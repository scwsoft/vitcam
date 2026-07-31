# ============================================================================
# FILE: detection/factory.py
# ============================================================================
import asyncio
import logging
import torch
import supervision as sv
from typing import Dict, Any
from models.camera import CameraConfig
from detection.predictor import CameraPredictor, CameraPredictorWithAnalytics
from rfdetr import RFDETRSmall, RFDETRMedium, RFDETRLarge, RFDETRBase, RFDETRNano, RFDETRSegMedium, RFDETRSegSmall, RFDETRSegLarge,RFDETRSegNano
from config.settings import settings
from supabase import create_client

# onnxruntime powers the Edge backend (self-hosted ONNX models, e.g. on
# Raspberry Pi). Imported defensively so non-Edge deployments don't hard-require
# it; _build_onnx_session raises a clear error if an Edge camera needs it and
# it's missing.
try:
    import onnxruntime as ort
except ImportError:
    ort = None


logger = logging.getLogger(__name__)

class CameraPredictorFactory:
    """Factory for creating camera predictors with shared model resources"""
    
    _model_instance = None
    _model_lock = asyncio.Lock()
    
    @classmethod
    async def get_shared_model(cls, camera_config: CameraConfig) -> Dict[str, Any]:
        """
        Get or create shared model instance
        
        Returns:
            Dictionary with shared model resources
        """
        async with cls._model_lock:
                    cls._model_instance = await cls._initialize_model(camera_config)
        return cls._model_instance
    
    @classmethod
    async def _initialize_model(cls, camera_config:CameraConfig) -> Dict[str, Any]:
        """
        Initialize the shared detection model
        
        Returns:
            Dictionary with model, processor, and annotators
        """

        try:

            device = None
            model = None
            print(f" camera config: {camera_config}")

            if torch.cuda.is_available(): device = "cuda"
            elif torch.backends.mps.is_available(): device = "mps"
            else : device ="cpu"

            # ── Detection disabled: skip model + annotator loading ────────────
            # When is_detection is False the predictor returns the original
            # frame untouched, so there is no need to allocate the RF-DETR
            # model (or the annotators). This avoids the GPU/VRAM cost for
            # pass-through cameras.
            if not camera_config.is_detection:
                logger.info(
                    f"Detection disabled for camera '{camera_config.name}'; "
                    "skipping model load (frames pass through unannotated)."
                )
                return {
                    'device': device,
                    'model': None,
                    'annotator': None,
                    'label_annotator': None,
                }

            if camera_config.modelsize == "Large" and camera_config.detectiontype == 'BoundingBox':
                model = RFDETRLarge(device=device)
                model.optimize_for_inference(compile=False) 
            
            elif camera_config.modelsize  == "Medium" and camera_config.detectiontype == 'BoundingBox': 
                model = RFDETRMedium(device=device)
                model.optimize_for_inference(compile=False) 

            elif camera_config.modelsize  == "Small" and camera_config.detectiontype == 'BoundingBox':  
                model = RFDETRSmall(device=device)
                model.optimize_for_inference(compile=False) 

            elif camera_config.modelsize  == "Nano" and camera_config.detectiontype == 'BoundingBox': 
                model = RFDETRNano(device=device)
                model.optimize_for_inference(compile=False) 
            
            elif  camera_config.modelsize  == "Custom" and camera_config.detectiontype == 'BoundingBox':  
                model =  RFDETRBase(device=device,
                          pretrain_weights=(f"{settings.MODEL_CHECKPOINT_PATH}"),
                          pretrained=True)
                model.optimize_for_inference(compile=False) 
            
            elif camera_config.modelsize == "Edge" and camera_config.detectiontype == 'BoundingBox':
                # Edge backend: self-hosted ONNX model served via ONNX Runtime.
                # `model` becomes an onnxruntime.InferenceSession — the object
                # CameraPredictorWithAnalytics._predict_onnx drives (it calls
                # get_inputs()/run() on it). No Ultralytics/YOLO involved.
                model = cls._build_onnx_session(settings.MODEL_CHECKPOINT_PATH)
            
            
            if camera_config.modelsize == "Large" and camera_config.detectiontype == 'Segmentation':
                model = RFDETRSegLarge(device=device)
                model.optimize_for_inference(compile=False) 
            
            elif camera_config.modelsize  == "Medium" and camera_config.detectiontype == 'Segmentation': 
                model = RFDETRSegMedium(device=device)
                model.optimize_for_inference(compile=False) 

            elif camera_config.modelsize  == "Small" and camera_config.detectiontype == 'Segmentation':  
                model = RFDETRSegSmall(device=device)
                model.optimize_for_inference(compile=False) 

            elif camera_config.modelsize  == "Nano" and camera_config.detectiontype == 'Segmentation': 
                model = RFDETRSegNano(device=device)
                model.optimize_for_inference(compile=False) 

            elif camera_config.modelsize  == "Edge" and camera_config.detectiontype == 'Segmentation':
                # Edge segmentation: ONNX seg model. rfdetr's forward_export emits
                # dets + labels + masks, and CameraPredictorWithAnalytics._predict_onnx
                # reads the mask output and renders it via MaskAnnotator. Same
                # InferenceSession contract as the BoundingBox Edge branch.
                model = cls._build_onnx_session(settings.SEG_MODEL_CHECKPOINT_PATH)
            
        
            logger.info(f"Loading model {camera_config.modelsize} on device: {device}")

            if camera_config.detectiontype == "BoundingBox":
                annotator = sv.BoxAnnotator(thickness=1)
            else:
                annotator = sv.MaskAnnotator()
            
            label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
            
            return {
                    'device': device,
                    'model': model,
                    'annotator': annotator,
                    'label_annotator': label_annotator
                }
            
        except Exception as e:
            logger.error(f"Failed to initialize model: {e}")
            raise

    @staticmethod
    def _build_onnx_session(model_path: str):
        """
        Build an ONNX Runtime session for an Edge camera.

        Returns an ``onnxruntime.InferenceSession`` — the object that
        ``CameraPredictorWithAnalytics._predict_onnx`` expects as
        ``shared_model['model']`` (it reads get_inputs() and calls run() on it).

        Execution providers are selected from what's actually available at
        runtime, preferring hardware acceleration and always falling back to
        CPU (the common case on a Raspberry Pi).
        """
        if ort is None:
            raise ImportError(
                "onnxruntime is required for Edge (ONNX) cameras but is not "
                "installed. Install one of: `pip install onnxruntime` (CPU / "
                "Raspberry Pi), `onnxruntime-gpu` (CUDA), or "
                "`onnxruntime-openvino` (Intel)."
            )

        available = ort.get_available_providers()
        preferred = [
            "CUDAExecutionProvider",
            "OpenVINOExecutionProvider",
            "CPUExecutionProvider",
        ]
        providers = [p for p in preferred if p in available] or ["CPUExecutionProvider"]

        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        session = ort.InferenceSession(
            model_path, sess_options=sess_options, providers=providers
        )
        logger.info(
            f"Loaded ONNX Edge model '{model_path}' "
            f"(active providers: {session.get_providers()})"
        )
        return session

    @classmethod
    async def create_predictor(cls, camera_config: CameraConfig, 
                              analytics_manager=None) -> CameraPredictor:
        """
        Create camera predictor instance
        
        Args:
            camera_config: Camera configuration
            analytics_manager: Optional analytics manager for tracking
            menment        Returns:
            CameraPredictor instance
        """
        supabase = await cls.get_supabase_client()
        shared_model = await cls.get_shared_model(camera_config)
        
        if analytics_manager:
            return CameraPredictorWithAnalytics(camera_config, shared_model, 
                        analytics_manager,supabase_client=supabase, 
                        save_detection_images=True, image_quality=85,  
                        frame_color_format="BGR")
        else:
            return CameraPredictor(camera_config, shared_model)

    @classmethod
    async def get_supabase_client(cls):
        """Get Supabase client instance"""
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)