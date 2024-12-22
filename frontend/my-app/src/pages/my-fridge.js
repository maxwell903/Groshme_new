import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Edit, Plus, Trash, X, Check, PlusCircle } from 'lucide-react';

// Helper component for inventory rows
const InventoryRow = React.memo(({ item, isEven, onUpdate, groceryLists, showDifference, difference }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(parseFloat(item.quantity) || 0);;
  const [localUnit, setLocalUnit] = useState(item.unit || '');
  const [showGroceryLists, setShowGroceryLists] = useState(false);

  const handleUpdate = async (updateData) => {
    try {
      setIsUpdating(true);
      const response = await fetch(`http://localhost:5000/api/fridge/${item.id}`, {
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
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${item.name} from your fridge?`)) {
      try {
        const response = await fetch(`http://localhost:5000/api/fridge/${item.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to delete item');
        await onUpdate?.();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };


  useEffect(() => {
    setLocalQuantity(item.quantity);
    setLocalUnit(item.unit || '');
  }, [item]);


  const handleQuantityUpdate = useCallback(() => 
    handleUpdate({ quantity: parseFloat(localQuantity) || 0 }), 
    [localQuantity]
  );
  const handleUnitUpdate = useCallback(() => handleUpdate({ unit: localUnit }), [localUnit]);


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
          onChange={(e) => setLocalQuantity(parseFloat(e.target.value) || 0)}
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
          step="0.1"
          
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
     
    </div>
  );
});

// Main component
export default function InventoryView() {
  const [recipes, setRecipes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [fridgeItems, setFridgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState('manual');
  const [pastedText, setPastedText] = useState('');
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: '' });
  const [processingResults, setProcessingResults] = useState(null);
  const [inventoryFilter, setInventoryFilter] = useState('inStock');
  const router = useRouter();
  const [selectedGroceryList, setSelectedGroceryList] = useState(null);
  const [showAddInventory, setShowAddInventory] = useState(false);  // Add this line
  const [groceryLists, setGroceryLists] = useState([]);
  const [showGroceryLists, setShowGroceryLists] = useState(false);
  const [selectedGroceryListItems, setSelectedGroceryListItems] = useState(null);
  const [showGroceryListItems, setShowGroceryListItems] = useState(false);
  const handleGroceryListSelect = async (list) => {
       try {
         const response = await fetch(`http://localhost:5000/api/grocery-lists/${list.id}`);
         const data = await response.json();
         setSelectedGroceryListItems({
           name: list.name,
           id: list.id,
           items: data.items || []
         });
         setShowGroceryLists(false);
         setShowGroceryListItems(true);
       } catch (error) {
         console.error('Error fetching grocery list items:', error);
       }
     };
         // Add a helper function to check if names match (case-insensitive)
     const namesMatch = (name1, name2) => {
       return name1.toLowerCase().includes(name2.toLowerCase()) || 
              name2.toLowerCase().includes(name1.toLowerCase());
     };


     const getItemColor = useCallback((itemName) => {
      if (!itemName) return 'black';
      // Clean the name and convert to lowercase for comparison
      const cleanName = itemName.replace(/[*•]/, '').trim().toLowerCase();
      const matchingFridgeItem = fridgeItems.find(item => 
        item.name.toLowerCase() === cleanName
      );
      if (!matchingFridgeItem) return 'black';
      return matchingFridgeItem.quantity > 0 ? 'green' : 'red';
    }, [fridgeItems]);




         // Add a function to sort and filter grocery list items
     const getFilteredGroceryListItems = () => {
       if (!selectedGroceryListItems) return { matchingNeeded: [], matchingInStock: [], other: [] };
       
       const neededItems = fridgeItems.filter(item => item.quantity === 0);
       const inStockItems = fridgeItems.filter(item => item.quantity > 0);
       
       return selectedGroceryListItems.items.reduce((acc, groceryItem) => {
        const cleanName = groceryItem.name.replace(/\[.*?\]/, '').replace(/[*•]/, '').trim().toLowerCase();
        const existsInFridge = fridgeItems.some(item => 
          item.name.toLowerCase() === cleanName
       
        );
       
        const matchesNeeded = neededItems.some(item => 
          item.name.toLowerCase() === cleanName
        );
        const matchesInStock = inStockItems.some(item => 
          item.name.toLowerCase() === cleanName
        );
         
        if (inventoryFilter === 'needed' || inventoryFilter === 'inStock') {
                    if (matchesNeeded || !existsInFridge) {
             acc.matchingNeeded.push(groceryItem);
           } else if (matchesInStock) {
             acc.matchingInStock.push(groceryItem);
           }
         } else {
           acc.other.push(groceryItem);
         }
         
         return acc;
       }, { matchingNeeded: [], matchingInStock: [], other: [] });
     };

  // Memoized filtered inventory
  const getFilteredInventory = useMemo(() => {
    switch (inventoryFilter) {
      case 'inStock':
        return fridgeItems.filter(item => item.quantity > 0);
      case 'needed':
        let neededItems = fridgeItems.filter(item => item.quantity === 0);
        
        if (selectedGroceryList) {
          const selectedList = groceryLists.find(list => list.id === selectedGroceryList);
          if (selectedList && selectedList.items) {
            // Filter needed items to only show those that match items in the selected grocery list
            neededItems = neededItems.filter(fridgeItem => 
              selectedList.items.some(groceryItem => {
                const cleanGroceryName = groceryItem.name.replace(/[•✓\[\]]/g, '').trim();
                return fridgeItem.name.toLowerCase() === cleanGroceryName.toLowerCase();
              })
            );
          }
        }
        return neededItems;
      case 'all':
        return fridgeItems;
      default:
        return fridgeItems;
    }
  }, [fridgeItems, inventoryFilter, selectedGroceryList, groceryLists]);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
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
        setLoading(false);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Handle inventory updates
  const handleInventoryUpdate = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/fridge');
      const data = await response.json();
      setFridgeItems(data.ingredients || []);
    } catch (error) {
      console.error('Error refreshing inventory:', error);
    }
  }, []);

  // Handle manual item addition
  const handleManualAdd = useCallback(async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/fridge/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      
      if (response.ok) {
        await handleInventoryUpdate();
        setNewItem({ name: '', quantity: 0, unit: '' });
      }
    } catch (error) {
      console.error('Error adding item:', error);
    }
  }, [newItem, handleInventoryUpdate]);

  // Handle text parsing
  const handleTextParse = useCallback(async (text) => {
    try {
      const response = await fetch('http://localhost:5000/api/fridge/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_text: text })
      });
      
      const data = await response.json();
      if (response.ok) {
        setProcessingResults(data);
        await handleInventoryUpdate();
        setPastedText('');
      }
    } catch (error) {
      console.error('Error parsing text:', error);
    }
  }, [handleInventoryUpdate]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      handleTextParse(text);
    }
  }, [handleTextParse]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link 
            href="/"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => {
              const prevPath = localStorage.getItem('previousPath') || '/';
              router.push(prevPath);
            }}
          >
            ← Back
          </Link>
        </div>
      </nav>
      <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-1">
  <div className="flex justify-between items-center mb-6">
    <div className="flex gap-4">
      <Link
        href="/my-fridge"
        className={`px-4 py-2 rounded-lg ${
          router.pathname === '/my-fridge' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
        }`}
      >
        My Fridge
      </Link>
      <Link
        href="/grocerylistId"
        className={`px-4 py-2 rounded-lg ${
          router.pathname === '/grocerylistId' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
        }`}
      >
        Grocery Lists
      </Link>
      <Link
        href="/menus"
        className={`px-4 py-2 rounded-lg ${
          router.pathname === '/menus' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
        }`}
      >
        My Menus
      </Link>
    </div>
    <Link
      href="/meal-prep"
      className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
    >
      My Fitness
    </Link>
  </div>
  </div>
