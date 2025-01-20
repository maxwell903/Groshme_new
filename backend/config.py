class Config:
    # Fixed values since we're deploying
    SUPABASE_URL = 'https://bvgnlxznztqggtqswovg.supabase.co'
    SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Z25seHpuenRxZ2d0cXN3b3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDI1ODIsImV4cCI6MjA1MDQ3ODU4Mn0.I8alzEBJYt_D1PDZHvuyZzLzlAEANTGkeR3IRyp1gCc'
    DB_PASSWORD = 'RecipeFinder123!'
    JWT_SECRET = 'UePlNfEZbOkObGzBwm987IAQ1iryqHxdCetXSS11h0ezhg1q1/GvtDB7ZjnAPsI1P5zPvQIU4sBphuzurumygA=='

     # Add these additional settings
    SUPABASE_JWT_SETTINGS = {
        'algorithms': ['HS256'],
        'verify_aud': False,
        'verify_iss': False,
        'verify_sub': False
    }
    
    # Direct database URI instead of constructing it
    SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:RecipeFinder123!@db.bvgnlxznztqggtqswovg.supabase.co:5432/postgres'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Add your Heroku domain to CORS origins
    CORS_ORIGINS = [
        'http://localhost:3000',
        'https://groshmebeta.netlify.app',
        'https://groshme-beta-c6285c415769.herokuapp.com'
    ]
    
    # Add a secret key for Flask
    SECRET_KEY = 'Hannahmax1!'