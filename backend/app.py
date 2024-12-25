# app.py
import re, uuid, json
from sqlalchemy import create_engine, text # type: ignore
from sqlalchemy.pool import NullPool
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy  # type: ignore
from flask_migrate import Migrate # type: ignore
from flask_cors import CORS # type: ignore
from datetime import datetime, timedelta
import mysql # type: ignore
from sqlalchemy import text # type: ignore
from fuzzywuzzy import fuzz # type: ignore
from sqlalchemy import func # type: ignore
from receipt_parser import parse_receipt  # Add at top with other imports
import mysql.connector # type: ignore
from mysql.connector import Error # type: ignore

from email.mime.text import MIMEText
import base64
import os
from werkzeug.utils import secure_filename





app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "https://groshmebeta.netlify.app", "https://groshmebeta-05487aa160b2.herokuapp.com"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "supports_credentials": True
    }
})

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


class MealPrepWeek(db.Model):
    id = db.Column(db.Integer, primary_key=True)
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
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    workout_type = db.Column(db.Enum('Push', 'Pull', 'Legs', 'Cardio'), nullable=False)
    major_groups = db.Column(db.JSON, nullable=False)
    minor_groups = db.Column(db.JSON, nullable=False)
    amount_sets = db.Column(db.Integer, nullable=False)
    amount_reps = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    rest_time = db.Column(db.Integer, nullable=False)
    sets = db.relationship('IndividualSet', backref='exercise', lazy=True, cascade='all, delete-orphan')
    set_histories = db.relationship('SetHistory', backref='exercise', lazy=True, cascade='all, delete-orphan')

class SetHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())
    sets = db.relationship('IndividualSet', backref='history', lazy=True, cascade='all, delete-orphan')



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
    




@app.route('/api/exercise/set/<int:set_id>', methods=['DELETE'])
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
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    UPDATE exercises
                    SET name = :name,
                        workout_type = :workout_type,
                        major_groups = :major_groups,
                        minor_groups = :minor_groups,
                        amount_sets = :amount_sets,
                        amount_reps = :amount_reps,
                        weight = :weight,
                        rest_time = :rest_time
                    WHERE id = :id
                    RETURNING id
                """),
                {
                    'id': exercise_id,
                    'name': data['name'],
                    'workout_type': data['workout_type'],
                    'major_groups': data['major_groups'],
                    'minor_groups': data['minor_groups'],
                    'amount_sets': data['amount_sets'],
                    'amount_reps': data['amount_reps'],
                    'weight': data['weight'],
                    'rest_time': data['rest_time']
                }
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Exercise not found'}), 404
                
            connection.commit()
            return jsonify({'message': 'Exercise updated successfully'})
            
    except Exception as e:
        print(f"Error updating exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercise/<int:exercise_id>/sets', methods=['POST'])
def add_exercise_sets(exercise_id):
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Create new history entry
            history_result = connection.execute(
                text("""
                    INSERT INTO set_history (exercise_id, created_at)
                    VALUES (:exercise_id, CURRENT_TIMESTAMP)
                    RETURNING id
                """),
                {'exercise_id': exercise_id}
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
                        'exercise_id': exercise_id,
                        'history_id': history_id,
                        'set_number': set_data['set_number'],
                        'reps': set_data['reps'],
                        'weight': set_data['weight']
                    }
                )
                
            connection.commit()
            return jsonify({'message': 'Sets added successfully'})
            
    except Exception as e:
        print(f"Error saving sets: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/exercise/<int:exercise_id>/sets/history', methods=['GET'])
def get_exercise_history(exercise_id):
    try:
        # Get all history records for this exercise
        histories = SetHistory.query\
            .filter_by(exercise_id=exercise_id)\
            .order_by(SetHistory.created_at.desc())\
            .all()
        
        # Prepare the response data
        history_data = []
        for history in histories:
            # Get all sets for this history record
            sets = IndividualSet.query\
                .filter_by(set_history_id=history.id)\
                .order_by(IndividualSet.set_number)\
                .all()
            
            history_data.append({
                'id': history.id,
                'created_at': history.created_at.isoformat(),
                'sets': [{
                    'set_number': set.set_number,
                    'reps': set.reps,
                    'weight': set.weight
                } for set in sets]
            })
        
        return jsonify({'history': history_data})
    except Exception as e:
        print(f"Error fetching exercise history: {str(e)}")  # Add debug logging
        return jsonify({'error': str(e)}), 500



class IndividualSet(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
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
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id', ondelete='CASCADE'), primary_key=True)
    

class WorkoutPlan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    week_id = db.Column(db.Integer, db.ForeignKey('workout_prep_week.id'), nullable=False)
    day = db.Column(db.String(20), nullable=False)
    workout_type = db.Column(db.String(20), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercise.id'), nullable=False)
    workout_prep_week = db.relationship('WorkoutPrepWeek', backref=db.backref('workouts', lazy=True, cascade='all, delete-orphan'))
    exercise = db.relationship('Exercise', backref=db.backref('workout_plan', lazy=True))

@app.route('/api/exercise/<int:exercise_id>/sets', methods=['GET'])
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

@app.route('/api/exercise/<int:exercise_id>/sets/<int:set_id>', methods=['DELETE'])
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

@app.route('/api/exercise/<int:exercise_id>/history/<int:history_id>', methods=['DELETE'])
def delete_exercise_history(exercise_id, history_id):
    try:
        history = SetHistory.query.get_or_404(history_id)
        
        # Verify the history belongs to the correct exercise
        if history.exercise_id != exercise_id:
            return jsonify({'error': 'History does not belong to this exercise'}), 404
            
        db.session.delete(history)
        db.session.commit()
        return jsonify({'message': 'History deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting history: {str(e)}")
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
    user_id = db.Column(db.UUID, nullable=False, default='bc6ae242-c238-4a6b-a884-2fd1fc03ed72')
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

class RecipeIngredientQuantity(db.Model):
    __tablename__ = 'recipe_ingredient_quantities'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id', ondelete='CASCADE'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20))


# Add this near the top with other model definitions
class RecipeIngredient3(db.Model):
    __tablename__ = 'recipe_ingredients3'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipe_ids = db.Column(db.JSON)

class RecipeIngredientNutrition(db.Model):
    __tablename__ = 'recipe_ingredient_nutrition'
    id = db.Column(db.Integer, primary_key=True)
    recipe_ingredient_quantities_id = db.Column(db.Integer, 
                                              db.ForeignKey('recipe_ingredient_quantities.id', ondelete='CASCADE'), 
                                              nullable=False)
    protein_grams = db.Column(db.Float, nullable=True)
    fat_grams = db.Column(db.Float, nullable=True)
    carbs_grams = db.Column(db.Float, nullable=True)
    serving_size = db.Column(db.Float, nullable=True)
    serving_unit = db.Column(db.String(20), nullable=True)
    
    recipe_ingredient = db.relationship('RecipeIngredientQuantity', 
                                      backref=db.backref('nutrition', 
                                                       uselist=False, 
                                                       cascade='all, delete-orphan'))


class Ingredient(db.Model):
    __tablename__ = 'ingredients'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipes = db.relationship(
        'Recipe',
        secondary='recipe_ingredient_quantities',
        backref=db.backref('ingredients', lazy=True),
        overlaps="ingredient_quantities,recipe_quantities"
    )

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
def get_meal_prep_weeks():
    try:
        weeks = MealPrepWeek.query.order_by(MealPrepWeek.created_date.desc()).all()
        weeks_data = []
        
        for week in weeks:
            # Get all meals for the week
            meals = MealPlan.query.filter_by(week_id=week.id).all()
            
            # Organize meals by day and type
            meal_plans = {}
            for meal in meals:
                recipe = Recipe.query.get(meal.recipe_id)
                if not recipe:
                    continue
                    
                if meal.day not in meal_plans:
                    meal_plans[meal.day] = {
                        'breakfast': [],
                        'lunch': [],
                        'dinner': []
                    }
                
                # Calculate nutrition totals for the recipe
                total_nutrition = {
                    'protein_grams': 0,
                    'fat_grams': 0,
                    'carbs_grams': 0
                }
                
                for ing_qty in recipe.ingredient_quantities:
                    if ing_qty.nutrition and ing_qty.nutrition.serving_size:
                        ratio = ing_qty.quantity / ing_qty.nutrition.serving_size
                        total_nutrition['protein_grams'] += (ing_qty.nutrition.protein_grams or 0) * ratio
                        total_nutrition['fat_grams'] += (ing_qty.nutrition.fat_grams or 0) * ratio
                        total_nutrition['carbs_grams'] += (ing_qty.nutrition.carbs_grams or 0) * ratio

                meal_data = {
                    'recipe_id': recipe.id,
                    'recipe_name': recipe.name,
                    'description': recipe.description,
                    'prep_time': recipe.prep_time,
                    'total_nutrition': total_nutrition
                }
                
                meal_plans[meal.day][meal.meal_type].append(meal_data)
            
            weeks_data.append({
                'id': week.id,
                'title': week.title,
                'start_day': week.start_day,
                'start_date': week.start_date.isoformat() if week.start_date else None,
                'end_date': week.end_date.isoformat() if week.end_date else None,
                'show_dates': week.show_dates,
                'created_date': week.created_date.strftime('%Y-%m-%d'),
                'meal_plans': meal_plans
            })
            
        return jsonify({'weeks': weeks_data})
    except Exception as e:
        print(f"Error fetching meal prep weeks: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks', methods=['POST'])
def create_meal_prep_week():
    try:
        data = request.json
        
        # Validate required fields
        if 'start_day' not in data:
            return jsonify({'error': 'Start day is required'}), 400
            
        # Create new week with optional fields
        new_week = MealPrepWeek(
            start_day=data['start_day'],
            title=data.get('title'),
            created_date=datetime.now()
        )
        
        # Handle date fields if provided
        if 'start_date' in data and data['start_date']:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            new_week.start_date = start_date
            # Calculate end_date as 6 days after start_date
            new_week.end_date = start_date + timedelta(days=6)
            
        db.session.add(new_week)
        db.session.commit()
        
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
        db.session.rollback()
        print(f"Error creating week: {str(e)}")  # Add debug logging
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
def delete_meal_prep_week(week_id):
    try:
        week = MealPrepWeek.query.get_or_404(week_id)
        db.session.delete(week)
        db.session.commit()
        return jsonify({'message': 'Week deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks/<int:week_id>/meals', methods=['POST'])
def add_meal_to_week(week_id):
    try:
        data = request.json
        week = MealPrepWeek.query.get_or_404(week_id)
        recipe = Recipe.query.get_or_404(data['recipe_id'])
        
        # Create new meal plan
        new_meal = MealPlan(
            week_id=week.id,
            recipe_id=recipe.id,
            day=data['day'],
            meal_type=data['meal_type']
        )
        
        db.session.add(new_meal)
        db.session.commit()
        
        return jsonify({'message': 'Meal added successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks/<int:week_id>/meals', methods=['DELETE'])
def delete_meal_from_week(week_id):
    try:
        data = request.json
        meal = MealPlan.query.filter_by(
            week_id=week_id,
            day=data['day'],
            meal_type=data['meal_type'],
            recipe_id=data['recipe_id']
        ).first_or_404()
        
        db.session.delete(meal)
        db.session.commit()
        
        return jsonify({'message': 'Meal deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/meal-prep/weeks/<int:week_id>/meals/batch', methods=['POST'])
def add_meals_batch(week_id):
    try:
        data = request.json
        week = MealPrepWeek.query.get_or_404(week_id)
        
        # Expect data to be an array of meal assignments
        for meal_data in data['meals']:
            new_meal = MealPlan(
                week_id=week.id,
                recipe_id=meal_data['recipe_id'],
                day=meal_data['day'],
                meal_type=meal_data['meal_type']
            )
            db.session.add(new_meal)
        
        db.session.commit()
        return jsonify({'message': f'{len(data["meals"])} meals added successfully'}), 201
    except Exception as e:
        db.session.rollback()
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
def get_exercises():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT id, name, workout_type, major_groups, minor_groups, 
                       amount_sets, amount_reps, weight, rest_time
                FROM exercises
                ORDER BY name
            """))
            
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
            
            return jsonify({'exercises': exercises})
    except Exception as e:
        print(f"Error fetching exercises: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercise', methods=['POST'])
def create_exercise():
    try:
        data = request.json
        engine = create_engine(db_url, poolclass=NullPool)
        major_groups = json.dumps(data['major_groups'])
        minor_groups = json.dumps(data['minor_groups'])
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO exercises (
                        name, workout_type, major_groups, minor_groups,
                        amount_sets, amount_reps, weight, rest_time
                    ) VALUES (
                        :name, :workout_type, :major_groups, :minor_groups,
                        :amount_sets, :amount_reps, :weight, :rest_time
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
                    'rest_time': data['rest_time']
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


@app.route('/api/recipe', methods=['POST'])
def add_recipe():
    try:
        data = request.json
        
        # Create the recipe
        new_recipe = Recipe(
            name=data['name'],
            description=data['description'],
            instructions=data['instructions'],
            prep_time=int(data['prep_time']),
            user_id=uuid.UUID('bc6ae242-c238-4a6b-a884-2fd1fc03ed72')
        )
        db.session.add(new_recipe)
        db.session.flush()
        
        # Process each ingredient
        for ingredient_data in data['ingredients']:
            # Find or create ingredient
            ingredient = Ingredient.query.filter(
                func.lower(Ingredient.name) == func.lower(ingredient_data['name'])
            ).first()
            
            if not ingredient:
                ingredient = Ingredient(name=ingredient_data['name'])
                db.session.add(ingredient)
                db.session.flush()
            
            # Create quantity association
            quantity = RecipeIngredientQuantity(
                recipe_id=new_recipe.id,
                ingredient_id=ingredient.id,
                quantity=float(ingredient_data['quantity']),
                unit=ingredient_data['unit']
            )
            db.session.add(quantity)
            db.session.flush()
            
            # Add nutrition data if provided
            if ingredient_data.get('nutritionData'):
                nutrition = RecipeIngredientNutrition(
                    recipe_ingredient_quantities_id=quantity.id,
                    protein_grams=ingredient_data['nutritionData'].get('protein_grams'),
                    fat_grams=ingredient_data['nutritionData'].get('fat_grams'),
                    carbs_grams=ingredient_data['nutritionData'].get('carbs_grams'),
                    serving_size=ingredient_data['nutritionData'].get('serving_size'),
                    serving_unit=ingredient_data['nutritionData'].get('serving_unit')
                )
                db.session.add(nutrition)
        
        db.session.commit()
        return jsonify({
            'message': 'Recipe added successfully',
            'recipe_id': new_recipe.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500



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
@app.route('/api/all-recipes')
def get_all_recipes():
    try:
        # Update the database URL to use your Supabase credentials
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)
        
        with engine.connect() as connection:
            # First get all recipes
            recipes_result = connection.execute(text("""
                SELECT id, name, description, prep_time 
                FROM recipe 
                ORDER BY id ASC
            """))
            recipes = recipes_result.fetchall()
            
            print(f"Found {len(recipes)} recipes")
            
            recipes_data = []
            for recipe in recipes:
                # Get ingredients using Supabase's JSON functions
                ingredients_result = connection.execute(text("""
                    SELECT name 
                    FROM recipe_ingredients3 
                    WHERE recipe_ids::jsonb ? :recipe_id
                """), {'recipe_id': str(recipe.id)})
                
                ingredients = ingredients_result.fetchall()
                
                # Get nutrition data
                nutrition_result = connection.execute(text("""
                    SELECT 
                        riq.quantity,
                        rin.protein_grams,
                        rin.fat_grams,
                        rin.carbs_grams,
                        rin.serving_size
                    FROM recipe_ingredient_quantities riq
                    LEFT JOIN recipe_ingredient_nutrition rin 
                        ON rin.recipe_ingredient_quantities_id = riq.id
                    WHERE riq.recipe_id = :recipe_id
                """), {'recipe_id': recipe.id})
                
                nutrition_data = nutrition_result.fetchall()
                
                # Calculate total nutrition
                total_nutrition = {
                    'protein_grams': 0,
                    'fat_grams': 0,
                    'carbs_grams': 0
                }
                
                for nutr in nutrition_data:
                    if nutr.serving_size and nutr.serving_size > 0:
                        ratio = nutr.quantity / nutr.serving_size
                        total_nutrition['protein_grams'] += (nutr.protein_grams or 0) * ratio
                        total_nutrition['fat_grams'] += (nutr.fat_grams or 0) * ratio
                        total_nutrition['carbs_grams'] += (nutr.carbs_grams or 0) * ratio
                
                recipes_data.append({
                    'id': recipe.id,
                    'name': recipe.name,
                    'description': recipe.description,
                    'prep_time': recipe.prep_time,
                    'ingredients': [ingredient[0] for ingredient in ingredients],
                    'total_nutrition': {
                        'protein_grams': round(total_nutrition['protein_grams'], 1),
                        'fat_grams': round(total_nutrition['fat_grams'], 1),
                        'carbs_grams': round(total_nutrition['carbs_grams'], 1)
                    }
                })
            
            return jsonify({
                'recipes': recipes_data,
                'count': len(recipes_data)
            })
    except Exception as e:
        print(f"Error fetching all recipes: {str(e)}")
        return jsonify({
            'recipes': [],
            'count': 0
        }), 500






from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool
from flask import jsonify, request

# Supabase connection string
DB_URL = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'

@app.route('/api/menus', methods=['GET'])
def get_menus():
    try:
        engine = create_engine(DB_URL, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT m.id, m.name, COUNT(mr.recipe_id) as recipe_count
                FROM menu m
                LEFT JOIN menu_recipe mr ON m.id = mr.menu_id
                GROUP BY m.id, m.name
                ORDER BY m.name
            """))

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
def create_menu():
    try:
        data = request.json
        engine = create_engine(DB_URL, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    INSERT INTO menu (name, created_date)
                    VALUES (:name, CURRENT_TIMESTAMP)
                    RETURNING id, name
                """),
                {"name": data['name']}
            )
            new_menu = result.fetchone()
            connection.commit()
            
            return jsonify({
                'id': new_menu.id,
                'name': new_menu.name
            }), 201
    except Exception as e:
        print(f"Error creating menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus/<int:menu_id>/recipes', methods=['GET'])
def get_menu_recipes(menu_id):
    try:
        engine = create_engine(DB_URL, poolclass=NullPool)
        
        with engine.connect() as connection:
            # First get menu name
            menu_result = connection.execute(
                text("SELECT name FROM menu WHERE id = :menu_id"),
                {"menu_id": menu_id}
            ).fetchone()
            
            if not menu_result:
                return jsonify({'error': 'Menu not found'}), 404
                
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
        recipe_id = data['recipe_id']
        engine = create_engine(DB_URL, poolclass=NullPool)
        
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
                return jsonify({'message': 'Recipe already in menu'}), 400
                
            # Add recipe to menu
            connection.execute(
                text("""
                    INSERT INTO menu_recipe (menu_id, recipe_id)
                    VALUES (:menu_id, :recipe_id)
                """),
                {"menu_id": menu_id, "recipe_id": recipe_id}
            )
            
            connection.commit()
            return jsonify({'message': 'Recipe added to menu'}), 201
    except Exception as e:
        print(f"Error adding recipe to menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus/<int:menu_id>', methods=['DELETE'])
def delete_menu(menu_id):
    try:
        engine = create_engine(DB_URL, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Delete menu recipes first
            connection.execute(
                text("DELETE FROM menu_recipe WHERE menu_id = :menu_id"),
                {"menu_id": menu_id}
            )
            
            # Delete menu
            result = connection.execute(
                text("DELETE FROM menu WHERE id = :menu_id"),
                {"menu_id": menu_id}
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Menu not found'}), 404
                
            connection.commit()
            return jsonify({'message': 'Menu deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus/<int:menu_id>/recipes/<int:recipe_id>', methods=['DELETE'])
def remove_recipe_from_menu(menu_id, recipe_id):
    try:
        engine = create_engine(DB_URL, poolclass=NullPool)
        
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    DELETE FROM menu_recipe
                    WHERE menu_id = :menu_id AND recipe_id = :recipe_id
                """),
                {"menu_id": menu_id, "recipe_id": recipe_id}
            )
            
            if not result.rowcount:
                return jsonify({'error': 'Recipe not found in menu'}), 404
                
            connection.commit()
            return jsonify({'message': 'Recipe removed from menu'}), 200
    except Exception as e:
        print(f"Error removing recipe from menu: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fridge/add', methods=['POST'])
def add_fridge_item():
    try:
        data = request.json
        
        # Clean the name
        name = data.get('name', '').strip()
        if not name:
            return jsonify({
                'success': False,
                'error': 'Name is required'
            }), 400
            
        # Remove any formatting markers
        name = re.sub(r'\[(red|green)\]•\s*', '', name)
        
        engine = create_engine(db_url, poolclass=NullPool)
        with engine.connect() as connection:
            # Check if item already exists
            result = connection.execute(
                text("""
                    SELECT id, quantity, unit, price_per 
                    FROM fridge_item 
                    WHERE LOWER(name) = LOWER(:name)
                    AND user_id = :user_id
                """),
                {
                    "name": name,
                    "user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"
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
                        WHERE id = :id
                    """),
                    {
                        "id": existing_item.id,
                        "quantity": float(data.get('quantity', existing_item.quantity or 0)),
                        "unit": data.get('unit', existing_item.unit),
                        "price_per": float(data.get('price_per', existing_item.price_per or 0))
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
                        "user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"
                    }
                )
                item_id = result.fetchone()[0]
            
            connection.commit()
            
            # Return the updated/created item
            result = connection.execute(
                text("SELECT * FROM fridge_item WHERE id = :id"),
                {"id": item_id}
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

@app.route('/api/fridge', methods=['GET'])
def get_fridge_items():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Query fridge items
            result = connection.execute(
                text("""
                    SELECT id, name, quantity, unit, price_per
                    FROM fridge_item
                    WHERE user_id = :user_id
                    ORDER BY name
                """),
                {"user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"}  # Default user ID
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
    


@app.route('/api/grocery-lists', methods=['POST'])
def create_grocery_list():
    try:
        data = request.json
        default_user_id = 'bc6ae242-c238-4a6b-a884-2fd1fc03ed72'  # Same default user ID as used in recipes
        
        # Create new list in Supabase/PostgreSQL
        with db.engine.connect() as connection:
            # Insert the grocery list with user_id
            result = connection.execute(
                text("""
                    INSERT INTO grocery_list (name, created_date, user_id)
                    VALUES (:name, CURRENT_TIMESTAMP, :user_id)
                    RETURNING id
                """),
                {
                    "name": data['name'],
                    "user_id": default_user_id
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
    

@app.route('/api/fridge/<int:item_id>', methods=['DELETE'])
def delete_fridge_item(item_id):
    try:
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
                    "user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"
                }
            )
            
            if not result.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Item not found'
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
def update_fridge_item(item_id):
    try:
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
                    "user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"
                }
            )
            
            if not result.fetchone():
                return jsonify({
                    'success': False,
                    'error': 'Item not found'
                }), 404
            
            # Update the item
            connection.execute(
                text("""
                    UPDATE fridge_item 
                    SET quantity = COALESCE(:quantity, quantity),
                        unit = COALESCE(:unit, unit),
                        price_per = COALESCE(:price_per, price_per)
                    WHERE id = :id
                """),
                {
                    "id": item_id,
                    "quantity": float(data.get('quantity')) if 'quantity' in data else None,
                    "unit": data.get('unit'),
                    "price_per": float(data.get('price_per')) if 'price_per' in data else None
                }
            )
            
            connection.commit()
            
            # Return updated item
            result = connection.execute(
                text("SELECT * FROM fridge_item WHERE id = :id"),
                {"id": item_id}
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
def clear_fridge():
    try:
        engine = create_engine(db_url, poolclass=NullPool)
        
        with engine.connect() as connection:
            # Set all quantities to 0 for the user's items
            connection.execute(
                text("""
                    UPDATE fridge_item 
                    SET quantity = 0
                    WHERE user_id = :user_id
                """),
                {"user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"}
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
                ingredient_list = ','.join([f"'{ing}'" for ing in ingredients])
                query = text(f"""
                    WITH matching_recipes AS (
                        SELECT DISTINCT r.id, r.name, r.description, r.prep_time
                        FROM recipe r
                        JOIN recipe_ingredient_quantities riq ON r.id = riq.recipe_id
                        JOIN ingredients i ON riq.ingredient_id = i.id
                        WHERE LOWER(i.name) = ANY(ARRAY[{ingredient_list}]::text[])
                        GROUP BY r.id, r.name, r.description, r.prep_time
                        HAVING COUNT(DISTINCT i.name) >= :ingredient_count
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
        recipe = Recipe.query.get_or_404(recipe_id)
        
        # Update basic recipe info
        recipe.name = data['name']
        recipe.description = data['description']
        recipe.instructions = data['instructions']
        recipe.prep_time = data['prep_time']
        
        # Get current ingredient names in the updated recipe
        updated_ingredient_names = {ing['name'].lower() for ing in data['ingredients']}
        
        # Find ingredients to remove (ones in DB but not in updated data)
        current_quantities = recipe.ingredient_quantities
        for quantity in current_quantities:
            if quantity.ingredient.name.lower() not in updated_ingredient_names:
                # Delete nutrition data if it exists
                if quantity.nutrition:
                    db.session.delete(quantity.nutrition)
                db.session.delete(quantity)
        
        # Update or add ingredients
        for ingredient_data in data['ingredients']:
            ingredient_name = ingredient_data['name']
            
            # Skip empty ingredient names
            if not ingredient_name:
                continue
                
            # Get or create ingredient
            ingredient = Ingredient.query.filter(
                func.lower(Ingredient.name) == func.lower(ingredient_name)
            ).first()
            
            if not ingredient:
                ingredient = Ingredient(name=ingredient_name)
                db.session.add(ingredient)
                db.session.flush()
            
            # Update or create quantity association
            quantity = RecipeIngredientQuantity.query.filter_by(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id
            ).first()
            
            if quantity:
                # Update existing quantity
                quantity.quantity = float(ingredient_data['quantity'])
                quantity.unit = ingredient_data['unit']
            else:
                # Create new quantity association
                quantity = RecipeIngredientQuantity(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    quantity=float(ingredient_data['quantity']),
                    unit=ingredient_data['unit']
                )
                db.session.add(quantity)
            
            # Update nutrition if provided
            if ingredient_data.get('nutritionData'):
                nutrition = quantity.nutrition
                if not nutrition:
                    nutrition = RecipeIngredientNutrition(
                        recipe_ingredient_quantities_id=quantity.id
                    )
                    db.session.add(nutrition)
                
                nutrition_data = ingredient_data['nutritionData']
                nutrition.protein_grams = nutrition_data.get('protein_grams')
                nutrition.fat_grams = nutrition_data.get('fat_grams')
                nutrition.carbs_grams = nutrition_data.get('carbs_grams')
                nutrition.serving_size = nutrition_data.get('serving_size')
                nutrition.serving_unit = nutrition_data.get('serving_unit')
        
        db.session.commit()
        return jsonify({'message': 'Recipe updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/recipe/<int:recipe_id>', methods=['DELETE'])
def delete_recipe(recipe_id):
    try:
        recipe = Recipe.query.get_or_404(recipe_id)
        
        # Delete associated ingredients in RecipeIngredient3 table
        RecipeIngredient3.query.filter(
            text('JSON_CONTAINS(recipe_ids, CAST(:recipe_id AS JSON))')
        ).params(recipe_id=recipe_id).update(
            {"recipe_ids": text("JSON_REMOVE(recipe_ids, JSON_UNQUOTE(JSON_SEARCH(recipe_ids, 'one', :recipe_id)))")},
            synchronize_session=False
        )
        
        # Delete associated records in RecipeIngredientDetails table
        RecipeIngredientDetails.query.filter_by(recipe_id=recipe_id).delete()
        
        # Delete associated records in RecipeIngredientQuantity table
        RecipeIngredientQuantity.query.filter_by(recipe_id=recipe_id).delete()
        
        # Delete associated records in RecipeIngredientNutrition table
        nutrition_subquery = db.session.query(RecipeIngredientNutrition.id).join(RecipeIngredientQuantity).filter(
            RecipeIngredientQuantity.recipe_id == recipe_id
        ).subquery()

        RecipeIngredientNutrition.query.filter(RecipeIngredientNutrition.id.in_(nutrition_subquery)).delete(synchronize_session=False)
        
        # Delete the recipe from menus
        MenuRecipe.query.filter_by(recipe_id=recipe_id).delete()
        
        # Delete the recipe itself
        db.session.delete(recipe)
        db.session.commit()
        
        return jsonify({'message': 'Recipe deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting recipe: {str(e)}")  # Add this line for logging
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
    
# This should be the ONLY get_grocery_list route in your file
@app.route('/api/grocery-lists/<int:list_id>', methods=['GET'])
def get_grocery_list(list_id):
    try:
        grocery_list = GroceryList.query.get_or_404(list_id)
        items_data = [{
            'id': item.id,
            'name': item.name,
            'list_id': item.list_id,
            'quantity': float(item.quantity) if item.quantity is not None else 0,
            'unit': item.unit or '',
            'price_per': float(item.price_per) if item.price_per is not None else 0,
            'total': float(item.quantity * item.price_per) if item.quantity is not None and item.price_per is not None else 0
        } for item in grocery_list.items]
        
        return jsonify({
            'id': grocery_list.id,
            'name': grocery_list.name,
            'items': items_data
        })
    except Exception as e:
        print(f"Error fetching grocery list: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Other routes that should remain (make sure there's only one of each)
@app.route('/api/grocery-lists', methods=['GET'])
def get_grocery_lists():
    try:
        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
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
                GROUP BY gl.id
            """), {"user_id": "bc6ae242-c238-4a6b-a884-2fd1fc03ed72"})  

            lists_data = []
            for row in result:
                lists_data.append({
                    'id': row.id,
                    'name': row.name,
                    'items': row.items
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
def add_item_to_list(list_id):
    try:
        data = request.json
        if not data or 'name' not in data:
            return jsonify({'error': 'Name is required'}), 400

        # Create connection to Supabase PostgreSQL
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)

        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Insert the new item into the grocery_item table
                result = connection.execute(
                    text("""
                        INSERT INTO grocery_item (list_id, name, quantity, unit, price_per, total)
                        VALUES (:list_id, :name, :quantity, :unit, :price_per, :total)
                        RETURNING id, name, quantity, unit, price_per, total
                    """),
                    {
                        "list_id": list_id,
                        "name": data['name'],
                        "quantity": float(data.get('quantity', 0)),
                        "unit": data.get('unit', ''),
                        "price_per": float(data.get('price_per', 0)),
                        "total": float(data.get('quantity', 0)) * float(data.get('price_per', 0))
                    }
                )

                new_item = result.fetchone()

            # Commit the transaction
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


@app.route('/api/exercise/<int:exercise_id>', methods=['GET'])
def get_exercise(exercise_id):
    try:
        # Get the exercise details
        exercise = Exercise.query.get_or_404(exercise_id)
        
        # Get the latest history and sets
        latest_history = SetHistory.query\
            .filter_by(exercise_id=exercise_id)\
            .order_by(SetHistory.created_at.desc())\
            .first()
            
        latest_sets = []
        if latest_history:
            latest_sets = IndividualSet.query\
                .filter_by(set_history_id=latest_history.id)\
                .order_by(IndividualSet.set_number)\
                .all()
        
        # Return comprehensive exercise data
        return jsonify({
            'id': exercise.id,
            'name': exercise.name,
            'workout_type': exercise.workout_type,
            'major_groups': exercise.major_groups,
            'minor_groups': exercise.minor_groups,
            'amount_sets': exercise.amount_sets,
            'amount_reps': exercise.amount_reps,
            'weight': exercise.weight,
            'rest_time': exercise.rest_time,
            'sets': [{
                'id': set.id,
                'set_number': set.set_number,
                'reps': set.reps,
                'weight': set.weight
            } for set in latest_sets],
            'created_at': latest_history.created_at.isoformat() if latest_history else None
        })
    except Exception as e:
        print(f"Error fetching exercise: {str(e)}")  # Add debug logging
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
        print(f"Received nutrition data: {data}")  # Debug log
        
        # Get the recipe ingredient quantity record by index
        quantity_records = RecipeIngredientQuantity.query.filter_by(recipe_id=recipe_id).all()
        
        if ingredient_index >= len(quantity_records):
            print(f"Invalid index: {ingredient_index}, total records: {len(quantity_records)}")
            return jsonify({'error': 'Invalid ingredient index'}), 400
            
        quantity_record = quantity_records[ingredient_index]
        print(f"Found quantity record: {quantity_record.id}")

        # First delete any existing nutrition record
        RecipeIngredientNutrition.query.filter_by(
            recipe_ingredient_quantities_id=quantity_record.id
        ).delete()
        
        # Create new nutrition record
        nutrition = RecipeIngredientNutrition(
            recipe_ingredient_quantities_id=quantity_record.id,
            protein_grams=data.get('protein_grams', 0),
            fat_grams=data.get('fat_grams', 0),
            carbs_grams=data.get('carbs_grams', 0),
            serving_size=data.get('serving_size', 0),
            serving_unit=data.get('serving_unit', '')
        )
        
        db.session.add(nutrition)
        db.session.commit()
        
        print("Successfully saved nutrition data")
        return jsonify({'message': 'Nutrition info added successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding nutrition info: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/recipe/<int:recipe_id>', methods=['GET'])
def get_recipe(recipe_id):
    try:
        # Create the database engine using Supabase credentials
        db_url = 'postgresql://postgres.bvgnlxznztqggtqswovg:RecipeFinder123!@aws-0-us-east-2.pooler.supabase.com:5432/postgres'
        engine = create_engine(db_url)
        
        with engine.connect() as connection:
            # Get basic recipe information
            recipe_result = connection.execute(
                text("""
                    SELECT id, name, description, instructions, prep_time, created_date
                    FROM recipe
                    WHERE id = :recipe_id
                """),
                {"recipe_id": recipe_id}
            ).first()
            
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
        print(f"Error fetching recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
            for exercise in data['exercises']:
                connection.execute(
                    text("""
                        INSERT INTO weekly_workouts (day, exercise_id, week_id)
                        VALUES (:day, :exercise_id, 1)
                        ON CONFLICT (day, exercise_id, week_id) 
                        DO UPDATE SET exercise_id = EXCLUDED.exercise_id
                    """),
                    {
                        'day': data['day'],
                        'exercise_id': exercise['id']
                    }
                )
                
            connection.commit()
            return jsonify({'message': 'Workout added successfully'})
            
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

@app.route('/api/logout', methods=['POST'])
def logout():
    # Clear the token file
    token_path = os.path.join('instance', 'token.json')
    if os.path.exists(token_path):
        os.remove(token_path)
    return jsonify({'message': 'Logged out successfully'}), 200

 

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


@app.route('/api/exercise/<int:exercise_id>/sets/latest', methods=['GET'])
def get_latest_set(exercise_id):
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = connection.cursor(dictionary=True)
        
        # Get the latest set by created_at first to find the most recent workout session
        cursor.execute("""
            WITH LatestSession AS (
                SELECT DATE(created_at) as session_date
                FROM individual_set
                WHERE exercise_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            )
            SELECT s.id, s.exercise_id, s.weight, s.reps, s.created_at
            FROM individual_set s
            JOIN LatestSession ls ON DATE(s.created_at) = ls.session_date
            WHERE s.exercise_id = %s
            ORDER BY s.weight DESC
            LIMIT 1
        """, (exercise_id, exercise_id))
        
        top_set = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return jsonify({
            'latestSet': {
                'id': top_set['id'],
                'exercise_id': top_set['exercise_id'],
                'weight': top_set['weight'],
                'reps': top_set['reps'],
                'created_at': top_set['created_at'].isoformat() if top_set['created_at'] else None
            } if top_set else None
        })
    except Exception as e:
        print(f"Error fetching latest set: {str(e)}")
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