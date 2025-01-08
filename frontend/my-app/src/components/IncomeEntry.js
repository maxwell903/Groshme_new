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
      {/* ... existing code ... */}
      
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
          {/* ... existing code ... */}
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