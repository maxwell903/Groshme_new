import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const EditExerciseModal = ({ isOpen, onClose, exercise, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    workout_type: 'Push',
    major_groups: '',
    minor_groups: '',
    amount_sets: '',
    amount_reps: '',
    weight: '',
    rest_time: ''
  });

  useEffect(() => {
    if (exercise) {
      setFormData({
        name: exercise.name,
        workout_type: exercise.workout_type,
        major_groups: Array.isArray(exercise.major_groups) ? exercise.major_groups.join(', ') : exercise.major_groups,
        minor_groups: Array.isArray(exercise.minor_groups) ? exercise.minor_groups.join(', ') : exercise.minor_groups,
        amount_sets: exercise.amount_sets,
        amount_reps: exercise.amount_reps,
        weight: exercise.weight,
        rest_time: exercise.rest_time
      });
    }
  }, [exercise]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/exercises/${exercise.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          major_groups: formData.major_groups.split(',').map(g => g.trim()),
          minor_groups: formData.minor_groups.split(',').map(g => g.trim()),
        })
      });

      if (!response.ok) throw new Error('Failed to update exercise');
      
      const updatedExercise = await response.json();
      onUpdate(updatedExercise);
      onClose();
    } catch (error) {
      console.error('Error updating exercise:', error);
      alert('Failed to update exercise');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Exercise</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exercise Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workout Type
            </label>
            <select
              value={formData.workout_type}
              onChange={(e) => setFormData(prev => ({ ...prev, workout_type: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option>Push</option>
              <option>Pull</option>
              <option>Legs</option>
              <option>Cardio</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Major Muscle Groups (comma-separated)
            </label>
            <input
              type="text"
              value={formData.major_groups}
              onChange={(e) => setFormData(prev => ({ ...prev, major_groups: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minor Muscle Groups (comma-separated)
            </label>
            <input
              type="text"
              value={formData.minor_groups}
              onChange={(e) => setFormData(prev => ({ ...prev, minor_groups: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Sets
              </label>
              <input
                type="number"
                value={formData.amount_sets}
                onChange={(e) => setFormData(prev => ({ ...prev, amount_sets: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rest Time Between Sets (seconds)
              </label>
              <input
                type="number"
                value={formData.rest_time}
                onChange={(e) => setFormData(prev => ({ ...prev, rest_time: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Weight For Set
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Reps:
              </label>
              <input
                type="number"
                value={formData.amount_reps}
                onChange={(e) => setFormData(prev => ({ ...prev, amount_reps: parseInt(e.target.value) }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                required
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Update Exercise
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExerciseModal;