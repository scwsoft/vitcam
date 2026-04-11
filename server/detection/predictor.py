# ============================================================================
# FILE: detection/predictor.py
# ============================================================================
import time
import asyncio
import logging
import numpy as np
import torch
import supervision as sv
from PIL import Image
from typing import Dict, Any, Optional
from collections import deque
from datetime import datetime, timezone
from models.camera import CameraConfig
from config.settings import COCO_CLASS_NAMES,CUSTOM_CLASS_NAMES

import cv2
import io
import base64
from pathlib import Path
from config.settings import settings


logger = logging.getLogger(__name__)


class CameraPredictor:
    """Base camera predictor for object detection"""
    
    def __init__(self, camera_config: CameraConfig, shared_model: Dict[str, Any]):
        """
        Initialize camera predictor
        
        Args:
            camera_config: Camera configuration
            shared_model: Shared model resources
        """
        self.camera_config = camera_config
        self.device = shared_model['device']
        self.model = shared_model['model']
        self.model_size = camera_config.modelsize
        # self.processor = shared_model['processor']
        self.annotator = shared_model['annotator']
        self.label_annotator = shared_model['label_annotator']
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def update_config(self, camera_config: CameraConfig):
        """
        Update camera configuration
        
        Args:
            camera_config: New camera configuration
        """
        self.camera_config = camera_config
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    
    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Perform object detection on frame
        
        Args:
            frame: Input frame
            
        Returns:
            Annotated frame
        """
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame
            
        try:
            converted_image = Image.fromarray(frame)
            detections = self.model.predict(converted_image, threshold=self.confidence_threshold)
            
          # Filter by detection classes
            if len(self.detection_classes)>1:
               detections = detections[np.isin(detections.class_id,  list(self.detection_classes))]
             

            
            labels = []
            for class_id, confidence in zip(detections.class_id, detections.confidence):
                class_name =  COCO_CLASS_NAMES[class_id] if self.model_size != "Custom" else CUSTOM_CLASS_NAMES[class_id]
                labels.append(f"{class_name} {confidence:.2f}")
            
            annotated_frame = frame.copy()
            annotated_frame = self.annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)
            
            return annotated_frame
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return frame


def _iou_nms(
    boxes: np.ndarray,
    scores: np.ndarray,
    iou_threshold: float,
) -> np.ndarray:
    """
    Module-level greedy IoU NMS on a pre-sorted (descending score) array of boxes.
    Returns an int array of surviving indices into `boxes`.
    """
    if len(boxes) == 0:
        return np.array([], dtype=np.int32)

    x1    = boxes[:, 0]; y1 = boxes[:, 1]
    x2    = boxes[:, 2]; y2 = boxes[:, 3]
    areas = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)

    surviving  = []
    suppressed = np.zeros(len(boxes), dtype=bool)

    for i in range(len(boxes)):
        if suppressed[i]:
            continue
        surviving.append(i)
        ix1   = np.maximum(x1[i], x1[i + 1:])
        iy1   = np.maximum(y1[i], y1[i + 1:])
        ix2   = np.minimum(x2[i], x2[i + 1:])
        iy2   = np.minimum(y2[i], y2[i + 1:])
        inter = np.maximum(0.0, ix2 - ix1) * np.maximum(0.0, iy2 - iy1)
        union = areas[i] + areas[i + 1:] - inter
        iou   = np.where(union > 0, inter / union, 0.0)
        suppressed[i + 1:][iou > iou_threshold] = True

    return np.array(surviving, dtype=np.int32)


class CameraPredictorWithAnalytics(CameraPredictor):
    """
    Enhanced camera predictor with a deliberately split pipeline:

        ┌──────────────────────────────────────────────────────┐
        │  Model inference  →  filter/NMS  →  detections       │
        │         │                                │            │
        │         ▼                                ▼            │
        │   DeepSORT tracking             Annotate frame        │
        │   (analytics only)              (returned to caller)  │
        │         │                                             │
        │         ▼                                             │
        │   _log_tracked_detections                             │
        │   (image saving, DB inserts/updates)                  │
        └──────────────────────────────────────────────────────┘

    The annotated frame is always drawn from the *model* detection boxes so
    the visualisation is stable and frame-accurate.  DeepSORT tracker IDs are
    used exclusively for de-duplicating analytics events and saving per-object
    detection images.
    """

    # Tune once here; referenced throughout the class
    NMS_IOU_THRESHOLD: float = 0.35   # tighter than original 0.50
    MIN_CONFIDENCE:    float = 0.50   # raised from original 0.45

    def __init__(
        self,
        camera_config: CameraConfig,
        shared_model: Dict[str, Any],
        analytics_manager,
        supabase_client=None,
        save_detection_images: bool = True,
        image_quality: int = 85,
        storage_bucket: str = "detection-images",
        frame_color_format: str = "BGR",
    ):
        super().__init__(camera_config, shared_model)
        self.analytics_manager     = analytics_manager
        self.session_id            = None
        self.supabase_client       = supabase_client
        self.save_detection_images = save_detection_images
        self.image_quality         = max(1, min(100, image_quality))
        self.storage_bucket        = storage_bucket
        self.frame_color_format    = frame_color_format.upper()
        self.camera_config = camera_config
        self.device = shared_model['device']
        self.model = shared_model['model']
        self.model_size = camera_config.modelsize

        # self.processor = shared_model['processor']
        self.bannotator = shared_model['annotator']
        self.label_annotator = shared_model['label_annotator']
        self.detection_classes = set(camera_config.detection_classes)
        self.confidence_threshold = camera_config.odthreshold / 100.0
    

        # ── Tracker initialisation ────────────────────────────────────────────
        try:
            from deep_sort_realtime.deepsort_tracker import DeepSort
            self.tracker = DeepSort(
                max_age=50,
                n_init=3,
                nms_max_overlap=0.1,
                max_cosine_distance=0.3,
                nn_budget=100,
                embedder="mobilenet",
                half=True,
                bgr=True,
                embedder_gpu=True,
                embedder_model_name=None,
                embedder_wts=None,
                polygon=False,
                today=None,
            )
            logger.info(
                f"DeepSORT tracker initialised for camera: {camera_config.name} "
                "(using deep-sort-realtime)"
            )
            self.tracker_type = "DeepSORT"

        except ImportError as e:
            logger.error(f"DeepSORT not available: {e}")
            try:
                from supervision import ByteTrack
                self.tracker = ByteTrack(
                    track_activation_threshold=0.25,
                    lost_track_buffer=50,
                    minimum_matching_threshold=0.8,
                    frame_rate=camera_config.fps,
                )
                logger.info(f"ByteTrack fallback initialised for camera: {camera_config.name}")
                self.tracker_type = "ByteTrack"
            except Exception as fallback_error:
                self.tracker      = None
                self.tracker_type = "None"
                logger.warning(f"Tracking unavailable for {camera_config.name}: {fallback_error}")

        except Exception as e:
            self.tracker      = None
            self.tracker_type = "None"
            logger.warning(f"Tracking unavailable for {camera_config.name}: {e}")

        # ── State ─────────────────────────────────────────────────────────────
        self.tracked_objects:    Dict[int, Dict] = {}
        self.track_history:      deque           = deque(maxlen=1000)
        self.logged_tracker_ids: set             = set()

        logger.info(
            f"CameraPredictorWithAnalytics ready – camera: {camera_config.name}, "
            f"tracker: {self.tracker_type}, image saving: {save_detection_images}"
        )

    # ── Public helpers ────────────────────────────────────────────────────────

    def set_session_id(self, session_id: str):
        self.session_id = session_id

    def set_image_saving(self, enabled: bool):
        self.save_detection_images = enabled
        logger.info(
            f"Image saving {'enabled' if enabled else 'disabled'} "
            f"for camera: {self.camera_config.name}"
        )

    def get_tracking_statistics(self) -> Dict[str, Any]:
        return {
            "tracker_type":           self.tracker_type,
            "total_tracked_objects":  len(self.tracked_objects),
            "total_logged_objects":   len(self.logged_tracker_ids),
            "active_tracks": len(
                [t for t in self.tracked_objects.values()
                 if time.time() - t.get("last_seen", 0) < 5]
            ),
            "tracked_objects":        self.tracked_objects,
            "recent_history":         list(self.track_history)[-50:],
            "image_saving_enabled":   self.save_detection_images,
        }

    def reset_tracker(self):
        if self.tracker:
            if self.tracker_type == "DeepSORT":
                try:
                    if hasattr(self.tracker, "delete_all_tracks"):
                        self.tracker.delete_all_tracks()
                except Exception as e:
                    logger.error(f"Error resetting DeepSort: {e}")
            elif self.tracker_type == "ByteTrack":
                try:
                    self.tracker.reset()
                except Exception as e:
                    logger.error(f"Error resetting ByteTrack: {e}")

        self.tracked_objects.clear()
        self.track_history.clear()
        self.logged_tracker_ids.clear()
        logger.info(f"Tracker reset for camera: {self.camera_config.name}")

    def clear_logged_tracker_ids(self):
        self.logged_tracker_ids.clear()
        logger.info(f"Cleared logged tracker IDs for camera: {self.camera_config.name}")

    # ── Core prediction ───────────────────────────────────────────────────────

    def predict_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Run detection + tracking and return an annotated frame.

        TWO INDEPENDENT OUTPUTS from a single inference
        ------------------------------------------------
        detections         – raw model boxes, after filtering + class-aware NMS.
                             These drive the *annotated frame* returned to the caller.

        tracked_detections – DeepSORT-confirmed boxes with stable tracker IDs.
                             These drive *analytics only* (image saving, DB logging).
                             They are never used to draw anything on the frame.

        This separation means:
          • Visualised boxes are always frame-accurate (no tracker lag/jitter).
          • Analytics fire exactly once per new object and update correctly on
            subsequent frames without ID-switch artefacts.
          • The DeepSORT embedder always sees clean pixels (unannotated frame).
        """
        if not self.camera_config.is_detection or not self.detection_classes:
            return frame

        try:
            # ── 1. Model inference ────────────────────────────────────────────
            converted_image = Image.fromarray(frame)
           
            if self.camera_config.modelsize =="Edge":
                
              result = self.model(converted_image)[0]
              detections = sv.Detections.from_ultralytics(result)

            else : detections = self.model.predict(
             converted_image, threshold=self.confidence_threshold
            
            )

            # ── 2. Class filter + confidence floor ────────────────────────────
            if self.detection_classes:
                detections = detections[
                    np.isin(detections.class_id, list(self.detection_classes))
                ]
            detections = detections[detections.confidence >= self.confidence_threshold]

            # # ── 3. Degenerate-box filter (w/h > 2 px) ────────────────────────
            # if len(detections) > 0:
            #     boxes = detections.xyxy
            #     valid = (
            #         (boxes[:, 2] - boxes[:, 0] > 2) &
            #         (boxes[:, 3] - boxes[:, 1] > 2)
            #     )
            #     detections = detections[valid]

            # # ── 4. Class-aware NMS ────────────────────────────────────────────
            # if len(detections) > 0:
            #     detections = self._class_aware_nms(
            #         detections, iou_threshold=self.NMS_IOU_THRESHOLD
            #     )

            # ── 5. Annotate frame using MODEL detections ──────────────────────
            #   Labels and boxes come entirely from the model; the tracker is
            #   not consulted here at all.
            # labels          = self._build_labels(detections)
            # annotated_frame = frame.copy()
            # annotated_frame = self.annotator.annotate(
            #     scene=annotated_frame, detections=detections
            # )
            # annotated_frame = self.label_annotator.annotate(
            #     scene=annotated_frame, detections=detections, labels=labels
            # )


            labels = []
            for class_id, confidence in zip(detections.class_id, detections.confidence):
                class_name =  COCO_CLASS_NAMES[class_id] if self.model_size != "Custom" else CUSTOM_CLASS_NAMES[class_id]
                labels.append(f"{class_name}")
            
            annotated_frame = frame.copy()
            annotated_frame = self.annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = self.label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)

            # ── 6. Run tracker on CLEAN frame → analytics only ────────────────
            #   Pass `frame` (not `annotated_frame`) so the DeepSORT embedder
            #   sees genuine pixels, not annotation paint.
            if len(detections) > 0 and self.analytics_manager:
                tracked_detections = self._run_tracker(detections, frame)
                if tracked_detections is not None and len(tracked_detections) > 0:
                    asyncio.create_task(
                        self._log_tracked_detections(tracked_detections, annotated_frame)
                    )

            return annotated_frame

        except Exception as e:
            import traceback
            logger.error(
                f"Error in predict_frame for camera {self.camera_config.name}: {e}"
            )
            logger.error(f"Traceback: {traceback.format_exc()}")
            return frame

    # ── Internal: tracking ────────────────────────────────────────────────────

    def _run_tracker(
        self,
        detections: "sv.Detections",
        frame: np.ndarray,
    ) -> Optional["sv.Detections"]:
        """
        Feed model detections into the configured tracker and return a
        sv.Detections object carrying stable tracker_ids.

        Returns None if tracking is unavailable or produces no confirmed tracks.

        IMPORTANT: `frame` must be the clean (unannotated) frame so that the
        DeepSORT appearance embedder captures genuine object features.
        """
        if not self.tracker or len(detections) == 0:
            return None

        if self.tracker_type == "DeepSORT":
            raw = []
            for i in range(len(detections.xyxy)):
                x1, y1, x2, y2 = map(float, detections.xyxy[i])
                raw.append((
                    [x1, y1, x2 - x1, y2 - y1],
                    float(detections.confidence[i]),
                    int(detections.class_id[i]),
                ))

            tracks = self.tracker.update_tracks(raw, frame=frame)

            t_boxes, t_conf, t_cls, t_ids = [], [], [], []
            for track in tracks:
                if not track.is_confirmed():
                    continue
                try:
                    conf = track.get_det_conf() if hasattr(track, "get_det_conf") else None
                    conf = float(conf) if conf is not None else 0.5
                except Exception:
                    conf = 0.5
                try:
                    cls = track.get_det_class() if hasattr(track, "get_det_class") else None
                    cls = int(cls) if cls is not None else 0
                except Exception:
                    cls = 0
                t_boxes.append(track.to_ltrb())
                t_conf.append(conf)
                t_cls.append(cls)
                t_ids.append(int(track.track_id))

            if not t_boxes:
                return None

            candidate = sv.Detections(
                xyxy=np.array(t_boxes,  dtype=np.float32),
                confidence=np.array(t_conf, dtype=np.float32),
                class_id=np.array(t_cls,   dtype=np.int32),
                tracker_id=np.array(t_ids,  dtype=np.int32),
            )

            # Post-tracking NMS: kills ID-switch duplicates, keeps older track
            return self._class_aware_nms(
                candidate,
                iou_threshold=self.NMS_IOU_THRESHOLD,
                preserve_tracker_id=True,
            )

        if self.tracker_type == "ByteTrack":
            try:
                return self.tracker.update_with_detections(detections)
            except Exception as e:
                logger.warning(f"ByteTrack update failed: {e}")
                return None

        return None

    # ── Internal: label building ──────────────────────────────────────────────

    def _build_labels(self, detections: "sv.Detections") -> list:
        """
        Build display labels from raw model detections only.
        No tracker IDs involved — purely class names from the model output.

        Note: Edge models use a 1-indexed class_id offset due to background class at index 0.
        """
        labels = []

        for class_id, _ in zip(detections.class_id, detections.confidence):
            try:
                class_id = int(class_id) if class_id is not None else 0
            except (TypeError, ValueError):
                class_id = 0

            labels.append(
                COCO_CLASS_NAMES[class_id] if self.model_size != "Custom" else CUSTOM_CLASS_NAMES[class_id]
                # if 0 <= class_id < len(COCO_CLASS_NAMES)
                # else f"class_{class_id}"
            )

        return labels

    # ── Internal: NMS helpers ─────────────────────────────────────────────────

    def _class_aware_nms(
        self,
        detections: "sv.Detections",
        iou_threshold: float = 0.35,
        preserve_tracker_id: bool = False,
    ) -> "sv.Detections":
        """
        Run NMS independently per class so that:
          • Boxes of different classes never suppress each other.
          • Boxes of the same class are deduplicated more aggressively than
            supervision's global with_nms().

        preserve_tracker_id=True (post-tracking pass):
            When two overlapping same-class tracks exist, the one with the
            lower (older) tracker_id wins — retaining the established track.
        """
        if len(detections) == 0:
            return detections

        boxes     = detections.xyxy
        scores    = detections.confidence
        class_ids = detections.class_id
        has_tid   = (
            hasattr(detections, "tracker_id")
            and detections.tracker_id is not None
            and len(detections.tracker_id) == len(boxes)
        )

        keep_indices: list = []

        for cls in np.unique(class_ids):
            cls_mask = np.where(class_ids == cls)[0]

            if preserve_tracker_id and has_tid:
                order = np.argsort(detections.tracker_id[cls_mask])   # oldest first
            else:
                order = np.argsort(scores[cls_mask])[::-1]             # highest conf first

            orig_indices = cls_mask[order]
            surviving    = _iou_nms(
                boxes[orig_indices], scores[orig_indices], iou_threshold
            )
            keep_indices.extend(orig_indices[surviving].tolist())

        keep_mask = np.array(sorted(keep_indices), dtype=np.int32)

        kwargs: Dict[str, Any] = dict(
            xyxy=detections.xyxy[keep_mask],
            confidence=detections.confidence[keep_mask],
            class_id=detections.class_id[keep_mask],
        )
        if has_tid:
            kwargs["tracker_id"] = detections.tracker_id[keep_mask]

        return sv.Detections(**kwargs)

    # ── Image storage ─────────────────────────────────────────────────────────

    async def _save_detection_image(
        self,
        frame: np.ndarray,
        tracker_id: int,
        class_name: str,
        bbox: list,
    ) -> Optional[str]:
        """
        Save a single-object detection image to Supabase Storage.

        `frame` is always the clean (unannotated) frame with only this object's
        bounding box drawn on top — never the multi-object display frame.
        """
        try:
            if self.supabase_client is None:
                logger.warning("Supabase client not configured, skipping image save")
                return None

            if not hasattr(self.supabase_client, "storage"):
                logger.error(
                    "Invalid Supabase client: missing 'storage' attribute. "
                    "Use create_client(url, key) from the supabase library."
                )
                return None

            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
            filename  = (
                f"{self.camera_config.name}/"
                f"{timestamp}_tracker{tracker_id}_{class_name}.jpg"
            )

            if len(frame.shape) == 3 and frame.shape[2] == 3:
                if self.frame_color_format == "RGB":
                    image_for_encoding = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                elif self.frame_color_format == "BGR":
                    image_for_encoding = frame
                else:
                    logger.warning(f"Unknown colour format '{self.frame_color_format}', assuming BGR")
                    image_for_encoding = frame
            else:
                image_for_encoding = frame

            is_success, buffer = cv2.imencode(
                ".jpg",
                image_for_encoding,
                [cv2.IMWRITE_JPEG_QUALITY, self.image_quality],
            )
            if not is_success:
                logger.error("Failed to encode frame to JPEG")
                return None

            try:
                self.supabase_client.storage.from_(self.storage_bucket).upload(
                    path=filename,
                    file=buffer.tobytes(),
                    file_options={"content-type": "image/jpeg"},
                )
                public_url = self.supabase_client.storage.from_(
                    self.storage_bucket
                ).get_public_url(filename)
                logger.info(f"Detection image saved: {filename}")
                return public_url

            except AttributeError as e:
                logger.error(f"Supabase client error: {e}")
                return None
            except Exception as e:
                logger.error(f"Failed to upload image to Supabase: {e}")
                return None

        except Exception as e:
            logger.error(f"Error saving detection image: {e}")
            return None

    # ── Analytics logging ─────────────────────────────────────────────────────

    async def _log_tracked_detections(
    self,
    tracked_detections: "sv.Detections",
    frame: np.ndarray,
):
        """
        Log tracker-confirmed detection events to the analytics buffer.

        `tracked_detections` comes from _run_tracker and carries stable
        tracker_ids.

        `frame` is always the clean (unannotated) frame. When saving a
        per-object image for a new tracker ID, only that single object's
        bounding box is drawn onto a copy of this clean frame — so the stored
        image never contains annotation paint from other objects.

        New tracker ID    → full insert event + optional isolated object image.
        Existing tracker ID → lightweight positional update, no image.

        Note: Edge models use a 1-indexed class_id offset due to background class at index 0.
        """
        try:
            current_time      = datetime.now(tz=timezone.utc)
            new_detections    = []
            update_detections = []

            n = len(tracked_detections.class_id) if hasattr(tracked_detections, "class_id") else 0

            for i in range(n):
                # ── Safe field extraction ─────────────────────────────────────
                try:
                    bbox = (
                        tracked_detections.xyxy[i]
                        if hasattr(tracked_detections, "xyxy") and len(tracked_detections.xyxy) > i
                        else [0, 0, 0, 0]
                    )
                except Exception as e:
                    logger.warning(f"bbox extraction failed for detection {i}: {e}")
                    bbox = [0, 0, 0, 0]

                try:
                    raw      = tracked_detections.class_id[i] if len(tracked_detections.class_id) > i else 0
                    class_id = int(raw) if raw is not None else 0
                except Exception as e:
                    logger.warning(f"class_id extraction failed for detection {i}: {e}")
                    class_id = 0

                try:
                    raw        = tracked_detections.confidence[i] if len(tracked_detections.confidence) > i else 0.5
                    confidence = float(raw) if raw is not None else 0.5
                except Exception as e:
                    logger.warning(f"confidence extraction failed for detection {i}: {e}")
                    confidence = 0.5

                try:
                    raw = (
                        tracked_detections.tracker_id[i]
                        if (
                            hasattr(tracked_detections, "tracker_id")
                            and tracked_detections.tracker_id is not None
                            and len(tracked_detections.tracker_id) > i
                        )
                        else None
                    )
                    tracker_id = int(raw) if raw is not None else None
                except Exception as e:
                    logger.warning(f"tracker_id extraction failed for detection {i}: {e}")
                    tracker_id = None

                if tracker_id is None:
                    continue

                class_name  = (
                    COCO_CLASS_NAMES[class_id] if self.model_size != "Custom" else CUSTOM_CLASS_NAMES[class_id]
                )

                # ── Update in-memory tracking state ───────────────────────────
                if tracker_id not in self.tracked_objects:
                    self.tracked_objects[tracker_id] = {
                        "class_id":    class_id,
                        "class_name":  class_name,
                        "first_seen":  time.time(),
                        "frame_count": 0,
                    }
                self.tracked_objects[tracker_id]["frame_count"] += 1
                self.tracked_objects[tracker_id]["last_seen"] = time.time()

                info = self.tracked_objects[tracker_id]
                track_metadata: Dict[str, Any] = {
                    "tracker_id":     tracker_id,
                    "first_seen":     info.get("first_seen"),
                    "frame_count":    info.get("frame_count", 0),
                    "track_duration": time.time() - info.get("first_seen", time.time()),
                }

                is_new = tracker_id not in self.logged_tracker_ids

                # ── NEW object ────────────────────────────────────────────────
                if is_new:
                    self.logged_tracker_ids.add(tracker_id)

                    image_url = None
                    if self.save_detection_images and self.supabase_client:
                        try:
                            # Draw only this object's box on a clean frame copy
                            save_frame = frame.copy()
                            single_det = sv.Detections(
                                xyxy=np.array([bbox]),
                                confidence=np.array([confidence]),
                                class_id=np.array([class_id]),
                                tracker_id=np.array([tracker_id]),
                            )
                            save_frame = self.annotator.annotate(
                                scene=save_frame, detections=single_det
                            )
                            save_frame = self.label_annotator.annotate(
                                scene=save_frame,
                                detections=single_det,
                                labels=[f"{class_name} {confidence:.2f}"],
                            )
                            image_url = await self._save_detection_image(
                                frame=save_frame,
                                tracker_id=tracker_id,
                                class_name=class_name,
                                bbox=bbox,
                            )
                        except Exception as img_err:
                            logger.error(
                                f"[{self.camera_config.name}] Image save failed "
                                f"for tracker {tracker_id}: {img_err}"
                            )

                    new_detections.append({
                        "camera_id":         self.camera_config.id,
                        "camera_name":       self.camera_config.name,
                        "camera_url":        self.camera_config.url,
                        "timestamp":         current_time.isoformat(),
                        "object_class_id":   class_id,
                        "object_class_name": class_name,
                        "confidence":        confidence,
                        "bbox_x":      float(bbox[0]) if len(bbox) > 0 else 0.0,
                        "bbox_y":      float(bbox[1]) if len(bbox) > 1 else 0.0,
                        "bbox_width":  float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                        "bbox_height": float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                        "frame_width":  frame.shape[1] if len(frame.shape) > 1 else 0,
                        "frame_height": frame.shape[0],
                        "session_id":   self.session_id,
                        "tracker_id":   tracker_id,
                        "image_url":    image_url,
                        "detection_metadata": {
                            "model_threshold":    self.camera_config.odthreshold / 100.0,
                            "detection_classes":  self.camera_config.detection_classes,
                            "recording_active":   getattr(
                                self.camera_config, "recording_active", False
                            ),
                            "tracking_metadata":  track_metadata,
                            "is_first_detection": True,
                            "image_saved":        image_url is not None,
                        },
                    })

                    self.track_history.append({
                        "tracker_id": tracker_id,
                        "class_name": class_name,
                        "timestamp":  current_time.isoformat(),
                        "status":     "first_detected",
                        "image_url":  image_url,
                    })

                    logger.info(
                        f"New object – camera: {self.camera_config.name}, "
                        f"tracker: {tracker_id}, class: {class_name}, "
                        f"conf: {confidence:.2f}, image saved: {image_url is not None}"
                    )

                # ── EXISTING object: lightweight update ───────────────────────
                else:
                    update_detections.append({
                        "camera_id":  self.camera_config.id,
                        "tracker_id": tracker_id,
                        "timestamp":  current_time.isoformat(),
                        "confidence": confidence,
                        "bbox_x":      float(bbox[0]) if len(bbox) > 0 else 0.0,
                        "bbox_y":      float(bbox[1]) if len(bbox) > 1 else 0.0,
                        "bbox_width":  float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0.0,
                        "bbox_height": float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0.0,
                        "detection_metadata": {
                            "tracking_metadata":  track_metadata,
                            "is_first_detection": False,
                            "last_updated":       current_time.isoformat(),
                        },
                    })

                    self.track_history.append({
                        "tracker_id": tracker_id,
                        "class_name": class_name,
                        "timestamp":  current_time.isoformat(),
                        "status":     "updated",
                        "confidence": confidence,
                    })

                    logger.debug(
                        f"Object updated – camera: {self.camera_config.name}, "
                        f"tracker: {tracker_id}, class: {class_name}, "
                        f"conf: {confidence:.2f}"
                    )

            # ── Flush to analytics buffer ─────────────────────────────────────
            if new_detections:
                self.analytics_manager.detection_buffer.extend(new_detections)

            for upd in update_detections:
                upd["_is_update"] = True
                self.analytics_manager.detection_buffer.append(upd)

            now = time.time()
            buf = self.analytics_manager.detection_buffer
            if (
                len(buf) >= self.analytics_manager.buffer_size
                or now - self.analytics_manager.last_flush >= self.analytics_manager.flush_interval
            ):
                await self.analytics_manager._flush_detection_buffer()

        except Exception as e:
            if self.analytics_manager and self.analytics_manager.logging_manager:
                await self.analytics_manager.logging_manager.log_error(
                    f"Error logging tracked detection events: {e}",
                    category="DETECTION",
                    error=e,
                )