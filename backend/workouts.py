from flask import Blueprint, jsonify, request
from datetime import datetime
from models import db, Workout

# Create Blueprint
workouts_bp = Blueprint('workouts', __name__)

@workouts_bp.route('/api/workouts', methods=['GET'])
def get_workouts():
    try:
        # Use SQLAlchemy ORM to fetch workouts
        workouts = Workout.query.order_by(Workout.created_at.desc()).all()
        
        # Format response data
        workouts_data = [{
            'id': workout.id,
            'name': workout.name,
            'created_at': workout.created_at.isoformat() if workout.created_at else None,
            'exercise_count': len(workout.exercises) if hasattr(workout, 'exercises') else 0
        } for workout in workouts]
        
        return jsonify({"workouts": workouts_data}), 200
        
    except Exception as e:
        print(f"Error fetching workouts: {str(e)}")
        return jsonify({"error": "Failed to fetch workouts", "details": str(e)}), 500

@workouts_bp.route('/api/workouts', methods=['POST'])
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
            'name': new_workout.name,
            'created_at': new_workout.created_at.isoformat()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating workout: {str(e)}")
        return jsonify({'error': str(e)}), 500

def init_app(app):
    """Register the Blueprint with the Flask app"""
    app.register_blueprint(workouts_bp)