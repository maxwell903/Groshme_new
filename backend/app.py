# app.py
import re, uuid, json
from sqlalchemy import create_engine, text # type: ignore
from sqlalchemy.pool import NullPool
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy  # type: ignore
from flask_migrate import Migrate # type: ignore
from flask_cors import CORS # type: ignore
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from sqlalchemy.dialects.postgresql import UUID  # Add this line
import mysql # type: ignore
from sqlalchemy import text # type: ignore
from fuzzywuzzy import fuzz # type: ignore
from sqlalchemy import func # type: ignore
from receipt_parser import parse_receipt  # Add at top with other imports
import mysql.connector # type: ignore
from mysql.connector import Error # type: ignore
from functools import wraps
from email.mime.text import MIMEText
import base64
import os
from werkzeug.utils import secure_filename
from config import Config
import traceback  # Make sure this is imported at the top of your file



app = Flask(__name__)

# Simplified CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://groshmebeta.netlify.app", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Range", "X-Content-Range"],
        "supports_credentials": True
    }
})

JWT_SECRET = os.environ.get('JWT_SECRET')

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401
            
        try:
            token = auth_header.replace('Bearer ', '')
            
            # Decode without verification first to get the claims
            unverified_claims = jwt.decode(
                token,
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                    "verify_exp": False
                }
            )
            
            print(f"Decoded claims: {unverified_claims}")  # Debug log
            
            # Get the user ID from the sub claim
            user_id = unverified_claims.get('sub')
            
            if not user_id:
                raise ValueError("No user ID in token")
            
            # Store the user ID in Flask's g object
            g.user_id = user_id
            
            return f(*args, **kwargs)
            
        except Exception as e:
            print(f"Auth error: {str(e)}")
            return jsonify({'error': str(e)}), 401
            
    return decorated

@app.route('/api/auth-test', methods=['GET'])
@auth_required
def test_auth():
    return jsonify({
        'message': 'Authentication successful',
        'user_id': g.user_id
    })

# Add this route to handle OPTIONS preflight requests
@app.route('/api/recipe', methods=['OPTIONS'])
def handle_recipe_options():
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
    return response

@app.errorhandler(Exception)
def handle_error(error):
    return jsonify({
        "error": str(error),
        "message": "An error occurred while processing your request."
    }), 500





# Supabase PostgreSQL connection
SUPABASE_URL = 'https://bvgnlxznztqggtqswovg.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Z25seHpuenRxZ2d0cXN3b3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDI1ODIsImV4cCI6MjA1MDQ3ODU4Mn0.I8alzEBJYt_D1PDZHvuyZzLzlAEANTGkeR3IRyp1gCc'
DB_PASSWORD = 'RecipeFinder123!'

# Construct database URL
if not all([SUPABASE_URL, SUPABASE_KEY, DB_PASSWORD]):
    raise ValueError("Missing required environment variables")

# Extract host and database name from Supabase URL
db_host = SUPABASE_URL.replace('https://', '').split('.')[0] + '.supabase.co'
db_name = 'postgres'  # Supabase uses 'postgres' as default database name


# Configure SQLAlchemy
db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres')
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy
db = SQLAlchemy(app)
migrate = Migrate(app, db)

@auth_required
def decorated(*args, **kwargs):
    auth_header = request.headers.get('Authorization')
    
    if not auth_header:
        return jsonify({'error': 'No authorization header'}), 401
        
    try:
        token = auth_header.replace('Bearer ', '')
        
        # Decode JWT token from Supabase
        decoded = jwt.decode(
            token,
            JWT_SECRET,  # Add your JWT secret key here
            algorithms=["HS256"]
        )
        
        g.user_id = decoded['sub']  # Supabase stores user ID in 'sub' claim
        return f(*args, **kwargs)
        
    except jwt.InvalidTokenError:
        return jsonify({'error': 'Invalid token'}), 401


def get_vision_credentials():
    try:
        # Path to your service account key file
        key_path = os.path.join('oauth_setup', 'service-account-key.json')
        
        if not os.path.exists(key_path):
            print(f"Service account key file not found at {key_path}")
            raise FileNotFoundError(f"Service account key file not found at {key_path}")
            
        # Create credentials object
        credentials = service_account.Credentials.from_service_account_file(
            key_path,
            scopes=['https://www.googleapis.com/auth/cloud-vision']
        )
        
        # Create and return the Vision client
        client = vision.ImageAnnotatorClient(credentials=credentials)
        return client
        
    except Exception as e:
        print(f"Error setting up credentials: {str(e)}")
        return None

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',  # Update with your MySQL username
            password='RecipePassword123!',  # Update with your MySQL password
            database='recipe_finder'  # Update with your database name
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None
    

UPLOAD_FOLDER = 'temp_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'heic', 'heif'}
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Models updates
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(UUID(as_uuid=True), primary_key=True)
    email = db.Column(db.String, unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    recipes = db.relationship('Recipe', backref='user', lazy=True)
    user_recipes = db.relationship('Recipe', backref='owner', lazy=True)


class MealPrepWeek(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)  # Add this line
    start_day = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(100))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    show_dates = db.Column(db.Boolean, default=False)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'start_day': self.start_day,
            'title': self.title,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'show_dates': self.show_dates,
            'created_date': self.created_date.strftime('%Y-%m-%d')
        }
    
