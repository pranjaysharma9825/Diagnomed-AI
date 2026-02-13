"""
FastAPI main application for the DDX Diagnostic System.
Unified backend integrating DDX multi-agent with DiagnoMed CNN.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict
import sys
import json
import uuid
import shutil
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import settings
from backend.utils.logging_config import get_logger, logger
from backend.models.patient import PatientCase as PatientCasePydantic, PatientProfile, PatientDemographics, SymptomReport
from backend.models.diagnosis import DiagnosticState, DiagnosisResult
from backend.priors.epidemiology import get_epidemiological_priors
from backend.priors.genphire import get_genomic_risk_engine
from backend.priors.symptom_disease_map import get_symptom_disease_mapper
from backend.models.database import SessionLocal, PatientCase, init_db

app_logger = get_logger(__name__)

# Static file directories
STATIC_DIR = settings.data_dir.parent / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
HEATMAPS_DIR = STATIC_DIR / "heatmaps"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    app_logger.info("Starting DDX Diagnostic System...")
    
    # Initialize components
    try:
        init_db()
        epi_priors = get_epidemiological_priors()
        genomic_engine = get_genomic_risk_engine()
        symptom_mapper = get_symptom_disease_mapper()
        app_logger.info("All components initialized successfully")
    except Exception as e:
        app_logger.error(f"Failed to initialize components: {e}")
    
    yield
    
    app_logger.info("Shutting down DDX Diagnostic System...")


app = FastAPI(
    title=settings.app_name,
    description="Agentic Closed-Loop Clinical Diagnostic System with CNN X-ray Analysis",
    version="0.2.0",
    lifespan=lifespan
)

# CORS middleware - Production ready
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://diagnomed-ai.vercel.app",  # Production frontend
        "http://localhost:5173",  # Local development
        "http://localhost:3000",# Alternative local port
        "https://diagnomed-ai.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ============================================================================
# Health Check Endpoint (for Render monitoring)
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring services."""
    return {
        "status": "healthy",
        "service": "DiagnoMed AI",
        "version": "0.2.0"
    }


# ============================================================================
# Request/Response Models
# ============================================================================

class SymptomInput(BaseModel):
    symptoms: List[str]
    region: str = "Global"
    age: int = 40
    sex: str = "male"


class DiagnosisInitResponse(BaseModel):
    session_id: str
    initial_candidates: List[dict]
    priors_applied: bool
    message: str


class TestResultInput(BaseModel):
    session_id: str
    test_id: str
    result: str


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "debug": settings.debug
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "message": "DDX Diagnostic System API",
        "version": "0.2.0",
        "docs": "/docs"
    }


# ============================================================================
# Prior Integration Endpoints
# ============================================================================

@app.get("/api/priors/epidemiology")
async def get_epi_priors(region: str = "Global", month: Optional[int] = None):
    """Get epidemiological disease priors for a region."""
    try:
        priors = get_epidemiological_priors()
        result = priors.get_priors(region=region, month=month)
        
        # Map IDs to names for frontend display
        mapper = get_symptom_disease_mapper()
        detailed_priors = {}
        for d_id, prob in result.items():
            name = mapper.get_disease_name(d_id) or d_id
            detailed_priors[name] = prob
            
        return {
            "region": region,
            "month": month,
            "priors": detailed_priors,
            "count": len(result)
        }
    except Exception as e:
        app_logger.error(f"Error getting epi priors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/priors/genomic")
