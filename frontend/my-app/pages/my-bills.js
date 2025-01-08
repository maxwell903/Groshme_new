// pages/my-bills.js
import { useState, useEffect } from 'react';

import { fetchApi } from '@/utils/api';
import { Plus, X, Calendar, DollarSign, RefreshCw, Edit2 } from 'lucide-react';
import TransactionEditModal from '@/components/TransactionEditModal';
import OneTimeIncomeModal from '@/components/OneTimeIncomeModal';



const AddIncomeModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    frequency: 'weekly',
    is_recurring: false,
    start_date: '',
    end_date: '',
    next_payment_date: '',
    ...initialData
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Valid amount is required';
    
    if (formData.is_recurring) {
      if (!formData.start_date) newErrors.start_date = 'Start date is required';
      if (!formData.end_date) newErrors.end_date = 'End date is required';
      if (!formData.next_payment_date) newErrors.next_payment_date = 'Next payment date is required';
      
      // Validate date ranges
      if (formData.start_date && formData.end_date && new Date(formData.start_date) > new Date(formData.end_date)) {
        newErrors.end_date = 'End date must be after start date';
      }
      if (formData.next_payment_date && formData.start_date && 
          new Date(formData.next_payment_date) < new Date(formData.start_date)) {
        newErrors.next_payment_date = 'Next payment date must be after start date';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {initialData ? 'Edit Income Entry' : 'Add New Income'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border rounded-md p-2"
              placeholder="e.g., Salary, Freelance Work"
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full border rounded-md p-2 pl-8"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
          </div>

          {/* Frequency Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full border rounded-md p-2"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Recurring Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              id="recurring"
              className="rounded border-gray-300"
            />
            <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
              Recurring Payment
            </label>
          </div>

          {/* Date Fields (shown only when recurring is checked) */}
          {formData.is_recurring && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
                {errors.start_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
                {errors.end_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Payment Date
                </label>
                <input
                  type="date"
                  value={formData.next_payment_date}
                  onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                  className="w-full border rounded-md p-2"
                />
                {errors.next_payment_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.next_payment_date}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
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
              {initialData ? 'Update' : 'Add'} Income
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const IncomeEntry = ({ entry, onEdit, onDelete, onTransactionsUpdate }) => {
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [showOneTimeIncomeModal, setShowOneTimeIncomeModal] = useState(false);
  
    const handleTransactionUpdate = async (updates) => {
      try {
        await fetchApi(`/api/income-entries/${entry.id}/transactions`, {
          method: 'POST',
          body: JSON.stringify(updates)
        });
        
        if (onTransactionsUpdate) {
          onTransactionsUpdate();
        }
      } catch (error) {
        console.error('Error updating transactions:', error);
      }
    };

    const handleOneTimeIncomeSubmit = async (incomeData) => {
        try {
          await fetchApi(`/api/income-entries/${entry.id}/one-time`, {
            method: 'POST',
            body: JSON.stringify(incomeData)
          });
          
          if (onTransactionsUpdate) {
            onTransactionsUpdate();
          }
          setShowOneTimeIncomeModal(false);
        } catch (error) {
          console.error('Error adding one-time income:', error);
        }
      };
  
    return (
      <div className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{entry.title}</h3>
            <p className="text-2xl font-bold text-green-600">${entry.amount}</p>
            <p className="text-sm text-gray-600 capitalize">
              {entry.frequency} {entry.is_recurring && '(Recurring)'}
            </p>
            {entry.is_recurring && (
              <div className="text-sm text-gray-600 mt-2">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>Next: {new Date(entry.next_payment_date).toLocaleDateString()}</span>
                </div>
                <div className="mt-1">
                  {new Date(entry.start_date).toLocaleDateString()} - {new Date(entry.end_date).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
          <div className="space-x-2">
            <button
              onClick={() => onEdit(entry)}
              className="text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </div>
        
        {entry.transactions && entry.transactions.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold">Recurring Transactions</h4>
              <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOneTimeIncomeModal(true)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                title="Add One-Time Income"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setShowTransactionModal(true)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                title="Edit Transactions"
              >
                <Edit2 size={16} />
              </button>
            </div>

            </div>
            <div className="space-y-2">
              {entry.transactions.map(transaction => (
                <div key={transaction.id} className="flex justify-between text-sm">
                  <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                  <span className="font-medium">${transaction.amount}</span>
                  {transaction.is_retroactive && (
                    <span className="text-xs text-gray-500">(Retroactive)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
  
        {showTransactionModal && (
          <TransactionEditModal
            isOpen={showTransactionModal}
            onClose={() => setShowTransactionModal(false)}
            transactions={entry.transactions}
            onSave={handleTransactionUpdate}
          />
        )}
          {showOneTimeIncomeModal && (
        <OneTimeIncomeModal
          isOpen={showOneTimeIncomeModal}
          onClose={() => setShowOneTimeIncomeModal(false)}
          onSubmit={handleOneTimeIncomeSubmit}
        />
      )}
      </div>
    );
  };

export default function MyBills() {
  const [showModal, setShowModal] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [summary, setSummary] = useState({
    weekly: 0,
    monthly: 0,
    yearly: 0
  });
  const [lastCheck, setLastCheck] = useState(null);
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetchApi('/api/income-entries');
      setEntries(response.entries);
      calculateSummary(response.entries);
    } catch (error) {
      setError('Failed to fetch income entries');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
     // Check for recurring transactions once per day
     fetchEntries();
   const processRecurring = async () => {
         try {
           await fetchApi('/api/income-entries/process-recurring', { method: 'POST' });
           setLastCheck(new Date());
         } catch (error) {
           console.error('Error processing recurring income:', error);
         }
       };
    
      processRecurring();
      const interval = setInterval(processRecurring, 86400000); // 24 hours (1 day)
    
       return () => clearInterval(interval);
    
  }, []);

  

  const calculateSummary = (entries) => {
    const totals = entries.reduce((acc, entry) => {
      const amount = parseFloat(entry.amount);
      switch (entry.frequency) {
        case 'weekly':
          acc.weekly += amount;
          acc.monthly += amount * 4.33;
          acc.yearly += amount * 52;
          break;
        case 'biweekly':
          acc.weekly += amount / 2;
          acc.monthly += amount * 2.17;
          acc.yearly += amount * 26;
          break;
        case 'monthly':
          acc.weekly += amount / 4.33;
          acc.monthly += amount;
          acc.yearly += amount * 12;
          break;
        case 'yearly':
          acc.weekly += amount / 52;
          acc.monthly += amount / 12;
          acc.yearly += amount;
          break;
      }
      return acc;
    }, { weekly: 0, monthly: 0, yearly: 0 });

    setSummary({
      weekly: Math.round(totals.weekly * 100) / 100,
      monthly: Math.round(totals.monthly * 100) / 100,
      yearly: Math.round(totals.yearly * 100) / 100
    });
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingEntry) {
        await fetchApi(`/api/income-entries/${editingEntry.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchApi('/api/income-entries', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      setEditingEntry(null);
      fetchEntries();
    } catch (error) {
      setError('Failed to save income entry');
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this income entry?')) {
      try {
        await fetchApi(`/api/income-entries/${id}`, {
          method: 'DELETE'
        });
        fetchEntries();
      } catch (error) {
        setError('Failed to delete income entry');
        console.error('Error:', error);
      }
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Income Management</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus size={20} />
            Add Income
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600">Weekly Total</h3>
            <p className="text-2xl font-bold text-green-600">${summary.weekly}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600">Monthly Total</h3>
            <p className="text-2xl font-bold text-green-600">${summary.monthly}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600">Yearly Total</h3>
            <p className="text-2xl font-bold text-green-600">${summary.yearly}</p>
          </div>
        </div>

        {/* Income Entries List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
              <p className="mt-2 text-gray-600">Loading income entries...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="mt-2 text-gray-600">No income entries yet</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Add your first income entry
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {entries.map((entry) => (
                  <IncomeEntry
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTransactionsUpdate={fetchEntries} // Add this prop
                />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Income Modal */}
        {showModal && (
          <AddIncomeModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setEditingEntry(null);
            }}
            onSubmit={handleSubmit}
            initialData={editingEntry}
          />
        )}
      </div>
    </div>
  );
}
  
    