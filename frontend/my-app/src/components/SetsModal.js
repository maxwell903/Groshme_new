import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const SetsModal = ({ exercise, isOpen, onClose }) => {
  const [sets, setSets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    // Initialize sets based on exercise.amount_sets
    if (exercise) {
      const initialSets = Array.from({ length: exercise.amount_sets }, (_, index) => ({
        set_number: index + 1,
        weight: exercise.weight || '',
        reps: exercise.amount_reps || ''
      }));
      setSets(initialSets);
    }
  }, [exercise]);

  // Fetch existing sets if any
  useEffect(() => {
    const fetchExistingSets = async () => {
      if (!exercise?.id || !isOpen || !user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please sign in to view sets');
          }
          throw new Error('Failed to load existing sets');
        }

        const data = await response.json();
        if (data.sets?.length > 0) {
          setSets(data.sets);
        }
      } catch (error) {
        console.error('Error fetching existing sets:', error);
        setError(error.message || 'Failed to load sets');
      } finally {
        setLoading(false);
      }
    };

    if (exercise && isOpen) {
      fetchExistingSets();
    }
  }, [exercise, isOpen, user]);

  const handleSetChange = (index, field, value) => {
    const newSets = [...sets];
    newSets[index] = {
      ...newSets[index],
      [field]: value ? parseFloat(value) : ''
    };
    setSets(newSets);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to save sets');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const validSets = sets.map(set => ({
        set_number: parseInt(set.set_number, 10),
        weight: parseFloat(set.weight) || 0,
        reps: parseInt(set.reps, 10) || 0
      }));

      const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sets: validSets,
          user_id: user.id  // Include user ID in the request
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Please sign in to save sets');
        }
        throw new Error(errorData.error || 'Failed to save sets');
      }

      const responseData = await response.json();
      onClose();
    } catch (error) {
      console.error('Error saving sets:', error);
      setError(error.message || 'Failed to save sets');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{exercise.name} Sets</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {sets.map((set, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Set {set.set_number}
                  </label>
                  <input
                    type="number"
                    value={set.set_number}
                    disabled
                    className="w-full p-2 border rounded bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (lbs)
                  </label>
                  <input
                    type="number"
                    value={set.weight}
                    onChange={(e) => handleSetChange(index, 'weight', e.target.value)}
                    className="w-full p-2 border rounded"
                    min="0"
                    step="5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reps
                  </label>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => handleSetChange(index, 'reps', e.target.value)}
                    className="w-full p-2 border rounded"
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader className="animate-spin h-4 w-4" />
                  Saving...
                </>
              ) : (
                'Save Sets'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetsModal;