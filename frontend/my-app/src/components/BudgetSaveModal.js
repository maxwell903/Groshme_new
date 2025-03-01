import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { fetchApi } from '@/utils/api';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const BudgetSaveModal = ({ 
  isOpen, 
  onClose, 
  entries,  // This will be the current budget entries
  totalBudget  // Optional total budget information
}) => {
  const [formData, setFormData] = useState({
    name: '',
    from_date: '',
    to_date: '',
    clear_transactions: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Budget period name is required';
    }
    
    if (!formData.from_date) {
      errors.from_date = 'Start date is required';
    }
    
    if (!formData.to_date) {
      errors.to_date = 'End date is required';
    }
    
    if (formData.from_date && formData.to_date && 
        new Date(formData.from_date) > new Date(formData.to_date)) {
      errors.to_date = 'End date must be after start date';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setError(errors);
      return;
    }
  
    setIsSubmitting(true);
    
    try {
      // Get auth token
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        setError({ submit: 'Authentication required. Please log in again.' });
        setTimeout(() => router.push('/signin'), 2000);
        return;
      }
      
      // Prepare data to send to backend
      const saveData = {
        name: formData.name,
        from_date: formData.from_date,
        to_date: formData.to_date,
        clear_transactions: formData.clear_transactions
      };
  
      // Call the API to save budget register with token
      const response = await fetch('/api/budget-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saveData)
      });
  
      if (!response.ok) {
        if (response.status === 401) {
          setError({ submit: 'Authentication expired. Please log in again.' });
          setTimeout(() => router.push('/signin'), 2000);
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save budget');
      }
  
      // Show success message or handle response
      alert('Budget saved successfully!');
      onClose(); // Close the modal
    } catch (err) {
      console.error('Error saving budget:', err);
      setError({ submit: err.message || 'Failed to save budget. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Save Budget Period</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Budget Period Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Period Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded-md p-2 disabled:bg-gray-100"
              placeholder="e.g., January 2024 Budget"
              disabled={isSubmitting}
            />
            {error?.name && <p className="text-red-500 text-sm mt-1">{error.name}</p>}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formData.from_date}
              onChange={(e) => setFormData(prev => ({ ...prev, from_date: e.target.value }))}
              className="w-full border rounded-md p-2 disabled:bg-gray-100"
              disabled={isSubmitting}
            />
            {error?.from_date && <p className="text-red-500 text-sm mt-1">{error.from_date}</p>}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={formData.to_date}
              onChange={(e) => setFormData(prev => ({ ...prev, to_date: e.target.value }))}
              className="w-full border rounded-md p-2 disabled:bg-gray-100"
              disabled={isSubmitting}
            />
            {error?.to_date && <p className="text-red-500 text-sm mt-1">{error.to_date}</p>}
          </div>

          {/* Clear Transactions Option */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="clear_transactions"
              checked={formData.clear_transactions}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                clear_transactions: e.target.checked 
              }))}
              className="mr-2 rounded border-gray-300"
              disabled={isSubmitting}
            />
            <label 
              htmlFor="clear_transactions" 
              className="text-sm text-gray-700"
            >
              Clear transactions after saving
            </label>
          </div>

          {/* Submit Error */}
          {error?.submit && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error.submit}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:bg-green-400"
              disabled={isSubmitting}
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : 'Save Budget Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetSaveModal;