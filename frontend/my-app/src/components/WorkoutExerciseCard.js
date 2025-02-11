import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import ExerciseSearchModal from './ExerciseSearchModal';

const ExerciseCard = ({ exercise, onDelete, day }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSetsModal, setShowSetsModal] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent expansion when clicking delete
    if (window.confirm('Are you sure you want to delete this exercise?')) {
      try {
        await onDelete(day, exercise.exercise_id);
      } catch (error) {
        console.error('Error deleting exercise:', error);
        alert('Failed to delete exercise');
      }
    }
  };

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
          onClick={handleDelete}
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
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setShowSetsModal(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Log Sets
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const WeekCard = ({ week, onDeleteWeek, onExerciseChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const handleDeleteWeek = async () => {
    if (window.confirm('Are you sure you want to delete this week and all its contents?')) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/workout-weeks/${week.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete week');
        }

        onDeleteWeek(week.id);
      } catch (error) {
        console.error('Error deleting week:', error);
        alert('Failed to delete week: ' + error.message);
      }
    }
  };

  const handleDeleteExercise = async (day, exerciseId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/workout-weeks/${week.id}/exercises/${exerciseId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete exercise');
      }

      onExerciseChange(); // Refresh the week data
    } catch (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  };

  const formatDateRange = () => {
    if (!week.start_date || !week.end_date) return '';
    const startDate = new Date(week.start_date);
    const endDate = new Date(week.end_date);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{week.title}</h3>
          <p className="text-sm text-gray-600">{formatDateRange()}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-gray-800"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <button
            onClick={handleDeleteWeek}
            className="text-red-600 hover:text-red-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 grid grid-cols-7 gap-4">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <div key={day} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium">{day}</h4>
                <button
                  onClick={() => {
                    setSelectedDay(day);
                    setShowExerciseModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Add Exercise
                </button>
              </div>

              <div className="space-y-2">
                {week.daily_workouts?.[day]?.map((exercise) => (
                  <ExerciseCard
                    key={exercise.exercise_id}
                    exercise={exercise}
                    day={day}
                    onDelete={handleDeleteExercise}
                  />
                ))}
                {(!week.daily_workouts?.[day] || week.daily_workouts[day].length === 0) && (
                  <div className="text-gray-500 text-center text-sm">
                    No exercises added
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showExerciseModal && (
        <ExerciseSearchModal
          isOpen={showExerciseModal}
          onClose={() => setShowExerciseModal(false)}
          onExercisesSelected={() => {
            setShowExerciseModal(false);
            onExerciseChange();
          }}
          weekId={week.id}
          day={selectedDay}
        />
      )}
    </div>
  );
};

export default WeekCard;