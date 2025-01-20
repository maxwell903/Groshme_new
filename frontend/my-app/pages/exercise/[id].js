import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Trash, X, Edit, ArrowLeft } from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL
import EditExerciseModal from '@/components/EditExerciseModal';

const ExerciseDetailsPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [exercise, setExercise] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchExerciseAndHistory = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const exerciseRes = await fetch(`${API_URL}/api/exercises/${id}`);
      if (!exerciseRes.ok) {
        const errorText = await exerciseRes.text();
        console.error('Exercise fetch error:', errorText);
        throw new Error('Failed to fetch exercise details');
      }
      const exerciseData = await exerciseRes.json();

      const historyRes = await fetch(`${API_URL}/api/exercises/${id}/sets/history`);
      if (!historyRes.ok) {
        const errorText = await historyRes.text();
        console.error('History fetch error:', errorText);
        throw new Error('Failed to fetch exercise history');
      }
      const historyData = await historyRes.json();

      setExercise(exerciseData);
      setHistory(historyData.history?.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      ) || []);

      setError(null);
    } catch (err) {
      console.error('Error fetching exercise data:', err);
      setError(err.message || 'Failed to load exercise data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchExerciseAndHistory();
    }
  }, [id, fetchExerciseAndHistory]);

  const handleDeleteExercise = async () => {
    if (!confirm('Are you sure you want to delete this exercise? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_URL}/api/exercises/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete error:', errorText);
        throw new Error('Failed to delete exercise');
      }

      router.push('/meal-prep');
    } catch (err) {
      console.error('Error deleting exercise:', err);
      setError(err.message || 'Failed to delete exercise');
      setIsDeleting(false);
    }
  };

  const handleDeleteSession = async (historyId) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/exercises/${id}/history/${historyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete session error:', errorText);
        throw new Error('Failed to delete session');
      }

      await fetchExerciseAndHistory();
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(err.message || 'Failed to delete session');
    }
  };

  const handleUpdateExercise = (updatedExercise) => {
    setExercise(updatedExercise);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-gray-600">Loading exercise details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-100 text-red-700 p-8 rounded-lg shadow-md max-w-md w-full">
          <p className="mb-4">Error: {error}</p>
          <Link 
            href="/meal-prep" 
            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Meal Prep
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
            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Meal Prep
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
            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Meal Prep
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{exercise.name}</h1>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p>Type: {exercise.workout_type}</p>
                <p>Target: {exercise.amount_sets} sets × {exercise.amount_reps} reps</p>
                <p>Weight: {exercise.weight} lbs</p>
                <p>Rest: {exercise.rest_time} seconds</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="text-blue-600 hover:text-blue-800"
                title="Edit Exercise"
              >
                <Edit size={20} />
              </button>
              <button
                onClick={handleDeleteExercise}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-800 disabled:text-red-300"
                title="Delete Exercise"
              >
                <Trash size={20} />
              </button>
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-600">No workout history available</p>
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
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Set</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Weight (lbs)</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Reps</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {session.sets.map((set) => (
                          <tr key={set.set_number} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{set.set_number}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{set.weight}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{set.reps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <EditExerciseModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            exercise={exercise}
            onUpdate={(updatedExercise) => {
              handleUpdateExercise(updatedExercise);
              setIsEditModalOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetailsPage;