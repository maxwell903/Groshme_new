import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Edit, Trash, Search } from 'lucide-react';

const WorkoutCard = ({ workout, onDelete, onAddExercise }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const groupedExercises = workout.exercises.reduce((acc, exercise) => {
    if (!acc[exercise.workout_type]) {
      acc[exercise.workout_type] = [];
    }
    acc[exercise.workout_type].push(exercise);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-lg mb-4">
      <div className="p-4 flex justify-between items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1"
        >
          <span className="text-xl font-semibold">{workout.name}</span>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Search size={20} />
          </button>
          <button
            onClick={() => onAddExercise(workout.id)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => onDelete(workout.id)}
            className="p-2 rounded-full hover:bg-gray-100 text-red-600"
          >
            <Trash size={20} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="px-4 pb-4">
          <input
            type="text"
            placeholder="Search exercises..."
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
            className="w-full p-2 border rounded-lg"
          />
        </div>
      )}

      {isExpanded && (
        <div className="p-4 border-t">
          {Object.entries(groupedExercises).map(([type, exercises]) => (
            <div key={type} className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{type}</h3>
              <div className="space-y-4">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{exercise.name}</h4>
                        <p className="text-sm text-gray-600">
                          Major Groups: {exercise.major_groups.join(', ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          Target: {exercise.recommended_weight}lbs × {exercise.recommended_reps} reps
                        </p>
                      </div>
                      {exercise.latest_set ? (
                        <div className="text-right">
                          <p className="font-medium">Last Set</p>
                          <p className="text-sm text-gray-600">
                            {exercise.latest_set.weight}lbs × {exercise.latest_set.reps} reps
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No sets logged</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function WorkoutCards() {
  const [workouts, setWorkouts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  const handleAddWorkout = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkoutName })
      });
      
      if (!response.ok) throw new Error('Failed to add workout');
      
      // Refresh workouts
      fetchWorkouts();
      setShowAddModal(false);
      setNewWorkoutName('');
    } catch (error) {
      console.error('Error adding workout:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Workouts</h1>
        <button
  onClick={() => setShowDaySelector(true)}
  className="text-blue-600 hover:text-blue-800"
  title="Add to Weekly Plan"
>
  <Plus size={20} />
</button>
      </div>

      {workouts.map((workout) => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          onDelete={handleDeleteWorkout}
          onAddExercise={handleAddExercise}
        />
      ))}

      {/* Add Workout Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add New Workout</h2>
            <input
              type="text"
              placeholder="Workout name"
              value={newWorkoutName}
              onChange={(e) => setNewWorkoutName(e.target.value)}
              className="w-full p-2 border rounded-lg mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWorkout}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}