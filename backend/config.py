import os
from dotenv import load_dotenv # type: ignore

# Load environment variables
load_dotenv()

class Config:
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    
    # Extract database connection details from Supabase URL
    db_host = SUPABASE_URL.replace('https://', '').split('.')[0] + '.supabase.co'
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = f"postgresql://postgres:{DB_PASSWORD}@db.{db_host}:5432/postgres"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS configuration
    CORS_ORIGINS = [
        'http://localhost:3000',
        'https://groshmebeta.netlify.app'
    ]