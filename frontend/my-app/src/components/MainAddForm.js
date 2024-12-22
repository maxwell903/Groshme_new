import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import InventoryRow from './InventoryRow';  // Import from separate file
import { ReceiptUploadModal, GroceryListModal } from './InventoryModals';
import { useFilteredInventory, useGroceryListItems, renderFilterButtons } from './InventoryUtils';

const MainAddForm = ({ newItem, setNewItem, handleManualAdd }) => (
  <form onSubmit={handleManualAdd} className="grid grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">Item Name</label>
      <input
        type="text"
        value={newItem.name}
        onChange={(e) => setNewItem(prev => ({...prev, name: e.target.value}))}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        placeholder="Enter item name"
        required
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700">Quantity</label>
      <input
        type="number"
        value={newItem.quantity}
        onChange={(e) => setNewItem(prev => ({...prev, quantity: parseInt(e.target.value) || 0}))}
        className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2"
        placeholder="0"
        min="0"
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
        placeholder="Optional unit"
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
);

export default function InventoryView() {
  // State management
  const [recipes, setRecipes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [error, setError] = useState(null);
  const [fridgeItems, setFridgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState('manual');
  const [pastedText, setPastedText] = useState('');
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: '' });
  const [processingResults, setProcessingResults] = useState(null);
  const [inventoryFilter, setInventoryFilter] = useState('inStock');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedGroceryList, setSelectedGroceryList] = useState(null);
  const [groceryLists, setGroceryLists] = useState([]);
  const [showAddInventory, setShowAddInventory] = useState(false);
  
  const router = useRouter();

  // Filtered inventory using custom hook
  const filteredInventory = useFilteredInventory(fridgeItems, inventoryFilter, selectedGroceryList);
  const groceryListItems = useGroceryListItems(selectedGroceryList, fridgeItems);

  // API calls and data fetching
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [recipesRes, menusRes, fridgeRes, groceryListsRes] = await Promise.all([
        fetch('http://localhost:5000/api/all-recipes'),
        fetch('http://localhost:5000/api/menus'),
        fetch('http://localhost:5000/api/fridge'),
        fetch('http://localhost:5000/api/grocery-lists')
      ]);

      const [recipesData, menusData, fridgeData, groceryListsData] = await Promise.all([
        recipesRes.json(),
        menusRes.json(),
        fridgeRes.json(),
        groceryListsRes.json()
      ]);

      setRecipes(recipesData.recipes || []);
      setMenus(menusData.menus || []);
      setFridgeItems(fridgeData.ingredients || []);
      setGroceryLists(groceryListsData.lists || []);
      setError(null);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Continue with part 2...





