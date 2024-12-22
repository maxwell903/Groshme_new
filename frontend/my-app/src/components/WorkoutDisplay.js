import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Edit, Trash, X } from 'lucide-react';

const ExerciseSearch = ({ onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/exercises');
        const data = await response.json();
        setExercises(data.exercises || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setLoading(false);
      }
    };
    fetchExercises();
  }, []);

  const filteredExercises = exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Search Exercises</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search exercises..."
          className="w-full border rounded-md p-2 mb-4"
        />
        {loading ? (
          <div className="text-center py-4">Loading exercises...</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {filteredExercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => onSelect(exercise)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
              >
                {exercise.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const WorkoutCard = ({ workout, onDelete, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    const fetchWorkoutExercises = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/workouts/${workout.id}/exercises`);
        const data = await response.json();
        setExercises(data.exercises || []);
      } catch (error) {
        console.error('Error fetching workout exercises:', error);
      }
    };

    if (isExpanded) {
      fetchWorkoutExercises();
    }
  }, [workout.id, isExpanded]);

  const exercisesByType = exercises.reduce((acc, exercise) => {
    if (!acc[exercise.workout_type]) {
      acc[exercise.workout_type] = [];
    }
    acc[exercise.workout_type].push(exercise);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-grow"
        >
          <span className="text-lg font-semibold">{workout.name}</span>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        <div className="flex gap-2">
          <button onClick={() => onEdit(workout)} className="text-blue-600 hover:text-blue-800">
            <Edit size={20} />
          </button>
          <button onClick={() => onDelete(workout.id)} className="text-red-600 hover:text-red-800">
            <Trash size={20} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {Object.entries(exercisesByType).map(([type, typeExercises]) => (
            <div key={type}>
              <h3 className="font-medium text-gray-700 mb-2">{type}</h3>
              <div className="space-y-2">
                {typeExercises.map((exercise) => (
                  <div key={exercise.id} className="bg-gray-50 p-3 rounded">
                    <div className="font-medium">{exercise.name}</div>
                    <div className="text-sm text-gray-600">
                      Weight: {exercise.weight}lbs • {exercise.major_groups.join(', ')}
                    </div>
                    <div className="text-sm text-gray-600">
                      {exercise.latest_set ? (
                        `Latest Set: ${exercise.latest_set.weight}lbs × ${exercise.latest_set.reps} reps`
                      ) : (
                        "No sets logged"
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

const WorkoutDisplay = () => {
  const [workouts, setWorkouts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [newWorkoutName, setNewWorkoutName] = useState('');

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/workouts');
      const data = await response.json();
      setWorkouts(data.workouts || []);
    } catch (error) {
      console.error('Error fetching workouts:', error);
    }
  };

  const handleAddWorkout = async () => {
    if (!newWorkoutName.trim()) return;

    try {
      const response = await fetch('http://localhost:5000/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkoutName })
      });

      if (response.ok) {
        setNewWorkoutName('');
        setShowAddModal(false);
        fetchWorkouts();
      }
    } catch (error) {
      console.error('Error adding workout:', error);
    }
  };

  const handleExerciseSelect = async (exercise) => {
    if (!selectedWorkout) return;

    try {
      await fetch(`http://localhost:5000/api/workouts/${selectedWorkout}/exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: exercise.id })
      });

      setShowSearchModal(false);
      setSelectedWorkout(null);
      fetchWorkouts();
    } catch (error) {
      console.error('Error adding exercise to workout:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Workouts</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          <Plus size={20} />
          Add Workout
        </button>
      </div>

      <div className="space-y-4">
        {workouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            onDelete={async (id) => {
              if (window.confirm('Delete this workout?')) {
                try {
                  await fetch(`http://localhost:5000/api/workouts/${id}`, {
                    method: 'DELETE'
                  });
                  fetchWorkouts();
                } catch (error) {
                  console.error('Error deleting workout:', error);
                }
              }
            }}
            onEdit={(workout) => {
              setSelectedWorkout(workout.id);
              setShowSearchModal(true);
            }}
          />
        ))}
      </div>

      {/* Add Workout Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Workout</h3>
            <input
              type="text"
              value={newWorkoutName}
              onChange={(e) => setNewWorkoutName(e.target.value)}
              placeholder="Workout name..."
              className="w-full border rounded-md p-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWorkout}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Search Modal */}
      {showSearchModal && (
        <ExerciseSearch
          onSelect={handleExerciseSelect}
          onClose={() => {
            setShowSearchModal(false);
            setSelectedWorkout(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkoutDisplay;