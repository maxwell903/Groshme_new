import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';

const ExerciseForm = ({ initialData = null }) => {
  const router = useRouter();
  const { user } = useAuth();
  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    workout_type: initialData?.workout_type || 'Push',
    major_groups: initialData?.major_groups?.join(', ') || '',
    minor_groups: initialData?.minor_groups?.join(', ') || '',
    amount_sets: initialData?.amount_sets || '',
    amount_reps: initialData?.amount_reps || '',
    weight: initialData?.weight || '',
    rest_time: initialData?.rest_time || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Format the data before sending
      const formattedData = {
        name: formData.name,
        workout_type: formData.workout_type,
        major_groups: formData.major_groups.split(',').map(g => g.trim()),
        minor_groups: formData.minor_groups.split(',').map(g => g.trim()),
        amount_sets: parseInt(formData.amount_sets) || 0,
        amount_reps: parseInt(formData.amount_reps) || 0,
        weight: parseFloat(formData.weight) || 0,
        rest_time: parseInt(formData.rest_time) || 0
      };

      const url = isEditing 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/exercises/${initialData.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/exercise`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save exercise');
      }

      // Reset form on success
      if (!isEditing) {
        setFormData({
          name: '',
          workout_type: 'Push',
          major_groups: '',
          minor_groups: '',
          amount_sets: '',
          amount_reps: '',
          weight: '',
          rest_time: ''
        });
      }

      alert(`Exercise ${isEditing ? 'updated' : 'saved'} successfully!`);
      router.push('/meal-prep');
    } catch (error) {
      console.error('Error saving exercise:', error);
      alert(`Failed to ${isEditing ? 'update' : 'save'} exercise: ${error.message}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {isEditing ? 'Edit Exercise' : 'Enter Exercise'}
      </h1>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Exercise Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
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
            required
            value={formData.major_groups}
            onChange={(e) => setFormData(prev => ({ ...prev, major_groups: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="e.g., Chest, Triceps"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minor Muscle Groups (comma-separated)
          </label>
          <input
            type="text"
            required
            value={formData.minor_groups}
            onChange={(e) => setFormData(prev => ({ ...prev, minor_groups: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="e.g., Front Deltoid, Core"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Sets
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.amount_sets}
              onChange={(e) => setFormData(prev => ({ ...prev, amount_sets: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rest Time (seconds)
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.rest_time}
              onChange={(e) => setFormData(prev => ({ ...prev, rest_time: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Weight For Set (lbs)
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.5"
              value={formData.weight}
              onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Reps For Set
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.amount_reps}
              onChange={(e) => setFormData(prev => ({ ...prev, amount_reps: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {isEditing ? 'Update' : 'Save'} Exercise
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExerciseForm;