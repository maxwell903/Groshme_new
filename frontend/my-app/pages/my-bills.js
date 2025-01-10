// pages/my-bills.js
import { useState, useEffect, useMemo } from 'react';

import { fetchApi } from '@/utils/api';
import { Plus, X, Calendar, DollarSign, RefreshCw, Edit2 } from 'lucide-react';
import TransactionEditModal from '@/components/TransactionEditModal';
import OneTimeIncomeModal from '@/components/OneTimeIncomeModal';



const AddIncomeModal = ({ isOpen, onClose, onSubmit, initialData = null, entries = [] }) => {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    frequency: 'weekly',
    is_recurring: false,
    start_date: '',
    end_date: '',
    next_payment_date: '',
    is_subaccount: false,
    parent_id: null,
    ...initialData
  });

  const [errors, setErrors] = useState({});

  // Filter out potential parent accounts (exclude current entry if editing and any subaccounts)
  const availableParents = useMemo(() => {
    if (!initialData) {
      // If creating new, all non-subaccounts are available
      return entries.filter(entry => !entry.is_subaccount);
    } else {
      // If editing, exclude self and children
      return entries.filter(entry => 
        !entry.is_subaccount && 
        entry.id !== initialData.id &&
        !isDescendantOf(entry, initialData.id)
      );
    }
  }, [entries, initialData]);

  // Helper function to check if an entry is a descendant of another
  const isDescendantOf = (entry, parentId) => {
    if (!entry.children) return false;
    return entry.children.some(child => 
      child.id === parentId || isDescendantOf(child, parentId)
    );
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Valid amount is required';
    
    if (formData.is_recurring) {
      if (!formData.start_date) newErrors.start_date = 'Start date is required';
      if (!formData.end_date) newErrors.end_date = 'End date is required';
      if (!formData.next_payment_date) newErrors.next_payment_date = 'Next payment date is required';
      
      if (formData.start_date && formData.end_date && 
          new Date(formData.start_date) > new Date(formData.end_date)) {
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
          {/* Subaccount Controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_subaccount"
                checked={formData.is_subaccount}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setFormData(prev => ({
                    ...prev,
                    is_subaccount: newValue,
                    parent_id: newValue ? prev.parent_id : null
                  }));
                }}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_subaccount" className="text-sm font-medium text-gray-700">
                Make this a subaccount
              </label>
            </div>

            {formData.is_subaccount && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Account
                </label>
                <select
                  value={formData.parent_id || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    parent_id: e.target.value
                  }))}
                  className="w-full border rounded-md p-2"
                  required={formData.is_subaccount}
                >
                  <option value="">Select a parent account</option>
                  {availableParents.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

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





const BudgetEntry = ({ 
  entry, 
  onEdit, 
  onDelete, 
  onTransactionsUpdate,
  onSetParent,
  level = 0
}) => {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showOneTimeIncomeModal, setShowOneTimeIncomeModal] = useState(false);

  // Calculate combined totals including child budgets
  const totals = useMemo(() => {
    let totalBudget = parseFloat(entry.amount);
    let totalSpent = entry.total_spent || 0;
    
    // Add totals from child budgets if any exist
    if (entry.children && entry.children.length > 0) {
      entry.children.forEach(child => {
        totalBudget += parseFloat(child.amount);
        totalSpent += child.total_spent || 0;
      });
    }
    
    return {
      budget: totalBudget,
      spent: totalSpent,
      remaining: totalBudget - totalSpent
    };
  }, [entry]);

  const handleTransactionUpdate = async (updates) => {
    try {
      await fetchApi(`/api/income-entries/${entry.id}/transactions`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      onTransactionsUpdate();
    } catch (error) {
      console.error('Error updating transactions:', error);
      // Handle error state if needed
    }
  };

  // Format numbers for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    maximumFractionDigits: 0
    }).format(amount);
  };

  const handleOneTimeIncomeSubmit = async (incomeData) => {
    try {
      await fetchApi(`/api/income-entries/${entry.id}/one-time`, {
        method: 'POST',
        body: JSON.stringify(incomeData)
      });
      onTransactionsUpdate();
    } catch (error) {
      console.error('Error adding one-time income:', error);
      // Handle error state if needed
    }
  };

  return (
    <div className={`bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow
      ${entry.is_subaccount ? `ml-${level * 2} border-l-4 border-blue-500` : ''}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start">
        <div className="w-full sm:w-auto mb-4 sm:mb-0">
          <h3 className="text-lg font-semibold">
            {entry.title}


 
            {entry.is_subaccount && 
              <span className="ml-2 text-sm text-blue-600">(Subaccount)</span>
              


            }
            
          </h3>

          
          
          {/* Budget Calculation Display */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.budget)}
            </span>
            <span className="text-xl">-</span>
            <span className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.spent)}
            </span>
            <span className="text-xl">=</span>
            <span className={`text-2xl font-bold ${
              totals.remaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(totals.remaining)}
            </span>
          </div>
               {/* Action Buttons */}
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
      

          {/* Frequency and Schedule Info */}
          <p className="text-sm text-gray-600 capitalize">
            {entry.frequency} {entry.is_recurring && '(Recurring)'}
          </p>
          {entry.is_recurring && entry.next_payment_date && (
            <div className="text-sm text-gray-600 mt-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>Next: {new Date(entry.next_payment_date).toLocaleDateString()}</span>
              </div>
              <div className="mt-1">
                {new Date(entry.start_date).toLocaleDateString()} - 
                {new Date(entry.end_date).toLocaleDateString()}
              </div>
            </div>
          )}
          
        </div>

       
      </div>
      
      {/* Transaction History */}
      <div className="mt-4 border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold">Transaction History</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOneTimeIncomeModal(true)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              title="Add One-Time Transaction"
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

        {/* Transactions List */}
        <div className="space-y-2">
          {entry.transactions?.map(transaction => (
            <div key={transaction.id} className="flex justify-between text-sm items-center">
              <div className="flex items-center gap-2 flex-1">
                <span className="whitespace-nowrap">
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </span>
                <span className="text-gray-600 truncate">
                  {transaction.is_one_time ? 
                    ` - ${transaction.title || 'One-time payment'}` : 
                    ''
                  }
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="font-medium whitespace-nowrap">
                  {formatCurrency(transaction.amount)}
                </span>
                {transaction.is_one_time && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                    One-time
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Child Budgets Section */}
        {entry.children && entry.children.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Subaccounts</h4>
            <div className="space-y-2">
              {entry.children.map(child => (
                <div key={child.id} className="flex justify-between text-sm items-center">
                  <span>{child.title}</span>
                  <span className="font-medium">
                    {formatCurrency(child.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showTransactionModal && (
        <TransactionEditModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          transactions={entry.transactions}
          onSave={async (updates) => {
            await handleTransactionUpdate(updates);
            setShowTransactionModal(false);
          }}
        />
      )}
      
      {showOneTimeIncomeModal && (
        <OneTimeIncomeModal
          isOpen={showOneTimeIncomeModal}
          onClose={() => setShowOneTimeIncomeModal(false)}
          onSubmit={async (incomeData) => {
            await handleOneTimeIncomeSubmit(incomeData);
            setShowOneTimeIncomeModal(false);
          }}
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



  const handleSetParent = (parentId) => {
    setEditingEntry(entries.find(entry => entry.id === parentId));
    setFormData(prev => ({
      ...prev,
      is_subaccount: true,
      parent_id: parentId
    }));
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Budget Management</h1>
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
            <h3 className="text-lg font-semibold text-gray-600">Total Weekly Budget</h3>
            <p className="text-2xl font-bold text-green-600">${summary.weekly}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600">Total Monthly Budget</h3>
            <p className="text-2xl font-bold text-green-600">${summary.monthly}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-600">Total Yearly Budget</h3>
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
            <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id}>
                <BudgetEntry
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onTransactionsUpdate={fetchEntries}
                  onSetParent={handleSetParent}
                />
                {entry.children && entry.children.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {entry.children.map(child => (
                      <BudgetEntry
                        key={child.id}
                        entry={child}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onTransactionsUpdate={fetchEntries}
                        onSetParent={handleSetParent}
                        level={1}
                        
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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
            entries={entries}
          />
        )}
      </div>
    </div>
  );
}
  
    