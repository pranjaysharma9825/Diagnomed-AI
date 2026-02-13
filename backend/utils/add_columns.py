from backend.models.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Migrating database...")
        try:
            conn.execute(text("ALTER TABLE patient_cases ADD COLUMN doctor_notes TEXT"))
            print("Added doctor_notes column")
        except Exception as e:
            print(f"doctor_notes column error (likely exists): {e}")

        try:
            conn.execute(text("ALTER TABLE patient_cases ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending'"))
            print("Added verification_status column")
        except Exception as e:
            print(f"verification_status column error (likely exists): {e}")
        
        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
