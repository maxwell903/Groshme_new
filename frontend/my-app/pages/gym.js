import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchApi, API_URL } from '@/utils/api';

// Exercise search modal component
const ExerciseSearchModal = ({ isOpen, onClose, onSubmit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [exercises, setExercises] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');

  const workoutTypes = ['All', 'Push', 'Pull', 'Legs', 'Cardio'];

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch(`${API_URL}/api/exercises`);
        const data = await response.json();
        setExercises(data.exercises || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching exercises:', error);
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchExercises();
    }
  }, [isOpen]);

  const filteredExercises = exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedType === 'All' || exercise.workout_type === selectedType)
  );

  const toggleExercise = (exercise) => {
    setSelectedExercises(prev => {
      const isSelected = prev.find(e => e.id === exercise.id);
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id);
      }
      return [...prev, exercise];
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add Exercises</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border rounded-md p-2"
            />
          </div>

          {/* Workout Type Filter */}
          <div className="flex flex-wrap gap-2">
            {workoutTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading exercises...</div>
        ) : (
          <div className="mt-4 space-y-2">
            {filteredExercises.map((exercise) => (
              <label key={exercise.id} className="flex items-center p-2 hover:bg-gray-100 rounded">
                <input
                  type="checkbox"
                  checked={selectedExercises.some(e => e.id === exercise.id)}
                  onChange={() => toggleExercise(exercise)}
                  className="mr-3"
                />
                <div>
                  <div>{exercise.name}</div>
                  <div className="text-sm text-gray-600">
                    {exercise.workout_type} • {exercise.major_groups.join(', ')}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(selectedExercises);
              setSelectedExercises([]);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={selectedExercises.length === 0}
          >
            Add Selected
          </button>
        </div>
      </div>
    </div>
  );
};

// Exercise card component
const ExerciseCard = ({ exercise, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);
  
    const lastSetInfo = exercise.latestSet 
      ? `${exercise.latestSet.weight}lbs × ${exercise.latestSet.reps}`
      : "No sets recorded";
  
    return (
      <div className="relative bg-gray-50 p-4 rounded">
        <button
          onClick={() => onDelete(exercise.id)}
          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
        >
          <X size={16} />
        </button>
  
        <div 
          className="cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="font-medium mb-1">{exercise.name}</h3>
          <div className="text-sm text-blue-600 font-medium mb-2">
            {exercise.workout_type}
          </div>
  
          <div className="text-sm text-gray-600">
            <div className="font-medium">Last Top Set:</div>
            <div className="text-base text-gray-700">
              {lastSetInfo}
            </div>
          </div>
  
          {isExpanded && (
            <div className="mt-3 space-y-3 text-sm border-t pt-2">
              <div>
                <div className="font-medium mb-1">Major Groups</div>
                <ul className="list-inside space-y-1">
                  {exercise.major_groups.map((group, index) => (
                    <li key={index} className="flex items-center">
                      <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                      {group}
                    </li>
                  ))}
                </ul>
              </div>
  
              <div>
                <div className="font-medium mb-1">Minor Groups</div>
                <ul className="list-inside space-y-1">
                  {exercise.minor_groups.map((group, index) => (
                    <li key={index} className="flex items-center">
                      <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                      {group}
                    </li>
                  ))}
                </ul>
              </div>
  
              <div>Target: {exercise.amount_sets} sets • {exercise.amount_reps} reps</div>
              <div>Rest Period: {exercise.rest_time}s</div>
              <Link 
                href={`/exercise/${exercise.id}`}
                className="text-blue-600 hover:text-blue-800 block mt-2"
              >
                View History →
              </Link>
            </div>
          )}
  
          <div className="flex justify-end mt-2">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>
    );
  };

// Main Gym page component
const GymPage = () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [workouts, setWorkouts] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved workouts
  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/weekly-workouts`);
      if (!response.ok) throw new Error('Failed to fetch workouts');
      const data = await response.json();
      setWorkouts(data.workouts || {});
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercises = (day) => {
    setSelectedDay(day);
    setShowModal(true);
  };

  const handleSubmitExercises = async (selectedExercises) => {
    try {
      // Fetch detailed exercise information including latest sets
      const exercisesWithDetails = await Promise.all(
        selectedExercises.map(async (exercise) => {
          try {
            const response = await fetch(`${API_URL}/api/weekly-workouts`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                day: selectedDay,
                exercises: selectedExercises.map(exercise => ({
                  id: exercise.id,
                  name: exercise.name
                }))
              })
            });
        
            console.log('Server response status:', response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Server response:', errorText);
              throw new Error('Failed to save workouts');
            }
        
            const responseData = await response.json();
            console.log('Response data:', responseData);

            // First get exercise details
            const exerciseResponse = await fetch(`${API_URL}/api/exercises/${exercise.id}`);
            if (!exerciseResponse.ok) throw new Error('Failed to fetch exercise details');
            const exerciseData = await exerciseResponse.json();
  
            // Then try to get latest set info
            let latestSet = null;
            try {
              const setsResponse = await fetch(`${API_URL}/api/exercise/${exercise.id}/sets/latest`);
              if (setsResponse.ok) {
                const setsData = await setsResponse.json();
                latestSet = setsData.latestSet;
              }
            } catch (setError) {
              console.warn(`No sets found for exercise ${exercise.name}:`, setError);
            }
  
            return {
              ...exerciseData,
              latestSet
            };
          } catch (error) {
            console.error(`Error fetching details for exercise ${exercise.name}:`, error);
            return {
              ...exercise,
              latestSet: null
            };
          }
        })
      );
  
      // Save to database
      const response = await fetch(`${API_URL}/api/weekly-workouts`, {
        
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        
        body: JSON.stringify({
          day: selectedDay,
          exercises: exercisesWithDetails.map(exercise => ({
            id: exercise.id,
            name: exercise.name
          }))
        })
      });
      
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error('Failed to save workouts');
      }
  
      // Update local state
      setWorkouts(prev => ({
        ...prev,
        [selectedDay]: [
          ...(prev[selectedDay] || []),
          ...exercisesWithDetails
        ]
      }));
  
      // Success notification
      console.log('Exercises added successfully');
      
    } catch (error) {
      console.error('Error saving workouts:', error);
      alert('Failed to save workouts. Please try again.');
    }
  };

  const handleRemoveExercise = async (day, exerciseId) => {
    try {
      const response = await fetch(`${API_URL}/api/weekly-workouts/${day}/${exerciseId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to remove exercise');

      setWorkouts(prev => ({
        ...prev,
        [day]: prev[day].filter(exercise => exercise.id !== exerciseId)
      }));
    } catch (error) {
      console.error('Error removing exercise:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </div>
      </nav>
      
      

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Add the navigation buttons here, before the title */}
        <div className="flex gap-4 mb-6">
        <Link
    href="/my-fridge"
    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
  >
    My Food
  </Link>
          <Link
            href="/meal-prep"
            onClick={() => localStorage.setItem('lastMealPrepTab', 'mealprep')}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
          >
            My Meal Prep
          </Link>
          <Link
            href="/meal-prep"
            onClick={() => localStorage.setItem('lastMealPrepTab', 'workout')}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
          >
            My Exercises
          </Link>
          <Link
            href="/gym"
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            My Workouts
          </Link>
        </div>


        <h1 className="text-3xl font-bold text-gray-900 mb-8">Weekly Workout Plan</h1>

    
        
        <div className="grid grid-cols-7 gap-4">
          {days.map((day) => (
            <div key={day} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{day}</h2>
                <button
                  onClick={() => handleAddExercises(day)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Add exercises"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {workouts[day]?.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onDelete={(exerciseId) => handleRemoveExercise(day, exerciseId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <ExerciseSearchModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmitExercises}
        />
      </div>
    </div>
  );
};

export default GymPage;