import React, { useState } from 'react';
import { X } from 'lucide-react';

const ExerciseCard = ({ exercise, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow border mb-2 overflow-hidden">
      <div 
        className="p-4 cursor-pointer flex justify-between items-center"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <h3 className="font-medium text-gray-900">{exercise.name}</h3>
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
        </div>
      )}
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