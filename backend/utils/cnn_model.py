"""
CNN Model integration using HuggingFace Spaces API.
Calls the deployed model at yashganatra-ipd.hf.space for X-ray diagnosis.
"""
import os
import requests
import json
import mimetypes
from pathlib import Path
from typing import Optional, Dict, List

from backend.config import settings
from backend.utils.logging_config import get_logger

logger = get_logger(__name__)

# X-ray condition labels from DenseNet121 trained model
XRAY_LABELS = [
    "Atelectasis", "Cardiomegaly", "Consolidation", "Edema", "Effusion",
    "Emphysema", "Fibrosis", "Hernia", "Infiltration", "Mass", "Nodule",
    "Pleural_Thickening", "Pneumonia", "Pneumothorax"
]

# HuggingFace Space configuration
HF_SPACE = "yashganatra-ipd"
HF_BASE_URL = "https://yashganatra-ipd.hf.space"

# Ensure directories exist
HEATMAP_FOLDER = settings.data_dir.parent / "static" / "heatmaps"
UPLOADS_FOLDER = settings.data_dir.parent / "static" / "uploads"
HEATMAP_FOLDER.mkdir(parents=True, exist_ok=True)
UPLOADS_FOLDER.mkdir(parents=True, exist_ok=True)

logger.info(f"✅ Using HuggingFace Space: {HF_SPACE} -> {HF_BASE_URL}")


def call_huggingface_model(image_path: str) -> Optional[Dict]:
    """
    Call HuggingFace Space model API with multiple request patterns for compatibility.
    
    Args:
        image_path: Path to X-ray image file
        
    Returns:
        Dict with parsed prediction results or None on failure
    """
    url = HF_BASE_URL.rstrip("/") + "/run/predict"
    mime = mimetypes.guess_type(image_path)[0] or "application/octet-stream"
    
    attempts = []
    attempts_details = []
    
    # Pattern A: Gradio-style with data JSON + numbered file
    try:
        with open(image_path, "rb") as f:
            files = {
                "data": (None, json.dumps([None])),
                "data_0": (os.path.basename(image_path), f, mime),
            }
            logger.info(f"📤 Posting to {url} using Pattern A (Gradio)...")
            r = requests.post(url, files=files, timeout=60)
            attempts.append((r.status_code, r.text[:1000]))
            attempts_details.append({
                "url": url,
                "pattern": "A-Gradio",
                "status": r.status_code,
                "text": r.text[:5000]
            })
            if r.ok:
                try:
                    resp = r.json()
                except Exception:
                    resp = r.text
                parsed = _parse_space_response(resp)
                if parsed:
                    logger.info(f"✅ Pattern A succeeded")
                    return parsed
    except Exception as e:
        logger.warning(f"⚠️ Pattern A failed: {e}")
    
    # Pattern B: Simple file upload to /predict with 'image' key
    try:
        predict_url = HF_BASE_URL.rstrip("/") + "/predict"
        with open(image_path, "rb") as f:
            files = {"image": (os.path.basename(image_path), f, mime)}
            logger.info(f"📤 Posting to {predict_url} using Pattern B (image key)...")
            r = requests.post(predict_url, files=files, timeout=60)
            attempts.append((r.status_code, r.text[:1000]))
            attempts_details.append({
                "url": predict_url,
                "pattern": "B-image",
                "status": r.status_code,
                "text": r.text[:5000]
            })
            if r.ok:
                try:
                    resp = r.json()
                except Exception:
                    resp = r.text
                parsed = _parse_space_response(resp)
                if parsed:
                    logger.info(f"✅ Pattern B (image) succeeded")
                    return parsed
    except Exception as e:
        logger.warning(f"⚠️ Pattern B (image) failed: {e}")
    
    # Pattern C: Simple file upload to /predict with 'file' key
    try:
        predict_url = HF_BASE_URL.rstrip("/") + "/predict"
        with open(image_path, "rb") as f:
            files = {"file": (os.path.basename(image_path), f, mime)}
            logger.info(f"📤 Posting to {predict_url} using Pattern C (file key)...")
            r = requests.post(predict_url, files=files, timeout=60)
            attempts.append((r.status_code, r.text[:1000]))
            attempts_details.append({
                "url": predict_url,
                "pattern": "C-file",
                "status": r.status_code,
                "text": r.text[:5000]
            })
            if r.ok:
                try:
                    resp = r.json()
                except Exception:
                    resp = r.text
                parsed = _parse_space_response(resp)
                if parsed:
                    logger.info(f"✅ Pattern C (file) succeeded")
                    return parsed
    except Exception as e:
        logger.warning(f"⚠️ Pattern C (file) failed: {e}")
    
    # Pattern D: Fallback to /run/predict with 'file' key
    try:
        with open(image_path, "rb") as f:
            files = {"file": (os.path.basename(image_path), f, mime)}
            logger.info(f"📤 Posting to {url} using Pattern D (fallback)...")
            r = requests.post(url, files=files, timeout=60)
            attempts.append((r.status_code, r.text[:1000]))
            attempts_details.append({
                "url": url,
                "pattern": "D-fallback",
                "status": r.status_code,
                "text": r.text[:5000]
            })
            if r.ok:
                try:
                    resp = r.json()
                except Exception:
                    resp = r.text
                parsed = _parse_space_response(resp)
                if parsed:
                    logger.info(f"✅ Pattern D succeeded")
                    return parsed
    except Exception as e:
        logger.warning(f"⚠️ Pattern D failed: {e}")
    
    logger.error(f"❌ All HTTP attempts failed. Attempts summary: {attempts}")
    return {"_error": "all_attempts_failed", "attempts": attempts_details}


