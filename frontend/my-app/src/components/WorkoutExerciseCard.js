import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import SetsModal from './SetsModal';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const ExerciseCard = ({ exercise, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSetsModal, setShowSetsModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Check if exercise has been completed today
  useEffect(() => {
    const checkCompletion = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets/latest`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.latestSet) {
            const setDate = new Date(data.latestSet.created_at);
            const today = new Date();
            setIsCompleted(
              setDate.getDate() === today.getDate() &&
              setDate.getMonth() === today.getMonth() &&
              setDate.getFullYear() === today.getFullYear()
            );
          }
        }
      } catch (error) {
        console.error('Error checking completion:', error);
      }
    };

    checkCompletion();
  }, [exercise.id]);

  return (
    <div className={`bg-white rounded-lg shadow border mb-2 overflow-hidden 
      ${isCompleted ? 'border-green-500 bg-green-50' : ''}`}>
      <div 
        className="p-4 cursor-pointer flex justify-between items-center"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="font-medium text-gray-900">{exercise.name}</h3>
          {isCompleted && (
            <span className="text-sm text-green-600">Completed today</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(exercise.id);
          }}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <X size={16} />
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50">
          <p className="text-gray-600">
            {exercise.target_sets} × {exercise.target_reps}
          </p>
          <p className="text-gray-600">
            @ {exercise.target_weight} lbs
          </p>
          <p className="text-gray-600">
            Rest: {exercise.rest_time} seconds
          </p>
          <button
            onClick={() => setShowSetsModal(true)}
            className="mt-3 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Log Sets
          </button>
        </div>
      )}

      <SetsModal
        exercise={{
          ...exercise,
          amount_sets: exercise.target_sets,
          amount_reps: exercise.target_reps,
          weight: exercise.target_weight
        }}
        isOpen={showSetsModal}
        onClose={() => {
          setShowSetsModal(false);
          // Recheck completion status after logging sets
          setIsCompleted(true);
        }}
      />
    </div>
  );
};

const WorkoutExerciseCard = ({ day, exercises, onDeleteExercise }) => {
  if (!exercises || exercises.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-dashed">
        <p className="text-gray-500 text-center">No exercises added</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          onDelete={(exerciseId) => onDeleteExercise(day, exerciseId)}
        />
      ))}
    </div>
  );
};

export default WorkoutExerciseCard;