// ... continuing from part 1

  // Handlers
  const handleInventoryUpdate = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/fridge');
      const data = await response.json();
      setFridgeItems(data.ingredients || []);
      setError(null);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
      setError('Failed to update inventory');
    }
  }, []);

  const handleManualAdd = useCallback(async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    try {
      const response = await fetch('http://localhost:5000/api/fridge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      
      if (!response.ok) throw new Error('Failed to add item');
      
      await handleInventoryUpdate();
      setNewItem({ name: '', quantity: 0, unit: '' });
      setError(null);
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item. Please try again.');
    }
  }, [newItem, handleInventoryUpdate]);

  const handleReceiptUpload = useCallback(async (receiptText) => {
    try {
      const response = await fetch('http://localhost:5000/api/fridge/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_text: receiptText }),
      });

      if (!response.ok) throw new Error('Failed to process receipt');

      const data = await response.json();
      setProcessingResults(data);
      await handleInventoryUpdate();
      setShowUploadModal(false);
      setError(null);
    } catch (error) {
      console.error('Error processing receipt:', error);
      setError('Failed to process receipt. Please try again.');
    }
  }, [handleInventoryUpdate]);

  const handleClearFridge = useCallback(async () => {
    const message = inventoryFilter === 'inStock' 
      ? 'Are you sure you want to clear all quantities in your fridge? Items will move to "Need to Get"'
      : 'Are you sure you want to delete all items from your fridge? This cannot be undone.';

    if (!window.confirm(message)) return;

    try {
      const endpoint = inventoryFilter === 'inStock' ? 'clear' : 'delete-all';
      const method = inventoryFilter === 'inStock' ? 'POST' : 'DELETE';
      
      const response = await fetch(`http://localhost:5000/api/fridge/${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error(`Failed to ${inventoryFilter === 'inStock' ? 'clear' : 'delete'} fridge items`);

      await handleInventoryUpdate();
      setError(null);
    } catch (error) {
      console.error('Error clearing fridge:', error);
      setError('Failed to clear fridge. Please try again.');
    }
  }, [inventoryFilter, handleInventoryUpdate]);

  const handleGroceryListSelect = useCallback(async (list) => {
    try {
      const response = await fetch(`http://localhost:5000/api/grocery-lists/${list.id}`);
      if (!response.ok) throw new Error('Failed to fetch grocery list items');
      
      const data = await response.json();
      setSelectedGroceryList({
        name: list.name,
        id: list.id,
        items: data.items || []
      });
      setShowGroceryListModal(false);
      setError(null);
    } catch (error) {
      console.error('Error fetching grocery list items:', error);
      setError('Failed to fetch grocery list items');
    }
  }, []);

  // Continue with part 3...






  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Fridge</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setShowAddInventory(!showAddInventory)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddInventory ? <ChevronUp /> : <ChevronDown />}
              Add to Inventory
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={20} />
              Upload Receipt
            </button>
          </div>
        </div>

        {showAddInventory && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <MainAddForm 
              newItem={newItem}
              setNewItem={setNewItem}
              handleManualAdd={handleManualAdd}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {renderFilterButtons(inventoryFilter, fridgeItems, setInventoryFilter, handleClearFridge)}

          <div className="flex gap-8">
            {/* Main Inventory Grid */}
            <div className="flex-grow">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 mb-4 px-4 font-semibold text-gray-700">
                <div>Item</div>
                <div>Quantity</div>
                <div>Unit</div>
              </div>

              <div className="divide-y">
                {filteredInventory.map((item, index) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    isEven={index % 2 === 0}
                    onUpdate={handleInventoryUpdate}
                  />
                ))}
              </div>
            </div>

            {/* Grocery List Sidebar */}
            {selectedGroceryList && (
              <div className="w-80 bg-white rounded-lg shadow-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">{selectedGroceryList.name}</h3>
                  <button
                    onClick={() => setSelectedGroceryList(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Needed Items Section */}
                {groceryListItems.matchingNeeded.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-red-600 mb-2">Need to Get:</h4>
                    <div className="space-y-1">
                      {groceryListItems.matchingNeeded.map((item, idx) => (
                        <div key={idx} className="text-sm text-red-600 flex items-center">
                          <span className="mr-2">•</span>
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* In Stock Items Section */}
                {groceryListItems.matchingInStock.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-green-600 mb-2">In Stock:</h4>
                    <div className="space-y-1">
                      {groceryListItems.matchingInStock.map((item, idx) => (
                        <div key={idx} className="text-sm text-green-600 flex items-center">
                          <span className="mr-2">✓</span>
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Items Section */}
                {groceryListItems.other.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Other Items:</h4>
                    <div className="space-y-1">
                      {groceryListItems.other.map((item, idx) => (
                        <div key={idx} className="text-sm text-gray-600 flex items-center">
                          <span className="mr-2">-</span>
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <ReceiptUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleReceiptUpload}
        />

        <GroceryListModal
          isOpen={showGroceryListModal}
          onClose={() => setShowGroceryListModal(false)}
          groceryLists={groceryLists}
          onSelect={handleGroceryListSelect}
        />

        {/* Results Display */}
        {processingResults && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Processing Results</h2>
            
            {/* Matched Items */}
            {processingResults.matched_items?.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-green-700 mb-2">Successfully Matched Items</h3>
                <div className="bg-green-50 rounded-lg p-4">
                  {processingResults.matched_items.map((item, idx) => (
                    <div key={idx} className="text-green-700 mb-1">
                      {item.matched_ingredient}: {item.quantity} 
                      ({item.action === 'updated' ? 'Updated' : 'Added'})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Items */}
            {processingResults.unmatched_items?.length > 0 && (
              <div>
                <h3 className="font-semibold text-yellow-700 mb-2">Unmatched Items</h3>
                <div className="bg-yellow-50 rounded-lg p-4">
                  {processingResults.unmatched_items.map((item, idx) => (
                    <div key={idx} className="text-yellow-700 mb-1">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}