def _parse_space_response(resp) -> Optional[Dict]:
    """
    Normalize different HuggingFace Space response shapes into expected dict.
    
    Args:
        resp: Response from HF Space (dict, list, or string)
        
    Returns:
        Normalized dict with top_label, top_confidence, top3, gradcam_url
    """
    try:
        # Debug: Log raw response
        logger.info(f"🔍 Raw HF Space response type: {type(resp)}")
        logger.info(f"🔍 Raw HF Space response: {str(resp)[:500]}")
        
        # If response is a list, prefer first element
        if isinstance(resp, list) and len(resp) > 0:
            data = resp[0]
        elif isinstance(resp, dict):
            # Some spaces return {'data': [...]}
            if "data" in resp and isinstance(resp["data"], list) and len(resp["data"]) > 0:
                data = resp["data"][0]
            else:
                data = resp
        else:
            return None
        
        logger.info(f"🔍 Parsed data: {data}")
        
        # data should be a dict with 'predictions' key
        predictions = None
        gradcam_url = None
        if isinstance(data, dict):
            predictions = data.get("predictions") or data.get("prediction") or data.get("preds")
            gradcam_url = data.get("gradcam_url") or data.get("gradcam") or data.get("heatmap_url")
        
        logger.info(f"🔍 GradCAM URL from HF Space: {gradcam_url}")
        
        if not predictions:
            return None
        
        # Convert mapping to list of tuples if necessary
        if isinstance(predictions, dict):
            sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)[:3]
        elif isinstance(predictions, list):
            # already list of (label, score) pairs
            sorted_preds = predictions[:3]
        else:
            return None
        
        top_label, top_confidence = sorted_preds[0]
        
        # Make gradcam URL absolute if needed
        gradcam_full = None
        if gradcam_url:
            if not str(gradcam_url).startswith("http"):
                gradcam_full = HF_BASE_URL.rstrip("/") + "/" + str(gradcam_url).lstrip("/")
            else:
                gradcam_full = gradcam_url
            logger.info(f"✅ Final GradCAM URL: {gradcam_full}")
        else:
            logger.warning("⚠️ No GradCAM URL found in response")
        
        return {
            "top_label": top_label,
            "top_confidence": float(top_confidence),
            "top3": sorted_preds,
            "gradcam_url": gradcam_full,
        }
    except Exception as e:
        logger.error(f"⚠️ Error parsing response: {e}")
        return None


def predict_xray(image_path: str) -> Dict:
    """
    Run X-ray prediction using HuggingFace Space model.
    
    Args:
        image_path: Path to X-ray image file
        
    Returns:
        Dict with prediction results:
        - predicted_label: Top predicted condition
        - confidence: Confidence score (0-1)
        - all_predictions: List of (label, probability) for top conditions
        - gradcam_path: URL to GradCAM visualization (from HF Space)
    """
    try:
        logger.info(f"🔬 Running X-ray prediction for: {image_path}")
        prediction = call_huggingface_model(image_path)
        
        # Check for failure
        if isinstance(prediction, dict) and prediction.get("_error") == "all_attempts_failed":
            logger.error(f"❌ Model HTTP attempts failed: {prediction.get('attempts')}")
            return {
                "predicted_label": "Model Not Available",
                "confidence": 0.0,
                "all_predictions": [],
                "gradcam_path": None,
                "error": "HuggingFace Space API unavailable"
            }
        
        if not prediction:
            return {
                "predicted_label": "Model Not Available",
                "confidence": 0.0,
                "all_predictions": [],
                "gradcam_path": None,
                "error": "Model inference failed"
            }
        
        # Validate expected keys
        if not all(k in prediction for k in ("top_label", "top_confidence", "top3")):
            logger.error(f"❌ Unexpected prediction shape: {prediction}")
            return {
                "predicted_label": "Error",
                "confidence": 0.0,
                "all_predictions": [],
                "gradcam_path": None,
                "error": "Unexpected model response"
            }
        
        logger.info(f"✅ X-ray prediction: {prediction['top_label']} ({prediction['top_confidence']:.2%})")
        
        return {
            "predicted_label": prediction["top_label"],
            "confidence": prediction["top_confidence"],
            "all_predictions": prediction["top3"],
            "gradcam_path": prediction.get("gradcam_url")
        }
        
    except Exception as e:
        logger.error(f"❌ X-ray prediction error: {e}")
        return {
            "predicted_label": "Error",
            "confidence": 0.0,
            "all_predictions": [],
            "gradcam_path": None,
            "error": str(e)
        }


def get_xray_labels() -> List[str]:
    """Get list of conditions the CNN can detect."""
    return XRAY_LABELS.copy()