</div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Fridge</h1>
        <div className="mb-4 flex justify-between items-center">
  <button
    onClick={() => setShowAddInventory(!showAddInventory)}
    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
  >
    {showAddInventory ? <ChevronUp /> : <ChevronDown />}
    Add to Inventory
  </button>
  
  <button
    onClick={async () => {
      if (confirm('Are you sure you want to clear all quantities? Items will move to "Need to Get"')) {
        try {
          const response = await fetch('http://localhost:5000/api/fridge/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) throw new Error('Failed to clear quantities');
          await handleInventoryUpdate();
        } catch (error) {
          console.error('Error clearing quantities:', error);
        }
      }
    }}
    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
  >
    Clear All Quantities
  </button>
</div>

        {showAddInventory && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <div className="mb-4 flex gap-4">
              <button
                onClick={() => setAddMode('manual')}
                className={`px-4 py-2 rounded ${
                  addMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setAddMode('paste')}
                className={`px-4 py-2 rounded ${
                  addMode === 'paste' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Paste Receipt
              </button>
              <button
                onClick={() => setAddMode('file')}
                className={`px-4 py-2 rounded ${
                  addMode === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}
              >
                Upload File
              </button>
            </div>

            {addMode === 'manual' && (
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
                    onChange={(e) => setNewItem(prev => ({...prev, quantity: parseFloat(e.target.value) || 0}))}
                    className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2"
                    placeholder="0"
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
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Add Item
                  </button>
                </div>
              </form>
            )}

          {addMode === 'paste' && (
            <div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full h-32 border rounded-md p-2 mb-4"
                placeholder="Paste your receipt or grocery list here..."
              />
              <button
                onClick={() => handleTextParse(pastedText)}
                className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
              >
                Process Text
              </button>
              
              {/* Processing Results */}
              {processingResults && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Processing Results:</h3>
                  <div className="space-y-4">
                    <div className="bg-green-50 p-3 rounded">
                      <h4 className="text-green-800 font-medium mb-2">Matched Items:</h4>
                      {processingResults.matched_items.map((item, idx) => (
                        <div key={idx} className="text-green-700">
                          {item.matched_ingredient}: {item.quantity} 
                          ({item.action === 'updated' ? 'Updated' : 'Added'}, 
                          Total: {item.current_total})
                        </div>
                      ))}
                    </div>
                    
                    {processingResults.unmatched_items.length > 0 && (
                      <div className="bg-yellow-50 p-3 rounded">
                        <h4 className="text-yellow-800 font-medium mb-2">Unmatched Items:</h4>
                        {processingResults.unmatched_items.map((item, idx) => (
                          <div key={idx} className="text-yellow-700">{item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {addMode === 'file' && (
            <div>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
           )}
         </div>
        )}
        

        {/* Inventory Section */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Filter Buttons */}
          <div className="mb-4 flex gap-4">
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
                inventoryFilter === 'needed' ? 'bg-red-600 text-white' : 'bg-gray-200'
              }`}
            >
              Need to Get ({fridgeItems.filter(item => item.quantity === 0).length})
            </button>
            <button
              onClick={() => setInventoryFilter('all')}
              className={`px-4 py-2 rounded ${
                inventoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              View All ({fridgeItems.length})
            </button>
          </div>

          {/* Grocery List Filter (Only show when needed filter is active) */}
          {inventoryFilter === 'needed' && (
            <div className="mb-4 flex gap-2 items-center">
              <span className="text-sm text-gray-600">Filter by Grocery List:</span>
              <select
                value={selectedGroceryList || ''}
                onChange={(e) => {
                  const listId = e.target.value ? Number(e.target.value) : null;
                  setSelectedGroceryList(listId);
                }}
                className="border rounded px-2 py-1"
              >
                <option value="">All Items</option>
                {groceryLists.map(list => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-8">
              <p>Loading inventory...</p>
            </div>
          ) : (
            /* Inventory Grid */
            <div className="flex gap-8">
              {/* Main Tables Container */}
              <div className="flex-grow grid grid-cols-2 gap-1">
   {/* Column Headers */}
   <div className="col-span-2 grid grid-cols-2 gap-8 mb-4">
     {/* Left Column Headers */}
     <div className="grid grid-cols-3 px-4 font-semibold text-gray-700">
     <div className="w-36">Item</div>
     <div className="w-24">Quantity</div>
       <div className="flex justify-end">Unit</div>
     </div>
     {/* Right Column Headers */}
     <div className="grid grid-cols-3 px-4 font-semibold text-gray-700">
     <div className="w-36">Item</div>
     <div className="w-24">Quantity</div>
       <div className="flex justify-end">Unit</div>
     </div>
   </div>
   
   {/* Left Column Content */}
   <div className="space-y-1 pr-4">
                {getFilteredInventory
                  .slice(0, Math.ceil(getFilteredInventory.length / 2))
                  .map((item, index) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      isEven={index % 2 === 0}
                      onUpdate={handleInventoryUpdate}
                 
                    />
                  ))}
                 </div>
                    {/* Right Column Content */}
                <div className="space-y-1 pl- 4">
                {getFilteredInventory
                  .slice(Math.ceil(getFilteredInventory.length / 2))
                  .map((item, index) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      isEven={index % 2 === 0}
                      onUpdate={handleInventoryUpdate}
                    />
                  ))}
              </div>
              </div>

              {/* Grocery Lists Column */}
              <div className="space-y-2">
                {/* Main Grocery Lists Button */}
                <button
                    onClick={() => {
                        setShowGroceryLists(!showGroceryLists);
                        setShowGroceryListItems(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    <span>Grocery Lists</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showGroceryLists ? 'rotate-180' : ''}`} />
                </button>
                {showGroceryLists && (
                  <div className="absolute z-10 w-full mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      {groceryLists && groceryLists.map((list) => (
                       <button
                          key={list.id}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                          onClick={() => handleGroceryListSelect(list)}
                        >
                          {list.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Grocery List Items */}
 {selectedGroceryListItems && (
   <div>
     <button
       onClick={() => setShowGroceryListItems(!showGroceryListItems)}
       className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
     >
       <span>{selectedGroceryListItems.name}</span>
       <ChevronDown className={`w-4 h-4 transition-transform ${showGroceryListItems ? 'rotate-180' : ''}`} />
     </button>
     {showGroceryListItems && (
  <div className="absolute z-10 w-64 mt-2 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 max-h-96 overflow-y-auto">
    <div className="py-1 px-4" role="menu" aria-orientation="vertical">
      {(() => {
        const { matchingInStock, matchingNeeded, other } = getFilteredGroceryListItems();
        
        const renderItem = (item, idx, fridgeItems, matchingInStock) => {
          const name = item.name.replace(/\[(red|green)\]•/, '•');
          if (name.startsWith('###')) {
            return (
              <div key={idx} className="text-lg font-bold text-gray-900 py-2">
                {name.replace(/###/g, '').trim()}
              </div>
            );
          } else if (name.startsWith('**')) {
            return (
              <div key={idx} className="font-bold text-gray-900 py-1">
                {name.replace(/\*\*/g, '').trim()}
              </div>
            );
          } else {
            const isInStock = matchingInStock.includes(item);
            const cleanName = item.name.replace(/\[(red|green)\]•/, '').replace(/[*•]/, '').trim().toLowerCase();
            const existsInFridge = fridgeItems.some(fridgeItem => 
              fridgeItem.name.toLowerCase() === cleanName
            );
             // Determine text color based on item status
            let textColor;
            if (isInStock) {
              textColor = 'text-green-600';  // Item is in stock
            } else if (!existsInFridge) {
              textColor = 'text-red-600';    // Item doesn't exist in fridge
            } else {
              textColor = 'text-red-600';   // Item exists but needs restocking
            }
            
            return (
              <div key={idx} className={`text-sm ${textColor} py-1`}>
                {name}
              </div>
            );
          }
        };

        return (
          <>
            {inventoryFilter === 'needed' ? (
              // Needed items filter - show needed items first
              <>
                {matchingNeeded.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">Needed Items:</div>
                    {matchingNeeded.map((item, idx) => renderItem(item, `needed-${idx}`, fridgeItems, matchingInStock))}
                  </div>
                )}
                {matchingInStock.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">In Stock Items:</div>
                    {matchingInStock.map((item, idx) => renderItem(item, `instock-${idx}`, fridgeItems, matchingInStock))}
                  </div>
                )}
              </>
            ) : inventoryFilter === 'inStock' ? (
              // In Stock filter - show in stock items first
              <>
                {matchingInStock.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">In Stock Items:</div>
                    {matchingInStock.map((item, idx) => renderItem(item, `instock-${idx}`, fridgeItems, matchingInStock))}
                  </div>
                )}
                {matchingNeeded.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">Needed Items:</div>
                    {matchingNeeded.map((item, idx) => renderItem(item, `needed-${idx}`, fridgeItems, matchingInStock))}
                  </div>
                )}
              </>
            ) : (
              // All items view
              <div>
                {other.map((item, idx) => renderItem(item, `other-${idx}`, fridgeItems, matchingInStock))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  </div>
)}
   </div>
 )}
 </div>
              </div>
        
          )}
        </div>
      </div>
    </div>
  );
}