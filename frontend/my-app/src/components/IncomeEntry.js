import { Edit2 } from 'lucide-react';
import TransactionEditModal from './TransactionEditModal';
import { useState } from 'react';
import { fetchApi } from '@/utils/api';

const IncomeEntry = ({ entry, onEdit, onDelete, onTransactionsUpdate }) => {
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  const handleTransactionUpdate = async (updates) => {
    try {
      // Handle transaction updates through API
      await fetchApi(`/api/income-entries/${entry.id}/transactions`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      
      // Notify parent component to refresh data
      if (onTransactionsUpdate) {
        onTransactionsUpdate();
      }
    } catch (error) {
      console.error('Error updating transactions:', error);
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
            <h4 className="text-sm font-semibold">Recent Transactions</h4>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="p-1 text-gray-500 hover:text-gray-700"
              title="Edit Transactions"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {entry.transactions.slice(0, 3).map(transaction => (
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
    </div>
  );
};