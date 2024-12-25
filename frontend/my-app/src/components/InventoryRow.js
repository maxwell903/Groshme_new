import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { fetchApi, API_URL } from '@/utils/api';

// Helper component for inventory rows - optimized for performance
const InventoryRow = React.memo(({ 
  item, 
  isEven, 
  onUpdate, 
  groceryLists, 
  showDifference = false, 
  difference = null 
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const [localUnit, setLocalUnit] = useState(item.unit || '');
  const [showGroceryLists, setShowGroceryLists] = useState(false);

  // Reset local state when item changes
  useEffect(() => {
    setLocalQuantity(item.quantity);
    setLocalUnit(item.unit || '');
  }, [item]);

  // Optimized update handler with debouncing
  const handleUpdate = useCallback(async (updateData) => {
    try {
      setIsUpdating(true);
      const response = await fetch(`${API_URL}/api/fridge/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...item, 
          ...updateData,
          unit: localUnit 
        })
      });

      if (!response.ok) throw new Error('Failed to update item');
      await onUpdate?.();
    } catch (error) {
      console.error('Error updating item: ', error);
    } finally {
      setIsUpdating(false);
    }
  }, [item.id, localUnit, onUpdate]);

  // Delete handler with confirmation
  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Are you sure you want to delete ${item.name} from your fridge?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/fridge/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to delete item');
      await onUpdate?.();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, [item.id, item.name, onUpdate]);

  // Memoized update handlers
  const handleQuantityUpdate = useCallback(() => 
    handleUpdate({ quantity: localQuantity }), [handleUpdate, localQuantity]);
  
  const handleUnitUpdate = useCallback(() => 
    handleUpdate({ unit: localUnit }), [handleUpdate, localUnit]);

  return (
    <div className={`grid grid-cols-3 p-4 border-b ${isEven ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="w-36 flex items-start gap-2 pr-2">
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 transition-colors"
          title="Delete item"
        >
          <X size={20} />
        </button>
        <span className="text-sm break-words">{item.name}</span>
      </div>
      
      <div className="flex items-start gap-2 w-24">
        <input
          type="number"
          value={localQuantity}
          onChange={(e) => setLocalQuantity(parseInt(e.target.value) || 0)}
          onBlur={handleQuantityUpdate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            }
          }}
          className={`w-16 rounded border px-2 py-1 ${isUpdating ? 'bg-gray-100' : ''}`}
          disabled={isUpdating}
          min="0"
        />
      </div>

      <div className="flex justify-end">
        <input
          type="text"
          value={localUnit}
          onChange={(e) => setLocalUnit(e.target.value)}
          onBlur={handleUnitUpdate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            }
          }}
          className={`w-20 rounded border px-2 pr-1 text-right ${isUpdating ? 'bg-gray-100' : ''}`}
          disabled={isUpdating}
        />
      </div>
      
      {showDifference && difference !== null && (
        <div className={`text-sm ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {difference > 0 ? '+' : ''}{difference}
        </div>
      )}
    </div>
  );
});

InventoryRow.displayName = 'InventoryRow';

export default InventoryRow;