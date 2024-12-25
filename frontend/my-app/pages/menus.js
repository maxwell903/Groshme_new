import React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { fetchApi, API_URL } from '@/utils/api';

export default function Menus() {
  const [menus, setMenus] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [groceryLists, setGroceryLists] = useState([]);
  const [fridgeItems, setFridgeItems] = useState([]);
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    fetchMenus();
    fetchFridgeItems();
  }, []);

  const fetchFridgeItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/fridge`);
      const data = await response.json();
      setFridgeItems(data.ingredients || []);
    } catch (error) {
      console.error('Error fetching fridge items:', error);
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/menus`);
      if (!response.ok) throw new Error('Failed to fetch menus');
      const data = await response.json();
      setMenus(data.menus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    if (!newMenuName.trim()) {
      setError('Menu name is required');
      return;
    }
  
    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/menus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ name: newMenuName.trim() }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create menu');
      }
  
      const data = await response.json();
      console.log('Menu created successfully:', data);
      
      setNewMenuName('');
      setShowCreateForm(false);
      await fetchMenus(); // Refresh the menu list
    } catch (err) {
      console.error('Error creating menu:', err);
      setError(err.message || 'Failed to create menu');
    }
  };

  const handleShowModal = async (menuId) => {
    try {
      const response = await fetch(`${API_URL}/api/grocery-lists`);
      const data = await response.json();
      setGroceryLists(data.lists);
      setSelectedMenuId(menuId);
      setShowGroceryListModal(true);
    } catch (error) {
      console.error('Error fetching grocery lists:', error);
    }
  };

  const addToGroceryList = async (listId) => {
    try {
      // First fetch all recipes for this menu
      const menuResponse = await fetch(`${API_URL}/api/menus/${selectedMenuId}/recipes`);
      const menuData = await menuResponse.json();
      
      // Create formatted items for the grocery list
      for (const recipe of menuData.recipes) {
        // Add recipe name
        await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `**${recipe.name}**` }),
        });
        
        // Add ingredients with color indicators
        for (const ingredient of recipe.ingredients) {
          const inFridge = fridgeItems.some(item => 
            item.name.toLowerCase() === ingredient.toLowerCase() && item.quantity > 0
          );
          
          const color = inFridge ? 'text-green-600' : 'text-red-600';
          await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              name: `<span class="${color}">  • ${ingredient}</span>` 
            }),
          });
        }
      }

      setShowGroceryListModal(false);
      router.push('/grocerylistId');
    } catch (error) {
      console.error('Error adding menu to grocery list:', error);
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (!menuId) {
      console.error('No menu ID provided');
      return;
    }
  
    if (confirm('Are you sure you want to delete this Menu?')) {
      try {
        setIsDeleting(true);
        console.log('Attempting to delete menu:', menuId); // Debug log
  
        const response = await fetch(`${API_URL}/api/menus/${menuId}`, {
          method: 'DELETE',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          mode: 'cors',
          credentials: 'same-origin'
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete menu');
        }
  
        console.log('Menu deleted successfully'); // Debug log
  
        // Refresh the menus list
        await fetchMenus();
      } catch (error) {
        console.error('Error deleting menu:', error);
        setError('Failed to delete menu: ' + error.message);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Loading menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Home
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
      Meal Prep & Fitness
    </Link>
  </div>
</div>
</div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Menus</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
          >
            Create New Menu
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-8 p-6 bg-white rounded-lg shadow-lg">
            <form onSubmit={handleCreateMenu} className="space-y-4">
              <div>
                <label htmlFor="menuName" className="block text-sm font-medium text-gray-700">
                  Menu Name
                </label>
                <input
                  type="text"
                  id="menuName"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2"
                  required
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Create Menu
                </button>
              </div>
            </form>
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-lg bg-red-100 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {menus.map((menu) => (
  <div key={menu.id} className="relative">
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDeleteMenu(menu.id);
        }}
        className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleShowModal(menu.id);
        }}
        className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
    <Link
      href={`/menu/${menu.id}`}
      className="block no-underline"
      onClick={() => {
        localStorage.setItem('actualPreviousPath', `/menus`);
        localStorage.setItem('lastPath', `/menus`);
      }}
    >
      <div className="rounded-lg bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          {menu.name}
        </h3>
        <p className="text-sm text-gray-500">
          {menu.recipe_count} {menu.recipe_count === 1 ? 'recipe' : 'recipes'}
        </p>
        <div className="mt-4 text-blue-600 hover:text-blue-700">
          View Menu →
        </div>
      </div>
    </Link>
  </div>
))}
        </div>

        {showGroceryListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
              <h3 className="text-lg font-semibold mb-4">Select Grocery List</h3>
              <div className="space-y-2">
                {groceryLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => addToGroceryList(list.id)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
                  >
                    {list.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowGroceryListModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}