class RealSalary(db.Model):
    __tablename__ = 'real_salary'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def to_dict(self):
        return {
            'id': self.id,
            'amount': float(self.amount),
            'frequency': self.frequency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class WorkoutPrepWeek(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    start_day = db.Column(db.String(20), nullable=False)

class GroceryBill(db.Model):
    __tablename__ = 'grocery_bill'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    unit = db.Column(db.String(50))
    quantity = db.Column(db.Integer, nullable=False)
    price_per = db.Column(db.DECIMAL(10,2), nullable=False)  # Changed from Decimal to DECIMAL

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'unit': self.unit,
            'quantity': self.quantity,
            'price_per': float(self.price_per)
        }
    
class Exercise(db.Model):
    __tablename__ = 'exercises'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    workout_type = db.Column(db.Enum('Push', 'Pull', 'Legs', 'Cardio'), nullable=False)
    major_groups = db.Column(db.JSON, nullable=False)
    minor_groups = db.Column(db.JSON, nullable=False)
    amount_sets = db.Column(db.Integer, nullable=False)
    amount_reps = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    rest_time = db.Column(db.Integer, nullable=False)
    sets = db.relationship('IndividualSet', backref='exercises', lazy=True, cascade='all, delete-orphan')
    set_histories = db.relationship('SetHistory', backref='exercises', lazy=True, cascade='all, delete-orphan')

class SetHistory(db.Model):
    __tablename__ = 'set_history'
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.id'), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)  # Add this line
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    sets = db.relationship('IndividualSet', backref='history', lazy=True, cascade='all, delete-orphan')


class PaymentHistory(db.Model):
    __tablename__ = 'payments_history'
    id = db.Column(db.Integer, primary_key=True)
    income_entry_id = db.Column(db.UUID, db.ForeignKey('income_entries.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date, nullable=False)
    title = db.Column(db.String(100))  # Add this for one-time payment titles
    is_one_time = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

class IncomeEntry(db.Model):
    __tablename__ = 'income_entries'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    frequency = db.Column(db.String(20), nullable=False)
    is_recurring = db.Column(db.Boolean, default=False)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    next_payment_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, onupdate=db.func.current_timestamp())
    # Add parent-child relationship fields
    parent_id = db.Column(UUID(as_uuid=True), db.ForeignKey('income_entries.id'))
    is_subaccount = db.Column(db.Boolean, default=False)
        # Relationship to track child budgets
    children = db.relationship('IncomeEntry', 
                             backref=db.backref('parent', remote_side=[id]),
                             cascade='all, delete-orphan')

    def calculate_totals(self):
        """Calculate total amounts including child budgets"""
        # Base amounts for this budget
        total_budget = float(self.amount)
        total_spent = sum(float(t.amount) for t in self.transactions)
        
        # Add amounts from child budgets if this is a parent
        if not self.is_subaccount:
            for child in self.children:
                child_totals = child.calculate_totals()
                total_budget += child_totals['budget']
                total_spent += child_totals['spent']
                
        return {
            'budget': total_budget,
            'spent': total_spent,
            'remaining': total_budget - total_spent
        }
    # Add migration for new fields
def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('email', sa.String(), unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.current_timestamp())
    )

    # Add user_id foreign keys to relevant tables
    op.add_column('recipe', sa.Column('user_id', sa.UUID(), nullable=False))
    op.create_foreign_key('fk_recipe_user', 'recipe', 'users', ['user_id'], ['id'])

from functools import wraps
from flask import request, jsonify, g
import jwt
from supabase import create_client
from supabase.client import Client

SUPABASE_URL = 'https://bvgnlxznztqggtqswovg.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Z25seHpuenRxZ2d0cXN3b3ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDI1ODIsImV4cCI6MjA1MDQ3ODU4Mn0.I8alzEBJYt_D1PDZHvuyZzLzlAEANTGkeR3IRyp1gCc'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            



    

@app.route('/api/budget-register/<uuid:register_id>', methods=['DELETE'])
def delete_budget_register(register_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # Delete related transactions first
                connection.execute(
                    text("""
                        DELETE FROM budget_register_transactions
                        WHERE register_entry_id IN (
                            SELECT id FROM budget_register_entries 
                            WHERE register_id = :register_id
                        )
                    """),
                    {"register_id": register_id}
                )
                
                # Delete register entries
                connection.execute(
                    text("""
                        DELETE FROM budget_register_entries
                        WHERE register_id = :register_id
                    """),
                    {"register_id": register_id}
                )
                
                # Finally delete the register itself
                result = connection.execute(
                    text("""
                        DELETE FROM budget_register
                        WHERE id = :register_id
                        RETURNING id
                    """),
                    {"register_id": register_id}
                )
                
                if not result.rowcount:
                    return jsonify({'error': 'Budget register not found'}), 404

            return jsonify({'message': 'Budget register deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting budget register: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/budget-register', methods=['POST'])
def save_to_register():
    try:
        data = request.json
        print("Received budget register data:", data)  # Debug logging
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # First, calculate budget totals with updated spent amounts
                budget_totals_query = text("""
                    WITH RECURSIVE BudgetHierarchy AS (
                        -- Get all parent accounts (non-subaccounts)
                        SELECT 
                            id,
                            amount,
                            frequency,
                            ARRAY[]::uuid[] as path,
                            0 as level
                        FROM income_entries
                        WHERE is_subaccount = false
                        
                        UNION ALL
                        
                        -- Get all child accounts
                        SELECT 
                            c.id,
                            c.amount,
                            c.frequency,
                            path || c.parent_id,
                            h.level + 1
                        FROM income_entries c
                        JOIN BudgetHierarchy h ON c.parent_id = h.id
                    ),
                    -- Calculate monthly amounts for each account in hierarchy
                    MonthlyAmounts AS (
                        SELECT 
                            id,
                            CASE frequency
                                WHEN 'monthly' THEN amount
                                WHEN 'weekly' THEN amount * (52.0/12.0)
                                WHEN 'biweekly' THEN amount * (26.0/12.0)
                                WHEN 'yearly' THEN amount / 12.0
                            END as monthly_amount
                        FROM BudgetHierarchy
                    ),
                    -- Calculate spent amounts including recurring transactions
                    SpentAmounts AS (
                        SELECT 
                            income_entry_id,
                            COALESCE(SUM(
                                CASE 
                                    -- Include recurring transactions regardless of date
                                    WHEN NOT is_one_time THEN amount
                                    -- Include one-time transactions within date range
                                    WHEN payment_date BETWEEN :from_date AND :to_date THEN amount
                                    ELSE 0
                                END
                            ), 0) as total_spent
                        FROM payments_history
                        GROUP BY income_entry_id
                    )
                    SELECT 
                        COALESCE(SUM(m.monthly_amount), 0) as total_budgeted,
                        COALESCE(SUM(s.total_spent), 0) as total_spent,
                        COALESCE(SUM(m.monthly_amount), 0) - COALESCE(SUM(s.total_spent), 0) as total_saved
                    FROM MonthlyAmounts m
                    LEFT JOIN SpentAmounts s ON m.id = s.income_entry_id
                """)
                
                totals_result = connection.execute(
                    budget_totals_query,
                    {
                        "from_date": data['from_date'],
                        "to_date": data['to_date']
                    }
                ).fetchone()
                
                totals = {
                    'total_budgeted': float(totals_result.total_budgeted or 0),
                    'total_spent': float(totals_result.total_spent or 0),
                    'total_saved': float(totals_result.total_saved or 0)
                }
                print("Calculated Budget Totals:", totals)
                
                # Create the budget register entry
                register_result = connection.execute(
                    text("""
                        INSERT INTO budget_register (
                            name, from_date, to_date, 
                            total_budgeted, total_spent, total_saved,
                            created_at
                        ) VALUES (
                            :name, :from_date, :to_date, 
                            :total_budgeted, :total_spent, :total_saved,
                            CURRENT_TIMESTAMP
                        )
                        RETURNING id
                    """),
                    {
                        "name": data['name'],
                        "from_date": data['from_date'],
                        "to_date": data['to_date'],
                        "total_budgeted": totals['total_budgeted'],
                        "total_spent": totals['total_spent'],
                        "total_saved": totals['total_saved']
                    }
                )
                
                register_id = register_result.fetchone().id
                print(f"Created budget register with ID: {register_id}")
                
                # Save budget entries with updated spent calculation
                entries_result = connection.execute(
                    text("""
                        INSERT INTO budget_register_entries (
                            register_id, original_entry_id, title, amount, 
                            frequency, is_recurring, is_subaccount, parent_entry_id,
                            total_spent, total_saved
                        )
                        SELECT 
                            :register_id,
                            ie.id,
                            ie.title,
                            ie.amount,
                            ie.frequency,
                            ie.is_recurring,
                            ie.is_subaccount,
                            ie.parent_id,
                            COALESCE(SUM(
                                CASE 
                                    WHEN NOT ph.is_one_time THEN ph.amount
                                    WHEN ph.payment_date BETWEEN :from_date AND :to_date THEN ph.amount
                                    ELSE 0
                                END
                            ), 0) as total_spent,
                            ie.amount - COALESCE(SUM(
                                CASE 
                                    WHEN NOT ph.is_one_time THEN ph.amount
                                    WHEN ph.payment_date BETWEEN :from_date AND :to_date THEN ph.amount
                                    ELSE 0
                                END
                            ), 0) as total_saved
                        FROM income_entries ie
                        LEFT JOIN payments_history ph ON ie.id = ph.income_entry_id
                        GROUP BY ie.id, ie.title, ie.amount, ie.frequency,
                                ie.is_recurring, ie.is_subaccount, ie.parent_id
                        RETURNING id, title, amount, total_spent
                    """),
                    {
                        "register_id": register_id,
                        "from_date": data['from_date'],
                        "to_date": data['to_date']
                    }
                ).fetchall()
                
                # Save transactions including all recurring ones
                transactions_result = connection.execute(
                    text("""
                        INSERT INTO budget_register_transactions (
                            register_entry_id, amount, payment_date,
                            title, is_one_time, original_transaction_id
                        )
                        SELECT 
                            bre.id,
                            ph.amount,
                            ph.payment_date,
                            ph.title,
                            ph.is_one_time,
                            ph.id
                        FROM payments_history ph
                        JOIN income_entries ie ON ph.income_entry_id = ie.id
                        JOIN budget_register_entries bre ON ie.id = bre.original_entry_id
                        WHERE bre.register_id = :register_id
                        AND (
                            -- Include ALL recurring transactions
                            NOT ph.is_one_time
                            -- OR include one-time transactions within date range
                            OR (ph.is_one_time AND ph.payment_date BETWEEN :from_date AND :to_date)
                        )
                        RETURNING id, amount, payment_date
                    """),
                    {
                        "register_id": register_id,
                        "from_date": data['from_date'],
                        "to_date": data['to_date']
                    }
                ).fetchall()
                
                # Handle transaction clearing if requested
                if data.get('clear_transactions', False):
                    connection.execute(
                        text("""
                            DELETE FROM payments_history
                            WHERE payment_date BETWEEN :from_date AND :to_date
                            AND is_one_time = true
                        """),
                        {
                            "from_date": data['from_date'],
                            "to_date": data['to_date']
                        }
                    )
                
                return jsonify({
                    'message': 'Budget saved to register successfully',
                    'register': {
                        'id': str(register_id),
                        'total_budgeted': totals['total_budgeted'],
                        'total_spent': totals['total_spent'],
                        'total_saved': totals['total_saved']
                    }
                }), 201

    except Exception as e:
        print(f"Error saving budget to register: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/budget-register', methods=['GET'])
def get_budget_registers():
    try:
        # Use print for Heroku logs
        print("Starting get_budget_registers function")
        
        # Create engine with explicit connection parameters
        engine = create_engine(
            'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres', 
            poolclass=NullPool
        )
        
        # Explicitly open a connection
        with engine.connect() as connection:
            # Print connection details for debugging
            print(f"Connection established: {connection}")
            
            # Explicitly use text() with connection
            query = text("""
                SELECT 
                    id, 
                    name, 
                    from_date, 
                    to_date, 
                    created_at,
                    COALESCE(total_budgeted, 0) as total_budgeted,
                    COALESCE(total_spent, 0) as total_spent,
                    COALESCE(total_saved, 0) as total_saved
                FROM budget_register
                ORDER BY created_at DESC
            """)
            
            # Execute the query
            result = connection.execute(query)
            
            # Fetch all results
            rows = result.fetchall()
            
            # Print number of rows for debugging
            print(f"Number of budget registers found: {len(rows)}")
            
            # Convert results to list of dictionaries
            registers = []
            for row in rows:
                try:
                    register = {
                        'id': str(row.id),
                        'name': row.name,
                        'from_date': row.from_date.isoformat() if row.from_date else None,
                        'to_date': row.to_date.isoformat() if row.to_date else None,
                        'created_at': row.created_at.isoformat() if row.created_at else None,
                        'total_budgeted': float(row.total_budgeted),
                        'total_spent': float(row.total_spent),
                        'total_saved': float(row.total_saved)
                    }
                    registers.append(register)
                except Exception as row_error:
                    print(f"Error processing row: {row_error}")
                    print(f"Problematic row: {dict(row)}")
            
            # Return the registers
            return jsonify({'registers': registers})
            
    except Exception as e:
        # More detailed error logging
        print(f"FULL ERROR in get_budget_registers: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'error': 'Failed to fetch budget registers',
            'details': str(e)
        }), 500
    
@app.route('/api/budget-register/diagnostic', methods=['GET'])
def diagnostic_budget_register():
    try:
        engine = create_engine(
            'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres', 
            poolclass=NullPool
        )
        
        with engine.connect() as connection:
            # Check table existence
            table_exists = connection.execute(text("""
                SELECT EXISTS (
                   SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public'
                   AND table_name = 'budget_register'
                );
            """)).scalar()
            
            # Get column information
            columns_query = text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'budget_register';
            """)
            columns = connection.execute(columns_query).fetchall()
            
            # Count records
            count = connection.execute(text("SELECT COUNT(*) FROM budget_register")).scalar()
            
            return jsonify({
                'table_exists': table_exists,
                'columns': [{'name': col.column_name, 'type': col.data_type} for col in columns],
                'record_count': count
            })
    except Exception as e:
        print(f"Diagnostic error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/budget-register/<uuid:register_id>', methods=['GET'])
def get_budget_register_details(register_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Get register details
            register_result = connection.execute(
                text("""
                    SELECT *
                    FROM budget_register
                    WHERE id = :register_id
                """),
                {"register_id": register_id}
            ).fetchone()
            
            if not register_result:
                return jsonify({'error': 'Register not found'}), 404
            
            # Get entries with their transactions
            entries_result = connection.execute(text("""
                WITH EntryTransactions AS (
                    SELECT 
                        bre.id as entry_id,
                        json_agg(
                            json_build_object(
                                'id', brt.id,
                                'amount', brt.amount,
                                'payment_date', brt.payment_date,
                                'title', brt.title,
                                'is_one_time', brt.is_one_time
                            )
                        ) FILTER (WHERE brt.id IS NOT NULL) as transactions
                    FROM budget_register_entries bre
                    LEFT JOIN budget_register_transactions brt ON bre.id = brt.register_entry_id
                    WHERE bre.register_id = :register_id
                    GROUP BY bre.id
                )
                SELECT 
                    bre.*,
                    et.transactions
                FROM budget_register_entries bre
                LEFT JOIN EntryTransactions et ON bre.id = et.entry_id
                WHERE bre.register_id = :register_id
                ORDER BY bre.is_subaccount, bre.title
            """), {"register_id": register_id})
            
            entries = []
            for row in entries_result:
                entry_data = {
                    'id': str(row.id),
                    'title': row.title,
                    'amount': float(row.amount),
                    'frequency': row.frequency,
                    'is_recurring': row.is_recurring,
                    'is_subaccount': row.is_subaccount,
                    'parent_entry_id': str(row.parent_entry_id) if row.parent_entry_id else None,
                    'total_spent': float(row.total_spent),
                    'total_saved': float(row.total_saved),
                    'transactions': row.transactions if row.transactions else []
                }
                entries.append(entry_data)
            
            register_data = {
                'id': str(register_result.id),
                'name': register_result.name,
                'from_date': register_result.from_date.isoformat(),
                'to_date': register_result.to_date.isoformat(),
                'created_at': register_result.created_at.isoformat(),
                'total_budgeted': float(register_result.total_budgeted),
                'total_spent': float(register_result.total_spent),
                'total_saved': float(register_result.total_saved),
                'entries': entries
            }
            
            return jsonify(register_data)
            
    except Exception as e:
        print(f"Error fetching budget register details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/real-salary', methods=['GET'])
def get_real_salary():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT id, amount, frequency, created_at, updated_at
                    FROM real_salary
                    LIMIT 1
                """)
            ).fetchone()
            
            if result:
                return jsonify({
                    'salary': {
                        'id': result.id,
                        'amount': float(result.amount),
                        'frequency': result.frequency,
                        'created_at': result.created_at.isoformat(),
                        'updated_at': result.updated_at.isoformat()
                    }
                })
            else:
                return jsonify({'salary': None})
            
    except Exception as e:
        print(f"Error fetching real salary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/real-salary', methods=['POST'])
def set_real_salary():
    try:
        data = request.json
        if not data or 'amount' not in data or 'frequency' not in data:
            return jsonify({'error': 'Amount and frequency are required'}), 400
            
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Due to our trigger, this will automatically delete any existing entries
            result = connection.execute(
                text("""
                    INSERT INTO real_salary (amount, frequency)
                    VALUES (:amount, :frequency)
                    RETURNING id, amount, frequency, created_at, updated_at
                """),
                {
                    'amount': float(data['amount']),
                    'frequency': data['frequency']
                }
            )
            
            new_salary = result.fetchone()
            connection.commit()
            
            return jsonify({
                'message': 'Salary updated successfully',
                'salary': {
                    'id': new_salary.id,
                    'amount': float(new_salary.amount),
                    'frequency': new_salary.frequency,
                    'created_at': new_salary.created_at.isoformat(),
                    'updated_at': new_salary.updated_at.isoformat()
                }
            }), 201
            
    except Exception as e:
        print(f"Error setting real salary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/real-salary', methods=['DELETE'])
def delete_real_salary():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            connection.execute(text("DELETE FROM real_salary"))
            connection.commit()
            
            return jsonify({'message': 'Salary entry deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting real salary: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/real-salary/calculate', methods=['GET'])
def calculate_salary():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT amount, frequency
                    FROM real_salary
                    LIMIT 1
                """)
            ).fetchone()
            
            if not result:
                return jsonify({'error': 'No salary information found'}), 404
                
            amount = float(result.amount)
            frequency = result.frequency
            
            # Calculate all frequencies
            calculations = {
                'hourly': 0,
                'daily': 0,
                'weekly': 0,
                'biweekly': 0,
                'monthly': 0,
                'yearly': 0
            }
            
            # Base calculations on frequency
            if frequency == 'hourly':
                calculations['hourly'] = amount
                calculations['daily'] = amount * 8  # 8 hours per day
                calculations['weekly'] = calculations['daily'] * 5  # 5 days per week
                calculations['biweekly'] = calculations['weekly'] * 2
                calculations['monthly'] = calculations['weekly'] * 52 / 12  # 52 weeks per year
                calculations['yearly'] = calculations['weekly'] * 52
            elif frequency == 'daily':
                calculations['hourly'] = amount / 8
                calculations['daily'] = amount
                calculations['weekly'] = amount * 5
                calculations['biweekly'] = calculations['weekly'] * 2
                calculations['monthly'] = calculations['weekly'] * 52 / 12
                calculations['yearly'] = calculations['weekly'] * 52
            elif frequency == 'weekly':
                calculations['hourly'] = amount / (8 * 5)
                calculations['daily'] = amount / 5
                calculations['weekly'] = amount
                calculations['biweekly'] = amount * 2
                calculations['monthly'] = amount * 52 / 12
                calculations['yearly'] = amount * 52
            elif frequency == 'biweekly':
                calculations['weekly'] = amount / 2
                calculations['hourly'] = calculations['weekly'] / (8 * 5)
                calculations['daily'] = calculations['weekly'] / 5
                calculations['biweekly'] = amount
                calculations['monthly'] = amount * 26 / 12  # 26 biweekly periods per year
                calculations['yearly'] = amount * 26
            elif frequency == 'monthly':
                calculations['yearly'] = amount * 12
                calculations['biweekly'] = calculations['yearly'] / 26
                calculations['weekly'] = calculations['yearly'] / 52
                calculations['daily'] = calculations['weekly'] / 5
                calculations['hourly'] = calculations['daily'] / 8
                calculations['monthly'] = amount
            elif frequency == 'yearly':
                calculations['monthly'] = amount / 12
                calculations['biweekly'] = amount / 26
                calculations['weekly'] = amount / 52
                calculations['daily'] = calculations['weekly'] / 5
                calculations['hourly'] = calculations['daily'] / 8
                calculations['yearly'] = amount
                
            # Round all values to 2 decimal places
            calculations = {
                k: round(v, 2) 
                for k, v in calculations.items()
            }
            
            return jsonify({'calculations': calculations})
            
    except Exception as e:
        print(f"Error calculating salary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/debug/routes', methods=['GET'])
def list_routes():
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return jsonify({
        'routes': routes,
        'total_routes': len(routes)
    })

# Also add this simple test route
@app.route('/api/test', methods=['GET'])
def test_route():
    return jsonify({
        'message': 'API is working',
        'database_url': db_url is not None,
        'database_connected': db is not None
    })

# Add this route to verify database connection
@app.route('/api/exercises/test', methods=['GET'])
def test_exercises_table():
    try:
        # Test the database connection with proper row handling
        with db.engine.connect() as connection:
            # Get total count
            result = connection.execute(text('SELECT COUNT(*) as count FROM exercises'))
            count = result.scalar()
            
            # Get sample exercise with explicit column selection
            result = connection.execute(text('''
                SELECT 
                    id,
                    name,
                    workout_type,
                    amount_sets,
                    amount_reps,
                    weight,
                    rest_time
                FROM exercises 
                LIMIT 1
            '''))
            
            row = result.fetchone()
            
            if row:
                sample = {
                    'id': row.id,
                    'name': row.name,
                    'workout_type': row.workout_type,
                    'amount_sets': row.amount_sets,
                    'amount_reps': row.amount_reps,
                    'weight': row.weight,
                    'rest_time': row.rest_time
                }
            else:
                sample = None

        return jsonify({
            'success': True,
            'total_exercises': count,
            'sample_exercise': sample,
            'database_connected': True
        })
        
    except Exception as e:
        print(f"Database test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'database_connected': False,
            'error_type': type(e).__name__
        }), 500



@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})

@app.route('/api/grocery-bill/import', methods=['POST'])
def import_grocery_items():
    try:
        data = request.get_json()
        print("Received data:", data)  # Debug log
        
        if not data or 'items' not in data:
            return jsonify({"error": "No items provided"}), 400
            
        items = data['items']
        
        # Debug log each item being processed
        for item in items:
            print("Processing item:", item)
            
        # Add items to database using text() for the SQL query
        for item in items:
            db.session.execute(
                text("""INSERT INTO grocery_bill 
                   (name, unit, quantity, price_per) 
                   VALUES (:name, :unit, :quantity, :price_per)"""),
                {
                    'name': item['name'],
                    'unit': item['unit'],
                    'quantity': item['quantity'],
                    'price_per': item['price_per']
                }
            )
        
        db.session.commit()
        return jsonify({"message": "Import successful"}), 200
        
    except Exception as e:
        db.session.rollback()
        print("Error importing items:", str(e))  # Debug log
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/grocery-bill', methods=['GET'])
def get_grocery_bill():
    try:
        items = db.session.query(GroceryBill).all()
        return jsonify({
            'items': [{
                'id': item.id,
                'name': item.name,
                'quantity': item.quantity,
                'unit': item.unit,
                'price_per': float(item.price_per)
            } for item in items]
        })
    except Exception as e:
        print(f"Error fetching grocery bill: {str(e)}")
        return jsonify({'error': str(e)}), 500
    




@app.route('/api/exercises/set/<int:set_id>', methods=['DELETE'])
def delete_individual_set(set_id):
    try:
        set_to_delete = IndividualSet.query.get_or_404(set_id)
        db.session.delete(set_to_delete)
        db.session.commit()
        return jsonify({'message': 'Set deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting set: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/exercises/<int:exercise_id>', methods=['PUT'])
def update_exercise(exercise_id):
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'workout_type', 'major_groups', 'minor_groups', 
                           'amount_sets', 'amount_reps', 'weight', 'rest_time']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Get the exercise
        exercise = Exercise.query.get_or_404(exercise_id)
        
        # Update fields
        exercise.name = data['name']
        exercise.workout_type = data['workout_type']
        exercise.major_groups = data['major_groups']
        exercise.minor_groups = data['minor_groups']
        exercise.amount_sets = data['amount_sets']
        exercise.amount_reps = data['amount_reps'] 
        exercise.weight = data['weight']
        exercise.rest_time = data['rest_time']
        
        db.session.commit()
        
        # Return updated exercise
        return jsonify({
            'id': exercise.id,
            'name': exercise.name,
            'workout_type': exercise.workout_type,
            'major_groups': exercise.major_groups,
            'minor_groups': exercise.minor_groups,
            'amount_sets': exercise.amount_sets,
            'amount_reps': exercise.amount_reps,
            'weight': exercise.weight,
            'rest_time': exercise.rest_time
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

    
@app.route('/api/exercises/<int:exercise_id>', methods=['DELETE', 'PUT', 'OPTIONS'])
def manage_exercise(exercise_id):
    # Handle OPTIONS request for CORS
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, PUT, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            if request.method == 'DELETE':
                with connection.begin():
                    # First delete all associated set histories and individual sets
                    # Delete individual sets first
                    connection.execute(
                        text("""
                            DELETE FROM individual_set 
                            WHERE exercise_id = :exercise_id
                        """),
                        {"exercise_id": exercise_id}
                    )
                    
                    # Delete set histories
                    connection.execute(
                        text("""
                            DELETE FROM set_history 
                            WHERE exercise_id = :exercise_id
                        """),
                        {"exercise_id": exercise_id}
                    )
                    
                    # Delete the exercise
                    result = connection.execute(
                        text("""
                            DELETE FROM exercises 
                            WHERE id = :exercise_id 
                            RETURNING id
                        """),
                        {"exercise_id": exercise_id}
                    )
                    
                    if not result.rowcount:
                        return jsonify({'error': 'Exercise not found'}), 404
                    
                return jsonify({'message': 'Exercise and all related data deleted successfully'}), 200

            elif request.method == 'PUT':
                data = request.json
                with connection.begin():
                    # Update the exercise
                    result = connection.execute(
    text("""
        UPDATE exercises
        SET name = %(name)s,
            workout_type = %(workout_type)s,
            major_groups = %(major_groups)s::json,
            minor_groups = %(minor_groups)s::json,
            amount_sets = %(amount_sets)s,
            amount_reps = %(amount_reps)s,
            weight = %(weight)s,
            rest_time = %(rest_time)s
        WHERE id = %(exercise_id)s
        RETURNING id, name, workout_type, major_groups, minor_groups,
                  amount_sets, amount_reps, weight, rest_time
    """),
    {
        "exercise_id": exercise_id,
        "name": data['name'],
        "workout_type": data['workout_type'],
        "major_groups": json.dumps(data['major_groups']),
        "minor_groups": json.dumps(data['minor_groups']),
        "amount_sets": data['amount_sets'],
        "amount_reps": data['amount_reps'],
        "weight": data['weight'],
        "rest_time": data['rest_time']
    }
)
                    
                    if not result.rowcount:
                        return jsonify({'error': 'Exercise not found'}), 404
                        
                    updated = result.fetchone()
                    
                    return jsonify({
                        'message': 'Exercise updated successfully',
                        'exercise': {
                            'id': updated.id,
                            'name': updated.name,
                            'workout_type': updated.workout_type,
                            'major_groups': updated.major_groups,
                            'minor_groups': updated.minor_groups,
                            'amount_sets': updated.amount_sets,
                            'amount_reps': updated.amount_reps,
                            'weight': updated.weight,
                            'rest_time': updated.rest_time
                        }
                    }), 200
                    
    except Exception as e:
        print(f"Error managing exercise: {str(e)}")
        return jsonify({
            'error': 'Failed to manage exercise',
            'details': str(e)
        }), 500


@app.route('/api/exercises/<int:exercise_id>/sets', methods=['POST'])
@auth_required
def add_exercise_sets(exercise_id):
    try:
        user_id = g.user_id
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # Verify exercise belongs to user
                exercise_check = connection.execute(
                    text("SELECT id FROM exercises WHERE id = :id AND user_id = :user_id"),
                    {"id": exercise_id, "user_id": user_id}
                ).fetchone()
                
                if not exercise_check:
                    return jsonify({'error': 'Exercise not found or unauthorized'}), 404
                
                # Create history entry
                history_result = connection.execute(
                    text("""
                        INSERT INTO set_history (exercise_id, user_id, created_at)
                        VALUES (:exercise_id, :user_id, CURRENT_TIMESTAMP)
                        RETURNING id
                    """),
                    {
                        "exercise_id": exercise_id,
                        "user_id": user_id
                    }
                )
                
                history_id = history_result.fetchone()[0]
                
                # Add sets
                for set_data in data['sets']:
                    connection.execute(
                        text("""
                            INSERT INTO individual_set (
                                exercise_id, set_history_id, set_number, reps, weight
                            ) VALUES (
                                :exercise_id, :history_id, :set_number, :reps, :weight
                            )
                        """),
                        {
                            "exercise_id": exercise_id,
                            "history_id": history_id,
                            "set_number": set_data['set_number'],
                            "reps": set_data['reps'],
                            "weight": set_data['weight']
                        }
                    )
                
            return jsonify({'message': 'Sets added successfully'})
            
    except Exception as e:
        print(f"Error saving sets: {str(e)}")
        return jsonify({'error': str(e)}), 500

    
@app.route('/api/exercise/<int:exercise_id>/sets/<int:history_id>', methods=['DELETE'])
def delete_exercise_sets(exercise_id, history_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # First verify the history belongs to this exercise
                result = connection.execute(
                    text("""
                        SELECT id FROM set_history 
                        WHERE id = :history_id AND exercise_id = :exercise_id
                    """),
                    {
                        'history_id': history_id,
                        'exercise_id': exercise_id
                    }
                )
                
                if not result.fetchone():
                    return jsonify({'error': 'Set history not found for this exercise'}), 404
                
                # Delete all individual sets for this history
                connection.execute(
                    text("""
                        DELETE FROM individual_set 
                        WHERE set_history_id = :history_id
                    """),
                    {'history_id': history_id}
                )
                
                # Delete the history entry
                connection.execute(
                    text("""
                        DELETE FROM set_history 
                        WHERE id = :history_id
                    """),
                    {'history_id': history_id}
                )
            
            return jsonify({'message': 'Exercise sets deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting sets: {str(e)}")
        return jsonify({'error': str(e)}), 500





class IndividualSet(db.Model):
    __tablename__ = 'individual_set'
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.id'), nullable=False)
    set_history_id = db.Column(db.Integer, db.ForeignKey('set_history.id'), nullable=False)
    set_number = db.Column(db.Integer, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Integer, nullable=False)

class Workout(db.Model):
    __tablename__ = 'workouts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    exercises = db.relationship('Exercise', secondary='workout_exercises', 
                              backref=db.backref('workouts', lazy=True))

class WorkoutExercise(db.Model):
    __tablename__ = 'workout_exercises'
    workout_id = db.Column(db.Integer, db.ForeignKey('workouts.id', ondelete='CASCADE'), primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.id', ondelete='CASCADE'), primary_key=True)
    

class WorkoutPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    week_id = db.Column(db.Integer, db.ForeignKey('workout_prep_week.id'), nullable=False)
    day = db.Column(db.String(20), nullable=False)
    workout_type = db.Column(db.String(20), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.id'), nullable=False)
    workout_prep_week = db.relationship('WorkoutPrepWeek', backref=db.backref('workouts', lazy=True, cascade='all, delete-orphan'))
    exercise = db.relationship('Exercise', backref=db.backref('workout_plan', lazy=True))

@app.route('/api/exercises/<int:exercise_id>/sets', methods=['GET'])
def get_exercise_sets(exercise_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Get the most recent set history
            history_result = connection.execute(
                text("""
                    SELECT id, created_at
                    FROM set_history 
                    WHERE exercise_id = :exercise_id
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {'exercise_id': exercise_id}
            ).fetchone()
            
            if not history_result:
                return jsonify({'sets': []})
                
            # Get sets for this history
            sets_result = connection.execute(
                text("""
                    SELECT id, set_number, reps, weight
                    FROM individual_set
                    WHERE set_history_id = :history_id
                    ORDER BY set_number
                """),
                {'history_id': history_result.id}
            )
            
            sets = [{
                'id': row.id,
                'set_number': row.set_number,
                'reps': row.reps,
                'weight': row.weight
            } for row in sets_result]
            
            return jsonify({'sets': sets})
            
    except Exception as e:
        print(f"Error fetching sets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercises/<int:exercise_id>/sets/<int:set_id>', methods=['DELETE'])
def delete_set(exercise_id, set_id):
    try:
        set = IndividualSet.query.get_or_404(set_id)
        
        # Verify the set belongs to the correct exercise
        if set.exercise_id != exercise_id:
            return jsonify({'error': 'Set does not belong to this exercise'}), 404
            
        db.session.delete(set)
        db.session.commit()
        return jsonify({'message': 'Set deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting set: {str(e)}")
        return jsonify({'error': str(e)}), 500


app.route('/api/exercise/<int:exercise_id>/history/<int:history_id>', methods=['DELETE'])
def delete_workout_history(exercise_id, history_id):
    try:
        history = SetHistory.query\
            .filter_by(id=history_id, exercise_id=exercise_id)\
            .first_or_404()
            
        # Delete associated sets first
        IndividualSet.query.filter_by(set_history_id=history_id).delete()
        
        # Then delete the history record
        db.session.delete(history)
        db.session.commit()
        
        return jsonify({'message': 'Workout history deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting workout history: {str(e)}")
        return jsonify({'error': str(e)}), 500

    

class MealPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    week_id = db.Column(db.Integer, db.ForeignKey('meal_prep_week.id'), nullable=False)
    day = db.Column(db.String(20), nullable=False)
    meal_type = db.Column(db.String(20), nullable=False)  # breakfast, lunch, or dinner
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id'), nullable=False)
    recipe = db.relationship('Recipe')
    meal_prep_week = db.relationship('MealPrepWeek', backref=db.backref('meals', lazy=True, cascade='all, delete-orphan'))

class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    instructions = db.Column(db.Text)
    prep_time = db.Column(db.Integer)
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    

    ingredient_quantities = db.relationship(
        'RecipeIngredientQuantity',
        backref='recipe',
        lazy=True,
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'instructions': self.instructions,
            'prep_time': self.prep_time,
            'created_date': self.created_date.isoformat() if self.created_date else None,
            'ingredients': [qty.to_dict() for qty in self.ingredient_quantities]
        }

class RecipeIngredientQuantity(db.Model):
    __tablename__ = 'recipe_ingredient_quantities'
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id'), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id'), nullable=False)
    
    # Explicitly define the relationship with clear foreign key
    nutrition = db.relationship(
        'RecipeIngredientNutrition', 
        back_populates='recipe_ingredient', 
        uselist=False, 
        cascade='all, delete-orphan',
        # Explicitly specify the foreign key
        primaryjoin='RecipeIngredientQuantity.id == RecipeIngredientNutrition.recipe_ingredient_quantities_id'
    )


# Add this near the top with other model definitions
class RecipeIngredient3(db.Model):
    __tablename__ = 'recipe_ingredients3'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipe_ids = db.Column(db.JSON)

class RecipeIngredientNutrition(db.Model):
    __tablename__ = 'recipe_ingredient_nutrition'
    id = db.Column(db.Integer, primary_key=True)
    recipe_ingredient_quantities_id = db.Column(
        db.Integer, 
        db.ForeignKey('recipe_ingredient_quantities.id', ondelete='CASCADE'), 
        nullable=False,
        index=True  # Add an index for performance
    )

    recipe_ingredient = db.relationship(
        'RecipeIngredientQuantity', 
        back_populates='nutrition',
        # Explicitly specify the foreign key
        primaryjoin='RecipeIngredientNutrition.recipe_ingredient_quantities_id == RecipeIngredientQuantity.id'
    )
    protein_grams = db.Column(db.Float, nullable=True)
    fat_grams = db.Column(db.Float, nullable=True)
    carbs_grams = db.Column(db.Float, nullable=True)
    serving_size = db.Column(db.Float, nullable=True)
    serving_unit = db.Column(db.String(20), nullable=True)
    
    
    
    recipe_ingredient = db.relationship(
        'RecipeIngredientQuantity', 
        back_populates='nutrition'
    )


class Ingredient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'))
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Menu(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())

class MenuRecipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    menu_id = db.Column(db.Integer, db.ForeignKey('menu.id'), nullable=False)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id'), nullable=False)
    menu = db.relationship('Menu', backref=db.backref('menu_recipes', lazy=True))
    recipe = db.relationship('Recipe', backref=db.backref('menu_recipes', lazy=True))

class FridgeItem(db.Model):
    __tablename__ = 'fridge_item'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.UUID, nullable=False, default='bc6ae242-c238-4a6b-a884-2fd1fc03ed72')
    name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Float, default=0)
    unit = db.Column(db.String(20))
    price_per = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'quantity': float(self.quantity) if self.quantity is not None else 0,
            'unit': self.unit or '',
            'price_per': float(self.price_per) if self.price_per is not None else 0
        }


# Add this function to upgrade the database
def upgrade_database():
    upgrade_commands = [
        """
        ALTER TABLE fridge_item
        ADD COLUMN IF NOT EXISTS price_per DECIMAL(10, 2) DEFAULT 0.0;
        """
    ]
    
    conn = db.engine.connect()
    for command in upgrade_commands:
        conn.execute(text(command))
    conn.close()

# Add to your existing models in app.py

class GroceryList(db.Model):
    __tablename__ = 'grocery_list'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.UUID, nullable=False, default='bc6ae242-c238-4a6b-a884-2fd1fc03ed72')
    name = db.Column(db.String(100), nullable=False)
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    items = db.relationship('GroceryItem', back_populates='list', cascade='all, delete-orphan')

class RecipeIngredientDetails(db.Model):
    __tablename__ = 'recipe_ingredient_details'
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False)
    ingredient_name = db.Column(db.String(100), db.ForeignKey('recipe_ingredients3.name'), nullable=False)
    quantity = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(20))
    
    recipe = db.relationship('Recipe', backref=db.backref('ingredient_details', lazy=True, cascade='all, delete-orphan'))
    ingredient = db.relationship('RecipeIngredient3', backref=db.backref('recipe_details', lazy=True))

