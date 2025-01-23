import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/utils/fetch';



const InventoryRow = React.memo(({ item, isEven, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const [localUnit, setLocalUnit] = useState(item.unit || '');

  useEffect(() => {
    setLocalQuantity(item.quantity);
    setLocalUnit(item.unit || '');
  }, [item]);

  const handleUpdate = async (updateData) => {
    try {
      setIsUpdating(true);
      await fetch(`/api/fridge/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...item, 
          ...updateData,
          unit: localUnit 
        })
      });
      await onUpdate?.();
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${item.name}?`)) {
      return;
    }
    try {
      await fetch(`/api/fridge/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      await onUpdate?.();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <div className={`grid grid-cols-[2fr_1fr_1fr] items-center gap-4 p-4 border-b ${isEven ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <X size={20} />
        </button>
        <span className="text-sm">{item.name}</span>
      </div>
      
      <div className="flex justify-center">
        <input
          type="number"
          value={localQuantity}
          onChange={(e) => setLocalQuantity(parseFloat(e.target.value) || 0)}
          onBlur={() => handleUpdate({ quantity: localQuantity })}
          className={`w-24 text-center rounded border px-2 py-1 ${isUpdating ? 'bg-gray-100' : ''}`}
          disabled={isUpdating}
          min="0"
          step="0.1"
        />
      </div>
      
      <div className="flex justify-end">
        <input
          type="text"
          value={localUnit}
          onChange={(e) => setLocalUnit(e.target.value)}
          onBlur={() => handleUpdate({ unit: localUnit })}
          className={`w-24 text-right rounded border px-2 py-1 ${isUpdating ? 'bg-gray-100' : ''}`}
          disabled={isUpdating}
        />
      </div>
    </div>
  );
});

InventoryRow.displayName = 'InventoryRow';

export default function AuthenticatedFridge() {
  const [fridgeItems, setFridgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: '' });
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState('inStock');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Get filtered inventory
  const getFilteredInventory = useCallback(() => {
    switch (inventoryFilter) {
      case 'inStock':
        return fridgeItems.filter(item => item.quantity > 0);
      case 'needed':
        return fridgeItems.filter(item => item.quantity === 0);
      default:
        return fridgeItems;
    }
  }, [fridgeItems, inventoryFilter]);

  // Fetch fridge items
  const fetchFridgeItems = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/api/fridge');
      setFridgeItems(data.ingredients || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching fridge items:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    } else if (user) {
      fetchFridgeItems();
    }
  }, [user, authLoading, router, fetchFridgeItems]);

  const handleManualAdd = async (e) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/fridge/add', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      
      await fetchFridgeItems();
      setNewItem({ name: '', quantity: 0, unit: '' });
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleClearFridge = async () => {
    if (window.confirm('Are you sure you want to clear all quantities? Items will move to "Need to Get"')) {
      try {
        await fetchWithAuth('/api/fridge/clear', {
          method: 'POST'
        });
        await fetchFridgeItems();
      } catch (error) {
        console.error('Error clearing fridge:', error);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Fridge</h1>
          <button
            onClick={() => setShowAddInventory(!showAddInventory)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showAddInventory ? <ChevronUp /> : <ChevronDown />}
            Add to Inventory
          </button>
        </div>

        {showAddInventory && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <form onSubmit={handleManualAdd} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Item Name</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem(prev => ({...prev, name: e.target.value}))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem(prev => ({...prev, quantity: parseFloat(e.target.value) || 0}))}
                  className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2"
                  min="0"
                  step="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unit</label>
                <input
                  type="text"
                  value={newItem.unit}
                  onChange={(e) => setNewItem(prev => ({...prev, unit: e.target.value}))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="col-span-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex justify-between items-center">
            <div className="flex gap-4">
              <button
                onClick={() => setInventoryFilter('inStock')}
                className={`px-4 py-2 rounded ${
                  inventoryFilter === 'inStock' ? 'bg-green-600 text-white' : 'bg-gray-200'
                }`}
              >
                In My Fridge ({fridgeItems.filter(item => item.quantity > 0).length})
              </button>
              <button
                onClick={() => setInventoryFilter('needed')}
                className={`px-4 py-2 rounded ${
                  inventoryFilter === 'needed' ? 'bg-green-600 text-white' : 'bg-gray-200'
                }`}
              >
                Need to Get ({fridgeItems.filter(item => item.quantity === 0).length})
              </button>
            </div>
            <button
              onClick={handleClearFridge}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear All Quantities
            </button>
          </div>

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 mb-4 px-4 text-sm font-semibold text-gray-700">
      <div>Item</div>
      <div className="text-center">Quantity</div>
      <div className="text-right">Unit</div>
    </div>

          <div className="divide-y">
            {getFilteredInventory().map((item, index) => (
              <InventoryRow
                key={item.id}
                item={item}
                isEven={index % 2 === 0}
                onUpdate={fetchFridgeItems}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}