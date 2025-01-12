import React, { useState } from 'react';
import { X } from 'lucide-react';

const TransactionEditModal = ({ isOpen, onClose, transactions = [], onSave }) => {
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [editedAmounts, setEditedAmounts] = useState({});
  const [editedTitles, setEditedTitles] = useState({});

  const handleCheckboxChange = (transactionId) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleAmountChange = (transactionId, newAmount) => {
    setEditedAmounts({
      ...editedAmounts,
      [transactionId]: parseFloat(newAmount)
    });
  };

  const handleTitleChange = (transactionId, newTitle) => {
    setEditedTitles({
      ...editedTitles,
      [transactionId]: newTitle
    });
  };

  const formatDate = (dateString) => {
    // First try parsing as ISO string
    let date = new Date(dateString);
    
    // If invalid, try parsing with explicit timezone
    if (isNaN(date.getTime())) {
      date = new Date(dateString + 'T00:00:00Z');
    }
    
    // If still invalid, return placeholder
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return 'Date error';
    }
    
    // Format the date
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSave = () => {
    const updates = {
      toDelete: Array.from(selectedTransactions),
      amountUpdates: editedAmounts,
      titleUpdates: editedTitles
    };
    onSave(updates);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Edit Transactions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions to display</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-4 py-2 border-b">
                <input
                  type="checkbox"
                  checked={selectedTransactions.has(transaction.id)}
                  onChange={() => handleCheckboxChange(transaction.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div className="text-sm text-gray-600">
                    {formatDate(transaction.payment_date)}
                  </div>
                  {transaction.is_one_time && (
                    <input
                      type="text"
                      value={editedTitles[transaction.id] ?? transaction.title ?? ''}
                      onChange={(e) => handleTitleChange(transaction.id, e.target.value)}
                      className="border rounded-md p-2 text-sm"
                      placeholder="Transaction title"
                    />
                  )}
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={editedAmounts[transaction.id] ?? transaction.amount}
                      onChange={(e) => handleAmountChange(transaction.id, e.target.value)}
                      className="w-full border rounded-md p-2 pl-8"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
            disabled={selectedTransactions.size === 0 && 
                     Object.keys(editedAmounts).length === 0 &&
                     Object.keys(editedTitles).length === 0}
          >
            {selectedTransactions.size > 0 ? `Delete Selected (${selectedTransactions.size})` : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionEditModal;