// Create a new file: src/components/ColoredAddItemModal.js

import React, { useState, useEffect } from 'react';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const ColoredAddItemModal = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  listId 
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [fridgeItems, setFridgeItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  useEffect(() => {
    // Fetch fridge items and recipes when modal opens
    if (isOpen) {
      Promise.all([
        fetch(`${API_URL}/api/fridge`).then(res => res.json()),
        fetch(`${API_URL}/api/all-recipes`).then(res => res.json())
      ]).then(([fridgeData, recipesData]) => {
        setFridgeItems(fridgeData.ingredients || []);
        
        // Extract unique ingredients from recipes
        const allIngredients = new Set();
        recipesData.recipes?.forEach(recipe => {
          recipe.ingredients.forEach(ing => allIngredients.add(ing.toLowerCase()));
        });
        setIngredients(Array.from(allIngredients));
      });
    }
  }, [isOpen]);

  const getItemColor = (itemName) => {
    if (!itemName) return 'text-gray-900';
    
    // Check if item exists in fridge with quantity > 0
    const inFridge = fridgeItems.some(item => 
      item.name.toLowerCase() === itemName.toLowerCase() && 
      item.quantity > 0
    );
    
    if (inFridge) return 'text-green-600';
    
    // Check if item exists in recipe database
    const inRecipes = ingredients.some(ing => 
      ing.toLowerCase() === itemName.toLowerCase()
    );
    
    if (inRecipes) return 'text-red-600';
    
    return 'text-gray-900';
  };

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    
    const cleanedName = newItemName.trim();
    const color = getItemColor(cleanedName);
    const colorPrefix = color === 'text-green-600' ? '[green]' : 
                       color === 'text-red-600' ? '[red]' : '';
    
    // Add bullet point and color coding
    const formattedName = `${colorPrefix}• ${cleanedName}`;
    
    await onAdd(listId, formattedName);
    setNewItemName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96">
        <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
        {newItemName && (
          <div className="mb-2">
            <span className={getItemColor(newItemName)}>
              Preview: • {newItemName}
            </span>
          </div>
        )}
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Enter item name..."
          className="w-full rounded-md border p-2 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setNewItemName('');
              onClose();
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColoredAddItemModal;