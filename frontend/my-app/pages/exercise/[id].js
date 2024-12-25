import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Trash, X, Edit } from 'lucide-react';
import EditExerciseModal from '@/components/EditExerciseModal';
import { fetchApi, API_URL } from '@/utils/api';

export default function ExerciseHistory() {
  const router = useRouter();
  const { id } = router.query;
  const [exercise, setExercise] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchExerciseAndHistory();
  }, [fetchExerciseAndHistory]);

  const fetchExerciseAndHistory = async () => {
    try {
      setLoading(true);

      const exerciseResponse = await fetch(`${API_URL}/api/exercise/${id}`);
      if (!exerciseResponse.ok) {
        throw new Error('Failed to fetch exercise details');
      }
      const exerciseData = await exerciseResponse.json();
      setExercise(exerciseData);

      const historyResponse = await fetch(`${API_URL}/api/exercise/${id}/sets/history`);
      if (!historyResponse.ok) {
        throw new Error('Failed to fetch exercise history');
      }
      const historyData = await historyResponse.json();
      
      const sortedHistory = historyData.history.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setHistory(sortedHistory);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExercise = async () => {
    if (!confirm('Are you sure you want to delete this exercise? This will delete all history and cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_URL}/api/exercises/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete exercise');
      }

      router.push('/meal-prep');
    } catch (err) {
      console.error('Error deleting exercise:', err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSet = async (historyId, setId) => {
    if (!confirm('Are you sure you want to delete this set?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/exercise/${id}/sets/${setId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete set');
      }

      // Refresh the history data
      fetchExerciseAndHistory();
    } catch (err) {
      console.error('Error deleting set:', err);
      setError(err.message);
    }
  };

  const handleDeleteSession = async (historyId) => {
    if (!confirm('Are you sure you want to delete this entire session?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/exercise/${id}/history/${historyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      // Refresh the history data
      fetchExerciseAndHistory();
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-gray-600">Loading exercise history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-100 text-red-700 p-8 rounded-lg shadow-md">
          <p className="mb-4">{error}</p>
          <Link
            href="/meal-prep"
            className="text-blue-600 hover:text-blue-800 inline-flex items-center"
          >
            ← Back to Workout
          </Link>
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-gray-600 mb-4">Exercise not found</p>
          <Link
            href="/meal-prep"
            className="text-blue-600 hover:text-blue-800 inline-flex items-center"
          >
            ← Back to Workout
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link
            href="/meal-prep"
            className="text-blue-600 hover:text-blue-800 inline-flex items-center"
          >
            ← Back to Workout
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exercise.name} History</h1>
              <div className="mt-2 text-sm text-gray-600">
                <p>Workout Type: {exercise.workout_type}</p>
                <p>Target Set: {exercise.amount_sets} x {exercise.amount_reps} reps</p>
                <p>Target Weight {exercise.weight} lbs </p>
                <p>Rest Period: {exercise.rest_time} seconds</p>
              </div>
            </div>
            <button
              onClick={handleDeleteExercise}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 disabled:text-red-300"
              title="Delete Exercise"
            >
              <Trash size={20} />
            </button>
            
          </div>
          <button
    onClick={() => setShowEditModal(true)}
    className="text-blue-600 hover:text-blue-800"
    title="Edit Exercise"
  >
    <Edit size={20} />
  </button>
          <div className="flex gap-1">
  
 
</div>

          {history.length === 0 ? (
            <p className="text-gray-600">No workout history yet</p>
          ) : (
            <div className="space-y-6">
              {history.map((session) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">
                      {new Date(session.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </h3>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete Session"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 pr-4">Set</th>
                          <th className="pb-2 pr-4">Weight (lbs)</th>
                          <th className="pb-2 pr-4">Reps</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.sets.map((set, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="py-2 pr-4">{set.set_number}</td>
                            <td className="py-2 pr-4">{set.weight}</td>
                            <td className="py-2 pr-4">{set.reps}</td>
                            <td className="py-2">
                              
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditExerciseModal
  isOpen={showEditModal}
  onClose={() => setShowEditModal(false)}
  exercise={exercise}
  onUpdate={(updatedExercise) => {
    setExercise(updatedExercise);
    fetchExerciseAndHistory();
  }}
/>
    </div>
  );
}