class ReceiptParser:
    # Expanded common unit variations
    UNITS = {
        'weight': {
            'oz': ['oz', 'oz.', 'ounce', 'ounces'],
            'lb': ['lb', 'lb.', 'lbs', 'lbs.', 'pound', 'pounds'],
            'g': ['g', 'g.', 'gram', 'grams'],
            'kg': ['kg', 'kg.', 'kilo', 'kilos', 'kilogram', 'kilograms']
        },
        'volume': {
            'ml': ['ml', 'ml.', 'milliliter', 'milliliters'],
            'l': ['l', 'l.', 'liter', 'liters'],
            'gal': ['gal', 'gal.', 'gallon', 'gallons'],
            'qt': ['qt', 'qt.', 'quart', 'quarts'],
            'pt': ['pt', 'pt.', 'pint', 'pints'],
            'fl oz': ['fl oz', 'fl.oz', 'fluid ounce', 'fluid ounces']
        },
        'packaging': {
            'pack': ['pack', 'pk', 'package'],
            'box': ['box', 'bx', 'boxes'],
            'bag': ['bag', 'bg', 'bags'],
            'case': ['case', 'cs', 'cases'],
            'bunch': ['bunch', 'bn', 'bunches'],
            'container': ['container', 'cont', 'containers'],
            'jar': ['jar', 'jr', 'jars'],
            'can': ['can', 'cn', 'cans']
        }
    }

    @classmethod
    def normalize_unit(cls, unit_text):
        """Convert various unit formats to standard form"""
        unit_text = unit_text.lower().strip()
        for category in cls.UNITS.values():
            for standard, variations in category.items():
                if unit_text in variations:
                    return standard
        return unit_text

    @classmethod
    def extract_price(cls, text):
        """Extract price from text using regex"""
        import re
        # Match common price patterns
        price_patterns = [
            r'\$\s*(\d+\.?\d*)',  # $12.99
            r'(\d+\.?\d*)\s*\$',  # 12.99$
            r'(\d+\.\d{2})',      # Just numbers with cents
            r'(\d+)'             # Just numbers (assume dollars)
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        return None

    @classmethod
    def extract_quantity(cls, text):
        """Extract quantity from text"""
        import re
        # Match quantity patterns
        qty_patterns = [
            r'(\d+\.?\d*)\s*x',   # 2x or 2.5x
            r'x\s*(\d+\.?\d*)',   # x2 or x2.5
            r'^(\d+\.?\d*)\s',    # Starting with number
            r'(\d+\.?\d*)\s*(?:' + '|'.join(sum([var for var in cls.UNITS.values()], [])) + ')'  # Number before unit
        ]
        
        for pattern in qty_patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        return 1.0  # Default quantity if none found

    @classmethod
    def parse_receipt_line(cls, line, known_items):
        """Parse a single line of receipt text"""
        # Remove special characters except $, ., and basic punctuation
        clean_line = re.sub(r'[^a-zA-Z0-9\s$.,]', '', line)
        
        # Extract item name, quantity, and price
        item_name_match = re.search(r'(.*?)\s+(\d+\.?\d*)\s*(\$\s*\d+\.?\d*)', clean_line)
        if item_name_match:
            item_name = item_name_match.group(1).strip()
            quantity = float(item_name_match.group(2))
            price = float(item_name_match.group(3).replace('$', '').strip())
            total = quantity * price
        else:
            return None
        
        # Try to match with known items
        best_match = None
        best_score = 0
        
        for known_item in known_items:
            score = fuzz.ratio(item_name.lower(), known_item.lower())
            if score > best_score and score > 80:  # 80% threshold for matching
                best_score = score
                best_match = known_item
        
        # Extract unit
        found_unit = None
        for category in cls.UNITS.values():
            for standard, variations in category.items():
                if any(var in item_name.lower() for var in variations):
                    found_unit = standard
                    break
            if found_unit:
                break
        
        return {
            'item_name': best_match if best_match else item_name,
            'quantity': quantity,
            'unit': found_unit,
            'price': price,
            'total': total,
            'matched': bool(best_match),
            'match_score': best_score if best_match else 0
        }

    @classmethod
    def parse_receipt(cls, receipt_text, known_items):
        """Parse full receipt text and return structured data"""
        lines = receipt_text.strip().split('\n')
        parsed_items = []
        unmatched_items = []
        subtotal = 0
        
        for line in lines:
            if not line.strip():
                continue
                
            result = cls.parse_receipt_line(line, known_items)
            if result:
                if result['matched']:
                    parsed_items.append(result)
                    subtotal += result['total']
                else:
                    unmatched_items.append(result)
        
        return {
            'matched_items': parsed_items,
            'unmatched_items': unmatched_items,
            'subtotal': subtotal
        }
    
# Add these routes to handle meal prep functionality
@app.route('/api/meal-prep/weeks', methods=['GET'])
@auth_required
def get_meal_prep_weeks():
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First get all weeks
            weeks_result = connection.execute(
                text("""
                    WITH WeekMeals AS (
                        SELECT 
                            w.id,
                            w.title,
                            w.start_day,
                            w.start_date,
                            w.end_date,
                            w.show_dates,
                            w.created_date,
                            m.day,
                            m.meal_type,
                            r.id as recipe_id,
                            r.name as recipe_name,
                            r.description,
                            r.prep_time
                        FROM meal_prep_week w
                        LEFT JOIN meal_plan m ON w.id = m.week_id
                        LEFT JOIN recipe r ON m.recipe_id = r.id
                        WHERE w.user_id = :user_id
                    ),
                    MealNutrition AS (
                        SELECT 
                            r.id as recipe_id,
                            COALESCE(SUM(
                                CASE WHEN rin.serving_size > 0 
                                THEN (rin.protein_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                                END
                            ), 0) as total_protein,
                            COALESCE(SUM(
                                CASE WHEN rin.serving_size > 0 
                                THEN (rin.fat_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                                END
                            ), 0) as total_fat,
                            COALESCE(SUM(
                                CASE WHEN rin.serving_size > 0 
                                THEN (rin.carbs_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                                END
                            ), 0) as total_carbs
                        FROM recipe r
                        LEFT JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
                        LEFT JOIN recipe_ingredient_nutrition rin 
                            ON rin.recipe_ingredient_quantities_id = riq.id
                        GROUP BY r.id
                    )
                    SELECT 
                        wm.*,
                        mn.total_protein,
                        mn.total_fat,
                        mn.total_carbs
                    FROM WeekMeals wm
                    LEFT JOIN MealNutrition mn ON wm.recipe_id = mn.recipe_id
                    ORDER BY wm.created_date DESC, wm.day, wm.meal_type
                """),
                {"user_id": user_id}
            )

            # Process the results into a nested structure
            weeks_data = {}
            for row in weeks_result:
                week_id = row.id
                
                # Initialize week if not exists
                if week_id not in weeks_data:
                    weeks_data[week_id] = {
                        'id': week_id,
                        'title': row.title,
                        'start_day': row.start_day,
                        'start_date': row.start_date.isoformat() if row.start_date else None,
                        'end_date': row.end_date.isoformat() if row.end_date else None,
                        'show_dates': row.show_dates,
                        'created_date': row.created_date.strftime('%Y-%m-%d'),
                        'meal_plans': {}
                    }
                
                # Skip if no meal data
                if not row.day or not row.meal_type:
                    continue
                
                # Initialize day if not exists
                if row.day not in weeks_data[week_id]['meal_plans']:
                    weeks_data[week_id]['meal_plans'][row.day] = {
                        'breakfast': [],
                        'lunch': [],
                        'dinner': []
                    }
                
                # Add meal to appropriate type if recipe exists
                if row.recipe_id:
                    meal_data = {
                        'id': row.recipe_id,
                        'name': row.recipe_name,
                        'description': row.description,
                        'prep_time': row.prep_time,
                        'total_nutrition': {
                            'protein_grams': round(float(row.total_protein), 1),
                            'fat_grams': round(float(row.total_fat), 1),
                            'carbs_grams': round(float(row.total_carbs), 1)
                        }
                    }
                    weeks_data[week_id]['meal_plans'][row.day][row.meal_type.lower()].append(meal_data)

            # Convert to list for response
            weeks = list(weeks_data.values())

            return jsonify({'weeks': weeks})
            
    except Exception as e:
        print(f"Error fetching meal prep weeks: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/workout-plans', methods=['GET'])
def get_workout_plans():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT 
                    wp.id,
                    wp.week_id,
                    wp.day,
                    wp.workout_type,
                    e.id as exercise_id,
                    e.name as exercise_name,
                    e.major_groups,
                    e.minor_groups,
                    e.amount_sets,
                    e.amount_reps,
                    e.weight,
                    e.rest_time
                FROM workout_plan wp
                JOIN exercise e ON wp.exercise_id = e.id
                ORDER BY wp.day, e.workout_type
            """))
            
            plans = {}
            for row in result:
                if row.day not in plans:
                    plans[row.day] = []
                    
                plans[row.day].append({
                    'id': row.exercise_id,
                    'name': row.exercise_name,
                    'workout_type': row.workout_type,
                    'major_groups': row.major_groups,
                    'minor_groups': row.minor_groups,
                    'amount_sets': row.amount_sets,
                    'amount_reps': row.amount_reps,
                    'weight': row.weight,
                    'rest_time': row.rest_time
                })
                
            return jsonify({'workout_plans': plans})
            
    except Exception as e:
        print(f"Error fetching workout plans: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workouts/<int:workout_id>/exercises', methods=['GET'])
def get_workout_exercises(workout_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                WITH LatestSets AS (
                    SELECT DISTINCT ON (exercise_id)
                        exercise_id,
                        weight,
                        reps,
                        created_at
                    FROM individual_set
                    ORDER BY exercise_id, created_at DESC
                )
                SELECT 
                    e.*,
                    ls.weight as latest_weight,
                    ls.reps as latest_reps,
                    ls.created_at as latest_set_date
                FROM exercise e
                JOIN workout_exercises we ON e.id = we.exercise_id
                LEFT JOIN LatestSets ls ON e.id = ls.exercise_id
                WHERE we.workout_id = :workout_id
                ORDER BY e.workout_type, e.name
            """), {"workout_id": workout_id})
            
            exercises = []
            for row in result:
                exercises.append({
                    'id': row.id,
                    'name': row.name,
                    'workout_type': row.workout_type,
                    'major_groups': row.major_groups,
                    'minor_groups': row.minor_groups,
                    'amount_sets': row.amount_sets,
                    'amount_reps': row.amount_reps,
                    'weight': row.weight,
                    'rest_time': row.rest_time,
                    'latest_set': {
                        'weight': row.latest_weight,
                        'reps': row.latest_reps,
                        'created_at': row.latest_set_date.isoformat() if row.latest_set_date else None
                    } if row.latest_weight is not None else None
                })
                
            return jsonify({'exercises': exercises})
            
    except Exception as e:
        print(f"Error fetching workout exercises: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/exercise/<int:exercise_id>/history/<int:history_id>', methods=['DELETE'])
@auth_required
def delete_exercise_history(exercise_id, history_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # First verify the history belongs to this user and exercise
                history_check = connection.execute(
                    text("""
                        SELECT sh.id 
                        FROM set_history sh
                        JOIN exercises e ON sh.exercise_id = e.id
                        WHERE sh.id = :history_id 
                        AND sh.exercise_id = :exercise_id
                        AND sh.user_id = :user_id
                    """),
                    {
                        "history_id": history_id,
                        "exercise_id": exercise_id,
                        "user_id": user_id
                    }
                ).fetchone()

                if not history_check:
                    return jsonify({'error': 'History record not found or unauthorized'}), 404

                # Delete all associated sets first
                connection.execute(
                    text("""
                        DELETE FROM individual_set 
                        WHERE set_history_id = :history_id
                    """),
                    {"history_id": history_id}
                )

                # Then delete the history record
                connection.execute(
                    text("""
                        DELETE FROM set_history 
                        WHERE id = :history_id 
                        AND user_id = :user_id
                    """),
                    {
                        "history_id": history_id,
                        "user_id": user_id
                    }
                )

            return jsonify({'message': 'Session deleted successfully'})

    except Exception as e:
        print(f"Error deleting exercise history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workouts/<int:workout_id>/exercise', methods=['POST'])
def add_workout_exercise():
    try:
        data = request.json
        workout_id = data.get('workout_id')
        exercise_id = data.get('exercise_id')
        
        if not workout_id or not exercise_id:
            return jsonify({'error': 'Missing required fields'}), 400
            
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Check if exercise already exists in workout
            result = connection.execute(text("""
                SELECT 1 FROM workout_exercises
                WHERE workout_id = :workout_id AND exercise_id = :exercise_id
            """), {
                "workout_id": workout_id,
                "exercise_id": exercise_id
            })
            
            if result.fetchone():
                return jsonify({'error': 'Exercise already exists in workout'}), 400
            
            # Add exercise to workout
            connection.execute(text("""
                INSERT INTO workout_exercises (workout_id, exercise_id)
                VALUES (:workout_id, :exercise_id)
            """), {
                "workout_id": workout_id,
                "exercise_id": exercise_id
            })
            
            connection.commit()
            return jsonify({'message': 'Exercise added to workout successfully'}), 201
            
    except Exception as e:
        print(f"Error adding exercise to workout: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/exercises/<int:exercise_id>/sets', methods=['GET'])
def get_exercises_sets(exercise_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                WITH LatestHistory AS (
                    SELECT id, created_at
                    FROM set_history
                    WHERE exercise_id = :exercise_id
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                SELECT 
                    s.id,
                    s.set_number,
                    s.reps,
                    s.weight,
                    h.created_at
                FROM individual_set s
                JOIN LatestHistory h ON s.set_history_id = h.id
                ORDER BY s.set_number
            """), {"exercise_id": exercise_id})
            
            sets = []
            latest_date = None
            
            for row in result:
                sets.append({
                    'id': row.id,
                    'set_number': row.set_number,
                    'reps': row.reps,
                    'weight': row.weight
                })
                if not latest_date and row.created_at:
                    latest_date = row.created_at
                    
            return jsonify({
                'sets': sets,
                'created_at': latest_date.isoformat() if latest_date else None
            })
            
    except Exception as e:
        print(f"Error fetching exercise sets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks', methods=['POST'])
@auth_required
def create_meal_prep_week():
    try:
        data = request.json
        user_id = g.user_id  # Get authenticated user's ID
        
        if 'start_day' not in data:
            return jsonify({'error': 'Start day is required'}), 400
            
        # Create new week with user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO meal_prep_week (
                        start_day, title, start_date, end_date,
                        show_dates, created_date, user_id
                    ) VALUES (
                        :start_day, :title, :start_date, :end_date,
                        false, CURRENT_TIMESTAMP, :user_id
                    ) RETURNING id, start_day, title, start_date,
                              end_date, show_dates, created_date
                """),
                {
                    "start_day": data['start_day'],
                    "title": data.get('title'),
                    "start_date": data.get('start_date'),
                    "end_date": data.get('end_date'),
                    "user_id": user_id
                }
            )
            
            new_week = result.fetchone()
            connection.commit()
            
            return jsonify({
                'id': new_week.id,
                'start_day': new_week.start_day,
                'title': new_week.title,
                'start_date': new_week.start_date.isoformat() if new_week.start_date else None,
                'end_date': new_week.end_date.isoformat() if new_week.end_date else None,
                'show_dates': new_week.show_dates,
                'created_date': new_week.created_date.strftime('%Y-%m-%d')
            }), 201
            
    except Exception as e:
        print(f"Error creating week: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/meal-prep/weeks/<int:week_id>/toggle-dates', methods=['POST'])
def toggle_week_dates(week_id):
    try:
        week = MealPrepWeek.query.get_or_404(week_id)
        week.show_dates = not week.show_dates
        db.session.commit()
        return jsonify({'show_dates': week.show_dates}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks/<int:week_id>', methods=['DELETE'])
@auth_required
def delete_meal_prep_week(week_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First verify the week belongs to the user
            week_check = connection.execute(
                text("""
                    SELECT id FROM meal_prep_week 
                    WHERE id = :week_id AND user_id = :user_id
                """),
                {"week_id": week_id, "user_id": user_id}
            ).fetchone()
            
            if not week_check:
                return jsonify({'error': 'Week not found or unauthorized'}), 404
            
            # Delete meals first
            connection.execute(
                text("DELETE FROM meal_plan WHERE week_id = :week_id"),
                {"week_id": week_id}
            )
            
            # Delete week
            connection.execute(
                text("DELETE FROM meal_prep_week WHERE id = :week_id"),
                {"week_id": week_id}
            )
            
            connection.commit()
            return jsonify({'message': 'Week deleted successfully'}), 200
            
    except Exception as e:
        print(f"Error deleting week: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks/<int:week_id>/meals', methods=['POST'])
@auth_required
def add_meal_to_week(week_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        data = request.json
        
        if not all(k in data for k in ['day', 'meal_type', 'recipe_id']):
            return jsonify({'error': 'Missing required fields'}), 400
            
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Verify week belongs to user
            week_check = connection.execute(
                text("""
                    SELECT id FROM meal_prep_week 
                    WHERE id = :week_id AND user_id = :user_id
                """),
                {
                    "week_id": week_id,
                    "user_id": user_id
                }
            ).fetchone()
            
            if not week_check:
                return jsonify({'error': 'Week not found or unauthorized'}), 404
            
            # Add meal to week
            result = connection.execute(
                text("""
                    INSERT INTO meal_plan (week_id, day, meal_type, recipe_id)
                    VALUES (:week_id, :day, :meal_type, :recipe_id)
                    RETURNING id
                """),
                {
                    "week_id": week_id,
                    "day": data['day'],
                    "meal_type": data['meal_type'].lower(),
                    "recipe_id": data['recipe_id']
                }
            )
            
            meal_id = result.fetchone()[0]
            connection.commit()
            
            return jsonify({
                'message': 'Meal added successfully',
                'id': meal_id
            }), 201
            
    except Exception as e:
        print(f"Error adding meal to week: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

# Route to delete a meal from a week
@app.route('/api/meal-prep/weeks/<int:week_id>/meals', methods=['DELETE', 'OPTIONS'])
@auth_required
def delete_meal_from_week(week_id):
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        return response
        
    try:
        user_id = g.user_id  # Get authenticated user's ID
        data = request.json
        
        if not all(k in data for k in ['day', 'meal_type', 'recipe_id']):
            return jsonify({'error': 'Missing required fields'}), 400
            
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First verify week belongs to user
            week_check = connection.execute(
                text("""
                    SELECT id FROM meal_prep_week 
                    WHERE id = :week_id AND user_id = :user_id
                """),
                {
                    "week_id": week_id,
                    "user_id": user_id
                }
            ).fetchone()
            
            if not week_check:
                return jsonify({'error': 'Week not found or unauthorized'}), 404
                
            # Delete the meal
            result = connection.execute(
                text("""
                    DELETE FROM meal_plan 
                    WHERE week_id = :week_id 
                    AND day = :day 
                    AND meal_type = :meal_type 
                    AND recipe_id = :recipe_id
                """),
                {
                    "week_id": week_id,
                    "day": data['day'],
                    "meal_type": data['meal_type'].lower(),
                    "recipe_id": data['recipe_id']
                }
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Meal not found'}), 404
                
            connection.commit()
            return jsonify({'success': True, 'message': 'Meal deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting meal from week: {str(e)}")
        return jsonify({'error': str(e)}), 500

    
@app.route('/api/meal-prep/weeks/<int:week_id>', methods=['GET'])
@auth_required
def get_meal_prep_week(week_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                WITH WeekMeals AS (
                    SELECT 
                        w.id,
                        w.title,
                        w.start_day,
                        w.start_date,
                        w.end_date,
                        w.show_dates,
                        w.created_date,
                        m.day,
                        m.meal_type,
                        m.recipe_id,
                        r.name as recipe_name,
                        r.description,
                        r.prep_time
                    FROM meal_prep_week w
                    LEFT JOIN meal_plan m ON w.id = m.week_id
                    LEFT JOIN recipe r ON m.recipe_id = r.id
                    WHERE w.id = :week_id AND w.user_id = :user_id
                )
                SELECT 
                    id,
                    title,
                    start_day,
                    start_date,
                    end_date,
                    show_dates,
                    created_date,
                    json_object_agg(
                        day, 
                        json_object_agg(
                            meal_type, 
                            json_agg(
                                json_build_object(
                                    'recipe_id', recipe_id,
                                    'name', recipe_name,
                                    'description', description,
                                    'prep_time', prep_time
                                )
                            )
                        )
                    ) as meal_plans
                FROM WeekMeals
                GROUP BY id, title, start_day, start_date, end_date, show_dates, created_date
            """), {"week_id": week_id, "user_id": user_id})
            
            week_data = result.fetchone()
            
            if not week_data:
                return jsonify({'error': 'Week not found or unauthorized'}), 404
            
            # Parse meal_plans JSON
            meal_plans = {}
            if week_data.meal_plans:
                for day, meals_by_type in week_data.meal_plans.items():
                    meal_plans[day] = {}
                    for meal_type, meals in meals_by_type.items():
                        meal_plans[day][meal_type] = meals
            
            return jsonify({
                'id': week_data.id,
                'title': week_data.title,
                'start_day': week_data.start_day,
                'start_date': week_data.start_date.isoformat() if week_data.start_date else None,
                'end_date': week_data.end_date.isoformat() if week_data.end_date else None,
                'show_dates': week_data.show_dates,
                'created_date': week_data.created_date.strftime('%Y-%m-%d'),
                'meal_plans': meal_plans
            })
            
    except Exception as e:
        print(f"Error fetching meal prep week: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/grocery-bill/parse-receipt', methods=['POST'])
def parse_receipt_bill():
    try:
        data = request.json
        receipt_text = data.get('receipt_text')
        
        if not receipt_text:
            return jsonify({'error': 'Receipt text is required'}), 400
            
        # Get all fridge items for comparison
        fridge_items = FridgeItem.query.all()
        
        # Parse receipt lines
        lines = receipt_text.strip().split('\n')
        matched_items = []
        
        for line in lines:
            # Match pattern: Item name followed by quantity and price
            match = re.match(r'^(.*?)\s*(\d+)EA\s*@\s*(\d+\.\d{2})/EA\s*\$(\d+\.\d{2})', line)
            if match:
                name, quantity, price_per, total = match.groups()
                
                # Check if item exists in fridge
                in_fridge = any(
                    item.name.lower() == name.strip().lower() 
                    for item in fridge_items
                )
                
                matched_items.append({
                    'item_name': name.strip(),
                    'quantity': int(quantity),
                    'unit': 'EA',
                    'price': float(price_per),
                    'total': float(total)
                })
                
        return jsonify({
            'grouped_items': {'Receipt Items': matched_items},
            'unmatched_items': []
        })
        
    except Exception as e:
        print(f"Error parsing receipt: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/exercises', methods=['GET'])
@auth_required
def list_exercises():
    try:
        user_id = g.user_id  # Get authenticated user's ID
        
        with db.engine.connect() as connection:
            result = connection.execute(text("""
                SELECT 
                    e.id, 
                    e.name, 
                    e.workout_type, 
                    e.major_groups,
                    e.minor_groups,
                    e.amount_sets,
                    e.amount_reps,
                    e.weight,
                    e.rest_time
                FROM exercises e
                WHERE e.user_id = :user_id
                ORDER BY e.name
            """), {"user_id": user_id})
            
            exercises = [{
                'id': row.id,
                'name': row.name,
                'workout_type': row.workout_type,
                'major_groups': row.major_groups,
                'minor_groups': row.minor_groups,
                'amount_sets': row.amount_sets,
                'amount_reps': row.amount_reps,
                'weight': row.weight,
                'rest_time': row.rest_time
            } for row in result]
            
            return jsonify({
                'success': True,
                'exercises': exercises
            })
            
    except Exception as e:
        print(f"Error listing exercises: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Find this route in app.py
@app.route('/api/exercise', methods=['POST'])
@auth_required  # Add this decorator
def create_exercise():
    try:
        data = request.json
        user_id = g.user_id  # Get authenticated user's ID
        
        engine = create_engine(db_url, poolclass=NullPool)
        major_groups = json.dumps(data['major_groups'])
        minor_groups = json.dumps(data['minor_groups'])
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO exercises (
                        name, workout_type, major_groups, minor_groups,
                        amount_sets, amount_reps, weight, rest_time, user_id
                    ) VALUES (
                        :name, :workout_type, :major_groups, :minor_groups,
                        :amount_sets, :amount_reps, :weight, :rest_time, :user_id
                    ) RETURNING id
                """),
                {
                    'name': data['name'],
                    'workout_type': data['workout_type'],
                    'major_groups': major_groups,
                    'minor_groups': minor_groups,
                    'amount_sets': data['amount_sets'],
                    'amount_reps': data['amount_reps'],
                    'weight': data['weight'],
                    'rest_time': data['rest_time'],
                    'user_id': user_id  # Add the user_id from auth
                }
            )
            
            exercise_id = result.fetchone()[0]
            connection.commit()
            
            return jsonify({
                'message': 'Exercise created successfully',
                'id': exercise_id
            }), 201
            
    except Exception as e:
        print(f"Error creating exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500

    
@app.route('/api/exercises/<int:exercise_id>', methods=['GET'])
@auth_required
def get_exercise_details(exercise_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        
        with db.engine.connect() as connection:
            result = connection.execute(text('''
                SELECT 
                    id, name, workout_type, amount_sets,
                    amount_reps, weight, rest_time
                FROM exercises 
                WHERE id = :exercise_id AND user_id = :user_id
            '''), {
                'exercise_id': exercise_id,
                'user_id': user_id
            })
            
            exercise = result.fetchone()
            
            if not exercise:
                return jsonify({'error': 'Exercise not found or unauthorized'}), 404
            
            exercise_data = {
                'id': exercise.id,
                'name': exercise.name,
                'workout_type': exercise.workout_type,
                'amount_sets': exercise.amount_sets,
                'amount_reps': exercise.amount_reps,
                'weight': exercise.weight,
                'rest_time': exercise.rest_time
            }
            
            return jsonify(exercise_data)
            
    except Exception as e:
        print(f"Error fetching exercise: {str(e)}")
        return jsonify({
            'error': str(e),
            'error_type': type(e).__name__
        }), 500
    


@app.route('/api/exercises/<int:exercise_id>', methods=['DELETE'])
@auth_required
def delete_exercise(exercise_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        
        with db.engine.connect() as connection:
            # First verify ownership
            check_result = connection.execute(
                text("SELECT id FROM exercises WHERE id = :id AND user_id = :user_id"),
                {"id": exercise_id, "user_id": user_id}
            ).fetchone()
            
            if not check_result:
                return jsonify({'error': 'Exercise not found or unauthorized'}), 404
            
            # Delete associated records
            connection.execute(
                text("DELETE FROM set_history WHERE exercise_id = :id"),
                {"id": exercise_id}
            )
            
            connection.execute(
                text("DELETE FROM individual_set WHERE exercise_id = :id"),
                {"id": exercise_id}
            )
            
            # Delete the exercise
            connection.execute(
                text("DELETE FROM exercises WHERE id = :id AND user_id = :user_id"),
                {"id": exercise_id, "user_id": user_id}
            )
            
            connection.commit()
            return jsonify({'message': 'Exercise deleted successfully'}), 200
            
    except Exception as e:
        print(f"Error deleting exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

# In your app.py

    
@app.route('/api/exercises/<int:exercise_id>/sets/history', methods=['GET'])
@auth_required
def get_exercise_set_history(exercise_id):
    try:
        user_id = g.user_id
        
        # Verify exercise ownership
        with db.engine.connect() as connection:
            ownership_check = connection.execute(
                text("SELECT id FROM exercises WHERE id = :exercise_id AND user_id = :user_id"),
                {"exercise_id": exercise_id, "user_id": user_id}
            ).fetchone()
            
            if not ownership_check:
                return jsonify({'error': 'Exercise not found or unauthorized'}), 404

            # Get all history records for this exercise
            result = connection.execute(text("""
                SELECT 
                    sh.id as history_id,
                    sh.created_at,
                    json_agg(
                        json_build_object(
                            'set_number', s.set_number,
                            'reps', s.reps,
                            'weight', s.weight
                        ) ORDER BY s.set_number
                    ) as sets
                FROM set_history sh
                LEFT JOIN individual_set s ON sh.id = s.set_history_id
                WHERE sh.exercise_id = :exercise_id
                GROUP BY sh.id, sh.created_at
                ORDER BY sh.created_at DESC
            """), {"exercise_id": exercise_id})

            history_data = [{
                'id': row.history_id,
                'created_at': row.created_at.isoformat(),
                'sets': row.sets if row.sets else []
            } for row in result]

            return jsonify({'history': history_data})

    except Exception as e:
        print(f"Error fetching exercise history: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/exercises/<int:exercise_id>/sets/latest', methods=['GET'])
@auth_required
def get_latest_set(exercise_id):
    try:
        user_id = g.user_id
        
        with db.engine.connect() as connection:
            # First verify ownership
            ownership_check = connection.execute(
                text("SELECT id FROM exercises WHERE id = :exercise_id AND user_id = :user_id"),
                {"exercise_id": exercise_id, "user_id": user_id}
            ).fetchone()
            
            if not ownership_check:
                return jsonify({'error': 'Exercise not found or unauthorized'}), 404

            # Find the most recent set_history and its best set
            result = connection.execute(text("""
                WITH LatestHistory AS (
                    SELECT id
                    FROM set_history 
                    WHERE exercise_id = :exercise_id
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                SELECT 
                    s.id,
                    s.weight,
                    s.reps,
                    h.created_at
                FROM individual_set s
                JOIN set_history h ON s.set_history_id = h.id
                WHERE s.exercise_id = :exercise_id
                AND h.id IN (SELECT id FROM LatestHistory)
                ORDER BY s.weight DESC, s.reps DESC
                LIMIT 1
            """), {"exercise_id": exercise_id})
            
            latest_set = result.fetchone()
            
            if latest_set:
                return jsonify({
                    'latestSet': {
                        'id': latest_set.id,
                        'weight': latest_set.weight,
                        'reps': latest_set.reps,
                        'created_at': latest_set.created_at.isoformat()
                    }
                })
            else:
                return jsonify({'latestSet': None})

    except Exception as e:
        print(f"Error fetching latest set: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add these new routes above the existing grocery list routes
@app.route('/api/grocery-lists/<int:list_id>', methods=['DELETE'])
def delete_grocery_list(list_id):
    try:
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)

        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Delete the grocery items associated with the list
                connection.execute(
                    text("""
                        DELETE FROM grocery_item
                        WHERE list_id = :list_id
                    """),
                    {"list_id": list_id}
                )
                
                # Delete the grocery list
                result = connection.execute(
                    text("""
                        DELETE FROM grocery_list
                        WHERE id = :list_id
                    """),
                    {"list_id": list_id}
                )
                
                if result.rowcount == 0:
                    return jsonify({'error': 'Grocery list not found'}), 404
            
            # Commit the transaction
            connection.commit()
            
            return jsonify({'message': 'Grocery list deleted successfully'}), 200
        
    except Exception as e:
        print(f"Error deleting grocery list: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/grocery-lists/<int:list_id>/items/<int:item_id>', methods=['DELETE'])
def delete_grocery_item(list_id, item_id):
    try:
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)

        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Delete the grocery item
                result = connection.execute(
                    text("""
                        DELETE FROM grocery_item
                        WHERE id = :item_id AND list_id = :list_id
                    """),
                    {
                        "item_id": item_id,
                        "list_id": list_id
                    }
                )
                
                if result.rowcount == 0:
                    return jsonify({'error': 'Item not found in the specified list'}), 404
            
            # Commit the transaction
            connection.commit()
            
            return jsonify({'message': 'Item deleted successfully'}), 200
        
    except Exception as e:
        print(f"Error deleting grocery item: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/auth/user', methods=['POST'])
def create_user():
    try:
        data = request.json
        user_id = data['user_id']
        
        # Create user record
        user = User(id=user_id, email=data['email'])
        db.session.add(user)
        
        # Add default recipe
        default_recipe = Recipe(
            user_id=user_id,
            name='Getting Started Recipe',
            description='Welcome! Here\'s how to create recipes...',
            instructions='Step 1...'
        )
        db.session.add(default_recipe)
        
        db.session.commit()
        return jsonify({'message': 'User created successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/auth/validate', methods=['POST'])
def validate_token():
    token = request.headers.get('Authorization')
    if not token:
        return jsonify({'valid': False}), 401
    try:
        user = supabase.auth.get_user(token.split(' ')[1])
        return jsonify({'valid': True, 'user': user})
    except:
        return jsonify({'valid': False}), 401
    
@app.route('/api/auth/logout', methods=['POST'])
@auth_required
def logout():
    try:
        supabase.auth.sign_out()
        return jsonify({'message': 'Logged out successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Update all existing routes
@app.route('/api/recipes', methods=['GET'])
@auth_required
def get_recipes():
    try:
        # Only get recipes for the authenticated user
        recipes = Recipe.query.filter_by(user_id=g.user_id).all()
        return jsonify({
            'recipes': [recipe.to_dict() for recipe in recipes]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Migration for existing data
def migrate_existing_data():
    """Migrate existing recipes to default user"""
    default_user_id = 'bc6ae242-c238-4a6b-a884-2fd1fc03ed72'
    Recipe.query.filter_by(user_id=None).update({'user_id': default_user_id})
    db.session.commit()



@app.route('/api/recipe', methods=['POST'])
@auth_required
def add_recipe():
    try:
        data = request.json
        user_id = g.user_id
        
        print(f"=== START RECIPE CREATION ===")
        print(f"Received data: {data}")
        print(f"User ID: {user_id}")
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Test database connection
            test = connection.execute(text("SELECT current_user, current_database()")).fetchone()
            print(f"Database connection test: {test}")
            
            # Construct insert query - use bindparam for more explicit parameter binding
            insert_query = text("""
                INSERT INTO recipe (
                    name, description, instructions, 
                    prep_time, user_id, created_date
                ) VALUES (
                    :name, :description, :instructions,
                    :prep_time, :user_id, CURRENT_TIMESTAMP
                ) RETURNING id, name, user_id
            """)
            
            params = {
                "name": data['name'],
                "description": data.get('description', ''),
                "instructions": data.get('instructions', ''),
                "prep_time": int(data.get('prep_time', 0)),
                "user_id": user_id
            }
            
            print(f"Executing insert with query: {insert_query}")
            print(f"Parameters: {params}")
            
            try:
                result = connection.execute(insert_query, params)
                new_recipe = result.fetchone()
                print(f"Insert result: {new_recipe}")
                
                # Verify the insert worked
                verify = connection.execute(
                    text("SELECT * FROM recipe WHERE id = :id"),
                    {"id": new_recipe.id}
                ).fetchone()
                print(f"Verification query result: {verify}")
                
                # Insert recipe ingredients if provided
                if 'ingredients' in data and data['ingredients']:
                    for ingredient in data['ingredients']:
                        # First, get or create the ingredient
                        ingredient_result = connection.execute(
                            text("""
                                INSERT INTO ingredients (name)
                                VALUES (:name)
                                ON CONFLICT (name) DO NOTHING
                                RETURNING id
                            """),
                            {"name": ingredient['name']}
                        )
                        
                        # Get the ingredient ID (either newly created or existing)
                        ingredient_id = connection.execute(
                            text("SELECT id FROM ingredients WHERE name = :name"),
                            {"name": ingredient['name']}
                        ).fetchone().id
                        
                        # Add ingredient quantity to recipe
                        connection.execute(
                            text("""
                                INSERT INTO recipe_ingredient_quantities 
                                (recipe_id, ingredient_id, quantity, unit)
                                VALUES (:recipe_id, :ingredient_id, :quantity, :unit)
                            """),
                            {
                                "recipe_id": new_recipe.id,
                                "ingredient_id": ingredient_id,
                                "quantity": ingredient['quantity'],
                                "unit": ingredient.get('unit', '')
                            }
                        )
                
                connection.commit()  # Commit the transaction
                
                return jsonify({
                    'message': 'Recipe created successfully',
                    'recipe': {
                        'id': new_recipe.id,
                        'name': new_recipe.name,
                        'user_id': str(new_recipe.user_id)
                    }
                }), 201
                
            except Exception as db_error:
                print(f"Database error during insert: {str(db_error)}")
                connection.rollback()  # Rollback on error
                raise
                
    except Exception as e:
        print(f"=== ERROR IN RECIPE CREATION ===")
        print(f"Error: {str(e)}")
        print(f"Error type: {type(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        print("=== END RECIPE CREATION ===")


@app.route('/api/home-data')
def home_data():
    try:
        # Get total recipes count
        total_recipes = db.session.execute(text('SELECT COUNT(*) FROM recipe')).scalar()
        
        # Get latest recipes with nutrition data
        latest_recipes = db.session.execute(text("""
            WITH LatestRecipes AS (
                SELECT id, name, description, prep_time, created_date
                FROM recipe
                ORDER BY created_date DESC
                LIMIT 6
            )
            SELECT 
                r.*,
                json_agg(DISTINCT i.name) as ingredients,
                COALESCE(SUM(
                    CASE 
                        WHEN rin.serving_size > 0 
                        THEN (rin.protein_grams * riq.quantity / rin.serving_size)
                        ELSE 0 
                    END
                ), 0) as total_protein,
                COALESCE(SUM(
                    CASE 
                        WHEN rin.serving_size > 0 
                        THEN (rin.fat_grams * riq.quantity / rin.serving_size)
                        ELSE 0 
                    END
                ), 0) as total_fat,
                COALESCE(SUM(
                    CASE 
                        WHEN rin.serving_size > 0 
                        THEN (rin.carbs_grams * riq.quantity / rin.serving_size)
                        ELSE 0 
                    END
                ), 0) as total_carbs
            FROM LatestRecipes r
            LEFT JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
            LEFT JOIN ingredients i ON riq.ingredient_id = i.id
            LEFT JOIN recipe_ingredient_nutrition rin ON rin.recipe_ingredient_quantities_id = riq.id
            GROUP BY r.id, r.name, r.description, r.prep_time, r.created_date
        """)).fetchall()
        
        latest_recipes_data = [{
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'prep_time': recipe.prep_time,
            'ingredients': recipe.ingredients if recipe.ingredients else [],
            'total_nutrition': {
                'protein_grams': round(float(recipe.total_protein), 1),
                'fat_grams': round(float(recipe.total_fat), 1),
                'carbs_grams': round(float(recipe.total_carbs), 1)
            }
        } for recipe in latest_recipes]
        
        return jsonify({
            'total_recipes': total_recipes,
            'latest_recipes': latest_recipes_data
        })
    except Exception as e:
        print(f"Error in home_data: {str(e)}")
        db.session.rollback()
        return jsonify({
            'total_recipes': 0,
            'latest_recipes': []
        }), 500
    
# All Recipes Route
# In app.py

@app.route('/api/all-recipes')
@auth_required
def get_all_recipes():
    try:
        user_id = g.user_id  # Get the authenticated user's ID
        print(f"Getting recipes for user: {user_id}")  # Debug log
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT r.*, 
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.protein_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_protein,
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.fat_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_fat,
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.carbs_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_carbs
                    FROM recipe r
                    LEFT JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
                    LEFT JOIN recipe_ingredient_nutrition rin 
                        ON rin.recipe_ingredient_quantities_id = riq.id
                    WHERE r.user_id = :user_id
                    GROUP BY r.id, r.name, r.description, r.prep_time
                    ORDER BY r.created_date DESC
                """),
                {"user_id": user_id}
            )
            
            recipes = [{
                'id': row.id,
                'name': row.name,
                'description': row.description,
                'prep_time': row.prep_time,
                'total_nutrition': {
                    'protein_grams': round(float(row.total_protein), 1),
                    'fat_grams': round(float(row.total_fat), 1),
                    'carbs_grams': round(float(row.total_carbs), 1)
                }
            } for row in result]
            
            return jsonify({
                'recipes': recipes,
                'count': len(recipes)
            })
            
    except Exception as e:
        print(f"Error fetching recipes: {str(e)}")
        return jsonify({'error': str(e)}), 500






from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from flask import jsonify, request

# Supabase connection string
DB_URL = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'



@app.route('/api/menus', methods=['GET'])
@auth_required  # This decorator ensures user is authenticated
def get_menus():
    try:
        user_id = g.user_id  # Get authenticated user's ID from auth decorator
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Modified query to include user filtering
            result = connection.execute(text("""
                SELECT m.id, m.name, COUNT(mr.recipe_id) as recipe_count
                FROM menu m
                LEFT JOIN menu_recipe mr ON m.id = mr.menu_id
                WHERE m.user_id = :user_id  -- Filter by user_id
                GROUP BY m.id, m.name
                ORDER BY m.name
            """), {"user_id": user_id})

            menus_data = [{
                'id': row.id,
                'name': row.name,
                'recipe_count': row.recipe_count
            } for row in result]

            return jsonify({'menus': menus_data})
    except Exception as e:
        print(f"Error fetching menus: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/menus', methods=['POST'])
@auth_required
def create_menu():
    try:
        data = request.json
        user_id = g.user_id  # Get authenticated user's ID
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Menu name is required'}), 400

        engine = create_engine(db_url, poolclass=NullPool)

        with engine.connect() as connection:
            with connection.begin():  # Start a transaction
                # Insert menu with user_id
                result = connection.execute(
                    text("""
                        INSERT INTO menu (name, user_id, created_date)
                        VALUES (:name, :user_id, CURRENT_TIMESTAMP)
                        RETURNING id, name, created_date
                    """),
                    {
                        "name": data['name'],
                        "user_id": user_id
                    }
                )
                
                new_menu = result.fetchone()
                if not new_menu:
                    raise Exception('Failed to create menu')

                return jsonify({
                    'id': new_menu.id,
                    'name': new_menu.name,
                    'created_date': new_menu.created_date.isoformat() if new_menu.created_date else None,
                    'recipe_count': 0
                }), 201

    except Exception as e:
        print(f"Error creating menu: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/menus/<int:menu_id>/recipes', methods=['GET'])
@auth_required
def get_menu_recipes(menu_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First verify menu belongs to user
            menu_result = connection.execute(
                text("""
                    SELECT name 
                    FROM menu 
                    WHERE id = :menu_id AND user_id = :user_id
                """),
                {"menu_id": menu_id, "user_id": user_id}
            ).fetchone()
            
            if not menu_result:
                return jsonify({'error': 'Menu not found or unauthorized'}), 404

            # Get recipes with nutrition data
            result = connection.execute(text("""
                WITH RecipeIngredients AS (
                    SELECT 
                        r.id as recipe_id,
                        r.name as recipe_name,
                        r.description,
                        r.prep_time,
                        json_agg(
                            json_build_object(
                                'name', rid.ingredient_name,
                                'quantity', rid.quantity,
                                'unit', rid.unit
                            )
                        ) as ingredients
                    FROM recipe r
                    JOIN menu_recipe mr ON r.id = mr.recipe_id
                    LEFT JOIN recipe_ingredient_details rid ON r.id = rid.recipe_id
                    WHERE mr.menu_id = :menu_id
                    GROUP BY r.id, r.name, r.description, r.prep_time
                ),
                RecipeNutrition AS (
                    SELECT 
                        ri.recipe_id,
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.protein_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_protein,
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.fat_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_fat,
                        COALESCE(
                            SUM(CASE WHEN rin.serving_size > 0 
                                THEN (rin.carbs_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END), 0
                        ) as total_carbs
                    FROM RecipeIngredients ri
                    LEFT JOIN recipe_ingredient_quantities riq ON ri.recipe_id = riq.recipe_id
                    LEFT JOIN recipe_ingredient_nutrition rin 
                        ON rin.recipe_ingredient_quantities_id = riq.id
                    GROUP BY ri.recipe_id
                )
                SELECT 
                    ri.*,
                    rn.total_protein,
                    rn.total_fat,
                    rn.total_carbs
                FROM RecipeIngredients ri
                LEFT JOIN RecipeNutrition rn ON ri.recipe_id = rn.recipe_id
                ORDER BY ri.recipe_name
            """), {"menu_id": menu_id})

            recipes_data = [{
                'id': row.recipe_id,
                'name': row.recipe_name,
                'description': row.description,
                'prep_time': row.prep_time,
                'ingredients': row.ingredients,
                'total_nutrition': {
                    'protein_grams': round(float(row.total_protein), 1),
                    'fat_grams': round(float(row.total_fat), 1),
                    'carbs_grams': round(float(row.total_carbs), 1)
                }
            } for row in result]

            return jsonify({
                'menu_name': menu_result.name,
                'recipes': recipes_data
            })

    except Exception as e:
        print(f"Error fetching menu recipes: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/menus/<int:menu_id>/recipes', methods=['POST'])
def add_recipe_to_menu(menu_id):
    try:
        data = request.json
        recipe_id = data.get('recipe_id')
        
        if not recipe_id:
            return jsonify({'error': 'Recipe ID is required'}), 400

        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Check if recipe already exists in menu
            existing = connection.execute(
                text("""
                    SELECT id FROM menu_recipe 
                    WHERE menu_id = :menu_id AND recipe_id = :recipe_id
                """),
                {"menu_id": menu_id, "recipe_id": recipe_id}
            ).fetchone()
            
            if existing:
                return jsonify({'error': 'Recipe already exists in menu'}), 400
                
            # Add recipe to menu
            connection.execute(
                text("""
                    INSERT INTO menu_recipe (menu_id, recipe_id)
                    VALUES (:menu_id, :recipe_id)
                """),
                {"menu_id": menu_id, "recipe_id": recipe_id}
            )
            
            connection.commit()
            return jsonify({'message': 'Recipe added to menu successfully'}), 201
            
    except Exception as e:
        print(f"Error adding recipe to menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus/<int:menu_id>', methods=['DELETE'])
@auth_required
def delete_menu(menu_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # First verify the menu belongs to the user
                menu_check = connection.execute(
                    text("""
                        SELECT id FROM menu 
                        WHERE id = :menu_id AND user_id = :user_id
                    """),
                    {"menu_id": menu_id, "user_id": user_id}
                ).fetchone()
                
                if not menu_check:
                    return jsonify({'error': 'Menu not found or unauthorized'}), 404

                # Delete menu recipes first
                connection.execute(
                    text("DELETE FROM menu_recipe WHERE menu_id = :menu_id"),
                    {"menu_id": menu_id}
                )
                
                # Then delete the menu
                result = connection.execute(
                    text("""
                        DELETE FROM menu 
                        WHERE id = :menu_id AND user_id = :user_id
                        RETURNING id
                    """),
                    {"menu_id": menu_id, "user_id": user_id}
                )
                
                if not result.rowcount:
                    return jsonify({'error': 'Menu not found or unauthorized'}), 404
                
            return jsonify({'message': 'Menu deleted successfully'}), 200
            
    except Exception as e:
        print(f"Error deleting menu: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/menus/<int:menu_id>/recipes/<int:recipe_id>', methods=['DELETE'])
@auth_required
def remove_recipe_from_menu(menu_id, recipe_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First verify menu belongs to user
            menu_check = connection.execute(
                text("""
                    SELECT id FROM menu 
                    WHERE id = :menu_id AND user_id = :user_id
                """),
                {"menu_id": menu_id, "user_id": user_id}
            ).fetchone()
            
            if not menu_check:
                return jsonify({'error': 'Menu not found or unauthorized'}), 404

            result = connection.execute(
                text("""
                    DELETE FROM menu_recipe
                    WHERE menu_id = :menu_id AND recipe_id = :recipe_id
                    RETURNING id
                """),
                {"menu_id": menu_id, "recipe_id": recipe_id}
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Recipe not found in menu'}), 404
                
            connection.commit()
            return jsonify({'message': 'Recipe removed from menu successfully'}), 200
            
    except Exception as e:
        print(f"Error removing recipe from menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fridge/add', methods=['POST'])
@auth_required
def add_fridge_item():
    try:
        data = request.json
        user_id = g.user_id  # Get authenticated user's ID
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({
                'success': False,
                'error': 'Name is required'
            }), 400
        
        engine = create_engine(db_url, poolclass=NullPool)
        with engine.connect() as connection:
            # Check if item already exists for this user
            result = connection.execute(
                text("""
                    SELECT id, quantity, unit, price_per 
                    FROM fridge_item 
                    WHERE LOWER(name) = LOWER(:name)
                    AND user_id = :user_id
                """),
                {
                    "name": name,
                    "user_id": user_id
                }
            )
            existing_item = result.fetchone()
            
            if existing_item:
                # Update existing item
                connection.execute(
                    text("""
                        UPDATE fridge_item 
                        SET quantity = :quantity,
                            unit = :unit,
                            price_per = :price_per
                        WHERE id = :id AND user_id = :user_id
                    """),
                    {
                        "id": existing_item.id,
                        "quantity": float(data.get('quantity', existing_item.quantity or 0)),
                        "unit": data.get('unit', existing_item.unit),
                        "price_per": float(data.get('price_per', existing_item.price_per or 0)),
                        "user_id": user_id
                    }
                )
                item_id = existing_item.id
            else:
                # Create new item
                result = connection.execute(
                    text("""
                        INSERT INTO fridge_item (name, quantity, unit, price_per, user_id)
                        VALUES (:name, :quantity, :unit, :price_per, :user_id)
                        RETURNING id
                    """),
                    {
                        "name": name,
                        "quantity": float(data.get('quantity', 0)),
                        "unit": data.get('unit', ''),
                        "price_per": float(data.get('price_per', 0)),
                        "user_id": user_id
                    }
                )
                item_id = result.fetchone()[0]
            
            connection.commit()
            
            # Return the updated/created item
            result = connection.execute(
                text("""
                    SELECT * FROM fridge_item 
                    WHERE id = :id AND user_id = :user_id
                """),
                {
                    "id": item_id,
                    "user_id": user_id
                }
            )
            item = result.fetchone()
            
            return jsonify({
                'success': True,
                'item': {
                    'id': item.id,
                    'name': item.name,
                    'quantity': float(item.quantity) if item.quantity is not None else 0,
                    'unit': item.unit or '',
                    'price_per': float(item.price_per) if item.price_per is not None else 0
                }
            })
            
    except Exception as e:
        print(f"Error adding fridge item: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/fridge/parse-receipt', methods=['POST'])
def parse_receipt():
    try:
        data = request.json
        receipt_text = data['receipt_text']
        
        matched_items, unmatched_items = parse_receipt(receipt_text)
        
        # Update database with matched items
        for ingredient in matched_items:
            fridge_item = FridgeItem.query.filter_by(name=ingredient).first()
            
            if fridge_item:
                fridge_item.quantity += 1  # Increment quantity by 1
            else:
                fridge_item = FridgeItem(
                    name=ingredient,
                    quantity=1
                )
                db.session.add(fridge_item)

        db.session.commit()
        
        return jsonify({
            'matched_items': list(matched_items),
            'unmatched_items': unmatched_items,
            'total_matches': len(matched_items)
        })
    except Exception as e:
        db.session.rollback()
        print(f"Error in parse_receipt: {str(e)}")
        return jsonify({'error': str(e)}), 500


    

@app.route('/api/grocery-lists', methods=['POST'])
@auth_required
def create_grocery_list():
    try:
        data = request.json
        user_id = g.user_id  # Get authenticated user's ID
        
        # Create new list in PostgreSQL
        with engine.connect() as connection:
            # Insert the grocery list with user_id
            result = connection.execute(
                text("""
                    INSERT INTO grocery_list (name, created_date, user_id)
                    VALUES (:name, CURRENT_TIMESTAMP, :user_id)
                    RETURNING id
                """),
                {
                    "name": data['name'],
                    "user_id": user_id
                }
            )
            list_id = result.fetchone()[0]

            # If items are provided, insert them
            if 'items' in data and data['items']:
                for item_name in data['items']:
                    connection.execute(
                        text("""
                            INSERT INTO grocery_item 
                            (list_id, name, quantity, unit, price_per, total)
                            VALUES (:list_id, :name, 0, '', 0, 0)
                        """),
                        {
                            "list_id": list_id,
                            "name": item_name
                        }
                    )

            connection.commit()
            
            return jsonify({
                'message': 'Grocery list created', 
                'id': list_id
            }), 201
            
    except Exception as e:
        print(f"Error creating grocery list: {str(e)}")
        return jsonify({'error': str(e)}), 500

    

@app.route('/api/fridge', methods=['GET'])
@auth_required
def get_fridge_items():
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Query fridge items for specific user
            result = connection.execute(
                text("""
                    SELECT id, name, quantity, unit, price_per
                    FROM fridge_item
                    WHERE user_id = :user_id
                    ORDER BY name
                """),
                {"user_id": user_id}
            )
            
            items = []
            for row in result:
                items.append({
                    'id': row.id,
                    'name': row.name,
                    'quantity': float(row.quantity) if row.quantity is not None else 0,
                    'unit': row.unit or '',
                    'price_per': float(row.price_per) if row.price_per is not None else 0
                })
            
            return jsonify({
                'success': True,
                'ingredients': items
            })
            
    except Exception as e:
        print(f"Error fetching fridge items: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    

@app.route('/api/fridge/<int:item_id>', methods=['DELETE'])
@auth_required
def delete_fridge_item(item_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Verify item exists and belongs to user
            result = connection.execute(
                text("""
                    DELETE FROM fridge_item 
                    WHERE id = :id AND user_id = :user_id
                    RETURNING id
                """),
                {
                    "id": item_id,
                    "user_id": user_id
                }
            )
            
            if not result.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Item not found or unauthorized'
                }), 404
            
            connection.commit()
            
            return jsonify({
                'success': True,
                'message': 'Item deleted successfully'
            })
            
    except Exception as e:
        print(f"Error deleting fridge item: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/api/fridge/<int:item_id>', methods=['PUT'])
@auth_required
def update_fridge_item(item_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Verify item exists and belongs to user
            result = connection.execute(
                text("""
                    SELECT id FROM fridge_item 
                    WHERE id = :id AND user_id = :user_id
                """),
                {
                    "id": item_id,
                    "user_id": user_id
                }
            )
            
            if not result.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Item not found or unauthorized'
                }), 404
            
            # Update the item
            connection.execute(
                text("""
                    UPDATE fridge_item 
                    SET quantity = COALESCE(:quantity, quantity),
                        unit = COALESCE(:unit, unit),
                        price_per = COALESCE(:price_per, price_per)
                    WHERE id = :id AND user_id = :user_id
                """),
                {
                    "id": item_id,
                    "user_id": user_id,
                    "quantity": float(data.get('quantity')) if 'quantity' in data else None,
                    "unit": data.get('unit'),
                    "price_per": float(data.get('price_per')) if 'price_per' in data else None
                }
            )
            
            connection.commit()
            
            # Return updated item
            result = connection.execute(
                text("SELECT * FROM fridge_item WHERE id = :id AND user_id = :user_id"),
                {
                    "id": item_id,
                    "user_id": user_id
                }
            )
            item = result.fetchone()
            
            return jsonify({
                'success': True,
                'item': {
                    'id': item.id,
                    'name': item.name,
                    'quantity': float(item.quantity) if item.quantity is not None else 0,
                    'unit': item.unit or '',
                    'price_per': float(item.price_per) if item.price_per is not None else 0
                }
            })
            
    except Exception as e:
        print(f"Error updating fridge item: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/fridge/clear', methods=['POST'])
@auth_required
def clear_fridge():
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Set all quantities to 0 for the user's items only
            connection.execute(
                text("""
                    UPDATE fridge_item 
                    SET quantity = 0
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id}
            )
            
            connection.commit()
            
            return jsonify({
                'success': True,
                'message': 'All quantities cleared successfully'
            })
            
    except Exception as e:
        print(f"Error clearing fridge: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/fridge/delete-all', methods=['DELETE'])
def delete_all_fridge_items():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Delete all items for the user
            connection.execute(
                text("""
                    DELETE FROM fridge_item 
                    WHERE user_id = :user_id
                """),
                {"user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"}
            )
            
            connection.commit()
            
            return jsonify({
                'success': True,
                'message': 'All items deleted successfully'
            })
            
    except Exception as e:
        print(f"Error deleting all fridge items: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@app.route('/api/fridge/clear', methods=['POST'])
def clear_fridge_items():
    try:
        # Update all items to have quantity 0
        FridgeItem.query.update({FridgeItem.quantity: 0})
        db.session.commit()
        return jsonify({'message': 'All fridge quantities cleared'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search():
    db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
    engine = create_engine(db_url, poolclass=NullPool)
    ingredients = request.args.getlist('ingredient')
    try:
        if ingredients:
            with engine.connect() as connection:
                # Convert ingredients to lowercase
                ingredient_list = ','.join([f"'{ing.lower()}'" for ing in ingredients])
                query = text(f"""
                    WITH matching_recipes AS (
                        SELECT DISTINCT r.id, r.name, r.description, r.prep_time
                        FROM recipe r
                        JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
                        JOIN ingredients i ON riq.ingredient_id = i.id
                        WHERE LOWER(i.name) = ANY(ARRAY[{ingredient_list}]::text[])
                        GROUP BY r.id, r.name, r.description, r.prep_time
                        HAVING COUNT(DISTINCT LOWER(i.name)) >= :ingredient_count
                    )
                    SELECT 
                        r.*,
                        json_agg(DISTINCT i.name) as ingredients,
                        COALESCE(SUM(
                            CASE 
                                WHEN rin.serving_size > 0 
                                THEN (rin.protein_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END
                        ), 0) as total_protein,
                        COALESCE(SUM(
                            CASE 
                                WHEN rin.serving_size > 0 
                                THEN (rin.fat_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END
                        ), 0) as total_fat,
                        COALESCE(SUM(
                            CASE 
                                WHEN rin.serving_size > 0 
                                THEN (rin.carbs_grams * riq.quantity / rin.serving_size)
                                ELSE 0 
                            END
                        ), 0) as total_carbs
                    FROM matching_recipes r
                    LEFT JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
                    LEFT JOIN ingredients i ON riq.ingredient_id = i.id
                    LEFT JOIN recipe_ingredient_nutrition rin ON rin.recipe_ingredient_quantities_id = riq.id
                    GROUP BY r.id, r.name, r.description, r.prep_time
                """)
                
                results = connection.execute(query, {'ingredient_count': len(ingredients)}).fetchall()
                
                recipes_data = [{
                    'id': recipe.id,
                    'name': recipe.name,
                    'description': recipe.description,
                    'prep_time': recipe.prep_time,
                    'ingredients': recipe.ingredients if recipe.ingredients else [],
                    'total_nutrition': {
                        'protein_grams': round(float(recipe.total_protein), 1),
                        'fat_grams': round(float(recipe.total_fat), 1),
                        'carbs_grams': round(float(recipe.total_carbs), 1)
                    }
                } for recipe in results]
                
                return jsonify({
                    'results': recipes_data,
                    'count': len(recipes_data)
                })
        
        return jsonify({'results': [], 'count': 0})
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({'error': str(e), 'results': [], 'count': 0}), 500
    



    
@app.route('/api/recipe/<int:recipe_id>', methods=['PUT'])
def update_recipe(recipe_id):
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Update recipe basic info
                connection.execute(
                    text("""
                        UPDATE recipe 
                        SET name = :name,
                            description = :description,
                            instructions = :instructions,
                            prep_time = :prep_time
                        WHERE id = :recipe_id
                    """),
                    {
                        "recipe_id": recipe_id,
                        "name": data['name'],
                        "description": data['description'],
                        "instructions": data['instructions'],
                        "prep_time": data['prep_time']
                    }
                )
                
                # First, delete existing ingredient quantities
                connection.execute(
                    text("DELETE FROM recipe_ingredient_quantities WHERE recipe_id = :recipe_id"),
                    {"recipe_id": recipe_id}
                )
                
                # Add updated ingredients
                for ingredient in data['ingredients']:
                    # Get or create ingredient
                    result = connection.execute(
                        text("""
                            WITH e AS (
                                INSERT INTO ingredients (name)
                                VALUES (:name)
                                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                                RETURNING id
                            )
                            SELECT id FROM e
                            UNION ALL
                            SELECT id FROM ingredients WHERE name = :name
                            LIMIT 1
                        """),
                        {"name": ingredient['name']}
                    )
                    ingredient_id = result.fetchone()[0]
                    
                    # Add quantity association
                    result = connection.execute(
                        text("""
                            INSERT INTO recipe_ingredient_quantities 
                                (recipe_id, ingredient_id, quantity, unit)
                            VALUES 
                                (:recipe_id, :ingredient_id, :quantity, :unit)
                            RETURNING id
                        """),
                        {
                            "recipe_id": recipe_id,
                            "ingredient_id": ingredient_id,
                            "quantity": ingredient['quantity'],
                            "unit": ingredient['unit']
                        }
                    )
                    quantity_id = result.fetchone()[0]
                    
                    # Add nutrition if provided
                    if ingredient.get('nutrition'):
                        nutrition = ingredient['nutrition']
                        connection.execute(
                            text("""
                                INSERT INTO recipe_ingredient_nutrition
                                    (recipe_ingredient_quantities_id, protein_grams,
                                     fat_grams, carbs_grams, serving_size, serving_unit)
                                VALUES
                                    (:quantity_id, :protein_grams, :fat_grams, 
                                     :carbs_grams, :serving_size, :serving_unit)
                            """),
                            {
                                "quantity_id": quantity_id,
                                "protein_grams": nutrition.get('protein_grams', 0),
                                "fat_grams": nutrition.get('fat_grams', 0),
                                "carbs_grams": nutrition.get('carbs_grams', 0),
                                "serving_size": nutrition.get('serving_size', 0),
                                "serving_unit": nutrition.get('serving_unit', '')
                            }
                        )

        # After successful update, fetch and return the updated recipe
        return get_recipe(recipe_id)
        
    except Exception as e:
        print(f"Error updating recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/recipe/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    try:
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url, poolclass=NullPool)

        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Delete recipe ingredient details first
                connection.execute(
                    text("DELETE FROM recipe_ingredient_details WHERE recipe_id = :recipe_id"),
                    {"recipe_id": recipe_id}
                )

                # Delete recipe ingredient quantities and associated nutrition data
                # PostgreSQL will handle cascade deletes for nutrition data
                connection.execute(
                    text("DELETE FROM recipe_ingredient_quantities WHERE recipe_id = :recipe_id"),
                    {"recipe_id": recipe_id}
                )

                # Delete recipe from menus
                connection.execute(
                    text("DELETE FROM menu_recipe WHERE recipe_id = :recipe_id"),
                    {"recipe_id": recipe_id}
                )

                # Delete the recipe itself
                result = connection.execute(
                    text("DELETE FROM recipe WHERE id = :recipe_id RETURNING id"),
                    {"recipe_id": recipe_id}
                )

                if not result.rowcount:
                    return jsonify({'error': 'Recipe not found'}), 404

            return jsonify({'message': 'Recipe deleted successfully'}), 200

    except Exception as e:
        print(f"Error deleting recipe: {str(e)}")  # Debug logging
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/recipe/<int:recipe_id>/ingredients/<int:ingredient_id>', methods=['DELETE'])
def delete_recipe_ingredient(recipe_id, ingredient_id):
    try:
        # Find the recipe-ingredient quantity association
        quantity = RecipeIngredientQuantity.query.filter_by(
            recipe_id=recipe_id,
            ingredient_id=ingredient_id
        ).first_or_404()

        # Delete associated nutrition data first
        if quantity.nutrition:
            db.session.delete(quantity.nutrition)

        # Delete the quantity association
        db.session.delete(quantity)

        # Check if this ingredient is used in any other recipes
        other_uses = RecipeIngredientQuantity.query.filter_by(
            ingredient_id=ingredient_id
        ).count()

        # If this was the only recipe using this ingredient, delete the ingredient too
        if other_uses <= 1:
            ingredient = Ingredient.query.get(ingredient_id)
            if ingredient:
                db.session.delete(ingredient)

        db.session.commit()
        return jsonify({'message': 'Ingredient deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting ingredient: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/grocery-lists/<int:list_id>', methods=['GET'])
@auth_required
def get_grocery_list(list_id):
    try:
        user_id = g.user_id
        engine = create_engine(db_url, poolclass=NullPool)

        with engine.connect() as connection:
            # First verify the list belongs to the user
            list_result = connection.execute(
                text("""
                    SELECT id, name, user_id
                    FROM grocery_list
                    WHERE id = :list_id AND user_id = :user_id
                """),
                {
                    "list_id": list_id,
                    "user_id": user_id
                }
            ).fetchone()

            if not list_result:
                return jsonify({'error': 'Grocery list not found or unauthorized'}), 404

            # Get all items for the list
            items_result = connection.execute(
                text("""
                    SELECT id, name, quantity, unit, price_per, total
                    FROM grocery_item
                    WHERE list_id = :list_id
                    ORDER BY name
                """),
                {"list_id": list_id}
            )

            items_data = [{
                'id': item.id,
                'name': item.name,
                'quantity': float(item.quantity) if item.quantity is not None else 0,
                'unit': item.unit or '',
                'price_per': float(item.price_per) if item.price_per is not None else 0,
                'total': float(item.total) if item.total is not None else 0
            } for item in items_result]

            return jsonify({
                'id': list_result.id,
                'name': list_result.name,
                'items': items_data
            })

    except Exception as e:
        print(f"Error fetching grocery list: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Other routes that should remain (make sure there's only one of each)
@app.route('/api/grocery-lists', methods=['GET'])
@auth_required
def get_grocery_lists():
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)

        with engine.connect() as connection:
            # Query grocery lists with their items using SQLAlchemy text
            result = connection.execute(text("""
                SELECT
                    gl.id,
                    gl.name,
                    COALESCE(json_agg(json_build_object(
                        'id', gi.id,
                        'name', gi.name,
                        'quantity', gi.quantity,
                        'unit', gi.unit,
                        'price_per', gi.price_per,
                        'total', gi.total
                    )) FILTER (WHERE gi.id IS NOT NULL), '[]') AS items
                FROM grocery_list gl
                LEFT JOIN grocery_item gi ON gl.id = gi.list_id
                WHERE gl.user_id = :user_id
                GROUP BY gl.id, gl.name
                ORDER BY gl.created_date DESC
            """), {"user_id": user_id})  

            lists_data = []
            for row in result:
                lists_data.append({
                    'id': row.id,
                    'name': row.name,
                    'items': row.items if isinstance(row.items, list) else []
                })

            return jsonify({'lists': lists_data})

    except Exception as e:
        print(f"Error fetching grocery lists: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/grocery-lists/<int:list_id>/items/<int:item_id>', methods=['PUT'])
def update_grocery_item(list_id, item_id):
    try:
        data = request.json
        
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)

        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Update the grocery item
                result = connection.execute(
                    text("""
                        UPDATE grocery_item
                        SET 
                            name = COALESCE(:name, name),
                            quantity = COALESCE(:quantity, quantity),
                            unit = COALESCE(:unit, unit),
                            price_per = COALESCE(:price_per, price_per),
                            total = COALESCE(:quantity, quantity) * COALESCE(:price_per, price_per)
                        WHERE id = :item_id AND list_id = :list_id
                        RETURNING id, name, quantity, unit, price_per, total
                    """),
                    {
                        "item_id": item_id,
                        "list_id": list_id,
                        "name": data.get('name'),
                        "quantity": float(data['quantity']) if 'quantity' in data else None,
                        "unit": data.get('unit'),
                        "price_per": float(data['price_per']) if 'price_per' in data else None
                    }
                )

                updated_item = result.fetchone()
                
                if not updated_item:
                    return jsonify({'error': 'Item not found in the specified list'}), 404
            
            # Commit the transaction
            connection.commit()
            
            return jsonify({
                'message': 'Item updated successfully',
                'item': {
                    'id': updated_item.id,
                    'name': updated_item.name,
                    'quantity': float(updated_item.quantity),
                    'unit': updated_item.unit,
                    'price_per': float(updated_item.price_per),
                    'total': float(updated_item.total)
                }
            }), 200
            
    except Exception as e:
        print(f"Error updating grocery item: {str(e)}")
        return jsonify({'error': str(e)}), 500   


# Find and replace the existing GroceryItem model with this:
class GroceryItem(db.Model):
    __tablename__ = 'grocery_item'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    list_id = db.Column(db.Integer, db.ForeignKey('grocery_list.id'), nullable=False)
    list = db.relationship('GroceryList', back_populates='items')
    quantity = db.Column(db.Float, default=0)
    unit = db.Column(db.String(20))
    price_per = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0)

    def calculate_total(self):
        return float(self.quantity or 0) * float(self.price_per or 0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'list_id': self.list_id,
            'quantity': float(self.quantity) if self.quantity is not None else 0,
            'unit': self.unit or '',
            'price_per': float(self.price_per) if self.price_per is not None else 0,
            'total': float(self.total) if self.total is not None else 0
        }

def merge_grocery_items(list_id, items_to_add):
    """
    Helper function to merge grocery items with existing ones
    Returns list of items after merging
    """
    existing_items = GroceryItem.query.filter_by(list_id=list_id).all()
    merged_items = []
    
    for item in items_to_add:
        # Clean names for comparison by removing prefixes
        clean_name = item['name'].replace('✓ ', '').replace('• ', '')
        if clean_name.startswith('**') or clean_name.startswith('###'):
            # Don't duplicate headers - just add if not exists
            existing_header = next(
                (x for x in existing_items if x.name == item['name']), 
                None
            )
            if not existing_header:
                merged_items.append(item)
            continue
            
        # Look for matching ingredient (same name and unit)
        existing_item = next(
            (x for x in existing_items 
             if x.name.replace('✓ ', '').replace('• ', '') == clean_name
             and x.unit == item['unit']),
            None
        )
        
        if existing_item:
            # Update existing item
            existing_item.quantity += item['quantity']
            existing_item.total = existing_item.quantity * existing_item.price_per
            existing_item.name = item['name']  # Update check/bullet status
        else:
            # Add as new item
            merged_items.append(item)
            
    return merged_items




@app.route('/api/grocery-lists/<int:list_id>/add-menu/<int:menu_id>', methods=['POST'])
def add_menu_to_grocery_list(list_id, menu_id):
    try:
        menu = Menu.query.get_or_404(menu_id)
        items_to_add = []
        
        # Add menu header
        items_to_add.append({
            'name': f"--- {menu.name} ---",
            'quantity': 1,
            'unit': '',
            'price_per': 0,
            'total': 0
        })
        
        # Get all recipes in menu
        menu_recipes = MenuRecipe.query.filter_by(menu_id=menu_id).all()
        fridge_items = FridgeItem.query.all()
        
        for menu_recipe in menu_recipes:
            recipe = Recipe.query.get(menu_recipe.recipe_id)
            if not recipe:
                continue
                
            # Add recipe header
            items_to_add.append({
                'name': f"{recipe.name}",
                'quantity': 0,
                'unit': '',
                'price_per': 0,
                'total': 0
            })
            
            # Get recipe ingredients
            ingredients = RecipeIngredientDetails.query.filter_by(recipe_id=recipe.id).all()
            
            # Add ingredients
            for ingredient in ingredients:
                inFridge = any(
                    item.name.lower() == ingredient.ingredient_name.lower() and 
                    item.quantity > 0 
                    for item in fridge_items
                )
                
                items_to_add.append({
                    'name': f"{'✓' if inFridge else '•'} {ingredient.ingredient_name}",
                    'quantity': ingredient.quantity,
                    'unit': ingredient.unit,
                    'price_per': 0,
                    'total': 0
                })
        
        # Merge with existing items
        merged_items = merge_grocery_items(list_id, items_to_add)
        
        # Add new items to database
        for item in merged_items:
            grocery_item = GroceryItem(
                list_id=list_id,
                **item
            )
            db.session.add(grocery_item)
        
        db.session.commit()
        return jsonify({'message': 'Menu added successfully'}), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

 
@app.route('/api/grocery-lists/<int:list_id>/condense', methods=['POST'])
def condense_grocery_list(list_id):
    try:
        # Get all items in the list
        items = GroceryItem.query.filter_by(list_id=list_id).all()
        
        # Create a dictionary to track processed items
        processed_items = {}
        processed_recipes = {}
        processed_menus = {}
        items_to_delete = []
        
        for item in items:
            # Handle menu headers separately
            if item.name.startswith('###'):
                menu_name = item.name.lower()
                if menu_name in processed_menus:
                   destination_item = processed_menus[menu_name]
                   destination_item.quantity = float(destination_item.quantity or 0) + 1
                   db.session.flush()
                   items_to_delete.append(item)
                else:
                   if not item.quantity or item.quantity == 0:
                       item.quantity = 1
                   processed_menus[menu_name] = item
                continue

                  # Handle recipe names
            elif item.name.startswith('**'):
                recipe_name = item.name.lower()
                if recipe_name in processed_recipes:
                   # Add quantity (1) to existing recipe header
                   destination_item = processed_recipes[recipe_name]
                   destination_item.quantity = float(destination_item.quantity or 0) + 1
                   db.session.flush()
                   items_to_delete.append(item)
                else:
                   # Set initial quantity to 1 for recipe headers
                    if not item.quantity or item.quantity == 0:
                       item.quantity = 1
                    processed_recipes[recipe_name] = item
                continue
                
            # Clean the item name for comparison
            clean_name = item.name.replace('✓ ', '').replace('• ', '').lower()
            
            # Create a key combining name and unit for matching
            key = f"{clean_name}|{item.unit}"
            
            if key in processed_items:
                # Add quantity to existing item
                destination_item = processed_items[key]
                destination_item.quantity += item.quantity
                destination_item.total = destination_item.quantity * destination_item.price_per
                items_to_delete.append(item)
            else:
                processed_items[key] = item
        
        # Delete the merged items
        for item in items_to_delete:
            db.session.delete(item)
            
        db.session.commit()
        return jsonify({'message': 'List condensed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error condensing list: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/grocery-lists/<int:list_id>/items', methods=['POST'])
@auth_required
def add_item_to_list(list_id):
    try:
        user_id = g.user_id
        data = request.json
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Name is required'}), 400

        engine = create_engine(db_url, poolclass=NullPool)

        with engine.connect() as connection:
            # First verify the list belongs to the user
            list_check = connection.execute(
                text("""
                    SELECT id FROM grocery_list
                    WHERE id = :list_id AND user_id = :user_id
                """),
                {
                    "list_id": list_id,
                    "user_id": user_id
                }
            ).fetchone()

            if not list_check:
                return jsonify({'error': 'Grocery list not found or unauthorized'}), 404

            # Insert the new item
            result = connection.execute(
                text("""
                    INSERT INTO grocery_item 
                    (list_id, name, quantity, unit, price_per, total)
                    VALUES (
                        :list_id, :name, :quantity, :unit, :price_per,
                        :quantity * :price_per
                    )
                    RETURNING id, name, quantity, unit, price_per, total
                """),
                {
                    "list_id": list_id,
                    "name": data['name'],
                    "quantity": float(data.get('quantity', 0)),
                    "unit": data.get('unit', ''),
                    "price_per": float(data.get('price_per', 0))
                }
            )

            new_item = result.fetchone()
            connection.commit()

            return jsonify({
                'message': 'Item added successfully',
                'item': {
                    'id': new_item.id,
                    'name': new_item.name,
                    'quantity': float(new_item.quantity),
                    'unit': new_item.unit,
                    'price_per': float(new_item.price_per),
                    'total': float(new_item.total)
                }
            }), 201

    except Exception as e:
        print(f"Error adding item to list: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/import-to-fridge', methods=['POST'])
def import_to_fridge():
    try:
        data = request.json
        items = data.get('items', [])
         
        for item in items:
             # Check if item already exists
            existing_item = FridgeItem.query.filter(
                func.lower(FridgeItem.name) == func.lower(item['item_name'])
            ).first()
             
            if existing_item:
                existing_item.quantity = float(existing_item.quantity) + float(item['quantity'])
                existing_item.unit = item.get('unit', '')
                existing_item.price_per = float(item['price']) if 'price' in item else 0
            else:
                new_item = FridgeItem(
                    name=item['item_name'],
                    quantity=float(item['quantity']),
                    unit=item.get('unit', ''),
                    price_per=float(item['price']) if 'price' in item else 0
                )
                db.session.add(new_item)
         
        db.session.commit()
        return jsonify({'message': 'Items imported successfully'}), 200
         
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
 
@app.route('/api/import-to-grocery-list', methods=['POST'])
def import_to_grocery_list():
    try:
        data = request.json
        name = data.get('name')
        items = data.get('items', [])
         
        if not name:
            return jsonify({'error': 'List name is required'}), 400
             
        new_list = GroceryList(name=name)
        db.session.add(new_list)
        db.session.flush()
         
        for item in items:
            grocery_item = GroceryItem(
                name=item['item_name'],
                list_id=new_list.id,
                quantity=float(item['quantity']),
                unit=item.get('unit', ''),
                price_per=float(item['price']) if 'price' in item else 0,
                total=float(item['quantity']) * float(item['price']) if 'price' in item else 0
            )
            db.session.add(grocery_item)
             
        db.session.commit()
        return jsonify({'message': 'Grocery list created successfully', 'id': new_list.id}), 201
         
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/recipe-ingredient-details', methods=['POST'])
def add_recipe_ingredient_details():
    try:
        data = request.json
        # Validate required fields
        required_fields = ['recipe_id', 'ingredient_name', 'quantity']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Create the recipe ingredient details
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO recipe_ingredient_details 
            (recipe_id, ingredient_name, quantity, unit)
            VALUES (%s, %s, %s, %s)
            """,
            (data['recipe_id'], data['ingredient_name'], 
             data['quantity'], data.get('unit', ''))
        )
        db.commit()
        return jsonify({'message': 'Recipe ingredient details added successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500



    

@app.route('/api/exercise/<int:exercise_id>', methods=['DELETE'])
def delete_exercise_by_id(exercise_id):
    try:
        exercise = Exercise.query.get_or_404(exercise_id)
        
        # Delete associated records
        SetHistory.query.filter_by(exercise_id=exercise_id).delete()
        IndividualSet.query.filter_by(exercise_id=exercise_id).delete()
        
        # Delete the exercise
        db.session.delete(exercise)
        db.session.commit()
        
        return jsonify({'message': 'Exercise deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recipe/<int:recipe_id>/ingredients', methods=['GET'])
def get_recipe_ingredients(recipe_id):
    try:
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)

        with engine.connect() as connection:
            # Query ingredients with quantities and units
            result = connection.execute(text("""
                SELECT 
                    i.name,
                    riq.quantity,
                    riq.unit,
                    i.id as ingredient_id
                FROM recipe_ingredient_quantities riq
                JOIN ingredients i ON riq.ingredient_id = i.id
                WHERE riq.recipe_id = :recipe_id
            """), {"recipe_id": recipe_id})

            ingredients = [{
                'name': row.name,
                'quantity': float(row.quantity) if row.quantity else 0,
                'unit': row.unit or '',
                'ingredient_id': row.ingredient_id
            } for row in result]

            return jsonify({
                'success': True,
                'ingredients': ingredients
            })

    except Exception as e:
        print(f"Error fetching recipe ingredients: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch recipe ingredients'
        }), 500
    
@app.route('/api/recipe/<int:recipe_id>/ingredients/<int:ingredient_index>/nutrition', methods=['POST'])
def add_ingredient_nutrition(recipe_id, ingredient_index):
    try:
        data = request.json
        print(f"Received nutrition data: {data}")
        
        # Get quantity records
        quantity_records = RecipeIngredientQuantity.query.filter_by(recipe_id=recipe_id).all()
        
        print(f"Total Quantity Records: {len(quantity_records)}")
        for idx, record in enumerate(quantity_records):
            print(f"Record {idx}: ID={record.id}, Ingredient ID={record.ingredient_id}")
        
        if ingredient_index >= len(quantity_records):
            return jsonify({
                'error': 'Invalid ingredient index', 
                'total_records': len(quantity_records)
            }), 400
            
        quantity_record = quantity_records[ingredient_index]
        
        # Check if nutrition already exists and delete if it does
        existing_nutrition = RecipeIngredientNutrition.query.filter_by(
            recipe_ingredient_quantities_id=quantity_record.id
        ).first()
        
        if existing_nutrition:
            db.session.delete(existing_nutrition)
            db.session.flush()
        
        # Create new nutrition record
        nutrition = RecipeIngredientNutrition(
            recipe_ingredient_quantities_id=quantity_record.id,
            protein_grams=float(data.get('protein_grams', 0)),
            fat_grams=float(data.get('fat_grams', 0)),
            carbs_grams=float(data.get('carbs_grams', 0)),
            serving_size=float(data.get('serving_size', 0)),
            serving_unit=data.get('serving_unit', '')
        )
        
        db.session.add(nutrition)
        db.session.commit()
        
        return jsonify({
            'message': 'Nutrition info added successfully',
            'nutrition': {
                'protein_grams': nutrition.protein_grams,
                'fat_grams': nutrition.fat_grams,
                'carbs_grams': nutrition.carbs_grams,
                'serving_size': nutrition.serving_size,
                'serving_unit': nutrition.serving_unit
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        # More comprehensive error logging
        import traceback
        print(f"Error adding nutrition info: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            'error': 'Failed to add nutrition',
            'details': str(e),
            'traceback': traceback.format_exc()
        }), 500
    


@app.route('/api/recipe/<int:recipe_id>', methods=['GET'])
@auth_required
def get_recipe(recipe_id):
    try:
        # Use the authenticated user's ID from g object
        user_id = g.user_id
        print(f"Fetching recipe {recipe_id} for user {user_id}")  # Debug print
        recipe = Recipe.query.filter_by(id=recipe_id, user_id=user_id).first()
        if not recipe:
            return jsonify({'error': 'Recipe not found'}), 404
        
        # Create the database engine using Supabase credentials
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Debugging: Print out the SQL query and parameters
            recipe_ownership_query = text("""
                SELECT id FROM recipe 
                WHERE id = :recipe_id AND user_id = :user_id
            """)
            
            print(f"Checking recipe ownership query: {recipe_ownership_query}")
            print(f"Query parameters: recipe_id={recipe_id}, user_id={user_id}")
            
            # First, verify the recipe belongs to the authenticated user
            recipe_ownership = connection.execute(
                recipe_ownership_query,
                {
                    "recipe_id": recipe_id,
                    "user_id": user_id
                }
            ).fetchone()
            
            print(f"Recipe ownership result: {recipe_ownership}")
            
            if not recipe_ownership:
                print(f"No recipe found for id {recipe_id} and user {user_id}")
                return jsonify({'error': 'Recipe not found or unauthorized'}), 404
            
            # Get basic recipe information
            recipe_result = connection.execute(
                text("""
                    SELECT id, name, description, instructions, prep_time, created_date
                    FROM recipe
                    WHERE id = :recipe_id AND user_id = :user_id
                """),
                {
                    "recipe_id": recipe_id,
                    "user_id": user_id
                }
            ).first()
            
            print(f"Recipe result: {recipe_result}")
            
            if not recipe_result:
                return jsonify({'error': 'Recipe not found'}), 404
            
            # Get ingredients with their quantities and units
            ingredients_result = connection.execute(
                text("""
                    SELECT 
                        i.name,
                        riq.quantity,
                        riq.unit,
                        rin.protein_grams,
                        rin.fat_grams,
                        rin.carbs_grams,
                        rin.serving_size,
                        rin.serving_unit
                    FROM recipe_ingredient_quantities riq
                    JOIN ingredients i ON riq.ingredient_id = i.id
                    LEFT JOIN recipe_ingredient_nutrition rin 
                        ON rin.recipe_ingredient_quantities_id = riq.id
                    WHERE riq.recipe_id = :recipe_id
                """),
                {"recipe_id": recipe_id}
            )
            
            # Process ingredients and calculate total nutrition
            ingredients = []
            total_nutrition = {
                'protein_grams': 0,
                'fat_grams': 0,
                'carbs_grams': 0
            }
            
            for ing in ingredients_result:
                # Calculate scaled nutrition values if nutrition data exists
                nutrition = None
                if ing.serving_size and ing.serving_size > 0:
                    ratio = ing.quantity / ing.serving_size
                    nutrition = {
                        'protein_grams': float(ing.protein_grams or 0),
                        'fat_grams': float(ing.fat_grams or 0),
                        'carbs_grams': float(ing.carbs_grams or 0),
                        'serving_size': float(ing.serving_size),
                        'serving_unit': ing.serving_unit
                    }
                    
                    # Add to total nutrition
                    total_nutrition['protein_grams'] += (ing.protein_grams or 0) * ratio
                    total_nutrition['fat_grams'] += (ing.fat_grams or 0) * ratio
                    total_nutrition['carbs_grams'] += (ing.carbs_grams or 0) * ratio
                
                ingredients.append({
                    'name': ing.name,
                    'quantity': float(ing.quantity),
                    'unit': ing.unit,
                    'nutrition': nutrition
                })
            
            # Round total nutrition values
            total_nutrition = {
                key: round(value, 1)
                for key, value in total_nutrition.items()
            }
            
            # Construct the response
            recipe_data = {
                'id': recipe_result.id,
                'name': recipe_result.name,
                'description': recipe_result.description,
                'instructions': recipe_result.instructions,
                'prep_time': recipe_result.prep_time,
                'created_date': recipe_result.created_date.isoformat() if recipe_result.created_date else None,
                'ingredients': ingredients,
                'total_nutrition': total_nutrition
            }
            
            return jsonify(recipe_data)
            
    except Exception as e:
        print("Full error details:")
        print("Error Type:", type(e).__name__)
        print("Error Message:", str(e))
        
        # Print full traceback
        print("Traceback:")
        traceback.print_exc()
        
        # If there's a database-specific error, print more details
        if hasattr(e, 'orig'):
            print("Original DB Error:", e.orig)
        
        return jsonify({
            'error': 'Internal server error',
            'details': str(e),
            'error_type': type(e).__name__
        }), 500

@app.route('/api/recipe/<int:recipe_id>/nutrition', methods=['GET'])
def get_recipe_nutrition(recipe_id):
    try:
        with db.engine.connect() as connection:
            result = connection.execute(text("""
                SELECT * FROM recipe_nutrition_view 
                WHERE recipe_id = :recipe_id
            """), {"recipe_id": recipe_id})
            
            nutrition_data = []
            for row in result:
                nutrition_data.append({
                    'ingredient_name': row.ingredient_name,
                    'quantity': float(row.quantity),
                    'unit': row.unit,
                    'nutrition': {
                        'protein_grams': float(row.protein_grams) if row.protein_grams else 0,
                        'fat_grams': float(row.fat_grams) if row.fat_grams else 0,
                        'carbs_grams': float(row.carbs_grams) if row.carbs_grams else 0,
                        'serving_size': float(row.serving_size) if row.serving_size else 0,
                        'serving_unit': row.serving_unit
                    }
                })
            
            return jsonify({'nutrition_data': nutrition_data})
    except Exception as e:
        print(f"Error getting nutrition info: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

    

# Add this route to your app.py

# Replace or update your sets endpoint in app.py


# Add a test route to verify exercise existence
@app.route('/api/exercises/<int:exercise_id>/test', methods=['GET'])
def test_exercise_exists(exercise_id):
    try:
        with db.engine.connect() as connection:
            result = connection.execute(
                text("SELECT id, name FROM exercises WHERE id = :exercise_id"),
                {"exercise_id": exercise_id}
            ).fetchone()
            
            if result:
                return jsonify({
                    'exists': True,
                    'id': result.id,
                    'name': result.name
                })
            else:
                return jsonify({
                    'exists': False,
                    'queried_id': exercise_id
                })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'queried_id': exercise_id
        }), 500

@app.route('/api/exercises/diagnostic', methods=['GET'])
def diagnose_exercises():
    try:
        with db.engine.connect() as connection:
            # Get total count
            count_result = connection.execute(
                text("SELECT COUNT(*) as count FROM exercises")
            ).scalar()
            
            # Get all exercise IDs for debugging
            ids_result = connection.execute(
                text("SELECT id FROM exercises ORDER BY id")
            ).fetchall()
            
            # Get specific exercise 3 if it exists
            exercise_3 = connection.execute(
                text("SELECT * FROM exercises WHERE id = 3")
            ).fetchone()
            
            return jsonify({
                'total_exercises': count_result,
                'all_exercise_ids': [row[0] for row in ids_result],
                'exercise_3_exists': exercise_3 is not None,
                'exercise_3_data': dict(exercise_3) if exercise_3 else None
            })
            
    except Exception as e:
        print(f"Diagnostic error: {str(e)}")
        return jsonify({
            'error': str(e),
            'error_type': type(e).__name__
        }), 500

@app.route('/api/workouts', methods=['POST'])
def create_workout():
    try:
        data = request.json
        if not data or 'name' not in data:
            return jsonify({'error': 'Workout name is required'}), 400
        
        new_workout = Workout(name=data['name'])
        db.session.add(new_workout)
        db.session.commit()
        
        return jsonify({
            'id': new_workout.id,
            'name': new_workout.name
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error creating workout: {str(e)}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    try:
        workouts = Workout.query.order_by(Workout.created_at.desc()).all()
        workouts_data = [{
            'id': workout.id,
            'name': workout.name,
            'created_at': workout.created_at.isoformat() if workout.created_at else None,
            'exercise_count': len(workout.exercises)
        } for workout in workouts]
        
        return jsonify({"workouts": workouts_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Add these routes to your Flask app
from flask import jsonify, request
from datetime import datetime


@app.route('/api/weekly-workouts', methods=['POST'])
def add_workout():
    try:
        data = request.json
        if not data or 'day' not in data or 'exercises' not in data:
            return jsonify({'error': 'Invalid request data'}), 400
            
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():  # Start a transaction
                # First delete any existing exercises for this day
                connection.execute(
                    text("""
                        DELETE FROM weekly_workouts 
                        WHERE day = :day AND week_id = 1
                    """),
                    {"day": data['day']}
                )
                
                # Then insert the new exercises
                for exercise in data['exercises']:
                    connection.execute(
                        text("""
                            INSERT INTO weekly_workouts (day, exercise_id, week_id)
                            VALUES (:day, :exercise_id, 1)
                        """),
                        {
                            "day": data['day'],
                            "exercise_id": exercise['id']
                        }
                    )
            
            # Fetch the updated workouts for this day
            result = connection.execute(
                text("""
                    SELECT 
                        ww.day,
                        e.id,
                        e.name,
                        e.workout_type,
                        e.major_groups,
                        e.minor_groups,
                        e.amount_sets,
                        e.amount_reps,
                        e.weight,
                        e.rest_time
                    FROM weekly_workouts ww
                    JOIN exercises e ON ww.exercise_id = e.id
                    WHERE ww.day = :day AND ww.week_id = 1
                    ORDER BY e.workout_type
                """),
                {"day": data['day']}
            )
            
            workouts = []
            for row in result:
                workouts.append({
                    'id': row.id,
                    'name': row.name,
                    'workout_type': row.workout_type,
                    'major_groups': row.major_groups,
                    'minor_groups': row.minor_groups,
                    'amount_sets': row.amount_sets,
                    'amount_reps': row.amount_reps,
                    'weight': row.weight,
                    'rest_time': row.rest_time
                })
            
            return jsonify({
                'message': 'Workouts added successfully',
                'workouts': workouts
            })
            
    except Exception as e:
        print(f"Error adding workout: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/send-email', methods=['OPTIONS'])
def handle_email_preflight():
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response
   
@app.route('/api/send-email', methods=['POST', 'OPTIONS'])

def send_email():
    print("Received email request")  # Debug print
    if request.method == 'OPTIONS':
        return create_cors_response()
        
    try:
        print("Request data:", request.json)  # Debug print
        data = request.json
        subject = data.get('subject')
        body = data.get('body')
        
        if not subject or not body:
            return jsonify({'error': 'Subject and body are required'}), 400
            
        # Load credentials from token file
        token_path = os.path.join('instance', 'token.json')
        if not os.path.exists(token_path):
            return jsonify({'error': 'Gmail authentication not set up'}), 500
            
        creds = Credentials.from_authorized_user_file(token_path, ['https://www.googleapis.com/auth/gmail.send'])
        
        service = build('gmail', 'v1', credentials=creds)
        
        # Create message
        message = MIMEText(body)
        message['to'] = "maxwayne903@gmail.com"  # Replace with your email
        message['subject'] = subject
        
        # Encode the message
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Send message
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        
        return jsonify({'message': 'Email sent successfully'}), 200
        pass
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return jsonify({'error': str(e)}), 500

def create_cors_response():
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return response, 200




@app.route('/api/weekly-workouts/<day>/<int:exercise_id>', methods=['DELETE'])
def remove_workout_exercise(day, exercise_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    DELETE FROM weekly_workouts 
                    WHERE day = :day 
                    AND exercise_id = :exercise_id 
                    AND week_id = 1
                """),
                {'day': day, 'exercise_id': exercise_id}
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Workout exercise not found'}), 404
                
            connection.commit()
            return jsonify({'message': 'Exercise removed successfully'})
            
    except Exception as e:
        print(f"Error removing exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/weekly-workouts', methods=['GET'])
def get_weekly_workouts():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                WITH LatestSets AS (
                    SELECT DISTINCT ON (exercise_id) 
                        exercise_id,
                        weight,
                        reps,
                        created_at
                    FROM individual_set
                    ORDER BY exercise_id, created_at DESC
                )
                SELECT 
                    w.day,
                    e.*,
                    ls.weight as latest_weight,
                    ls.reps as latest_reps,
                    ls.created_at as latest_set_date
                FROM weekly_workouts w 
                JOIN exercises e ON w.exercise_id = e.id
                LEFT JOIN LatestSets ls ON e.id = ls.exercise_id
                ORDER BY w.day
            """))
            
            workouts = {}
            for row in result:
                if row.day not in workouts:
                    workouts[row.day] = []
                
                workouts[row.day].append({
                    'id': row.id,
                    'name': row.name,
                    'workout_type': row.workout_type,
                    'major_groups': row.major_groups,
                    'minor_groups': row.minor_groups,
                    'amount_sets': row.amount_sets,
                    'amount_reps': row.amount_reps,
                    'weight': row.weight,
                    'rest_time': row.rest_time,
                    'latestSet': {
                        'weight': row.latest_weight,
                        'reps': row.latest_reps,
                        'created_at': row.latest_set_date.isoformat() if row.latest_set_date else None
                    } if row.latest_weight is not None else None
                })
            
            return jsonify({'workouts': workouts})
            
    except Exception as e:
        print(f"Error fetching weekly workouts: {str(e)}")
        return jsonify({'error': str(e)}), 500


    
@app.route('/api/grocery-lists/<int:list_id>/import-to-fridge', methods=['POST'])
def import_grocerylist_to_fridge(list_id):  # Add list_id as a parameter
    try:
        # Get all items from the grocery list
        grocery_items = GroceryItem.query.filter_by(list_id=list_id).all()
        
        for item in grocery_items:
            # Skip recipe and menu headers
            if item.name.startswith('**') or item.name.startswith('###') or item.name.startswith('---'):
                continue
                
            # Clean the name (remove any ✓ or • prefixes)
            clean_name = item.name.replace('✓ ', '').replace('• ', '')
            
            # Check if item exists in fridge with same unit
            existing_item = FridgeItem.query.filter(
                db.func.lower(FridgeItem.name) == db.func.lower(clean_name),
                FridgeItem.unit == item.unit
            ).first()
            
            if existing_item:
                # Update quantity of existing item
                existing_item.quantity = existing_item.quantity + item.quantity
            else:
                # Create new fridge item
                new_item = FridgeItem(
                    name=clean_name,
                    quantity=item.quantity,
                    unit=item.unit,
                    price_per=item.price_per
                )
                db.session.add(new_item)
        
        db.session.commit()
        return jsonify({'message': 'Items imported to fridge successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error importing to fridge: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/income-entries', methods=['GET'])
def get_income_entries():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Modified query to include parent-child relationships
            result = connection.execute(text("""
                WITH RECURSIVE BudgetHierarchy AS (
                    -- Base case: get parent budgets
                    SELECT 
                        id, title, amount, frequency, is_recurring,
                        start_date, end_date, next_payment_date,
                        parent_id, is_subaccount,
                        ARRAY[]::uuid[] as path,
                        0 as level
                    FROM income_entries 
                    WHERE parent_id IS NULL
                    
                    UNION ALL
                    
                    -- Recursive case: get child budgets
                    SELECT 
                        c.id, c.title, c.amount, c.frequency, c.is_recurring,
                        c.start_date, c.end_date, c.next_payment_date,
                        c.parent_id, c.is_subaccount,
                        path || c.parent_id,
                        level + 0
                    FROM income_entries c
                    JOIN BudgetHierarchy p ON c.parent_id = p.id
                ),
                TransactionTotals AS (
                    SELECT 
                        income_entry_id,
                        COALESCE(SUM(amount), 0) as total_spent
                    FROM payments_history
                    GROUP BY income_entry_id
                )
                SELECT 
                    bh.*,
                    COALESCE(tt.total_spent, 0) as total_spent,
                    json_agg(
                        json_build_object(
                            'id', ph.id,
                            'amount', ph.amount,
                            'payment_date', ph.payment_date,
                            'title', ph.title,
                            'is_one_time', ph.is_one_time
                        )
                    ) FILTER (WHERE ph.id IS NOT NULL) as transactions
                FROM BudgetHierarchy bh
                LEFT JOIN TransactionTotals tt ON bh.id = tt.income_entry_id
                LEFT JOIN payments_history ph ON bh.id = ph.income_entry_id
                GROUP BY 
                    bh.id, bh.title, bh.amount, bh.frequency, 
                    bh.is_recurring, bh.start_date, bh.end_date, 
                    bh.next_payment_date, bh.parent_id, 
                    bh.is_subaccount, bh.path, bh.level,
                    tt.total_spent
                ORDER BY bh.path, bh.level, bh.title
            """))
            
            entries = []
            parent_map = {}
            
            # Process results and build hierarchy
            for row in result:
                entry_data = {
                    'id': str(row.id),
                    'title': row.title,
                    'amount': float(row.amount),
                    'frequency': row.frequency,
                    'is_recurring': row.is_recurring,
                    'start_date': row.start_date.isoformat() if row.start_date else None,
                    'end_date': row.end_date.isoformat() if row.end_date else None,
                    'next_payment_date': row.next_payment_date.isoformat() if row.next_payment_date else None,
                    'is_subaccount': row.is_subaccount,
                    'parent_id': str(row.parent_id) if row.parent_id else None,
                    'total_spent': float(row.total_spent),
                    'transactions': row.transactions if row.transactions else [],
                    'children': []
                }
                
                if row.parent_id:
                    parent = parent_map.get(str(row.parent_id))
                    if parent:
                        parent['children'].append(entry_data)
                        # Update parent totals
                        parent['total_budget'] = parent.get('total_budget', float(parent['amount'])) + float(row.amount)
                        parent['total_spent'] = parent.get('total_spent', 0) + float(row.total_spent)
                else:
                    entries.append(entry_data)
                
                parent_map[str(row.id)] = entry_data
            
            return jsonify({'entries': entries})
            
    except Exception as e:
        print(f"Error fetching income entries: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/income-entries', methods=['POST'])
def create_income_entry():
    try:
        data = request.json
        print("Received data for income entry:", data)
        print("Subaccount status:", data.get('is_subaccount'), "Parent ID:", data.get('parent_id'))
        
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Handle parent_id properly
            parent_id = data.get('parent_id')
            if not parent_id or parent_id == '':
                parent_id = None
            
            # Modified query to handle NULL parent_id correctly
            result = connection.execute(
                text("""
                    INSERT INTO income_entries (
                        title, amount, frequency, is_recurring,
                        start_date, end_date, next_payment_date,
                        parent_id, is_subaccount
                    ) VALUES (
                        :title, :amount, :frequency, :is_recurring,
                        :start_date, :end_date, :next_payment_date,
                        :parent_id, :is_subaccount
                    ) RETURNING id
                """),
                {
                    'title': data['title'],
                    'amount': float(data['amount']),
                    'frequency': data['frequency'],
                    'is_recurring': data['is_recurring'],
                    'start_date': data['start_date'] if data['is_recurring'] else None,
                    'end_date': data['end_date'] if data['is_recurring'] else None,
                    'next_payment_date': data['next_payment_date'] if data['is_recurring'] else None,
                    'parent_id': parent_id,  # This will now be None instead of empty string
                    'is_subaccount': bool(data.get('is_subaccount', False))
                }
            )
            
            entry_id = result.fetchone()[0]
            
            if data['is_recurring'] and data['start_date']:
                start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                today = datetime.now().date()
                
                if start_date <= today:
                    current_date = start_date
                    while current_date <= today:
                        connection.execute(
                            text("""
                                INSERT INTO payments_history (
                                    income_entry_id, amount, payment_date
                                ) VALUES (:entry_id, :amount, :payment_date)
                            """),
                            {
                                'entry_id': entry_id,
                                'amount': float(data['amount']),
                                'payment_date': current_date
                            }
                        )
                        
                        # Calculate next payment date based on frequency
                        if data['frequency'] == 'weekly':
                            current_date += timedelta(days=7)
                        elif data['frequency'] == 'biweekly':
                            current_date += timedelta(days=14)
                        elif data['frequency'] == 'monthly':
                            current_date += relativedelta(months=1)
                        elif data['frequency'] == 'yearly':
                            current_date += relativedelta(years=1)
            
            connection.commit()
            return jsonify({'message': 'Income entry created successfully', 'id': str(entry_id)}), 201
            
    except Exception as e:
        print(f"Error creating income entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/income-entries/<uuid:entry_id>', methods=['PUT'])
def update_income_entry(entry_id):
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # First verify the entry exists
                entry_check = connection.execute(
                    text("SELECT id FROM income_entries WHERE id = :id"),
                    {"id": entry_id}
                ).fetchone()
                
                if not entry_check:
                    return jsonify({'error': 'Income entry not found'}), 404
                
                # Handle parent_id: if is_subaccount is false, set parent_id to null
                parent_id = data.get('parent_id') if data.get('is_subaccount') else None
                
                # If this is becoming a subaccount, verify parent exists and is not a subaccount itself
                if parent_id:
                    parent_check = connection.execute(
                        text("""
                            SELECT id, is_subaccount 
                            FROM income_entries 
                            WHERE id = :parent_id
                        """),
                        {"parent_id": parent_id}
                    ).fetchone()
                    
                    if not parent_check:
                        return jsonify({'error': 'Parent account not found'}), 400
                    if parent_check.is_subaccount:
                        return jsonify({'error': 'Parent account cannot be a subaccount'}), 400
                
                # Update the income entry with all fields including parent relationship
                result = connection.execute(
                    text("""
                        UPDATE income_entries SET
                            title = :title,
                            amount = :amount,
                            frequency = :frequency,
                            is_recurring = :is_recurring,
                            start_date = :start_date,
                            end_date = :end_date,
                            next_payment_date = :next_payment_date,
                            is_subaccount = :is_subaccount,
                            parent_id = :parent_id,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                        RETURNING id, title, amount, is_subaccount, parent_id
                    """),
                    {
                        'id': entry_id,
                        'title': data['title'],
                        'amount': float(data['amount']),
                        'frequency': data['frequency'],
                        'is_recurring': data['is_recurring'],
                        'start_date': data.get('start_date'),
                        'end_date': data.get('end_date'),
                        'next_payment_date': data.get('next_payment_date'),
                        'is_subaccount': bool(data.get('is_subaccount')),
                        'parent_id': parent_id
                    }
                )
                
                updated = result.fetchone()
                
                # Validate no circular dependencies
                if parent_id:
                    cycle_check = connection.execute(
                        text("""
                            WITH RECURSIVE hierarchy AS (
                                SELECT id, parent_id, 1 as level
                                FROM income_entries
                                WHERE id = :parent_id
                                
                                UNION ALL
                                
                                SELECT e.id, e.parent_id, h.level + 1
                                FROM income_entries e
                                JOIN hierarchy h ON h.parent_id = e.id
                                WHERE h.level < 100
                            )
                            SELECT COUNT(*) as cycle_count
                            FROM hierarchy
                            WHERE id = :entry_id
                        """),
                        {"parent_id": parent_id, "entry_id": entry_id}
                    ).fetchone()
                    
                    if cycle_check.cycle_count > 0:
                        connection.rollback()
                        return jsonify({'error': 'Circular dependency detected'}), 400

                return jsonify({
                    'message': 'Income entry updated successfully',
                    'entry': {
                        'id': str(updated.id),
                        'title': updated.title,
                        'amount': float(updated.amount),
                        'is_subaccount': updated.is_subaccount,
                        'parent_id': str(updated.parent_id) if updated.parent_id else None
                    }
                })
                
    except Exception as e:
        print(f"Error updating income entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/income-entries/<uuid:entry_id>', methods=['DELETE'])
def delete_income_entry(entry_id):
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First check if this is a parent account with subaccounts
            subaccounts = connection.execute(
                text("""
                    SELECT COUNT(*) as count
                    FROM income_entries
                    WHERE parent_id = :entry_id
                """),
                {"entry_id": entry_id}
            ).fetchone()

            if subaccounts.count > 0:
                return jsonify({
                    'error': 'Cannot delete this budget while it has subaccounts. Please delete all subaccounts first.',
                    'hasSubaccounts': True
                }), 400

            # If no subaccounts, proceed with deletion
            # First delete associated payment history
            connection.execute(
                text("""
                    DELETE FROM payments_history
                    WHERE income_entry_id = :entry_id
                """),
                {"entry_id": entry_id}
            )
            
            # Then delete the income entry
            result = connection.execute(
                text("""
                    DELETE FROM income_entries 
                    WHERE id = :entry_id
                    RETURNING id, is_subaccount, parent_id
                """),
                {"entry_id": entry_id}
            )
            
            deleted_entry = result.fetchone()
            if not deleted_entry:
                return jsonify({'error': 'Income entry not found'}), 404
                
            connection.commit()
            return jsonify({
                'message': 'Income entry deleted successfully',
                'wasSubaccount': deleted_entry.is_subaccount,
                'parentId': str(deleted_entry.parent_id) if deleted_entry.parent_id else None
            })
            
    except Exception as e:
        print(f"Error deleting income entry: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/income-entries/process-recurring', methods=['POST'])
def process_recurring_income():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        today = datetime.now().date()
        
        with engine.connect() as connection:
            # Get all active recurring entries that need processing
            recurring_entries = connection.execute(
                text("""
                    SELECT id, amount, frequency, next_payment_date
                    FROM income_entries
                    WHERE is_recurring = true
                    AND next_payment_date <= :today
                    AND (end_date IS NULL OR end_date >= :today)
                """),
                {"today": today}
            ).fetchall()
            
            for entry in recurring_entries:
                # Create payment record
                connection.execute(
                    text("""
                        INSERT INTO payments_history (
                            income_entry_id, amount, payment_date
                        ) VALUES (:entry_id, :amount, :payment_date)
                    """),
                    {
                        'entry_id': entry.id,
                        'amount': float(entry.amount),
                        'payment_date': entry.next_payment_date
                    }
                )
                
                # Calculate and update next payment date
                if entry.frequency == 'weekly':
                    next_date = entry.next_payment_date + timedelta(days=7)
                elif entry.frequency == 'biweekly':
                    next_date = entry.next_payment_date + timedelta(days=14)
                elif entry.frequency == 'monthly':
                    next_date = entry.next_payment_date + relativedelta(months=1)
                else:  # yearly
                    next_date = entry.next_payment_date + relativedelta(years=1)
                
                # Update next payment date
                connection.execute(
                    text("""
                        UPDATE income_entries
                        SET next_payment_date = :next_date
                        WHERE id = :id
                    """),
                    {
                        'id': entry.id,
                        'next_date': next_date
                    }
                )
            
            connection.commit()
            return jsonify({'message': 'Recurring income processed successfully'})
            
    except Exception as e:
        print(f"Error processing recurring income: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@app.route('/api/income-entries/<uuid:entry_id>/transactions', methods=['POST'])
def update_transactions(entry_id):
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # Handle deletions
                if data.get('toDelete'):
                    connection.execute(
                        text("""
                            DELETE FROM payments_history
                            WHERE id = ANY(
                                SELECT uuid(unnest(:transaction_ids))
                            )
                            AND income_entry_id = :entry_id
                        """),
                        {
                            "transaction_ids": data['toDelete'],
                            "entry_id": str(entry_id)
                        }
                    )

                for transaction_id, is_recurring in data.get('recurringUpdates', {}).items():
                    connection.execute(
                    text("""
                    UPDATE payments_history
                    SET is_one_time = NOT :is_recurring
                    WHERE id = uuid(:transaction_id)
                    AND income_entry_id = :entry_id
                    """),
                {
                    "is_recurring": is_recurring,
                    "transaction_id": transaction_id,
                    "entry_id": str(entry_id)
                }
            )
                
                # Handle amount updates
                for transaction_id, new_amount in data.get('amountUpdates', {}).items():
                    connection.execute(
                        text("""
                            UPDATE payments_history
                            SET amount = :amount
                            WHERE id = uuid(:transaction_id)
                            AND income_entry_id = :entry_id  
                        """),
                        {
                            "amount": float(new_amount),
                            "transaction_id": transaction_id,
                            "entry_id": str(entry_id)
                        }
                    )
                
                # Handle title updates
                for transaction_id, new_title in data.get('titleUpdates', {}).items():
                    connection.execute(
                        text("""
                            UPDATE payments_history
                            SET title = :title
                            WHERE id = uuid(:transaction_id)
                            AND income_entry_id = :entry_id
                            AND is_one_time = true
                        """),
                        {
                            "title": new_title,
                            "transaction_id": transaction_id,
                            "entry_id": str(entry_id)
                        }
                    )

                # Handle date updates
                for transaction_id, new_date in data.get('dateUpdates', {}).items():
                    connection.execute(
                        text("""
                            UPDATE payments_history
                            SET payment_date = :payment_date
                            WHERE id = uuid(:transaction_id)
                            AND income_entry_id = :entry_id
                        """),
                        {
                            "payment_date": new_date,
                            "transaction_id": transaction_id,
                            "entry_id": str(entry_id)
                        }
                    )
            
            # Fetch updated transactions
            result = connection.execute(
                text("""
                    SELECT 
                        id, amount, payment_date,
                        title, is_one_time, created_at
                    FROM payments_history
                    WHERE income_entry_id = :entry_id
                    ORDER BY payment_date DESC
                """),
                {"entry_id": str(entry_id)}
            )
            
            updated_transactions = [{
                'id': str(row.id),
                'amount': float(row.amount),
                'payment_date': row.payment_date.isoformat() if row.payment_date else None,
                'title': row.title,
                'is_one_time': row.is_one_time,
                'created_at': row.created_at.isoformat() if row.created_at else None
            } for row in result]
            
            return jsonify({
                'message': 'Transactions updated successfully',
                'transactions': updated_transactions
            })
            
    except Exception as e:
        print(f"Error updating transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/income-entries/<uuid:entry_id>/one-time', methods=['POST'])
def add_one_time_income(entry_id):
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Verify the income entry exists
            entry = connection.execute(
                text("SELECT id FROM income_entries WHERE id = :id"),
                {"id": entry_id}
            ).fetchone()
            
            if not entry:
                return jsonify({'error': 'Income entry not found'}), 404
                
            # Add one-time transaction
            result = connection.execute(
                text("""
                    INSERT INTO payments_history (
                        income_entry_id, amount, payment_date, title, is_one_time
                    ) VALUES (
                        :entry_id, :amount, :payment_date, :title, true
                    )
                    RETURNING id, amount, payment_date, title, is_one_time
                """),
                {
                    'entry_id': entry_id,
                    'amount': float(data['amount']),
                    'payment_date': data['transaction_date'],
                    'title': data.get('title')
                }
            )
            
            new_transaction = result.fetchone()
            connection.commit()
            
            return jsonify({
                'message': 'One-time income added successfully',
                'transaction': {
                    'id': new_transaction.id,
                    'amount': float(new_transaction.amount),
                    'transaction_date': new_transaction.payment_date.isoformat(),
                    'title': new_transaction.title,
                    'is_one_time': new_transaction.is_one_time
                }
            }), 201
            
    except Exception as e:
        print(f"Error adding one-time income: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/exercises/<int:exercise_id>/sets', methods=['OPTIONS'])
def handle_exercise_sets_options(exercise_id):
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', 'https://groshmebeta.netlify.app')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

    
@app.route('/api/workout-weeks', methods=['OPTIONS'])
def workout_weeks_options():
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response
    
@app.route('/api/workout-weeks', methods=['GET'])
@auth_required
def get_workout_weeks():
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                WITH WeekSummary AS (
                    SELECT 
                        ww.id,
                        ww.title,
                        ww.start_date,
                        ww.end_date,
                        ww.start_day,
                        dw.day_of_week,
                        json_agg(
                            json_build_object(
                                'exercise_id', we.exercise_id,
                                'name', e.name,
                                'target_sets', we.target_sets,
                                'target_reps', we.target_reps,
                                'target_weight', we.target_weight,
                                'rest_time', we.rest_time,
                                'order_index', we.order_index
                            )
                        ) FILTER (WHERE we.id IS NOT NULL) as exercises
                    FROM workout_weeks ww
                    LEFT JOIN daily_workouts dw ON ww.id = dw.week_id
                    LEFT JOIN workout_exercises we ON dw.id = we.daily_workout_id
                    LEFT JOIN exercises e ON we.exercise_id = e.id
                    WHERE ww.user_id = :user_id
                    GROUP BY ww.id, ww.title, ww.start_date, ww.end_date, 
                             ww.start_day, dw.day_of_week
                    ORDER BY ww.start_date DESC, dw.day_of_week
                )
                SELECT 
                    id,
                    title,
                    start_date,
                    end_date,
                    start_day,
                    json_object_agg(
                        COALESCE(day_of_week, 'placeholder'),
                        COALESCE(exercises, '[]')
                    ) as daily_workouts
                FROM WeekSummary
                GROUP BY id, title, start_date, end_date, start_day
            """), {"user_id": user_id})

            weeks = []
            for row in result:
                # Clean up the daily_workouts by removing placeholder
                daily_workouts = row.daily_workouts
                if 'placeholder' in daily_workouts:
                    del daily_workouts['placeholder']

                weeks.append({
                    'id': row.id,
                    'title': row.title,
                    'start_date': row.start_date.isoformat(),
                    'end_date': row.end_date.isoformat(),
                    'start_day': row.start_day,
                    'daily_workouts': daily_workouts
                })

            return jsonify({'weeks': weeks})

    except Exception as e:
        print(f"Error fetching workout weeks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workout-weeks', methods=['POST'])
@auth_required
def create_workout_week():
    try:
        data = request.json
        user_id = g.user_id

        if not all(k in data for k in ['title', 'start_date', 'end_date', 'start_day']):
            return jsonify({'error': 'Missing required fields'}), 400

        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():
                # Create the workout week
                result = connection.execute(text("""
                    INSERT INTO workout_weeks (
                        user_id, title, start_date, end_date, start_day
                    ) VALUES (
                        :user_id, :title, :start_date, :end_date, :start_day
                    ) RETURNING id
                """), {
                    'user_id': user_id,
                    'title': data['title'],
                    'start_date': data['start_date'],
                    'end_date': data['end_date'],
                    'start_day': data['start_day']
                })
                
                week_id = result.fetchone().id

                # Create daily workout slots
                days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 
                       'Friday', 'Saturday', 'Sunday']
                current_day_index = days.index(data['start_day'])
                
                for i in range(7):
                    day = days[(current_day_index + i) % 7]
                    connection.execute(text("""
                        INSERT INTO daily_workouts (week_id, day_of_week)
                        VALUES (:week_id, :day)
                    """), {
                        'week_id': week_id,
                        'day': day
                    })

            return jsonify({
                'message': 'Workout week created successfully',
                'id': week_id
            }), 201

    except Exception as e:
        print(f"Error creating workout week: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workout-weeks/<int:week_id>/exercises/<int:exercise_id>', methods=['DELETE'])
@auth_required
def delete_workout_exercise(week_id, exercise_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First verify ownership of the week
            week_check = connection.execute(
                text("""
                    SELECT id FROM workout_weeks 
                    WHERE id = :week_id AND user_id = :user_id
                """),
                {"week_id": week_id, "user_id": user_id}
            ).fetchone()
            
            if not week_check:
                return jsonify({'error': 'Week not found or unauthorized'}), 404

            # Delete the exercise from workout_exercises
            result = connection.execute(
                text("""
                    DELETE FROM workout_exercises 
                    WHERE daily_workout_id IN (
                        SELECT id FROM daily_workouts WHERE week_id = :week_id
                    )
                    AND exercise_id = :exercise_id
                    RETURNING id
                """),
                {
                    "week_id": week_id,
                    "exercise_id": exercise_id
                }
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Exercise not found in workout'}), 404

            connection.commit()
            return jsonify({'message': 'Exercise deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workout-weeks/<int:week_id>', methods=['DELETE'])
@auth_required
def delete_workout_week(week_id):
    try:
        user_id = g.user_id  # Get authenticated user's ID
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            with connection.begin():  # Start a transaction
                # First verify ownership
                week_check = connection.execute(
                    text("""
                        SELECT id FROM workout_weeks 
                        WHERE id = :week_id AND user_id = :user_id
                    """),
                    {"week_id": week_id, "user_id": user_id}
                ).fetchone()
                
                if not week_check:
                    return jsonify({'error': 'Week not found or unauthorized'}), 404

                # Delete exercises from workout_exercises for this week
                connection.execute(
                    text("""
                        DELETE FROM workout_exercises 
                        WHERE daily_workout_id IN (
                            SELECT id FROM daily_workouts WHERE week_id = :week_id
                        )
                    """),
                    {"week_id": week_id}
                )
                
                # Delete daily workouts
                connection.execute(
                    text("""
                        DELETE FROM daily_workouts 
                        WHERE week_id = :week_id
                    """),
                    {"week_id": week_id}
                )
                
                # Finally delete the week itself
                connection.execute(
                    text("""
                        DELETE FROM workout_weeks 
                        WHERE id = :week_id AND user_id = :user_id
                    """),
                    {
                        "week_id": week_id,
                        "user_id": user_id
                    }
                )

            return jsonify({'message': 'Workout week deleted successfully'})
            
    except Exception as e:
        print(f"Error deleting workout week: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/workout-weeks/<int:week_id>/exercises', methods=['POST'])
@auth_required
def add_workout_exercises(week_id):
    try:
        data = request.json
        user_id = g.user_id

        if not all(k in data for k in ['day', 'exercises']):
            return jsonify({'error': 'Missing required fields'}), 400

        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Verify week ownership
            week_check = connection.execute(text("""
                SELECT id FROM workout_weeks 
                WHERE id = :week_id AND user_id = :user_id
            """), {
                'week_id': week_id,
                'user_id': user_id
            }).fetchone()

            if not week_check:
                return jsonify({'error': 'Workout week not found or unauthorized'}), 404

            # Get the daily workout ID
            daily_workout = connection.execute(text("""
                SELECT id FROM daily_workouts
                WHERE week_id = :week_id AND day_of_week = :day
            """), {
                'week_id': week_id,
                'day': data['day']
            }).fetchone()

            if not daily_workout:
                return jsonify({'error': 'Daily workout not found'}), 404

            # Add exercises
            for idx, exercise in enumerate(data['exercises']):
                connection.execute(text("""
                    INSERT INTO workout_exercises (
                        daily_workout_id, exercise_id, target_sets,
                        target_reps, target_weight, rest_time, order_index
                    ) VALUES (
                        :daily_workout_id, :exercise_id, :target_sets,
                        :target_reps, :target_weight, :rest_time, :order_index
                    )
                """), {
                    'daily_workout_id': daily_workout.id,
                    'exercise_id': exercise['id'],
                    'target_sets': exercise.get('target_sets', 3),
                    'target_reps': exercise.get('target_reps', 10),
                    'target_weight': exercise.get('target_weight'),
                    'rest_time': exercise.get('rest_time', 60),
                    'order_index': idx
                })

            connection.commit()
            return jsonify({'message': 'Exercises added successfully'})

    except Exception as e:
        print(f"Error adding exercises: {str(e)}")
        return jsonify({'error': str(e)}), 500

     
def upgrade_database():
    # SQL for PostgreSQL
    upgrade_commands = [
        """
        ALTER TABLE fridge
        ADD COLUMN IF NOT EXISTS price_per DECIMAL(10, 2) DEFAULT 0.0;
        """,
        """
        -- Optional: Add a computed total column
        ALTER TABLE fridge
        ADD COLUMN IF NOT EXISTS total DECIMAL(10, 2) 
        GENERATED ALWAYS AS (quantity * price_per) STORED;
        """
    ]
    
    conn = db.engine.connect()
    for command in upgrade_commands:
        conn.execute(text(command))
    conn.close()

     
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)