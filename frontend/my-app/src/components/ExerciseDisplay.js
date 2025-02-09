import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import SetsModal from './SetsModal';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from 'lucide-react';
import DaySelectionModal from './DaySelectionModal'; // Add this import
const API_URL = process.env.NEXT_PUBLIC_API_URL

const ExerciseCard = ({ exercise }) => {
  
    const [showSetsModal, setShowSetsModal] = useState(false);
    const [showDaySelector, setShowDaySelector] = useState(false);
    const router = useRouter();
    const [latestSet, setLatestSet] = useState(null);

    useEffect(() => {
      const fetchLatestSet = async () => {
        try {
          const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets/latest`);
          if (!response.ok) throw new Error('Failed to fetch latest set');
          const data = await response.json();
          setLatestSet(data.latestSet);
        } catch (err) {
          console.error('Error fetching latest set:', err);
        }
      };
  
      fetchLatestSet();
    }, [exercise.id]);
  
  
    const handleDaySelect = async (day) => {
      try {
        const response = await fetch(`${API_URL}/api/weekly-workouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day,
            exercises: [{ id: exercise.id }]
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to add exercise to workout plan');
        }
  
        setShowDaySelector(false);
        // Show success message or update UI as needed
        alert('Exercise added to workout plan');
      } catch (error) {
        console.error('Error adding exercise to workout plan:', error);
        alert('Failed to add exercise to workout plan');
      }
    };
  
    return (
      <>
        <div className="flex-none w-64 bg-white p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold mb-2">{exercise.name}</h3>
            <button
              onClick={() => setShowDaySelector(true)}
              className="text-blue-600 hover:text-blue-800"
              title="Add to Weekly Plan"
            >
              <Plus size={20} className="rounded-full border-2 border-current" />
            </button>
          </div>
  
          <p className="text-sm text-gray-600 mb-1">
            Target set: {exercise.amount_reps} reps × {exercise.weight} lbs
          </p>
          <p className="text-sm text-gray-600">
            Last top set: {latestSet ? `${latestSet.reps} reps × ${latestSet.weight} lbs` : 'N/A'}
          </p>
          <div className="mt-2 text-sm text-gray-500">
            {exercise.amount_sets} sets • Rest: {exercise.rest_time}s
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowSetsModal(true)}
              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 text-sm"
            >
              Log Sets
            </button>
            <button
              onClick={() => router.push(`/exercise/${exercise.id}`)}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-sm"
            >
              Set History
            </button>
          </div>
        </div>
        
        <SetsModal
          exercise={exercise}
          isOpen={showSetsModal}
          onClose={() => setShowSetsModal(false)}
        />  

<DaySelectionModal
        isOpen={showDaySelector}
        onClose={() => setShowDaySelector(false)}
        onDaySelect={handleDaySelect}
      />
    </>
  );
};




       
  
  const ExerciseSection = ({ title, exercises, onScroll }) => {
    const scrollContainer = React.useRef(null);
  
    const scroll = (direction) => {
      if (scrollContainer.current) {
        const scrollAmount = direction === 'left' ? -300 : 300;
        scrollContainer.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    };
  
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="relative">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-2 rounded-full shadow-lg hover:bg-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <div 
            ref={scrollContainer}
            className="flex overflow-x-auto gap-4 scrollbar-hide relative px-12"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
          
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 p-2 rounded-full shadow-lg hover:bg-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    );
  };



  const ExerciseDisplay = () => {
    const [exercises, setExercises] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user } = useAuth();
  
    useEffect(() => {
      const fetchExercises = async () => {
        try {
          // Get the token from localStorage (set during login)
          const token = localStorage.getItem('access_token');
          
          if (!token) {
            throw new Error('No authentication token found');
          }
  
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exercises`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
  
          if (!response.ok) {
            throw new Error('Failed to fetch exercises');
          }
  
          const data = await response.json();
          setExercises(data.exercises || []);
          setError(null);
        } catch (err) {
          console.error('Error fetching exercises:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
  
      if (user) {
        fetchExercises();
      }
    }, [user]);
  
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      );
    }
  
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-2">{exercise.name}</h3>
            <div className="text-sm text-gray-600">
              <p>Type: {exercise.workout_type}</p>
              <p>Sets: {exercise.amount_sets} × {exercise.amount_reps} reps</p>
              <p>Weight: {exercise.weight} lbs</p>
              <p>Rest: {exercise.rest_time}s</p>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  export default ExerciseDisplay;