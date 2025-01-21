// pages/menu/[menuId].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
const API_URL = process.env.NEXT_PUBLIC_API_URL
import { useCallback } from 'react';
import { fetchWithAuth } from '@/utils/fetch';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MenuDetail() {
  const router = useRouter();
  const { menuId } = router.query;
  const [menu, setMenu] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [groceryLists, setGroceryLists] = useState([]);
  const [fridgeItems, setFridgeItems] = useState([]);

  const fetchMenuRecipes = async () => {
    if (!menuId) return;
    
    try {
      const data = await fetchWithAuth(`/api/menus/${menuId}/recipes`);
      setMenu({ name: data.menu_name });
      setRecipes(data.recipes || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching menu recipes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const fetchFridgeItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/fridge`);
      const data = await response.json();
      if (data.success) {
        setFridgeItems(data.ingredients || []);
      }
    } catch (error) {
      console.error('Error fetching fridge items:', error);
    }
  };

  useEffect(() => {
    if (menuId) {
      fetchMenuRecipes();
      fetchFridgeItems();
    }
  }, [menuId]);

  

  const handleDeleteMenu = async () => {
    if (!menuId || isDeleting) return;

    try {
      setIsDeleting(true);
      await fetchWithAuth(`/api/menus/${menuId}`, {
        method: 'DELETE'
      });

      router.push('/menus');
    } catch (err) {
      console.error('Error deleting menu:', err);
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveRecipe = async (recipeId) => {
    try {
      await fetchWithAuth(`/api/menus/${menuId}/recipes/${recipeId}`, {
        method: 'DELETE'
      });

      fetchMenuRecipes();
    } catch (error) {
      console.error('Error removing recipe:', error);
      setError('Failed to remove recipe from menu');
    }
  };

  const handleShowModal = async () => {
    try {
      const response = await fetch(`${API_URL}/api/grocery-lists`);
      const data = await response.json();
      setGroceryLists(data.lists);
      setShowGroceryListModal(true);
    } catch (error) {
      console.error('Error fetching grocery lists:', error);
    }
  };

  const addToGroceryList = async (listId) => {
    try {
      // Add menu name as header
      await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `### ${menu.name} ###` }),
      });

      // Add each recipe and its ingredients
      for (const recipe of recipes) {
        // Add recipe name as a subheader
        await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `**${recipe.name}**` }),
        });
        
        // Process each ingredient
        if (Array.isArray(recipe.ingredients)) {
          for (const ingredient of recipe.ingredients) {
            const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient.name;
            const inFridge = fridgeItems.some(item => 
              item.name.toLowerCase() === ingredientName.toLowerCase() && 
              item.quantity > 0
            );
            
            await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                name: `${inFridge ? '✓' : '•'} ${ingredientName}`,
                quantity: ingredient.quantity || 0,
                unit: ingredient.unit || '',
              }),
            });
          }
        }
      }

      setShowGroceryListModal(false);
      router.push('/grocerylistId');
    } catch (error) {
      console.error('Error adding to grocery list:', error);
      setError('Failed to add to grocery list');
    }
  };

  const getIngredientColor = useCallback((ingredient) => {
    // Return a default color if ingredient is null or undefined
    if (!ingredient) return 'text-gray-900';
  
    try {
      // Clean the ingredient name and convert to lowercase
      const cleanIngredientName = ingredient.name?.toLowerCase() || ingredient.toLowerCase();
  
      // Check if the ingredient exists in fridgeItems
      const matchingFridgeItem = fridgeItems.find(item => 
        item?.name?.toLowerCase() === cleanIngredientName
      );
  
      // Return appropriate color based on quantity
      if (matchingFridgeItem) {
        return matchingFridgeItem.quantity > 0 ? 'text-green-600' : 'text-red-500';
      }
  
      // Default color if no match found
      return 'text-gray-900';
    } catch (error) {
      console.error('Error in getIngredientColor:', error);
      return 'text-gray-900'; // Default color in case of error
    }
  }, [fridgeItems]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-red-100 p-8 text-red-700">
          <p>{error}</p>
          <Link href="/menus" className="mt-4 text-blue-600 hover:text-blue-800">
            Return to Menus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/menus" className="text-blue-600 hover:text-blue-800">
            ← Back to Menus
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{menu?.name}</h1>
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this menu?')) {
                  handleDeleteMenu();
                }
              }}
              disabled={isDeleting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              
            >
              {isDeleting ? 'Deleting...' : 'Delete Menu'}
            </button>
            <button
              onClick={handleShowModal}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Add to Grocery List
            </button>
          </div>
        </div>

        {/* Color Index */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Color Index:</h2>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-green-600 font-medium">•</span>
              <span className="ml-2">Item is in your fridge</span>
            </div>
            <div className="flex items-center">
              <span className="text-red-600 font-medium">•</span>
              <span className="ml-2">Item needed (not in fridge)</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="relative rounded-lg bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Remove ${recipe.name} from menu?`)) {
                    handleRemoveRecipe(recipe.id);
                  }
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-red-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                {recipe.name}
              </h3>
              <p className="mb-4 text-gray-600">{recipe.description}</p>
              <div className="mb-4">
                <h4 className="font-medium mb-2">Ingredients:</h4>
                <ul className="space-y-1">
                  {Array.isArray(recipe.ingredients) && recipe.ingredients.map((ingredient, idx) => (
                    <li 
                      key={idx} 
                      className={getIngredientColor(typeof ingredient === 'string' ? ingredient : ingredient.name)}
                    >
                      {typeof ingredient === 'string' ? (
                        ingredient
                      ) : (
                        `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-gray-500 mb-1">
                Protein: {recipe.total_nutrition?.protein_grams || 0}g • 
                Fat: {recipe.total_nutrition?.fat_grams || 0}g • 
                Carbs: {recipe.total_nutrition?.carbs_grams || 0}g
              </p>
              <p className="text-sm text-gray-500">
                Prep time: {recipe.prep_time} mins
              </p>
              <Link 
                href={`/recipe/${recipe.id}`}
                className="mt-4 inline-block text-blue-600 hover:text-blue-700"
              >
                View Recipe →
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