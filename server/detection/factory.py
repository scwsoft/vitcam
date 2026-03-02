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
from rfdetr import RFDETRSmall, RFDETRMedium, RFDETRLarge, RFDETRBase, RFDETRNano
from config.settings import settings
from supabase import create_client, Client
from ultralytics import YOLO

logger = logging.getLogger(__name__)

class CameraPredictorFactory:
    """Factory for creating camera predictors with shared model resources"""
    
    _model_instance = None
    _model_lock = asyncio.Lock()
    
    @classmethod
    async def get_shared_model(cls) -> Dict[str, Any]:
        """
        Get or create shared model instance
        
        Returns:
            Dictionary with shared model resources
        """
        if cls._model_instance is None:
            async with cls._model_lock:
                if cls._model_instance is None:
                    cls._model_instance = await cls._initialize_model()
        return cls._model_instance
    
    @classmethod
    async def _initialize_model(cls) -> Dict[str, Any]:
        """
        Initialize the shared detection model
        
        Returns:
            Dictionary with model, processor, and annotators
        """

        try:
            
            device = None
            model = None
            
            if torch.cuda.is_available(): device = "cuda"
            elif torch.backends.mps.is_available(): device = "mps"
            else : device ="cpu"
          
            if settings.MODEL_SIZE == "Large":
                model = RFDETRLarge(device=device)
                model.optimize_for_inference(compile=False) 
            elif settings.MODEL_SIZE == "Medium": 
                model = RFDETRMedium(device=device)
                model.optimize_for_inference(compile=False) 

            elif settings.MODEL_SIZE == "Small": 
                model = RFDETRSmall(device=device)
                model.optimize_for_inference(compile=False) 

            elif settings.MODEL_SIZE == "Nano": 
                model = RFDETRNano(device=device)
                model.optimize_for_inference(compile=False) 
            
            elif settings.MODEL_SIZE == "Edge": 
                model = YOLO(f"{settings.MODEL_CHECKPOINT_PATH}")
                device = None

            elif settings.MODEL_SIZE == "Custom": 
                model =  RFDETRMedium(device=device,
                          pretrain_weights=(f"{settings.MODEL_CHECKPOINT_PATH}"),
                          pretrained=True)
                model.optimize_for_inference(compile=False) 


            logger.info(f"Loading model {settings.MODEL_SIZE} on device: {device}")

            
            box_annotator = sv.BoxAnnotator(thickness=1)
            label_annotator = sv.LabelAnnotator(text_scale=0.5, text_thickness=1)
            
            return {
                    'device': device,
                    'model': model,
                    'box_annotator': box_annotator,
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
        shared_model = await cls.get_shared_model()
        
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
