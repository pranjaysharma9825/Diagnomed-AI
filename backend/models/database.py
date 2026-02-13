"""
Database models for patient case storage.
Uses SQLAlchemy for SQLite persistence.
"""
import uuid
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy import create_engine, Column, String, Integer, Float, Text, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

from backend.config import settings
from backend.utils.logging_config import get_logger

logger = get_logger(__name__)

# Database setup
DB_PATH = settings.data_dir.parent / "patient_cases.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PatientCase(Base):
    """SQLAlchemy model for patient diagnostic cases."""
    
    __tablename__ = "patient_cases"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_name = Column(String(120), nullable=True)
    age = Column(Integer, nullable=True)
    sex = Column(String(10), nullable=True)
    blood_type = Column(String(10), nullable=True)
    region = Column(String(50), nullable=True, default="Global")
    
    # Symptoms and diagnosis
    symptoms = Column(Text, nullable=True)
    
    # Image data
    image_url = Column(String(255), nullable=True)
    gradcam_url = Column(String(255), nullable=True)
    
    # CNN prediction
    cnn_output = Column(String(100), nullable=True)
    cnn_confidence = Column(Float, nullable=True)
    cnn_all_predictions = Column(Text, nullable=True)  # JSON string
    
    # DDX multi-agent output
    ddx_candidates = Column(Text, nullable=True)  # JSON string
    ddx_final_diagnosis = Column(String(100), nullable=True)
    ddx_confidence = Column(Float, nullable=True)
    ddx_reasoning = Column(Text, nullable=True)
    
    # Analysis output (combined)
    analysis_output = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String(20), default="pending")  # pending, analyzed, reviewed
    
    # Doctor Review
    doctor_notes = Column(Text, nullable=True)
    verification_status = Column(String(20), default="pending")  # pending, approved, rejected
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "id": self.id,
            "patient_name": self.patient_name,
            "age": self.age,
            "sex": self.sex,
            "blood_type": self.blood_type,
            "region": self.region,
            "symptoms": self.symptoms,
            "image_url": self.image_url,
            "gradcam_url": self.gradcam_url,
            "cnn_output": self.cnn_output,
            "confidence": self.cnn_confidence,
            "cnn_all_predictions": self.cnn_all_predictions,
            "ddx_candidates": self.ddx_candidates,
            "ddx_final_diagnosis": self.ddx_final_diagnosis,
            "ddx_confidence": self.ddx_confidence,
            "analysis_output": self.analysis_output,
            "status": self.status,
            "verification_status": self.verification_status,
            "doctor_notes": self.doctor_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database initialized: {DB_PATH}")


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Initialize on import
init_db()
