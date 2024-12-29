import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { API_URL } from '@/utils/api';

const SetsModal = ({ exercise, isOpen, onClose }) => {
  const [sets, setSets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize sets based on exercise.amount_sets
    if (exercise) {
      const initialSets = Array.from({ length: exercise.amount_sets }, (_, index) => ({
        set_number: index + 1,
        weight: exercise.weight || 0,
        reps: exercise.amount_reps || 0
      }));
      setSets(initialSets);
    }
  }, [exercise]);

  // Fetch existing sets if any
  useEffect(() => {
    const fetchExistingSets = async () => {
      if (!exercise?.id) return;
      
      try {
        const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets`);
        const text = await response.text();
        
        try {
          const data = JSON.parse(text);
          if (response.ok && data.sets?.length > 0) {
            setSets(data.sets);
          }
        } catch (e) {
          console.error('Error parsing response:', text);
          throw new Error('Invalid response from server');
        }
      } catch (error) {
        console.error('Error fetching existing sets:', error);
        setError('Failed to load existing sets');
      }
    };

    if (exercise && isOpen) {
      fetchExistingSets();
    }
  }, [exercise, isOpen]);

  const handleSetChange = (index, field, value) => {
    const newSets = [...sets];
    newSets[index] = {
      ...newSets[index],
      [field]: value ? parseFloat(value) : 0
    };
    setSets(newSets);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate sets data
      const validSets = sets.map(set => ({
        set_number: parseInt(set.set_number, 10),
        weight: parseFloat(set.weight) || 0,
        reps: parseInt(set.reps, 10) || 0
      }));

      const response = await fetch(`${API_URL}/api/exercises/${exercise.id}/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sets: validSets
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON response:', text);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save sets');
      }

      // Success
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
                    step="2.5"
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