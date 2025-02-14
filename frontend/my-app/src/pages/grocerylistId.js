import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Plus, ChevronUp, ChevronDown, Trash, Layers, X, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/utils/fetch';




const API_URL = process.env.NEXT_PUBLIC_API_URL

// Modal Components
const RecipeSelectionModal = ({ listId, onClose, onSelect }) => {
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredRecipes, setFilteredRecipes] = useState([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_URL}/api/all-recipes`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch recipes');
        }

        const data = await response.json();
        setRecipes(data.recipes || []);
        setFilteredRecipes(data.recipes || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching recipes:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  useEffect(() => {
    const filtered = recipes.filter(recipe => 
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRecipes(filtered);
  }, [searchTerm, recipes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Select Recipe</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border rounded-md p-2"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading recipes...</div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : (
          <div className="space-y-2">
            {filteredRecipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => {
                  onSelect(recipe);
                  onClose();
                }}
                className="w-full text-left p-4 hover:bg-gray-100 rounded-md"
              >
                <div className="font-medium">{recipe.name}</div>
                <div className="text-sm text-gray-600">{recipe.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MenuSelectionModal = ({ listId, onClose, onSelect }) => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        // Get auth token
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${API_URL}/api/menus`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch menus');
        }

        const data = await response.json();
        setMenus(data.menus || []);
        setLoading(false);
      } catch (error) {
        console.error('Error loading menus:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchMenus();
  }, []);

  

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Select Menu</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-4">Loading menus...</div>
        ) : (
          <div className="space-y-2">
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => {
                  onSelect(menu.id);
                  onClose();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
              >
                {menu.name} ({menu.recipe_count} recipes)
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



// GroceryItem component for displaying and editing individual items
const GroceryItem = ({ item, listId, onUpdate, onDelete }) => {
  const isHeader = item.name.startsWith('**') || item.name.startsWith('###');
  const [isMarked, setIsMarked] = useState(item.name.startsWith('✓'));
  
  const handleToggleMark = async () => {
    if (isHeader) return;
    
    try {
      const newName = isMarked ? 
        item.name.replace('✓', 'X') : 
        item.name.replace('X', '✓');
      
      await fetch(`${API_URL}/api/grocery-lists/${listId}/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...item,
          name: newName
        })
      });
      
      setIsMarked(!isMarked);
      onUpdate();
    } catch (error) {
      console.error('Error toggling mark:', error);
    }
  };
  
  const [localData, setLocalData] = useState({
    quantity: parseFloat(item.quantity) || 0,
    unit: item.unit || '',
    price_per: parseFloat(item.price_per) || 0,
    total: parseFloat(item.total) || 0
  });

  const handleDeleteMarked = async () => {
    if (isRecipeHeader || isMenuHeader) {
      try {
        await fetchWithAuth(`/api/grocery-lists/${listId}/items/${item.id}`, {
          method: 'DELETE'
        });

        // If it's a recipe or menu header, refresh the entire list
        if (typeof onUpdate === 'function') {
          onUpdate();
        }
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item. Please try again.');
      }
    } else {
      // For regular items, toggle the checkmark
      const isChecked = item.name.startsWith('✓');
      const toggledName = isChecked ? 
        item.name.substring(2) : // Remove checkmark
        '✓ ' + item.name;       // Add checkmark

      try {
        await fetchWithAuth(`/api/grocery-lists/${listId}/items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...localData, name: toggledName })
        });

        if (typeof onUpdate === 'function') {
          onUpdate();
        }
      } catch (error) {
        console.error('Error updating item:', error);
      }
    }
  };

  const handleUpdate = async (field, value) => {
    try {
      const updatedData = { ...localData };
      updatedData[field] = value;
      
      const response = await fetchWithAuth(
        `/api/grocery-lists/${listId}/items/${item.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updatedData)
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to update item');
      }
  
      // Check if response has content before trying to parse JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setLocalData(data.item);
      } else {
        // If no JSON response, just use the updated data
        setLocalData(updatedData);
      }
      
      onUpdate();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  useEffect(() => {
    setLocalData({
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit || '',
      price_per: parseFloat(item.price_per) || 0,
      total: parseFloat(item.total) || 0
    });
  }, [item]);

  return (
    
    <tr className={`border-b ${
      isMenuHeader ? 'bg-gray-200 font-bold' : 
      isRecipeHeader ? 'bg-gray-100 font-bold italic' : ''
    }`}>
      <td className="py-2 px-4">
        {(isRecipeHeader || isMenuHeader) ? (
          <div className="flex items-center gap-2">
            <span>{item.name}</span>
            {item.quantity > 1 && (
              <span className="text-sm text-gray-600">
                (×{Math.floor(item.quantity)})
              </span>
            )}
          </div>
        ) : (
          item.name
        )}
      </td>
      {/* Only show input fields for regular items */}
      {!isMenuHeader && !isRecipeHeader ? (
        <>
          <td className="py-2 px-4">
            <input
              type="number"
              value={localData.quantity}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setLocalData(prev => ({
                  ...prev,
                  quantity: value,
                  total: value * prev.price_per
                }));
              }}
              onBlur={(e) => handleUpdate('quantity', parseFloat(e.target.value) || 0)}
              className="w-20 p-1 border rounded text-right"
              min="0"
              step="1"
            />
          </td>
          <td className="py-2 px-4">
            <input
              type="text"
              value={localData.unit}
              onChange={(e) => setLocalData(prev => ({ ...prev, unit: e.target.value }))}
              onBlur={(e) => handleUpdate('unit', e.target.value)}
              className="w-20 p-1 border rounded"
            />
          </td>
          <td className="py-2 px-4">
            <input
              type="number"
              value={localData.price_per}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setLocalData(prev => ({
                  ...prev,
                  price_per: value,
                  total: prev.quantity * value
                }));
              }}
              onBlur={(e) => handleUpdate('price_per', parseFloat(e.target.value) || 0)}
              className="w-24 p-1 border rounded text-right"
              min="0"
              step="1"
            />
          </td>
          <td className="py-2 px-4 text-right">
            ${localData.total.toFixed(2)}
          </td>
          <td className="py-2 px-4">
            <button
              onClick={handleDeleteMarked}
              className={`text-${item.name.startsWith('✓') ? 'red' : 'green'}-500 hover:text-${item.name.startsWith('✓') ? 'red' : 'green'}-700`}
              aria-label={item.name.startsWith('✓') ? "Unmark for deletion" : "Mark for deletion"}
            >
              {item.name.startsWith('✓') ? <X size={20} /> : <Check size={20} />}
            </button>
          </td>
        </>
      ) : (
        <>
          <td colSpan="4"></td>
          <td className="py-2 px-4">
            <button
              onClick={handleDeleteMarked}
              className="text-red-500 hover:text-red-700"
              aria-label="Delete header"
            >
              <X size={20} />
            </button>
          </td>

        </>
      )}
    </tr>
  );
};

export default function GroceryListsPage() {
  const [lists, setLists] = useState([]);
  const [expandedList, setExpandedList] = useState(null);
  const [newList, setNewList] = useState({ name: '', items: [] });
  const [showForm, setShowForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [fridgeItems, setFridgeItems] = useState([]);

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const fetchFridgeItems = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/api/fridge');
      setFridgeItems(data.ingredients || []);
    } catch (error) {
      console.error('Error fetching fridge items:', error);
      setError('Failed to fetch fridge items. ' + error.message);
      setFridgeItems([]);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/api/grocery-lists');
      setLists(data.lists || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching lists:', err);
      setError('Failed to load grocery lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
      return;
    }

    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const results = await Promise.allSettled([
          fetchData(),
          fetchFridgeItems()
        ]);
        
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Error in fetch ${index}:`, result.reason);
            setError(prev => prev ? `${prev}\n${result.reason.message}` : result.reason.message);
          }
        });
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setError('Failed to fetch data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchInitialData();
    }
  }, [user, authLoading, router, fetchData, fetchFridgeItems]);

  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/grocery-lists', {
        method: 'POST',
        body: JSON.stringify({
          name: newList.name,
          items: []
        })
      });
      
      await fetchData();
      setNewList({ name: '', items: [] });
      setShowForm(false);
    } catch (err) {
      setError('Failed to create list');
    }
  };

  const handleDeleteMarkedList = async (listId) => {
    if (!listId) return;
  
    if (confirm('Delete this list?')) {
      try {
        await fetchWithAuth(`/api/grocery-lists/${listId}`, {
          method: 'DELETE'
        });
        
        await fetchData();
      } catch (err) {
        console.error('Error deleting list:', err);
        setError(err.message || 'Failed to delete list');
      }
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    
    try {
      await fetchWithAuth(`/api/grocery-lists/${expandedList}/items`, {
        method: 'POST',
        body: JSON.stringify({ 
          name: newItemName,
          quantity: 0,
          unit: '',
          price_per: 0
        })
      });
  
      setNewItemName('');
      setShowAddItem(false);
      await fetchData();
    } catch (err) {
      setError(err.message);
      console.error('Error adding item:', err);
    }
  };

  const handleDeleteMarkedItem = async (itemId) => {
    if (!expandedList || !itemId) return;
    
    try {
      await fetchWithAuth(`/api/grocery-lists/${expandedList}/items/${itemId}`, {
        method: 'DELETE'
      });
  
      await fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
      setError(error.message || 'Failed to delete item');
    }
  };

  const fetchRecipeIngredientDetails = async (recipeId) => {
    try {
      const data = await fetchWithAuth(`/api/recipe/${recipeId}/ingredients`);
      return data;
    } catch (error) {
      throw new Error('Failed to fetch recipe ingredient details');
    }
  };

  const handleAddFromRecipe = async (recipe) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
  
      // Add recipe name as header
      await fetch(`${API_URL}/api/grocery-lists/${expandedList}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: `**${recipe.name}**` }),
      });
  
      // Get recipe ingredients
      const ingredientResponse = await fetch(`${API_URL}/api/recipe/${recipe.id}/ingredients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (!ingredientResponse.ok) {
        throw new Error('Failed to fetch recipe ingredients');
      }
  
      const ingredientData = await ingredientResponse.json();
  
      // Add each ingredient with a check mark
      for (const ingredient of ingredientData.ingredients) {
        await fetch(`${API_URL}/api/grocery-lists/${expandedList}/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `✓ ${ingredient.name}`,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }),
        });
      }
  
      setSelectedRecipe(false);
      await fetchData();
    } catch (err) {
      setError(err.message);
      console.error('Error adding recipe:', err);
    }
  };
 
  const handleAddFromMenu = async (menuId) => {
  try {
    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // First get menu details with recipes
    const menuResponse = await fetch(`${API_URL}/api/menus/${menuId}/recipes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!menuResponse.ok) {
      throw new Error('Failed to fetch menu details');
    }

    const menuData = await menuResponse.json();
    
    // Add menu name as header
    await fetch(`${API_URL}/api/grocery-lists/${expandedList}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: `### ${menuData.menu_name} ###` }),
    });

    // Add each recipe and its ingredients
    for (const recipe of menuData.recipes) {
      // Add recipe name as subheader
      await fetch(`${API_URL}/api/grocery-lists/${expandedList}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: `**${recipe.name}**` }),
      });

      // Get recipe ingredients
      const ingredientResponse = await fetch(`${API_URL}/api/recipe/${recipe.id}/ingredients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!ingredientResponse.ok) {
        throw new Error('Failed to fetch recipe ingredients');
      }

      const ingredientData = await ingredientResponse.json();

      // Add each ingredient
      for (const ingredient of ingredientData.ingredients) {
        const inFridge = fridgeItems.some(item => 
          item.name.toLowerCase() === ingredient.name.toLowerCase() && 
          item.quantity > 0
        );

        await fetch(`${API_URL}/api/grocery-lists/${expandedList}/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `${inFridge ? '✓' : '•'} ${ingredient.name}`,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }),
        });
      }
    }

    setSelectedMenu(false);
    await fetchData();
  } catch (err) {
    setError(err.message);
    console.error('Error adding menu:', err);
  }
};

  const calculateListTotal = (items) => {
    return items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price_per) || 0;
      return sum + (quantity * price);
    }, 0);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Grocery Lists</h1>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (expandedList) {
                  try {
                    await fetchWithAuth(`/api/grocery-lists/${expandedList}/condense`, {
                      method: 'POST'
                    });
                    await fetchData();
                  } catch (error) {
                    console.error('Error condensing list:', error);
                    setError('Failed to condense list');
                  }
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 font-medium bg-transparent hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors duration-200"
            >
              <Layers size={20} />
              Condense List
            </button>
            <button
              onClick={async () => {
                if (expandedList) {
                  try {
                    await fetchWithAuth(`/api/grocery-lists/${expandedList}/import-to-fridge`, {
                      method: 'POST'
                    });
                    alert('Items imported to fridge successfully');
                  } catch (error) {
                    console.error('Error importing to fridge:', error);
                    setError('Failed to import to fridge');
                  }
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Import To My Fridge
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              <Plus size={20} />
              New List
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-8 bg-white rounded-lg shadow-lg p-6">
            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  List Name
                </label>
                <input
                  type="text"
                  value={newList.name}
                  onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-100 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {lists.map((list) => (
            <div key={list.id} className="bg-white rounded-lg shadow-lg">
              <div className="flex items-center justify-between p-4">
                <button
                  onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                  className="flex-1 text-left flex items-center justify-between"
                >
                  <span className="text-lg font-medium">{list.name}</span>
                  {expandedList === list.id ? 
                    <ChevronUp className="h-5 w-5" /> : 
                    <ChevronDown className="h-5 w-5" />
                  }
                </button>
                <div className="flex items-center space-x-2 mr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchData();
                    }}
                    className="p-2 rounded-full hover:bg-gray-200 text-blue-600"
                    title="Refresh list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" 
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDeleteMarkedList(list.id)}
                    className="p-1 rounded-full hover:bg-gray-200"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>

              {expandedList === list.id && (
                <div className="p-4 border-t border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Item</th>
                        <th className="text-center py-2 px-4 w-24">Quantity</th>
                        <th className="text-center py-2 px-4 w-24">Unit</th>
                        <th className="text-center py-2 px-4 w-24">Price</th>
                        <th className="text-right py-2 px-4 w-24">Total</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items?.map((item) => (
                        <GroceryItem
                          key={item.id}
                          item={item}
                          listId={list.id}
                          onUpdate={fetchData}
                          onDelete={handleDeleteMarkedItem}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td colSpan="4" className="py-2 px-4 text-right">Total:</td>
                        <td className="py-2 px-4 text-right">
                          ${calculateListTotal(list.items || []).toFixed(2)}
                        </td>
                        <td className="py-2 px-4">
                          {list.items?.some(item => item.name.startsWith('✓')) && (
                            <button
                              onClick={async () => {
                                try {
                                  const markedItems = list.items.filter(item => item.name.startsWith('✓'));
                                  for (const item of markedItems) {
                                    await fetchWithAuth(`/api/grocery-lists/${list.id}/items/${item.id}`, {
                                      method: 'DELETE'
                                    });
                                  }
                                  await fetchData();
                                } catch (error) {
                                  console.error('Error deleting marked items:', error);
                                  setError('Failed to delete marked items');
                                }
                              }}
                              className="px-3 py-1 bg-red-600 text-black rounded-md hover:bg-red-700 text-sm"
                            >
                              <Trash size={20}/> ({list.items.filter(item => item.name.startsWith('✓')).length})
                            </button>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="flex items-left gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      <Plus size={20} />
                      Add Item
                    </button>

                    <button
                      onClick={() => setSelectedRecipe(true)}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      <Plus size={20} />
                      Add Recipe
                    </button>

                    <button
                      onClick={() => setSelectedMenu(true)}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-black hover:bg-purple-700"
                    >
                      <Plus size={20} />
                      Add Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Item Modal */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <h3 className="text-lg font-semibold mb-4">Add Item</h3>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Enter item name"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setNewItemName('');
                    setShowAddItem(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recipe Selection Modal */}
        {selectedRecipe && (
          <RecipeSelectionModal
            listId={expandedList}
            onClose={() => setSelectedRecipe(false)}
            onSelect={handleAddFromRecipe}
          />
        )}

        {/* Menu Selection Modal */}
        {selectedMenu && (
          <MenuSelectionModal
            listId={expandedList}
            onClose={() => setSelectedMenu(false)}
            onSelect={handleAddFromMenu}
          />
        )}
      </div>
    </div>
  );
}