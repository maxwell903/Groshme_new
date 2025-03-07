import React, { useState, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { fetchApi } from '@/utils/api'; // Import fetchApi function
const API_URL = process.env.NEXT_PUBLIC_API_URL

const IncomeCalculatorModal = ({ isOpen, onClose, onSubmit }) => {
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('hourly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const calculations = useMemo(() => {
    const baseAmount = parseFloat(amount) || 0;
    const calculations = {
      hourly: baseAmount,
      daily: 0,
      weekly: 0,
      biweekly: 0,
      monthly: 0,
      yearly: 0
    };

    switch (frequency) {
      case 'hourly':
        calculations.daily = baseAmount * 8;
        calculations.weekly = calculations.daily * 5;
        calculations.biweekly = calculations.weekly * 2;
        calculations.monthly = calculations.weekly * 52 / 12;
        calculations.yearly = calculations.weekly * 52;
        break;
      case 'daily':
        calculations.hourly = baseAmount / 8;
        calculations.weekly = baseAmount * 5;
        calculations.biweekly = calculations.weekly * 2;
        calculations.monthly = calculations.weekly * 52 / 12;
        calculations.yearly = calculations.weekly * 52;
        break;
      case 'weekly':
        calculations.hourly = baseAmount / (8 * 5);
        calculations.daily = baseAmount / 5;
        calculations.biweekly = baseAmount * 2;
        calculations.monthly = baseAmount * 52 / 12;
        calculations.yearly = baseAmount * 52;
        break;
      case 'biweekly':
        calculations.weekly = baseAmount / 2;
        calculations.hourly = calculations.weekly / (8 * 5);
        calculations.daily = calculations.weekly / 5;
        calculations.monthly = baseAmount * 26 / 12;
        calculations.yearly = baseAmount * 26;
        break;
      case 'monthly':
        calculations.yearly = baseAmount * 12;
        calculations.biweekly = calculations.yearly / 26;
        calculations.weekly = calculations.yearly / 52;
        calculations.daily = calculations.weekly / 5;
        calculations.hourly = calculations.daily / 8;
        break;
      case 'yearly':
        calculations.monthly = baseAmount / 12;
        calculations.biweekly = baseAmount / 26;
        calculations.weekly = baseAmount / 52;
        calculations.daily = calculations.weekly / 5;
        calculations.hourly = calculations.daily / 8;
        break;
    }

    Object.keys(calculations).forEach(key => {
      calculations[key] = Math.round(calculations[key]);
    });

    return calculations;
  }, [amount, frequency]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const validateInput = () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateInput()) return;

    setIsSubmitting(true);

    try {
      // Use fetchApi instead of direct fetch
      const data = await fetchApi('/api/real-salary', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(amount),
          frequency
        })
      });

      onSubmit(data.salary);
      onClose();
    } catch (error) {
      console.error('Error saving salary:', error);
      setError(error.message || 'Failed to save salary. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Calculate Income</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="w-full border rounded-md p-2 pl-8 disabled:bg-gray-100"
                placeholder="0"
                step="0.01"
                min="0"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full border rounded-md p-2 disabled:bg-gray-100"
              disabled={isSubmitting}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="mt-4 bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Calculated Income</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(calculations).map(([period, value]) => (
                <div key={period}>
                  <p className="text-sm text-gray-600 capitalize">{period}:</p>
                  <p className="font-semibold">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          </div>

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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Add Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomeCalculatorModal;