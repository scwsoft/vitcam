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
from supabase import create_client, Client
from ultralytics import YOLO


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
            
            elif  camera_config.modelsize  == "Custom" and camera_config.detectiontype == 'Segmentation':  
                model =  RFDETRSegMedium(device=device,
                          pretrain_weights=(f"{settings.MODEL_CHECKPOINT_PATH}"),
                          pretrained=False)
                model.optimize_for_inference(compile=False) 

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