async def get_genomic_risks(variants: List[str], population: str = "Global"):
    """Get disease risk modifiers based on genetic variants."""
    try:
        engine = get_genomic_risk_engine()
        result = engine.get_risk_modifiers(variants, population=population)
        return {
            "variants": variants,
            "population": population,
            "risk_modifiers": result,
            "count": len(result)
        }
    except Exception as e:
        app_logger.error(f"Error getting genomic risks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Symptom Matching Endpoints
# ============================================================================

@app.post("/api/symptoms/match")
async def match_symptoms(symptoms: List[str]):
    """Match symptom text to symptom IDs."""
    mapper = get_symptom_disease_mapper()
    results = []
    
    for symptom in symptoms:
        matched_id = mapper.match_symptom(symptom)
        results.append({
            "input": symptom,
            "symptom_id": matched_id,
            "matched": matched_id is not None
        })
    
    return {"matches": results}


@app.post("/api/diagnosis/candidates")
async def get_disease_candidates(input: SymptomInput):
    """
    Get disease candidates based on symptoms.
    Combines symptom-based matching with epidemiological and genomic priors.
    """
    try:
        # Get symptom-based candidates
        mapper = get_symptom_disease_mapper()
        candidates = mapper.get_candidates(input.symptoms, top_k=10)
        
        # Get epidemiological priors
        epi_priors = get_epidemiological_priors()
        priors = epi_priors.get_priors(region=input.region)
        
        # Adjust candidate probabilities with priors
        for candidate in candidates:
            disease_id = candidate['disease_id']
            if disease_id in priors:
                prior = priors[disease_id]
                prior_boost = min(prior * 10000, 2.0)
                candidate['prior_adjusted_prob'] = min(
                    candidate['base_probability'] * (1 + prior_boost),
                    0.95
                )
            else:
                candidate['prior_adjusted_prob'] = candidate['base_probability']
        
        candidates.sort(key=lambda x: x['prior_adjusted_prob'], reverse=True)
        
        return {
            "symptoms": input.symptoms,
            "region": input.region,
            "candidates": candidates,
            "count": len(candidates)
        }
    
    except Exception as e:
        app_logger.error(f"Error getting candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Patient Case Submission (DiagnoMed Integration)
# ============================================================================

@app.post("/api/patient/submit")
async def submit_patient_case(
    name: str = Form("Anonymous Patient"),
    symptoms: str = Form(""),
    age: Optional[int] = Form(None),
    sex: str = Form("unknown"),
    blood_type: str = Form("unknown"),
    region: str = Form("Global"),
    image: Optional[UploadFile] = File(None)
):
    """
    Submit patient case with symptoms and optional X-ray image.
    Runs DDX symptom analysis and CNN X-ray prediction.
    """
    db = SessionLocal()
    try:
        case_id = str(uuid.uuid4())
        image_url = None
        gradcam_url = None
        cnn_output = None
        cnn_confidence = None
        cnn_all_preds = None
        
        # Handle image upload
        if image and image.filename:
            ext = Path(image.filename).suffix
            image_filename = f"{case_id}{ext}"
            image_path = UPLOADS_DIR / image_filename
            
            with open(image_path, "wb") as f:
                shutil.copyfileobj(image.file, f)
            
            image_url = f"/static/uploads/{image_filename}"
            app_logger.info(f"Image saved: {image_path}")
            
            # Run CNN prediction
            try:
                from backend.utils.cnn_model import predict_xray
                result = predict_xray(str(image_path))
                cnn_output = result.get("predicted_label", "Unknown")
                cnn_confidence = result.get("confidence", 0.0)
                cnn_all_preds = json.dumps(result.get("all_predictions", []))
                
                if result.get("gradcam_path"):
                    gradcam_filename = Path(result["gradcam_path"]).name
                    gradcam_url = f"/static/heatmaps/{gradcam_filename}"
            except Exception as e:
                app_logger.warning(f"CNN prediction failed: {e}")
                cnn_output = "Model unavailable"
        
        # Get DDX symptom-based candidates
        ddx_candidates = []
        
        # Smart symptom extraction from paragraph or comma-separated list
        # Known symptom keywords to look for
        known_symptoms = [
            "fever", "headache", "cough", "fatigue", "joint_pain", "joint pain",
            "rash", "nausea", "vomiting", "diarrhea", "chills", "sweating",
            "chest_pain", "chest pain", "shortness_of_breath", "shortness of breath",
            "body_aches", "body aches", "sore_throat", "sore throat", "runny_nose",
            "runny nose", "muscle_pain", "muscle pain", "weakness", "appetite",
            "weight_loss", "weight loss", "night_sweats", "night sweats",
            "abdominal_pain", "abdominal pain", "bleeding", "bruising",
            "eye_pain", "eye pain", "skin_rash", "skin rash"
        ]
        
        # Normalize symptoms text
        symptoms_lower = symptoms.lower()
        
        # Extract matched symptoms
        symptom_list = []
        for symptom in known_symptoms:
            if symptom in symptoms_lower:
                # Normalize to underscore format
                normalized = symptom.replace(" ", "_")
                if normalized not in symptom_list:
                    symptom_list.append(normalized)
        
        # Fallback: try comma-split if no keywords matched
        if not symptom_list:
            symptom_list = [s.strip().lower().replace(" ", "_") for s in symptoms.split(",") if s.strip()]
        
        app_logger.info(f"Extracted symptoms: {symptom_list}")
        
        if symptom_list:
            mapper = get_symptom_disease_mapper()
            candidates = mapper.get_candidates(symptom_list, top_k=5)
            
            # Apply epidemiological priors
            epi = get_epidemiological_priors()
            priors = epi.get_priors(region=region)
            
            for c in candidates:
                if c['disease_id'] in priors:
                    c['epi_boost'] = priors[c['disease_id']] * 10000
                ddx_candidates.append(c)
        
        # Build analysis output
        analysis_parts = []
        if ddx_candidates:
            top3 = ddx_candidates[:3]
            analysis_parts.append("DDX Analysis: " + ", ".join(
                f"{c['name']} ({c['base_probability']:.0%})" for c in top3
            ))
        if cnn_output and cnn_output != "Model unavailable":
            analysis_parts.append(f"X-ray: {cnn_output} ({cnn_confidence:.0%})")
        
        analysis_output = " | ".join(analysis_parts) if analysis_parts else "Pending review"
        
        # Create patient case
        case = PatientCase(
            id=case_id,
            patient_name=name,
            age=age,
            sex=sex,
            blood_type=blood_type,
            region=region,
            symptoms=symptoms,
            image_url=image_url,
            gradcam_url=gradcam_url,
            cnn_output=cnn_output,
            cnn_confidence=cnn_confidence,
            cnn_all_predictions=cnn_all_preds,
            ddx_candidates=json.dumps(ddx_candidates) if ddx_candidates else None,
            analysis_output=analysis_output,
            status="analyzed"
        )
        
        db.add(case)
        db.commit()
        db.refresh(case)
        
        app_logger.info(f"Patient case created: {case_id}")
        
        return {
            "success": True,
            "case_id": case_id,
            "cnn_output": cnn_output,
            "ddx_candidates": ddx_candidates[:3] if ddx_candidates else [],
            "message": "Case submitted and analyzed"
        }
        
    except Exception as e:
        db.rollback()
        app_logger.error(f"Error submitting case: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/api/doctor/cases")
async def get_doctor_cases():
    """Get all patient cases for doctor review."""
    db = SessionLocal()
    try:
        cases = db.query(PatientCase).order_by(PatientCase.created_at.desc()).all()
        return [case.to_dict() for case in cases]
    except Exception as e:
        app_logger.error(f"Error fetching cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/api/doctor/cases/{case_id}")
async def get_case_detail(case_id: str):
    """Get detailed patient case by ID."""
    db = SessionLocal()
    try:
        case = db.query(PatientCase).filter(PatientCase.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        return case.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Error fetching case: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/api/doctor/stats")
async def get_doctor_stats():
    """Get dashboard statistics for doctor."""
    db = SessionLocal()
    try:
        from sqlalchemy import func
        from datetime import datetime, timedelta
        
        total_patients = db.query(PatientCase).count()
        
        # Cases without analysis = pending
        pending = db.query(PatientCase).filter(
            (PatientCase.analysis_output == None) | (PatientCase.analysis_output == "")
        ).count()
        
        # Cases with analysis = completed
        completed = total_patients - pending
        
        # Activity: cases in last 7 days vs previous 7 days
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)
        
        this_week = db.query(PatientCase).filter(PatientCase.created_at >= week_ago).count()
        last_week = db.query(PatientCase).filter(
            PatientCase.created_at >= two_weeks_ago,
            PatientCase.created_at < week_ago
        ).count()
        
        if last_week > 0:
            activity_change = int(((this_week - last_week) / last_week) * 100)
        else:
            activity_change = 100 if this_week > 0 else 0
        
        return {
            "total_patients": total_patients,
            "pending_diagnoses": pending,
            "completed_reports": completed,
            "activity_change": f"+{activity_change}%" if activity_change >= 0 else f"{activity_change}%"
        }
    except Exception as e:
        app_logger.error(f"Error fetching stats: {e}")
        return {
            "total_patients": 0,
            "pending_diagnoses": 0,
            "completed_reports": 0,
            "activity_change": "0%"
        }
    finally:
        db.close()


@app.get("/api/doctor/diagnosis-distribution")
async def get_diagnosis_distribution():
    """Get distribution of diagnoses by category."""
    db = SessionLocal()
    try:
        cases = db.query(PatientCase).filter(PatientCase.analysis_output != None).all()
        
        # Count diagnoses by category
        category_counts = {}
        for case in cases:
            output = case.analysis_output or ""
            # Parse disease names from analysis output
            if "Dengue" in output or "Malaria" in output or "Typhoid" in output:
                cat = "Infectious"
            elif "Pneumonia" in output or "COVID" in output or "Influenza" in output:
                cat = "Respiratory"
            elif "Hypertension" in output or "Heart" in output:
                cat = "Cardiovascular"
            elif "Diabetes" in output:
                cat = "Metabolic"
            else:
                cat = "Other"
            
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        # Format for pie chart
        distribution = [
            {"name": name, "value": count}
            for name, count in category_counts.items()
        ]
        
        # Ensure we have some data for the chart
        if not distribution:
            distribution = [
                {"name": "Infectious", "value": 0},
                {"name": "Respiratory", "value": 0},
                {"name": "Other", "value": 0}
            ]
        
        return distribution
    except Exception as e:
        app_logger.error(f"Error fetching distribution: {e}")
        return [{"name": "Error", "value": 0}]
    finally:
        db.close()


# ============================================================================
# Treatment Recommendation Endpoints
# ============================================================================

@app.get("/api/treatment/{disease_id}")
async def get_treatment_recommendation(
    disease_id: str,
    severity: str = "moderate",
    contraindications: Optional[str] = None
):
    """
    Get treatment recommendation for a disease.
    
    Args:
        disease_id: Disease ID (e.g., D001, D002)
        severity: mild/moderate/severe
        contraindications: Comma-separated list of contraindicated drugs
    """
    try:
        from backend.services.treatment_recommender import get_treatment_recommender
        
        recommender = get_treatment_recommender()
        
        contra_list = None
        if contraindications:
            contra_list = [c.strip() for c in contraindications.split(",")]
        
        plan = recommender.get_treatment(disease_id, severity, contra_list)
        
        if not plan:
            raise HTTPException(
                status_code=404,
                detail=f"No treatment protocol for disease: {disease_id}"
            )
        
        return plan.model_dump()
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"Error getting treatment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/treatments/available")
async def get_available_treatments():
    """List all diseases with available treatment protocols."""
    from backend.services.treatment_recommender import get_treatment_recommender
    recommender = get_treatment_recommender()
    return {
        "disease_ids": recommender.get_all_disease_ids(),
        "count": len(recommender.get_all_disease_ids())
    }


# ============================================================================
# Evaluation Endpoints (for Research Paper)
# ============================================================================

@app.post("/api/evaluation/pareto/generate")
async def generate_pareto_evaluation(n_cases: int = 100):
    """Generate synthetic evaluation and compute Pareto metrics."""
    try:
        from backend.evaluation.pareto_evaluator import get_pareto_evaluator
        
        evaluator = get_pareto_evaluator()
        evaluator.cases.clear()  # Reset for fresh evaluation
        evaluator.generate_synthetic_cases(n_cases)
        report = evaluator.generate_report(save=True)
        
        return {
            "success": True,
            "n_cases": n_cases,
            "results": report
        }
    except Exception as e:
        app_logger.error(f"Pareto evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/evaluation/pareto/results")
async def get_pareto_results():
    """Get latest Pareto evaluation results."""
    try:
        from backend.evaluation.pareto_evaluator import get_pareto_evaluator
        
        evaluator = get_pareto_evaluator()
        if not evaluator.cases:
            return {"message": "No evaluation data. Call /generate first."}
        
        return evaluator.generate_report(save=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/evaluation/likert/generate")
async def generate_likert_evaluation(n_responses: int = 50):
    """Generate synthetic Likert survey and compute statistics."""
    try:
        from backend.evaluation.likert_survey import get_likert_evaluator
        
        evaluator = get_likert_evaluator()
        evaluator.responses.clear()  # Reset
        evaluator.generate_synthetic_responses(n_responses)
        report = evaluator.generate_report(save=True)
        
        return {
            "success": True,
            "n_responses": n_responses,
            "results": report
        }
    except Exception as e:
        app_logger.error(f"Likert evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/evaluation/likert/results")
async def get_likert_results():
    """Get latest Likert survey results."""
    try:
        from backend.evaluation.likert_survey import get_likert_evaluator
        
        evaluator = get_likert_evaluator()
        if not evaluator.responses:
            return {"message": "No survey data. Call /generate first."}
        
        return evaluator.generate_report(save=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/evaluation/likert/template")
async def get_likert_template():
    """Get Likert survey template for clinicians."""
    from backend.evaluation.likert_survey import LikertSurveyEvaluator
    return LikertSurveyEvaluator.get_survey_template()


# ============================================================================
# Interactive Diagnostic Loop Endpoints
# ============================================================================

# In-memory session storage (for demo purposes)
_diagnostic_sessions = {}

class StartDiagnosisRequest(BaseModel):
    symptoms: List[str]
    region: str = "Global"
    age: int = 40
    sex: str = "male"
    # Contextual features
    month: int = None  # For seasonal patterns (1-12)
    family_history: List[str] = []  # Disease IDs in family history
    genetic_variants: List[str] = []  # Genetic variant IDs (e.g., rs1800562)

class TestResultRequest(BaseModel):
    test_id: str
    result: str  # "positive" or "negative"

@app.post("/api/diagnosis/start")
async def start_diagnosis_session(request: StartDiagnosisRequest):
    """
    Start an interactive diagnostic session.
    Returns session ID and initial DDx candidates.
    Now includes contextual features: seasonal, genomic, family history.
    """
    try:
        import datetime
        session_id = str(uuid.uuid4())
        
        # Get symptom mapper and epidemiological priors
        mapper = get_symptom_disease_mapper()
        epi = get_epidemiological_priors()
        
        # Determine current month for seasonal patterns
        current_month = request.month or datetime.datetime.now().month
        
        # Get initial candidates
        candidates = mapper.get_candidates(request.symptoms, top_k=10)
        priors = epi.get_priors(region=request.region, month=current_month)
        
        # Track contextual modifiers applied for transparency
        contextual_factors = {
            "seasonal_applied": False,
            "genomic_applied": False,
            "family_history_applied": False,
            "region": request.region,
            "month": current_month
        }
        
        # 1. Apply epidemiological/seasonal priors
        for c in candidates:
            if c['disease_id'] in priors:
                seasonal_boost = priors[c['disease_id']] * 10000
                c['epi_boost'] = seasonal_boost
                c['base_probability'] = min(c['base_probability'] * 1.2, 0.95)
                contextual_factors["seasonal_applied"] = True
        
        # 2. Apply genomic risk modifiers
        if request.genetic_variants:
            try:
                genomic_engine = get_genomic_risk_engine()
                risk_mods = genomic_engine.get_risk_modifiers(request.genetic_variants)
                for c in candidates:
                    if c['disease_id'] in risk_mods:
                        modifier = risk_mods[c['disease_id']]
                        c['genomic_modifier'] = modifier
                        c['base_probability'] = min(c['base_probability'] * modifier, 0.95)
                        contextual_factors["genomic_applied"] = True
            except Exception as e:
                app_logger.warning(f"Genomic modifier error: {e}")
        
        # 3. Apply family history boost
        if request.family_history:
            for c in candidates:
                if c['disease_id'] in request.family_history:
                    c['family_history_match'] = True
                    c['base_probability'] = min(c['base_probability'] * 1.5, 0.95)
                    contextual_factors["family_history_applied"] = True
        
        # Re-normalize probabilities after all modifiers
        total_prob = sum(c['base_probability'] for c in candidates)
        if total_prob > 0:
            for c in candidates:
                c['base_probability'] = round(c['base_probability'] / total_prob, 3)
        
        # Sort by probability
        candidates.sort(key=lambda x: x['base_probability'], reverse=True)
        
        # Define available tests for each disease
        disease_tests = {
            "D001": [  # Dengue
                {"test_id": "T001", "name": "NS1 Antigen Test", "cost_usd": 25, "sensitivity": 0.85, "specificity": 0.95},
                {"test_id": "T002", "name": "Dengue IgM/IgG", "cost_usd": 35, "sensitivity": 0.90, "specificity": 0.85},
                {"test_id": "T003", "name": "Platelet Count", "cost_usd": 10, "sensitivity": 0.75, "specificity": 0.65},
            ],
            "D002": [  # Malaria
                {"test_id": "T004", "name": "Blood Smear", "cost_usd": 15, "sensitivity": 0.90, "specificity": 0.98},
                {"test_id": "T005", "name": "Rapid Malaria Test", "cost_usd": 20, "sensitivity": 0.85, "specificity": 0.90},
            ],
            "D003": [  # Typhoid
                {"test_id": "T006", "name": "Widal Test", "cost_usd": 15, "sensitivity": 0.70, "specificity": 0.80},
                {"test_id": "T007", "name": "Blood Culture", "cost_usd": 50, "sensitivity": 0.85, "specificity": 0.98},
            ],
            "D004": [  # Influenza
                {"test_id": "T008", "name": "Rapid Flu Test", "cost_usd": 30, "sensitivity": 0.70, "specificity": 0.95},
                {"test_id": "T009", "name": "PCR Respiratory Panel", "cost_usd": 150, "sensitivity": 0.98, "specificity": 0.99},
            ],
            "D005": [  # Pneumonia
                {"test_id": "T010", "name": "Chest X-Ray", "cost_usd": 50, "sensitivity": 0.80, "specificity": 0.85},
                {"test_id": "T011", "name": "Sputum Culture", "cost_usd": 40, "sensitivity": 0.75, "specificity": 0.95},
            ],
            "D006": [  # COVID-19
                {"test_id": "T012", "name": "RT-PCR COVID", "cost_usd": 60, "sensitivity": 0.95, "specificity": 0.99},
                {"test_id": "T013", "name": "Rapid Antigen Test", "cost_usd": 20, "sensitivity": 0.80, "specificity": 0.97},
            ],
            "D007": [  # Common Cold
                {"test_id": "T014", "name": "Clinical Exam Only", "cost_usd": 0, "sensitivity": 0.90, "specificity": 0.60},
            ],
        }
        
        # Get recommended tests based on top candidates
        recommended_tests = []
        for c in candidates[:3]:
            if c['disease_id'] in disease_tests:
                for test in disease_tests[c['disease_id']]:
                    if test not in recommended_tests:
                        test_copy = test.copy()
                        test_copy['for_disease'] = c['name']
                        test_copy['disease_id'] = c['disease_id']
                        recommended_tests.append(test_copy)
        
        # Store session
        _diagnostic_sessions[session_id] = {
            "session_id": session_id,
            "symptoms": request.symptoms,
            "region": request.region,
            "candidates": candidates,
            "recommended_tests": recommended_tests,
            "completed_tests": [],
            "test_results": {},
            "total_cost": 0,
            "status": "in_progress",
            "disease_tests": disease_tests,
            "contextual_factors": contextual_factors,  # Track what modifiers were applied
        }
        
        app_logger.info(f"Started diagnostic session: {session_id}")
        
        return {
            "session_id": session_id,
            "candidates": candidates,
            "recommended_tests": recommended_tests[:6],  # Top 6 tests
            "contextual_factors": contextual_factors,  # Show what factors were applied
            "message": "Diagnostic session started. Review candidates and order tests."
        }
        
    except Exception as e:
        app_logger.error(f"Error starting diagnosis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/diagnosis/{session_id}/status")
async def get_diagnosis_status(session_id: str):
    """Get current status of a diagnostic session."""
    if session_id not in _diagnostic_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _diagnostic_sessions[session_id]
    return {
        "session_id": session_id,
        "candidates": session["candidates"],
        "recommended_tests": session["recommended_tests"],
        "completed_tests": session["completed_tests"],
        "test_results": session["test_results"],
        "total_cost": session["total_cost"],
        "status": session["status"]
    }


@app.post("/api/diagnosis/{session_id}/test-result")
async def submit_test_result(session_id: str, request: TestResultRequest):
    """
    Submit a test result and update disease probabilities.
    Uses Bayesian updating based on test sensitivity/specificity.
    """
    if session_id not in _diagnostic_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _diagnostic_sessions[session_id]
    
    # Find the test
    test = None
    for t in session["recommended_tests"]:
        if t["test_id"] == request.test_id:
            test = t
            break
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found in recommendations")
    
    # Store result
    session["completed_tests"].append(request.test_id)
    session["test_results"][request.test_id] = {
        "test_name": test["name"],
        "result": request.result,
        "for_disease": test.get("for_disease", "Unknown")
    }
    session["total_cost"] += test["cost_usd"]
    
    # Bayesian update of probabilities
    is_positive = request.result.lower() in ["positive", "pos", "true", "yes", "1"]
    sensitivity = test.get("sensitivity", 0.80)
    specificity = test.get("specificity", 0.90)
    
    for candidate in session["candidates"]:
        prior = candidate["base_probability"]
        
        if candidate["disease_id"] == test.get("disease_id"):
            # This test is for this disease - major update
            if is_positive:
                # P(D|+) = (sens * prior) / (sens * prior + (1-spec) * (1-prior))
                likelihood_ratio = sensitivity / (1 - specificity)
                posterior = (likelihood_ratio * prior) / (likelihood_ratio * prior + (1 - prior))
            else:
                # P(D|-) = ((1-sens) * prior) / ((1-sens) * prior + spec * (1-prior))
                likelihood_ratio = (1 - sensitivity) / specificity
                posterior = (likelihood_ratio * prior) / (likelihood_ratio * prior + (1 - prior))
            
            candidate["base_probability"] = min(max(posterior, 0.01), 0.99)
            candidate["updated_by_test"] = test["name"]
        else:
            # Test is not for this disease - minor inverse effect
            if is_positive:
                # Positive for another disease slightly decreases this one
                candidate["base_probability"] = candidate["base_probability"] * 0.95
            # Negative tests for other diseases don't affect much
    
    # Re-sort by probability
    session["candidates"].sort(key=lambda x: x["base_probability"], reverse=True)
    
    # Re-normalize probabilities to sum to 1.0 (for clean display)
    total_prob = sum(c["base_probability"] for c in session["candidates"])
    if total_prob > 0:
        for c in session["candidates"]:
            c["base_probability"] = round(c["base_probability"] / total_prob, 3)
    
    # REFRESH RECOMMENDED TESTS based on new top candidates
    disease_tests = session["disease_tests"]
    new_recommended = []
    for c in session["candidates"][:3]:  # Top 3 candidates
        if c['disease_id'] in disease_tests:
            for test in disease_tests[c['disease_id']]:
                # Skip already completed tests
                if test["test_id"] not in session["completed_tests"]:
                    if not any(t["test_id"] == test["test_id"] for t in new_recommended):
                        test_copy = test.copy()
                        test_copy['for_disease'] = c['name']
                        test_copy['disease_id'] = c['disease_id']
                        new_recommended.append(test_copy)
    session["recommended_tests"] = new_recommended
    
    # Check if we have a confident diagnosis
    top_prob = session["candidates"][0]["base_probability"] if session["candidates"] else 0
    if top_prob >= 0.70:  # Lowered threshold since we're normalizing
        session["status"] = "high_confidence"
    
    app_logger.info(f"Test result submitted: {test['name']} = {request.result}")
    
    return {
        "session_id": session_id,
        "test_submitted": test["name"],
        "result": request.result,
        "updated_candidates": session["candidates"],
        "recommended_tests": session["recommended_tests"],  # Include updated tests
        "total_cost": session["total_cost"],
        "status": session["status"],
        "message": f"Probabilities updated based on {test['name']} result"
    }


@app.get("/api/diagnosis/{session_id}/result")
async def get_diagnosis_result(session_id: str, contraindications: Optional[str] = None):
    """Get final diagnosis result with treatment, report, and trustworthiness data."""
    if session_id not in _diagnostic_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _diagnostic_sessions[session_id]
    top_candidate = session["candidates"][0] if session["candidates"] else None
    
    # Get treatment for top diagnosis
    treatment = None
    if top_candidate:
        try:
            from backend.services.treatment_recommender import get_treatment_recommender
            recommender = get_treatment_recommender()
            
            # Parse contraindications if provided
            contra_list = [c.strip() for c in contraindications.split(",")] if contraindications else []
            
            plan = recommender.get_treatment(
                disease_id=top_candidate["disease_id"], 
                severity="moderate",
                contraindications=contra_list
            )
            if plan:
                treatment = plan.model_dump()
        except Exception as e:
            app_logger.warning(f"Could not get treatment: {e}")
    
    # =========================================================================
    # TRUSTWORTHINESS FEATURES
    # =========================================================================
    
    # 1. Calculate overall confidence score
    top_prob = top_candidate["base_probability"] if top_candidate else 0
    num_tests = len(session["test_results"])
    
    # Confidence based on: probability, number of tests, agreement between symptoms and tests
    test_agreement = sum(1 for t in session["test_results"].values() if t["result"] == "positive") / max(num_tests, 1)
    confidence_score = min(0.95, (top_prob * 0.5) + (min(num_tests, 3) * 0.1) + (test_agreement * 0.2))
    
    if confidence_score >= 0.70:
        confidence_level = "High"
    elif confidence_score >= 0.45:
        confidence_level = "Medium"
    else:
        confidence_level = "Low"
    
    # 2. Generate evidence table
    evidence = []
    for symptom in session.get("symptoms", []):
        symptom_name = symptom.replace("_", " ").title()
        if top_candidate:
            evidence.append({
                "factor": f"Symptom: {symptom_name}",
                "supports": top_candidate["name"],
                "weight": round(0.7 + (0.2 * (1 if symptom in ["fever", "headache"] else 0.5)), 2),
                "type": "symptom"
            })
    
    for test_id, test_info in session["test_results"].items():
        evidence.append({
            "factor": f"Test: {test_info['test_name']}",
            "supports": test_info["for_disease"] if test_info["result"] == "positive" else f"Not {test_info['for_disease']}",
            "weight": 0.9 if test_info["result"] == "positive" else 0.3,
            "result": test_info["result"],
            "type": "test"
        })
    
    # 3. Generate reasoning chain
    reasoning_chain = []
    symptoms_list = session.get("symptoms", [])
    if symptoms_list:
        reasoning_chain.append(f"Step 1: Patient presented with {len(symptoms_list)} symptoms: {', '.join(s.replace('_', ' ') for s in symptoms_list[:4])}")
    
    if session["candidates"]:
        top_3 = [c["name"] for c in session["candidates"][:3]]
        reasoning_chain.append(f"Step 2: Initial differential diagnosis included: {', '.join(top_3)}")
    
    if num_tests > 0:
        positive_tests = [t["test_name"] for t in session["test_results"].values() if t["result"] == "positive"]
        negative_tests = [t["test_name"] for t in session["test_results"].values() if t["result"] == "negative"]
        
        if positive_tests:
            reasoning_chain.append(f"Step 3: Positive results from: {', '.join(positive_tests)} increased confidence in diagnosis")
        if negative_tests:
            reasoning_chain.append(f"Step 4: Negative results from: {', '.join(negative_tests)} helped rule out other conditions")
    
    if top_candidate:
        reasoning_chain.append(f"Step {len(reasoning_chain)+1}: Based on symptom pattern and test results, {top_candidate['name']} identified as most likely diagnosis with {int(top_prob * 100)}% probability")
    
    # 4. Uncertainty factors
    uncertainty_factors = []
    if num_tests < 2:
        uncertainty_factors.append("Limited test data - more tests could improve accuracy")
    if top_prob < 0.5:
        uncertainty_factors.append("No single diagnosis has strong probability - consider additional evaluation")
    if len(session["candidates"]) > 3 and session["candidates"][2]["base_probability"] > 0.15:
        uncertainty_factors.append("Multiple diseases have similar probability - differential remains broad")
    if not symptoms_list or len(symptoms_list) < 3:
        uncertainty_factors.append("Limited symptom information provided")
    
    # 5. Similar cases count (simulated)
    similar_cases = max(5, int(top_prob * 50))
    
    # =========================================================================
    # COMPREHENSIVE REPORT DATA
    # =========================================================================
    
    report = {
        "patient_summary": {
            "symptoms": session.get("symptoms", []),
            "region": session.get("region", "Global"),
            "session_id": session_id
        },
        "diagnostic_journey": {
            "initial_candidates": len(session["candidates"]),
            "tests_ordered": num_tests,
            "tests_details": [
                {
                    "name": t["test_name"],
                    "result": t["result"],
                    "for_disease": t["for_disease"]
                }
                for t in session["test_results"].values()
            ],
            "total_cost": session["total_cost"]
        },
        "final_diagnosis": {
            "disease": top_candidate["name"] if top_candidate else "Inconclusive",
            "disease_id": top_candidate["disease_id"] if top_candidate else None,
            "probability": top_prob,
            "category": top_candidate.get("category", "Unknown") if top_candidate else "Unknown"
        },
        "differential": [
            {"name": c["name"], "probability": c["base_probability"]}
            for c in session["candidates"][:5]
        ]
    }
    
    return {
        "session_id": session_id,
        "top_diagnosis": top_candidate,
        "all_candidates": session["candidates"],
        "tests_performed": session["test_results"],
        "total_cost": session["total_cost"],
        "treatment": treatment,
        "status": "complete",
        # Trustworthiness features
        "trustworthiness": {
            "confidence_score": round(confidence_score, 2),
            "confidence_level": confidence_level,
            "evidence": evidence,
            "reasoning_chain": reasoning_chain,
            "uncertainty_factors": uncertainty_factors,
            "similar_cases": similar_cases,
            "explainability_score": min(0.95, 0.5 + (len(evidence) * 0.05) + (len(reasoning_chain) * 0.05))
        },
        # Comprehensive report
        "report": report
    }


# ============================================================================
# RAG Similar Cases Endpoint
# ============================================================================

@app.post("/api/cases/similar")
async def get_similar_cases(symptoms: List[str], top_k: int = 5):
    """
    Find similar past diagnostic cases using RAG/vector search.
    Uses FAISS-based semantic search on symptom descriptions.
    """
    try:
        from backend.services.vector_store import get_vector_store
        
        vector_store = get_vector_store()
        
        if len(vector_store) == 0:
            return {
                "similar_cases": [],
                "message": "No historical cases available yet"
            }
        
        # Search for similar cases
        results = vector_store.search(symptoms, top_k=top_k)
        
        similar_cases = []
        for doc, score in results:
            similar_cases.append({
                "case_id": doc["case_id"],
                "symptoms": doc["symptoms"],
                "diagnosis": doc["diagnosis"],
                "confidence": doc["confidence"],
                "similarity_score": round(score, 3),
                "metadata": doc.get("metadata", {})
            })
        
        return {
            "query_symptoms": symptoms,
            "similar_cases": similar_cases,
            "total_in_store": len(vector_store)
        }
        
    except Exception as e:
        app_logger.error(f"Error finding similar cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cases/add")
async def add_case_to_store(
    case_id: str,
    symptoms: List[str],
    diagnosis: str,
    confidence: float = 0.8,
    metadata: Optional[Dict] = None
):
    """Add a successful diagnosis to the RAG store for future retrieval."""
    try:
        from backend.services.vector_store import get_vector_store
        
        vector_store = get_vector_store()
        vector_store.add_case(
            case_id=case_id,
            symptoms=symptoms,
            diagnosis=diagnosis,
            confidence=confidence,
            metadata=metadata or {}
        )
        
        # Save to disk
        from backend.config import settings
        vector_store.save(settings.data_dir / "vector_store")
        
        return {
            "success": True,
            "message": f"Case {case_id} added to store",
            "total_cases": len(vector_store)
        }
        
    except Exception as e:
        app_logger.error(f"Error adding case: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Multi-Agent Agentic Diagnosis Endpoints
# ============================================================================

class AgentDiagnosisRequest(BaseModel):
    symptoms: List[str]
    region: str = "Global"
    age: int = 40
    sex: str = "male"
    budget_usd: float = 500.0
    genetic_variants: List[str] = []


@app.post("/api/agents/diagnose")
async def run_agentic_diagnosis(request: AgentDiagnosisRequest):
    """
    Run the full multi-agent diagnostic workflow.
    Uses LangGraph to orchestrate Dr. Hypothesis, Dr. Test-Chooser, and Dr. Stewardship.
    """
    try:
        from backend.agents.orchestrator import get_diagnostic_graph, GraphState
        from backend.models.diagnosis import DiagnosticState, PatientContext
        
        # Initialize diagnostic state
        patient_context = PatientContext(
            age=request.age,
            sex=request.sex,
            region=request.region,
            genetic_variants=request.genetic_variants
        )
        
        diagnostic_state = DiagnosticState(
            session_id=str(uuid.uuid4()),
            symptoms=request.symptoms,
            patient_context=patient_context,
            budget_remaining=request.budget_usd
        )
        
        # Get the compiled graph
        graph = get_diagnostic_graph()
        
        # Create initial state
        initial_state = GraphState(diagnostic_state=diagnostic_state)
        
        # Run the graph until it needs user input or completes
        result = await graph.ainvoke(initial_state)
        
        # Extract results
        ds = result.diagnostic_state
        
        return {
            "session_id": ds.session_id,
            "status": "complete" if result.diagnosis_complete else "awaiting_test",
            "hypotheses": [
                {
                    "disease_id": h.disease_id,
                    "name": h.disease_name,
                    "probability": round(h.probability, 3),
                    "supporting_evidence": h.supporting_evidence,
                    "refuting_evidence": h.refuting_evidence
                }
                for h in ds.hypotheses[:5]
            ],
            "confidence": round(ds.confidence, 3),
            "tests_ordered": ds.tests_ordered,
            "budget_remaining": round(ds.budget_remaining, 2),
            "iteration": ds.iteration,
            "awaiting_test": result.awaiting_test_result,
            "current_test": result.current_test_request.dict() if result.current_test_request else None
        }
        
    except ImportError as e:
        app_logger.warning(f"Agent system not fully configured: {e}")
        return {
            "error": "Agent system requires additional dependencies",
            "detail": str(e),
            "fallback": "Use /api/diagnosis/start for basic diagnosis"
        }
    except Exception as e:
        app_logger.error(f"Agentic diagnosis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents/status")
async def get_agent_status():
    """Check if the multi-agent system is available and configured."""
    status = {
        "available": False,
        "agents": [],
        "message": ""
    }
    
    try:
        from backend.agents.dr_hypothesis import get_dr_hypothesis
        from backend.agents.dr_test_chooser import get_dr_test_chooser
        from backend.agents.dr_stewardship import get_dr_stewardship
        from backend.agents.orchestrator import get_diagnostic_graph
        
        status["agents"] = [
            {"name": "Dr. Hypothesis", "role": "Generates differential diagnosis"},
            {"name": "Dr. Test-Chooser", "role": "Selects optimal diagnostic tests"},
            {"name": "Dr. Stewardship", "role": "Reviews cost/benefit of tests"}
        ]
        status["available"] = True
        status["message"] = "Multi-agent diagnostic system ready"
        
    except ImportError as e:
        status["message"] = f"Missing dependency: {e}"
    except Exception as e:
        status["message"] = f"Configuration error: {e}"
    
    return status


# ============================================================================
# Run with uvicorn
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )


