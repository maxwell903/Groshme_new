// pages/my-bills.js
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { fetchApi } from '@/utils/api';
import { Plus, X, Calendar, DollarSign, RefreshCw, Edit2, History, Save } from 'lucide-react';
import TransactionEditModal from '@/components/TransactionEditModal';
import OneTimeIncomeModal from '@/components/OneTimeIncomeModal';
import BudgetSummaryCard from '@/components/BudgetSummaryCard';
import BudgetSaveModal from '@/components/BudgetSaveModal';



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

   // Helper function to check if an entry is a descendant of another
   const isDescendantOf = (entry, parentId) => {
    if (!entry.children) return false;
    return entry.children.some(child => 
      child.id === parentId || isDescendantOf(child, parentId)
    );
  };
  // Filter out potential parent accounts (exclude current entry if editing and any subaccounts)
  const availableParents = useMemo(() => {
    // Get all potential parent accounts (non-subaccounts)
    const potentialParents = entries.filter(entry => {
      // Entry is valid as parent if:
      // 1. It's not a subaccount itself
      // 2. It's not the current entry being edited
      return !entry.is_subaccount && (!initialData || entry.id !== initialData.id);
    });
  
    return potentialParents;
  }, [entries, initialData]);
  
  // Then in your select element, make sure to include and select the current parent_id
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
                    parent_id: e.target.value || null // Handle empty string case
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


const calculateBudgetByFrequency = (amount, frequency) => {
  let weekly = 0;
  let monthly = 0;
  let yearly = 0;
  let biweekly = 0;
  
  const baseAmount = parseFloat(amount) || 0;

  switch (frequency) {
    case 'weekly':
      weekly = baseAmount;
      biweekly = weekly * 2;
      monthly = weekly * 52 / 12;
      yearly = weekly * 52;
      break;

    case 'biweekly':
      biweekly = baseAmount;
      weekly = biweekly / 2;
      monthly = biweekly * 26 / 12;
      yearly = biweekly * 26;
      break;

    case 'monthly':
      monthly = baseAmount;
      weekly = monthly * 12 / 52;
      biweekly = monthly * 12 / 26;
      yearly = monthly * 12;
      break;

    case 'yearly':
      yearly = baseAmount;
      monthly = yearly / 12;
      weekly = yearly / 52;
      biweekly = yearly / 26;
      break;
  }

  return { weekly, biweekly, monthly, yearly };
};

// Component for displaying budget calculations
const BudgetCalculations = ({ budget }) => {
  const calculations = useMemo(() => {
    // Calculate budget for all frequencies
    const baseCalc = calculateBudgetByFrequency(budget.amount, budget.frequency);
    
    // Include any child budgets if they exist
    if (budget.children && budget.children.length > 0) {
      budget.children.forEach(child => {
        const childCalc = calculateBudgetByFrequency(child.amount, child.frequency);
        baseCalc.weekly += childCalc.weekly;
        baseCalc.biweekly += childCalc.biweekly;
        baseCalc.monthly += childCalc.monthly;
        baseCalc.yearly += childCalc.yearly;
      });
    }
    
    return baseCalc;
  }, [budget]);

  // Format currency values
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      <div className="bg-gray-50 p-3 rounded">
        <span className="text-sm text-gray-600">Weekly:</span>
        <div className="font-semibold">{formatCurrency(calculations.weekly)}</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <span className="text-sm text-gray-600">Biweekly:</span>
        <div className="font-semibold">{formatCurrency(calculations.biweekly)}</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <span className="text-sm text-gray-600">Monthly:</span>
        <div className="font-semibold">{formatCurrency(calculations.monthly)}</div>
      </div>
      <div className="bg-gray-50 p-3 rounded">
        <span className="text-sm text-gray-600">Yearly:</span>
        <div className="font-semibold">{formatCurrency(calculations.yearly)}</div>
      </div>
    </div>
  );
};

const calculateByFrequency = (amount, frequency) => {
  let weekly = 0;
  let monthly = 0;
  let yearly = 0;
  let biweekly = 0;

  switch (frequency) {
    case 'weekly':
      weekly = parseFloat(amount);
      monthly = weekly * 52 / 12; // Weekly to monthly (52 weeks / 12 months)
      yearly = weekly * 52;       // Weekly to yearly
      biweekly = weekly * 2;      // Weekly to biweekly
      break;

    case 'biweekly':
      biweekly = parseFloat(amount);
      weekly = biweekly / 2;      // Biweekly to weekly
      monthly = biweekly * 26 / 12; // Biweekly to monthly (26 pay periods)
      yearly = biweekly * 26;     // Biweekly to yearly
      break;

    case 'monthly':
      monthly = parseFloat(amount);
      weekly = monthly * 12 / 52;  // Monthly to weekly
      yearly = monthly * 12;       // Monthly to yearly
      biweekly = monthly * 12 / 26; // Monthly to biweekly
      break;

    case 'yearly':
      yearly = parseFloat(amount);
      weekly = yearly / 52;        // Yearly to weekly
      monthly = yearly / 12;       // Yearly to monthly
      biweekly = yearly / 26;      // Yearly to biweekly
      break;
  }

  return { weekly, monthly, yearly, biweekly };
};

// Component to display income summary







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
  const [timeframe, setTimeframe] = useState('monthly');

  const formatDate = (dateInput) => {
    

    // Handle both Date objects and date strings
    let date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateInput);
      return 'Invalid date';
    }
    
    // Format the date as MM/DD/YYYY
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const getMonthlyAmount = (amount, frequency) => {
    switch (frequency) {
      case 'weekly':
        return amount * 52 / 12;
      case 'biweekly':
        return amount * 26 / 12;
      case 'monthly':
        return amount;
      case 'yearly':
        return amount / 12;
      default:
        return amount;
    }
  };

  
  // Calculate amounts for different timeframes
  const calculations = useMemo(() => {
    // First get monthly base amount
    const baseMonthly = getMonthlyAmount(entry.amount, entry.frequency);
    const monthlySpent = entry.total_spent || 0;
  
    // Calculate child budgets (if any)
    let childrenMonthly = 0;
    if (entry.children && entry.children.length > 0) {
      childrenMonthly = entry.children.reduce((sum, child) => {
        return sum + getMonthlyAmount(child.amount, child.frequency);
      }, 0);
    }
  
    const totalMonthly = baseMonthly + childrenMonthly;
    
    // Calculate different timeframes
    const daily = {
      budget: totalMonthly / 30,  // Approximate days in a month
      spent: monthlySpent / 30,
    };
    daily.remaining = daily.budget - daily.spent;
  
    const weekly = {
      budget: totalMonthly * 12 / 52,
      spent: monthlySpent * 12 / 52,
    };
    weekly.remaining = weekly.budget - weekly.spent;
  
    const monthly = {
      budget: totalMonthly,
      spent: monthlySpent,
      remaining: totalMonthly - monthlySpent
    };
  
    const yearly = {
      budget: totalMonthly * 12,
      spent: monthlySpent * 12,
      remaining: (totalMonthly * 12) - (monthlySpent * 12)
    };
  
    return {
      daily,
      weekly,
      monthly,
      yearly
    };
  }, [entry.amount, entry.frequency, entry.total_spent, entry.children]);
  
  const timeframeLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };

  const currentTimeframe = calculations[timeframe];

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

          <div className="flex gap-2 mt-2 mb-3">
            {Object.keys(timeframeLabels).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {timeframeLabels[tf]}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(currentTimeframe.budget)}
            </span>
            <span className="text-xl">-</span>
            <span className="text-2xl font-bold text-red-600">
              {formatCurrency(currentTimeframe.spent)}
            </span>
            <span className="text-xl">=</span>
            <span className={`text-2xl font-bold ${
              currentTimeframe.remaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(Math.abs(currentTimeframe.remaining))}
            </span>
          </div>

          <p className="text-sm text-gray-600 capitalize mt-2">
            {entry.frequency} {entry.is_recurring && '(Recurring)'}
          </p>
          {entry.is_recurring && entry.next_payment_date && (
            <div className="text-sm text-gray-600 mt-2">
              <div className="flex items-center gap-2">
                <Calendar size={16} />
                <span>Next: {formatDate(entry.next_payment_date)}</span>
              </div>
              <div className="mt-1">
                {formatDate(entry.start_date)} - {formatDate(entry.end_date)}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
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

        <div className="space-y-2">
    {entry.transactions?.map(transaction => (
      <div key={transaction.id} className="flex justify-between text-sm items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Date */}
          <span className="whitespace-nowrap">
            {formatDate(transaction.payment_date)}
          </span>
          {/* Title */}
          {transaction.title && (
            <span className="text-gray-600 truncate">
              {` - ${transaction.title}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4 whitespace-nowrap">
          {/* Amount */}
          <span className="font-medium">
            {formatCurrency(transaction.amount)}
          </span>
          {/* Transaction Type Badge */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              transaction.is_one_time
                ? 'bg-blue-100 text-blue-800'
                : 'bg-orange-100 text-orange-800'
            }`}
          >
            {transaction.is_one_time ? 'One-time' : 'Recurring'}
          </span>
        </div>
      </div>
    ))}
  </div>

        {entry.children && entry.children.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Subaccounts</h4>
            
{entry.children && entry.children.length > 0 && (
  <div className="space-y-2">
    {entry.children.map(child => {
      // Calculate child amount based on timeframe
      const childAmount = (() => {
        const monthlyAmount = getMonthlyAmount(child.amount, child.frequency);
        switch(timeframe) {
          case 'daily':
            return monthlyAmount / (4.33 *7);
          case 'weekly':
            return monthlyAmount * 12 / 52;
          case 'monthly':
            return monthlyAmount;
          case 'yearly':
            return monthlyAmount * 12;
          default:
            return monthlyAmount;
        }
      })();

      return (
        <div key={child.id} className="flex justify-between text-sm items-center">
          <span>{child.title}</span>
          <span className="font-medium">
            {formatCurrency(childAmount)}
          </span>
        </div>
      );
    })}
  </div>
)}
          </div>
        )}
      </div>

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
  const router = useRouter();
  const [showBudgetSaveModal, setShowBudgetSaveModal] = useState(false);
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
    setEntries(entries);  // Just update the entries state
  };
  

  const handleSubmit = async (formData) => {
    try {
      
        const dataToSubmit = {
          ...formData,
          parent_id: formData.is_subaccount ? formData.parent_id : null,
          // Ensure parent_id is null if not a subaccount
        };
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
        setError('Failed to delete income entry please refresh the page and make sure the account you are deleting does not have any subaccounts :)');
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
    <h1 className="text-2xl font-bold">Faye's Budget Management</h1>
    <div className="flex items-center gap-4">
    <button
    onClick={() => setShowBudgetSaveModal(true)}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
  >
    <Save size={20} />
    Reset Budget Period
  </button>
    <button
      onClick={() => router.push('/budget-register')}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
    >
      <History size={18} />
      <span>View Budget History</span>
    </button>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
      >
        <Plus size={20} />
        Add Budget
      </button>
    </div>
  </div>

      

  <BudgetSummaryCard entries={entries} />
          

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
        {showBudgetSaveModal && (
    <BudgetSaveModal
      isOpen={showBudgetSaveModal}
      onClose={() => setShowBudgetSaveModal(false)}
      entries={entries}
    />
  )}
        

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
  
    