from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Workout(db.Model):
    __tablename__ = 'workouts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Add relationship to exercises if needed
    exercises = db.relationship('Exercise', secondary='workout_exercises', 
                              backref=db.backref('workouts', lazy=True))

class Exercise(db.Model):
    __tablename__ = 'exercises'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    workout_type = db.Column(db.String(20), nullable=False)
    major_groups = db.Column(db.JSON, nullable=False)
    minor_groups = db.Column(db.JSON, nullable=False)
    amount_sets = db.Column(db.Integer, nullable=False)
    amount_reps = db.Column(db.Integer, nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    rest_time = db.Column(db.Integer, nullable=False)

class WorkoutExercise(db.Model):
    __tablename__ = 'workout_exercises'
    workout_id = db.Column(db.Integer, db.ForeignKey('workouts.id', ondelete='CASCADE'), primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey('exercises.id', ondelete='CASCADE'), primary_key=True)