import jwt
import json
import requests
from functools import wraps
from flask import request, jsonify, g
import time
from urllib.parse import urlparse

class SupabaseAuth:
    def __init__(self, supabase_url, supabase_key):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.jwks = None
        self.jwks_last_updated = 0
        
        # Extract tenant ID from Supabase URL
        parsed_url = urlparse(supabase_url)
        self.tenant_id = parsed_url.netloc.split('.')[0]
    
    def _get_jwks(self):
        """Fetch and cache the JWKS (JSON Web Key Set) from Supabase"""
        # Only update once per hour
        current_time = time.time()
        if self.jwks is None or (current_time - self.jwks_last_updated) > 3600:
            jwks_url = f"https://{self.tenant_id}.supabase.co/auth/v1/jwks"
            response = requests.get(jwks_url)
            response.raise_for_status()
            self.jwks = response.json()
            self.jwks_last_updated = current_time
        return self.jwks
    
    def verify_token(self, token):
        """Verify a JWT token using Supabase's public key"""
        if not token:
            return None
            
        # Get the kid (Key ID) from the token header
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get('kid')
        except Exception as e:
            print(f"Error parsing token header: {str(e)}")
            return None
            
        if not kid:
            print("No 'kid' found in token header")
            return None
            
        # Get the JWKS and find the matching key
        jwks = self._get_jwks()
        key = None
        for jwk in jwks.get('keys', []):
            if jwk.get('kid') == kid:
                key = jwk
                break
                
        if not key:
            print(f"No matching key found for kid: {kid}")
            return None
            
        # Convert JWK to PEM format for PyJWT
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(json.dumps(key))
        
        try:
            # Verify and decode the token
            decoded = jwt.decode(
                token, 
                public_key, 
                algorithms=['RS256'],
                options={
                    # These options can be customized based on your needs
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_aud': False,  # Set to True in production with proper audience
                }
            )
            return decoded
        except Exception as e:
            print(f"Token verification error: {str(e)}")
            return None

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401
            
        try:
            token = auth_header.replace('Bearer ', '')
            
            # Initialize SupabaseAuth with your Supabase URLs
            from config import Config
            auth = SupabaseAuth(Config.SUPABASE_URL, Config.SUPABASE_KEY)
            
            # Verify the token
            decoded = auth.verify_token(token)
            
            if not decoded:
                return jsonify({'error': 'Invalid token'}), 401
            
            # Store user info in Flask's g object
            g.user_id = decoded.get('sub')
            
            if not g.user_id:
                return jsonify({'error': 'User ID not found in token'}), 401
                
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Auth error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 401
            
    return decorated