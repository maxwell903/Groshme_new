import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import WorkoutExerciseCard from '@/components/WorkoutExerciseCard';
import ExerciseSearchModal from '@/components/ExerciseSearchModal';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const DaySelector = ({ isOpen, onClose, onDaySelect }) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  
  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim() || !startDate) {
      alert('Please enter a title and start date');
      return;
    }

    const selectedDate = new Date(startDate);
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 7);

    const dayIndex = selectedDate.getDay();
    const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
    
    onDaySelect({
      title,
      startDate: startDate,
      endDate: endDate.toISOString().split('T')[0],
      day: days[adjustedDayIndex]
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New Week</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-md p-2"
              placeholder="Enter week title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-md p-2"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Week
          </button>
        </div>
      </div>
    </div>
  );
};

const WeekCard = ({ week, onDeleteWeek }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState(null);

  const handleDeleteExercise = async (day, exerciseId) => {
    try {
      await onDeleteExercise(day, exerciseId, week.id);
    } catch (err) {
      setError(err.message);
      console.error('Error deleting exercise:', err);
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
      {/* Header */}
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
            onClick={() => onDeleteWeek(week.id)}
            className="text-red-600 hover:text-red-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
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

              <WorkoutExerciseCard
  day={day}
  exercises={week.daily_workouts?.[day] || []}
  onDeleteExercise={(day, exerciseId) => handleDeleteExercise(day, exerciseId)}
  weekId={week.id}  // Make sure this is being passed
/>
            </div>
          ))}
        </div>
      )}

      {/* Exercise Search Modal */}
      {showExerciseModal && (
        <ExerciseSearchModal
          isOpen={showExerciseModal}
          onClose={() => setShowExerciseModal(false)}
          onExercisesSelected={() => {
            setShowExerciseModal(false);
            // Refresh week data after adding exercises
            // You'll need to implement this refresh logic
            onExerciseChange();
          }}
          weekId={week.id}
          day={selectedDay}
        />
      )}
    </div>
  );
};


const GymPage = () => {
  const [weeks, setWeeks] = useState([]);
  const [showDaySelector, setShowDaySelector] = useState(false);
  const [loading, setLoading] = useState(true);

  

  const fetchWeeks = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch(`${API_URL}/api/workout-weeks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch weeks');
      }

      const data = await response.json();
      setWeeks(data.weeks || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching weeks:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeks();
  }, []);

  const handleDeleteExercise = async (day, exerciseId, weekId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${API_URL}/api/workout-weeks/${weekId}/days/${day}/exercises/${exerciseId}`, 
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete exercise');
      }

      // Refresh the weeks data after successful deletion
      await fetchWeeks();
    } catch (error) {
      console.error('Error deleting exercise:', error);
    }
  };

  const handleDaySelect = async (weekData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      // Log the data being sent for debugging
      console.log('Sending workout week data:', weekData);

      const response = await fetch(`${API_URL}/api/workout-weeks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: weekData.title,
          start_date: weekData.startDate,
          end_date: weekData.endDate,
          start_day: weekData.day
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create week');
      }

      const result = await response.json();
      console.log('Week created successfully:', result);
      await fetchWeeks();
      setShowDaySelector(false);
    } catch (error) {
      console.error('Error creating week:', error);
      alert(error.message || 'Failed to create workout week');
    }
  };

  const handleDeleteWeek = async (weekId) => {
    if (!confirm('Are you sure you want to delete this week?')) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await fetch(`${API_URL}/api/workout-weeks/${weekId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to delete week');
      await fetchWeeks();
    } catch (error) {
      console.error('Error deleting week:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Workout Weeks</h1>
          <button
            onClick={() => setShowDaySelector(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Add Week
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="space-y-4">
            {weeks.map((week) => (
              <WeekCard
                key={week.id}
                week={week}
                onDeleteWeek={handleDeleteWeek}
                onDeleteExercise={handleDeleteExercise}
              />
            ))}
          </div>
        )}

        <DaySelector
          isOpen={showDaySelector}
          onClose={() => setShowDaySelector(false)}
          onDaySelect={handleDaySelect}
        />
      </div>
    </div>
  );
};

export default GymPage;