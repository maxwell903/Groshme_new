import React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { fetchWithAuth } from '@/utils/fetch';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const fetchMenus = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/menus');
      setMenus(data.menus || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching menus:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFridgeItems = async () => {
    if (!user) return;
    
    try {
      const response = await fetchWithAuth(`/api/fridge`);
      if (response.success) {
        setFridgeItems(response.ingredients || []);
      }
    } catch (error) {
      console.error('Error fetching fridge items:', error);
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      fetchMenus();
      fetchFridgeItems();
    }
  }, [user, authLoading]);

  const handleCreateMenu = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to create a menu');
      return;
    }
    
    if (!newMenuName.trim()) {
      setError('Menu name is required');
      return;
    }

    try {
      setError(null);
      await fetchWithAuth('/api/menus', {
        method: 'POST',
        body: JSON.stringify({ name: newMenuName.trim(), user_id: user.id })
       
      });

      setNewMenuName('');
      setShowCreateForm(false);
      await fetchMenus();
    } catch (err) {
      console.error('Error creating menu:', err);
      setError(err.message);
    }
  };

  const handleDeleteMenu = async (menuId) => {
    if (!user) {
      setError('You must be logged in to delete a menu');
      return;
    }
    
    if (!menuId || isDeleting) return;

    if (confirm('Are you sure you want to delete this Menu?')) {
      try {
        setIsDeleting(true);
        await fetchWithAuth(`/api/menus/${menuId}`, {
          method: 'DELETE'
        });
        await fetchMenus();
      } catch (err) {
        console.error('Error deleting menu:', err);
        setError(err.message);
      } finally {
        setIsDeleting(false);
      }
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
      const menuResponse = await fetchWithAuth(`/api/menus/${selectedMenuId}/recipes`);
      const menuData = await menuResponse.json();
      
      // Add menu as a header
      await fetchWithAuth(`/api/grocery-lists/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `### ${menuData.menu_name || 'Menu'} ###` }),
      });

      for (const recipe of menuData.recipes) {
        // Add recipe name as subheader
        await fetchWithAuth(`/api/grocery-lists/${listId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `**${recipe.name}**` }),
        });
        
        // Add ingredients
        for (const ingredient of recipe.ingredients) {
          const inFridge = fridgeItems.some(item => 
            item.name.toLowerCase() === ingredient.toLowerCase() && item.quantity > 0
          );
          
          await fetchWithAuth(`/api/grocery-lists/${listId}/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              name: `${inFridge ? '✓' : '•'} ${ingredient}`,
            }),
          });
        }
      }

      setShowGroceryListModal(false);
      router.push('/grocerylistId');
    } catch (error) {
      console.error('Error adding menu to grocery list:', error);
      setError('Failed to add menu to grocery list');
    }
  };
  
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/signin');
    return null;
  }

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
    <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">
      
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Menus</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
    </ProtectedRoute>
  );
}