import React, { useState } from 'react';
import { Calendar, Edit2, Plus } from 'lucide-react';
import TransactionEditModal from './TransactionEditModal';
import OneTimeIncomeModal from './OneTimeIncomeModal';
import { fetchApi } from '@/utils/api';

const IncomeEntry = ({ entry, onEdit, onDelete, onTransactionsUpdate }) => {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showOneTimeModal, setShowOneTimeModal] = useState(false);

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

  const handleOneTimeSubmit = async (data) => {
    try {
      await fetchApi(`/api/income-entries/${entry.id}/one-time`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
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
            <h4 className="text-sm font-semibold">Transactions</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOneTimeModal(true)}
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

      {showOneTimeModal && (
        <OneTimeIncomeModal
          isOpen={showOneTimeModal}
          onClose={() => setShowOneTimeModal(false)}
          onSubmit={handleOneTimeSubmit}
        />
      )}
    </div>
  );
};

export default IncomeEntry;