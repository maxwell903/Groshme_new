# app.py
import re
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy # type: ignore
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
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "supports_credentials": True
    }
})
 
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 
    'postgresql://postgres:RecipeFinder123!@db.bvgnlxznztqggtqswovg.supabase.co:5432/postgres'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
 
db = SQLAlchemy()
db.init_app(app)
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

from sqlalchemy import text

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
    
# app.py route:
@app.route('/api/parse-receipt-image', methods=['POST'])
def parse_receipt_image():
    try:
        if 'receipt' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['receipt']
        content = file.read()

        # Initialize Vision client with service account
        credentials = service_account.Credentials.from_service_account_file(
            'oauth_setup/service-account-key.json',
            scopes=['https://www.googleapis.com/auth/cloud-vision']
        )
        client = vision.ImageAnnotatorClient(credentials=credentials)
        
        image = vision.Image(content=content)
        response = client.text_detection(image=image)
        
        # Extract detected text
        detected_text = response.text_annotations[0].description if response.text_annotations else "No text detected"

        return jsonify({
            'text': detected_text
        })

    except Exception as e:
        print(f"Error processing receipt: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercise/<int:exercise_id>/sets', methods=['GET'])
def get_exercise_sets(exercise_id):
    try:
        # Get the most recent set history for this exercise
        latest_history = SetHistory.query\
            .filter_by(exercise_id=exercise_id)\
            .order_by(SetHistory.created_at.desc())\
            .first()
            
        if latest_history:
            sets = IndividualSet.query\
                .filter_by(history_id=latest_history.id)\
                .order_by(IndividualSet.set_number)\
                .all()
                
            return jsonify({
                'sets': [{
                    'id': set.id,
                    'set_number': set.set_number,
                    'reps': set.reps,
                    'weight': set.weight
                } for set in sets]
            })
        return jsonify({'sets': []})
    except Exception as e:
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
        exercise = Exercise.query.get_or_404(exercise_id)
        data = request.json
        
        exercise.name = data['name']
        exercise.workout_type = data['workout_type']
        exercise.major_groups = data['major_groups']
        exercise.minor_groups = data['minor_groups']
        exercise.amount_sets = data['amount_sets']
        exercise.amount_reps = data['amount_reps']
        exercise.weight = data['weight']
        exercise.rest_time = data['rest_time']
        
        db.session.commit()
        return jsonify({'message': 'Exercise updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/exercise/<int:exercise_id>/sets', methods=['POST'])
def add_exercise_sets(exercise_id):
    try:
        data = request.json
        sets_data = data.get('sets', [])
        
        # Create new history entry
        history = SetHistory(exercise_id=exercise_id)
        db.session.add(history)
        db.session.flush()  # Get the history ID
        
        # Add sets
        for set_data in sets_data:
            new_set = IndividualSet(
                exercise_id=exercise_id,
                set_history_id=history.id,  # Add this line
                set_number=set_data['set_number'],
                reps=set_data['reps'],
                weight=set_data['weight']
            )
            db.session.add(new_set)
            
        db.session.commit()
        return jsonify({'message': 'Sets added successfully'})
    except Exception as e:
        db.session.rollback()
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

@app.route('/api/exercises/<int:exercise_id>', methods=['DELETE'])
def delete_exercise(exercise_id):
    try:
        # This will cascade delete all associated history and sets
        exercise = Exercise.query.get_or_404(exercise_id)
        db.session.delete(exercise)
        db.session.commit()
        return jsonify({'message': 'Exercise deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting exercise: {str(e)}")
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

@app.route('/api/exercise', methods=['POST', 'OPTIONS'])
def create_exercise():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    try:
        data = request.json
        exercise = Exercise(
            name=data['name'],
            workout_type=data['workout_type'],
            major_groups=data['major_groups'],
            minor_groups=data['minor_groups'],
            amount_sets=data['amount_sets'],
            amount_reps=data['amount_reps'],
            weight=data['weight'],
            rest_time=data['rest_time']
        )
        db.session.add(exercise)
        db.session.commit()
        return jsonify({'message': 'Exercise created successfully'}), 201
    except Exception as e:
        db.session.rollback()
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
   name = db.Column(db.String(100), nullable=False)
   description = db.Column(db.Text)
   instructions = db.Column(db.Text)
   prep_time = db.Column(db.Integer)
   created_date = db.Column(db.DateTime, default=db.func.current_timestamp())
   ingredients = db.relationship(
        'Ingredient',
        secondary='recipe_ingredient_quantities',
        backref=db.backref('recipes', lazy=True)
    )

class RecipeIngredientQuantity(db.Model):
    __tablename__ = 'recipe_ingredient_quantities'
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer, db.ForeignKey('recipe.id', ondelete='CASCADE'), nullable=False)
    ingredient_id = db.Column(db.Integer, db.ForeignKey('ingredients.id', ondelete='CASCADE'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20))
    
    recipe = db.relationship('Recipe', backref=db.backref('ingredient_quantities', lazy=True))
    ingredient = db.relationship('Ingredient', backref=db.backref('recipe_quantities', lazy=True))


# Add this near the top with other model definitions
class RecipeIngredient3(db.Model):
    __tablename__ = 'recipe_ingredients3'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    recipe_ids = db.Column(db.JSON)

class RecipeIngredientNutrition(db.Model):
    __tablename__ = 'recipe_ingredient_nutrition'
    
    id = db.Column(db.Integer, primary_key=True)
    recipe_ingredient_quantities_id = db.Column(db.Integer, db.ForeignKey('recipe_ingredient_quantities.id', ondelete='CASCADE'), nullable=False)
    protein_grams = db.Column(db.Float, nullable=True)
    fat_grams = db.Column(db.Float, nullable=True)
    carbs_grams = db.Column(db.Float, nullable=True)
    serving_size = db.Column(db.Float, nullable=True)
    serving_unit = db.Column(db.String(20), nullable=True)
    
    # Add relationship to RecipeIngredientQuantity
    recipe_ingredient = db.relationship('RecipeIngredientQuantity', backref=db.backref('nutrition', uselist=False, cascade='all, delete-orphan'))


class Ingredient(db.Model):
    __tablename__ = 'ingredients'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

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
    __table_args__ = {'extend_existing': True}  # Add this line
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Float(precision=2), nullable=False)
    unit = db.Column(db.String(20))
    price_per = db.Column(db.Float, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'quantity': float(self.quantity) if self.quantity is not None else 0,
            'unit': self.unit,
            'price_per': float(self.price_per) if self.price_per is not None else 0,
            'total': float(self.quantity * self.price_per) if self.quantity is not None and self.price_per is not None else 0
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
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_date = db.Column(db.DateTime, default=db.func.current_timestamp())

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
        exercises = Exercise.query.all()
        return jsonify({
            'exercises': [{
                'id': ex.id,
                'name': ex.name,
                'workout_type': ex.workout_type,
                'major_groups': ex.major_groups,
                'minor_groups': ex.minor_groups,
                'amount_sets': ex.amount_sets,
                'amount_reps': ex.amount_reps,
                'weight': ex.weight,
                'rest_time': ex.rest_time
            } for ex in exercises]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# Add these new routes above the existing grocery list routes

@app.route('/api/grocery-lists/<int:list_id>', methods=['DELETE'])
def delete_grocery_list(list_id):
    try:
        # Get the list
        grocery_list = GroceryList.query.get_or_404(list_id)
        
        # Delete will cascade to items due to relationship configuration
        db.session.delete(grocery_list)
        db.session.commit()
        
        return jsonify({'message': 'Grocery list deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting grocery list: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/grocery-lists/<int:list_id>/items/<int:item_id>', methods=['DELETE'])
def delete_grocery_item(list_id, item_id):
    try:
        item = GroceryItem.query.get_or_404(item_id)
        
        # Verify the item belongs to the specified list
        if item.list_id != list_id:
            return jsonify({'error': 'Item not found in the specified list'}), 404
            
        db.session.delete(item)
        db.session.commit()
        
        return jsonify({'message': 'Item deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting grocery item: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/recipe/<int:recipe_id>')
def get_recipe(recipe_id):
    try:
        recipe = Recipe.query.get_or_404(recipe_id)
        
        # Get ingredients with quantities and nutrition info
        ingredient_quantities = RecipeIngredientQuantity.query\
            .filter_by(recipe_id=recipe_id)\
            .outerjoin(RecipeIngredientNutrition)\
            .all()
        
        ingredient_data = []
        total_nutrition = {
           'protein_grams': 0,
           'fat_grams': 0,
           'carbs_grams': 0
        }

        for qty in ingredient_quantities:
            ingredient_info = {
                'name': qty.ingredient.name,
                'quantity': qty.quantity,
                'unit': qty.unit,
                'nutrition': None
            }
            
            # Add nutrition info if available
            if hasattr(qty, 'nutrition') and qty.nutrition:
                ingredient_info['nutrition'] = {
                    'protein_grams': qty.nutrition.protein_grams,
                    'fat_grams': qty.nutrition.fat_grams,
                    'carbs_grams': qty.nutrition.carbs_grams,
                    'serving_size': qty.nutrition.serving_size,
                    'serving_unit': qty.nutrition.serving_unit
                }

                if qty.nutrition.serving_size and qty.nutrition.serving_size > 0:
                   ratio = qty.quantity / qty.nutrition.serving_size
                   total_nutrition['protein_grams'] += (qty.nutrition.protein_grams or 0) * ratio
                   total_nutrition['fat_grams'] += (qty.nutrition.fat_grams or 0) * ratio
                   total_nutrition['carbs_grams'] += (qty.nutrition.carbs_grams or 0) * ratio
            
            ingredient_data.append(ingredient_info)
        
        recipe_data = {
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'instructions': recipe.instructions,
            'prep_time': recipe.prep_time,
            'ingredients': ingredient_data,
            'total_nutrition': {
                'protein_grams': round(total_nutrition['protein_grams'], 1),
               'fat_grams': round(total_nutrition['fat_grams'], 1),
               'carbs_grams': round(total_nutrition['carbs_grams'], 1)
           }
       }
        
        return jsonify(recipe_data)
    except Exception as e:
        print(f"Recipe detail error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/home-data')
def home_data():
   try:
       total_recipes = Recipe.query.count()
       latest_recipes = Recipe.query.order_by(Recipe.created_date.desc()).limit(6).all()
       
       latest_recipes_data = [{
           'id': recipe.id,
           'name': recipe.name,
           'description': recipe.description,
           'prep_time': recipe.prep_time,
           'ingredients': [ingredient.name for ingredient in recipe.ingredients],
           'total_nutrition': {
                'protein_grams': sum(
                    (ing.nutrition.protein_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                    for ing in recipe.ingredient_quantities 
                    if ing.nutrition and ing.nutrition.serving_size
                ),
                'fat_grams': sum(
                    (ing.nutrition.fat_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                    for ing in recipe.ingredient_quantities 
                    if ing.nutrition and ing.nutrition.serving_size
                ),
                'carbs_grams': sum(
                    (ing.nutrition.carbs_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                    for ing in recipe.ingredient_quantities 
                    if ing.nutrition and ing.nutrition.serving_size
                )
            }
       } for recipe in latest_recipes]
       
       return jsonify({
           'total_recipes': total_recipes,
           'latest_recipes': latest_recipes_data
       })
   except Exception as e:
       print(f"Error: {str(e)}")
       return jsonify({
           'total_recipes': 0,
           'latest_recipes': []
       })
    
# All Recipes Route
@app.route('/api/all-recipes')
def get_all_recipes():
    try:
        # Get all recipes with eager loading of related data
        recipes = Recipe.query\
            .options(
                db.joinedload(Recipe.ingredients),
                db.joinedload(Recipe.ingredient_quantities)\
                  .joinedload(RecipeIngredientQuantity.nutrition)
            )\
            .order_by(Recipe.id.asc())\
            .all()
            
        print(f"Found {len(recipes)} recipes")
        
        recipes_data = []
        for recipe in recipes:
            # Get ingredients using the recipe_ingredients3 table
            ingredients = db.session.query(RecipeIngredient3.name)\
                .filter(db.text('JSON_CONTAINS(recipe_ids, CAST(:recipe_id AS JSON))'))\
                .params(recipe_id=recipe.id)\
                .all()
            
            # Calculate nutrition totals
            recipes_data.append({
                'id': recipe.id,
                'name': recipe.name,
                'description': recipe.description,
                'prep_time': recipe.prep_time,
                'ingredients': [ingredient[0] for ingredient in ingredients],
                'total_nutrition': {
                    'protein_grams': sum(
                        (ing.nutrition.protein_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    ),
                    'fat_grams': sum(
                        (ing.nutrition.fat_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    ),
                    'carbs_grams': sum(
                        (ing.nutrition.carbs_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    )
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




@app.route('/api/recipe', methods=['POST'])
def add_recipe():
    try:
        data = request.json
        
        # Create the recipe
        new_recipe = Recipe(
            name=data['name'],
            description=data['description'],
            instructions=data['instructions'],
            prep_time=int(data['prep_time'])
        )
        db.session.add(new_recipe)
        db.session.flush()  # Get the recipe ID while keeping transaction open
        
        # Process each ingredient and its nutrition data
        for ingredient_data in data['ingredients']:
            # Get or create ingredient
            ingredient = Ingredient.query.filter_by(name=ingredient_data['name']).first()
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

@app.route('/api/menus', methods=['GET'])
def get_menus():
    try:
        menus = Menu.query.all()
        menus_data = [{
            'id': menu.id,
            'name': menu.name,
            'recipe_count': len(menu.menu_recipes)
        } for menu in menus]
        return jsonify({'menus': menus_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus', methods=['POST'])
def create_menu():
    try:
        data = request.json
        new_menu = Menu(name=data['name'])
        db.session.add(new_menu)
        db.session.commit()
        return jsonify({
            'id': new_menu.id,
            'name': new_menu.name
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/menus/<int:menu_id>/recipes', methods=['GET'])
def get_menu_recipes(menu_id):
    try:
        # Get menu with recipes
        menu = Menu.query.get_or_404(menu_id)
        recipes = []
        
        # Get all recipes in menu with nutrition data
        for menu_recipe in menu.menu_recipes:
            recipe = Recipe.query\
                .options(
                    db.joinedload(Recipe.ingredients),
                    db.joinedload(Recipe.ingredient_quantities)\
                      .joinedload(RecipeIngredientQuantity.nutrition)
                )\
                .get(menu_recipe.recipe_id)
            
            if recipe:
                recipes.append(recipe)
        
        recipes_data = []
        for recipe in recipes:
            # Get ingredient details from recipe_ingredient_details table
            ingredient_details = RecipeIngredientDetails.query\
                .filter_by(recipe_id=recipe.id)\
                .all()
            
            recipes_data.append({
                'id': recipe.id,
                'name': recipe.name,
                'description': recipe.description,
                'prep_time': recipe.prep_time,
                'ingredients': [
                    {
                        'name': detail.ingredient_name,
                        'quantity': detail.quantity,
                        'unit': detail.unit
                    }
                    for detail in ingredient_details
                ],
                'total_nutrition': {
                    'protein_grams': sum(
                        (ing.nutrition.protein_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    ),
                    'fat_grams': sum(
                        (ing.nutrition.fat_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    ),
                    'carbs_grams': sum(
                        (ing.nutrition.carbs_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                        for ing in recipe.ingredient_quantities 
                        if ing.nutrition and ing.nutrition.serving_size
                    )
                }
            })
        
        return jsonify({
            'menu_name': menu.name,
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
        
        existing = MenuRecipe.query.filter_by(
            menu_id=menu_id, 
            recipe_id=recipe_id
        ).first()
        
        if existing:
            return jsonify({'message': 'Recipe already in menu'}), 400
            
        menu_recipe = MenuRecipe(menu_id=menu_id, recipe_id=recipe_id)
        db.session.add(menu_recipe)
        db.session.commit()
        return jsonify({'message': 'Recipe added to menu'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/menus/<int:menu_id>', methods=['DELETE', 'OPTIONS'])
def delete_menu(menu_id):
    # Handle preflight request
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    print(f"Attempting to delete menu {menu_id}")  # Debug log
    try:
        # First delete all menu-recipe associations
        MenuRecipe.query.filter_by(menu_id=menu_id).delete()
        
        # Then delete the menu itself
        menu = Menu.query.get_or_404(menu_id)
        db.session.delete(menu)
        db.session.commit()
        
        print(f"Successfully deleted menu {menu_id}")  # Debug log
        return jsonify({'message': 'Menu deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting menu {menu_id}: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500
    



@app.route('/api/menus/<int:menu_id>/recipes/<int:recipe_id>', methods=['DELETE'])
def remove_recipe_from_menu(menu_id, recipe_id):
    try:
        menu_recipe = MenuRecipe.query.filter_by(
            menu_id=menu_id,
            recipe_id=recipe_id
        ).first_or_404()
        
        db.session.delete(menu_recipe)
        db.session.commit()
        return jsonify({'message': 'Recipe removed from menu'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/fridge/add', methods=['POST'])
def add_fridge_item():
    try:
        data = request.json
        
        # Clean the name
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'success': False, 'error': 'Name is required'}), 400
            
        # Remove any formatting markers
        name = re.sub(r'\[(red|green)\]•\s*', '', name)
        
        # Check if item already exists
        existing_item = FridgeItem.query.filter(
            db.func.lower(FridgeItem.name) == db.func.lower(name)
        ).first()
        
        if existing_item:
            # Update existing item
            existing_item.quantity = float(data.get('quantity', existing_item.quantity or 0))
            existing_item.unit = data.get('unit', existing_item.unit)
            existing_item.price_per = float(data.get('price_per', existing_item.price_per or 0))
            db.session.commit()
            return jsonify({
                'success': True,
                'item': existing_item.to_dict()
            })
        
        # Create new item
        new_item = FridgeItem(
            name=name,
            quantity=float(data.get('quantity', 0)),
            unit=data.get('unit', ''),
            price_per=float(data.get('price_per', 0))
        )
        
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'item': new_item.to_dict()
        })
    except Exception as e:
        db.session.rollback()
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
        items = FridgeItem.query.all()
        return jsonify({
            'success': True,
            'ingredients': [item.to_dict() for item in items]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    


@app.route('/api/grocery-lists', methods=['POST'])
def create_grocery_list():
    try:
        data = request.json
        new_list = GroceryList(name=data['name'])
        db.session.add(new_list)
        db.session.commit()
        
        for item_name in data['items']:
            item = GroceryItem(name=item_name, list_id=new_list.id)
            db.session.add(item)
        
        db.session.commit()
        return jsonify({'message': 'Grocery list created', 'id': new_list.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/fridge/<int:item_id>', methods=['DELETE'])
def delete_fridge_item(item_id):
    try:
        item = FridgeItem.query.get_or_404(item_id)
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Item deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/fridge/<int:item_id>', methods=['PUT'])
def update_fridge_item(item_id):
    try:
        item = FridgeItem.query.get(item_id)
        if not item:
            return jsonify({
                'success': False,
                'error': 'Item not found'
            }), 404

        data = request.json
        
        # Update fields if provided
        if 'quantity' in data:
            item.quantity = float(data['quantity'])
        if 'unit' in data:
            item.unit = data['unit']
        if 'price_per' in data:
            item.price_per = float(data['price_per'])
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'item': item.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    



@app.route('/api/fridge/clear', methods=['POST'])
def clear_fridge():
    try:
        # Set all quantities to 0
        FridgeItem.query.update({FridgeItem.quantity: 0})
        db.session.commit()
        return jsonify({'message': 'All fridge items cleared'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/fridge/delete-all', methods=['DELETE'])
def delete_all_fridge_items():
    try:
        FridgeItem.query.delete()
        db.session.commit()
        return jsonify({'message': 'All fridge items deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
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
    ingredients = request.args.getlist('ingredient')
    try:
        if ingredients:
            # Create a query that handles JSON array of recipe_ids
            subquery = """
                WITH RECURSIVE numbered_ingredients AS (
                    SELECT name, recipe_ids
                    FROM recipe_ingredients3
                    WHERE LOWER(name) REGEXP LOWER(:ingredient_pattern)
                ),
                recipe_matches AS (
                    SELECT DISTINCT 
                        JSON_UNQUOTE(JSON_EXTRACT(r.recipe_ids, CONCAT('$[', numbers.n, ']'))) as recipe_id
                    FROM numbered_ingredients r
                    CROSS JOIN (
                        SELECT a.N + b.N * 10 + c.N * 100 as n
                        FROM (SELECT 0 as N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
                              UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a
                        CROSS JOIN (SELECT 0 as N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
                                   UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
                        CROSS JOIN (SELECT 0 as N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
                                   UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) c
                    ) numbers
                    WHERE JSON_UNQUOTE(JSON_EXTRACT(r.recipe_ids, CONCAT('$[', numbers.n, ']'))) IS NOT NULL
                    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(r.recipe_ids, CONCAT('$[', numbers.n, ']')))
                    HAVING COUNT(DISTINCT r.name) >= :ingredient_count
                )
                SELECT r.id, r.name, r.description, r.instructions, r.prep_time
                FROM recipe r
                INNER JOIN recipe_matches rm ON r.id = CAST(rm.recipe_id AS SIGNED)
            """
            
            ingredient_pattern = '|'.join(ingredients)
            
            # Execute the search query
            recipes = db.session.execute(text(subquery), {
                'ingredient_pattern': ingredient_pattern,
                'ingredient_count': len(ingredients)
            }).all()
            
            # Get recipes with nutrition data
            recipes_data = []
            for recipe_row in recipes:
                recipe = Recipe.query\
                    .options(
                        db.joinedload(Recipe.ingredients),
                        db.joinedload(Recipe.ingredient_quantities)\
                          .joinedload(RecipeIngredientQuantity.nutrition)
                    )\
                    .get(recipe_row.id)
                
                # Get ingredients using recipe_ingredients3 table
                ingredients = db.session.query(RecipeIngredient3.name)\
                    .filter(db.text('JSON_CONTAINS(recipe_ids, CAST(:recipe_id AS JSON))'))\
                    .params(recipe_id=recipe.id)\
                    .all()
                
                recipes_data.append({
                    'id': recipe.id,
                    'name': recipe.name,
                    'description': recipe.description,
                    'prep_time': recipe.prep_time,
                    'ingredients': [ingredient[0] for ingredient in ingredients],
                    'total_nutrition': {
                        'protein_grams': sum(
                            (ing.nutrition.protein_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                            for ing in recipe.ingredient_quantities 
                            if ing.nutrition and ing.nutrition.serving_size
                        ),
                        'fat_grams': sum(
                            (ing.nutrition.fat_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                            for ing in recipe.ingredient_quantities 
                            if ing.nutrition and ing.nutrition.serving_size
                        ),
                        'carbs_grams': sum(
                            (ing.nutrition.carbs_grams or 0) * (ing.quantity / ing.nutrition.serving_size)
                            for ing in recipe.ingredient_quantities 
                            if ing.nutrition and ing.nutrition.serving_size
                        )
                    }
                })
            
            return jsonify({
                'results': recipes_data,
                'count': len(recipes_data)
            })
        else:
            return jsonify({
                'results': [],
                'count': 0
            })
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({
            'error': str(e),
            'results': [],
            'count': 0
        }), 500
    
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
        lists = GroceryList.query.all()
        return jsonify({
            'lists': [{
                'id': list.id,
                'name': list.name,
                'items': [{
                    'id': item.id,
                    'name': item.name,
                    'quantity': float(item.quantity) if item.quantity is not None else 0,
                    'unit': item.unit or '',
                    'price_per': float(item.price_per) if item.price_per is not None else 0,
                    'total': float(item.quantity * item.price_per) if item.quantity is not None and item.price_per is not None else 0
                } for item in list.items]
            } for list in lists]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grocery-lists/<int:list_id>/items/<int:item_id>', methods=['PUT'])
def update_grocery_item(list_id, item_id):
    try:
        data = request.json
        item = GroceryItem.query.get_or_404(item_id)
        
        if item.list_id != list_id:
            return jsonify({'error': 'Item not found in the specified list'}), 404
        
        if 'quantity' in data:
            item.quantity = float(data['quantity'])
        if 'unit' in data:
            item.unit = data['unit']
        if 'price_per' in data:
            item.price_per = float(data['price_per'])
            
        # Calculate total
        item.total = float(item.quantity or 0) * float(item.price_per or 0)
        
        db.session.commit()
        return jsonify({
            'message': 'Item updated successfully',
            'item': {
                'id': item.id,
                'name': item.name,
                'list_id': item.list_id,
                'quantity': float(item.quantity) if item.quantity is not None else 0,
                'unit': item.unit or '',
                'price_per': float(item.price_per) if item.price_per is not None else 0,
                'total': float(item.total) if item.total is not None else 0
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    


# Find and replace the existing GroceryItem model with this:
class GroceryItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    list_id = db.Column(db.Integer, db.ForeignKey('grocery_list.id'), nullable=False)
    grocery_list = db.relationship('GroceryList', backref=db.backref('items', lazy=True, cascade='all, delete-orphan'))
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


@app.route('/api/grocery-lists/<int:list_id>/add-recipe/<int:recipe_id>', methods=['POST'])
def add_recipe_to_grocery_list(list_id, recipe_id):
    try:
        recipe = Recipe.query.get_or_404(recipe_id)
        
        # Prepare items to add
        items_to_add = []
        
        # Add recipe header
        items_to_add.append({
            'name': f"**{recipe.name}**",
            'quantity': 1,
            'unit': '',
            'price_per': 0,
            'total':  ''
        })
        
        # Get recipe ingredients
        ingredients = RecipeIngredientDetails.query.filter_by(recipe_id=recipe_id).all()
        fridge_items = FridgeItem.query.all()
        
        # Prepare ingredient items
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
        return jsonify({'message': 'Recipe added successfully'}), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error adding recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
            
        new_item = GroceryItem(
            name=data['name'],
            list_id=list_id,
            quantity=float(data.get('quantity', 0)),
            unit=data.get('unit', ''),
            price_per=float(data.get('price_per', 0))
        )
        new_item.total = new_item.calculate_total()
        
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'message': 'Item added successfully',
            'item': new_item.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
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
        # Query to get ingredients with quantities and units
        ingredients_query = db.session.query(
            RecipeIngredientQuantity,
            Ingredient
        ).join(
            Ingredient,
            RecipeIngredientQuantity.ingredient_id == Ingredient.id
        ).filter(
            RecipeIngredientQuantity.recipe_id == recipe_id
        ).all()

        # Format the ingredients data
        ingredients = [{
            'name': ingredient.name,
            'quantity': float(quantity.quantity) if quantity.quantity else 0,
            'unit': quantity.unit or '',
            'ingredient_id': ingredient.id
        } for quantity, ingredient in ingredients_query]

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
       connection = get_db_connection()
       if not connection:
           return jsonify({'error': 'Database connection failed'}), 500
           
       data = request.json
       if not data or 'day' not in data or 'exercises' not in data:
           return jsonify({'error': 'Invalid request data - requires day and exercises'}), 400
           
       day = data['day']
       exercises = data['exercises']
       
       cursor = connection.cursor()
       
       # Insert exercises with default week_id of 1
       for exercise in exercises:
           cursor.execute("""
               INSERT INTO weekly_workouts (day, exercise_id, week_id) 
               VALUES (%s, %s, 1)
               ON DUPLICATE KEY UPDATE exercise_id = VALUES(exercise_id)
           """, (day, exercise['id']))
       
       connection.commit()
       cursor.close()
       connection.close()
       
       return jsonify({'message': 'Workout added successfully'}), 200
       
   except Exception as e:
       if connection:
           connection.rollback()
           connection.close()
       print(f"Error adding workout: {str(e)}")
       return jsonify({'error': str(e)}), 500
   
@app.route('/api/health-check', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'}), 200

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
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = connection.cursor()
        
        # Delete the record for the specific day and exercise
        cursor.execute("""
            DELETE FROM weekly_workouts 
            WHERE day = %s AND exercise_id = %s AND week_id = 1
        """, (day, exercise_id))
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return jsonify({'message': 'Exercise removed successfully'}), 200
        
    except Exception as e:
        if connection:
            connection.rollback()
            connection.close()
        print(f"Error removing exercise: {str(e)}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/weekly-workouts', methods=['GET'])
def get_weekly_workouts():
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = connection.cursor(dictionary=True)
        
        # First get all weekly workouts with exercise details
        cursor.execute("""
            SELECT DISTINCT
                w.day,
                w.exercise_id,
                e.name,
                e.workout_type,
                e.major_groups,
                e.minor_groups,
                e.amount_sets,
                e.amount_reps,
                e.weight,
                e.rest_time,
                w.created_at
            FROM weekly_workouts w
            JOIN exercises e ON w.exercise_id = e.id
            ORDER BY w.day, w.created_at DESC
        """)
        
        workout_rows = cursor.fetchall()
        workouts = {}
        
        # Process each workout row
        for row in workout_rows:
            day = row['day']
            if day not in workouts:
                workouts[day] = []
            
            # Get the latest set for this exercise, ensuring we get from the most recent session
            cursor.execute("""
                WITH LatestSession AS (
                    SELECT DATE(created_at) as session_date
                    FROM individual_set
                    WHERE exercise_id = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                ),
                TopSet AS (
                    SELECT 
                        s.weight,
                        s.reps,
                        s.created_at
                    FROM individual_set s
                    JOIN LatestSession ls ON DATE(s.created_at) = ls.session_date
                    WHERE s.exercise_id = %s
                    ORDER BY s.weight DESC
                    LIMIT 1
                )
                SELECT * FROM TopSet
            """, (row['exercise_id'], row['exercise_id']))
            
            latest_set = cursor.fetchone()
            
            exercise = {
                'id': row['exercise_id'],
                'name': row['name'],
                'workout_type': row['workout_type'],
                'major_groups': row['major_groups'].split(','),
                'minor_groups': row['minor_groups'].split(','),
                'amount_sets': row['amount_sets'],
                'amount_reps': row['amount_reps'],
                'weight': row['weight'],
                'rest_time': row['rest_time'],
                'latestSet': {
                    'weight': latest_set['weight'],
                    'reps': latest_set['reps'],
                    'created_at': latest_set['created_at'].isoformat() if latest_set else None
                } if latest_set else None
            }
            
            # Only add if we haven't already added this exercise for this day
            if not any(e['id'] == exercise['id'] for e in workouts[day]):
                workouts[day].append(exercise)
        
        cursor.close()
        connection.close()
        
        return jsonify({'workouts': workouts})
        
    except Exception as e:
        if connection:
            connection.close()
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
   with app.app_context():
       db.create_all()
   app.run(debug=True, port=5000)