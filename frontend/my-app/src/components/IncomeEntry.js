import React, { useState } from 'react';
import { Calendar, Plus, Edit2, X } from 'lucide-react';
import TransactionEditModal from '@/components/TransactionEditModal';
import OneTimeIncomeModal from '@/components/OneTimeIncomeModal';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const IncomeEntry = ({ entry, onEdit, onDelete, onTransactionsUpdate }) => {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showOneTimeIncomeModal, setShowOneTimeIncomeModal] = useState(false);

  // Calculate total from all transactions
  const totalAmount = entry.transactions?.reduce((sum, transaction) => 
    sum + parseFloat(transaction.amount), 0) || 0;

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
          <p className="text-2xl font-bold text-green-600">${totalAmount.toFixed(2)}</p>
          {entry.is_recurring && (
            <p className="text-sm text-gray-600 capitalize">
              {entry.frequency} (Recurring)
            </p>
          )}
          {entry.is_recurring && entry.next_payment_date && (
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
      
      <div className="mt-4 border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-semibold">Transactions</h4>
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
          {entry.transactions?.map(transaction => (
            <div key={transaction.id} className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <span>{new Date(transaction.transaction_date).toLocaleDateString()}</span>
                {transaction.title && (
                  <span className="text-gray-600">({transaction.title})</span>
                )}
              </span>
              <span className="font-medium">${parseFloat(transaction.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

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

export default IncomeEntry;