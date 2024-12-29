// src/pages/recipe/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import NutritionModal from '@/components/NutritionModal';
import { ChevronDown, ChevronUp, Plus, Edit, Trash, X, Check } from 'lucide-react';
import { fetchApi, API_URL } from '@/utils/api';

const NavigationBar = () => {
  const router = useRouter();
  const currentPath = router.pathname;

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back
          </Link>

          <div className="flex gap-4">
            <Link
              href="/all-recipes"
              className={`px-4 py-2 rounded-lg ${
                currentPath === '/all-recipes' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
              }`}
            >
              View All
            </Link>

            <Link
              href="/search"
              className={`px-4 py-2 rounded-lg ${
                currentPath === '/search' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
              }`}
            >
              Ingredient Search
            </Link>

            <Link
              href="/menus"
              className={`px-4 py-2 rounded-lg ${
                currentPath === '/menus' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
              }`}
            >
              Menus
            </Link>

            <Link
              href="/grocerylistId"
              className={`px-4 py-2 rounded-lg ${
                currentPath === '/grocerylistId' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
              }`}
            >
              Grocerys
            </Link>

            <Link
              href="/meal-prep"
              className={`px-4 py-2 rounded-lg ${
                currentPath === '/meal-prep' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100'
              }`}
            >
              Meal Prep
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default function RecipePage() {
  const router = useRouter();
  const { id } = router.query;
  const [backPath, setBackPath] = useState('/');
  const [recipe, setRecipe] = useState(null);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [addingToMenu, setAddingToMenu] = useState(false);
  const [groceryLists, setGroceryLists] = useState([]);
  const [showGroceryListModal, setShowGroceryListModal] = useState(false);
  const [fridgeItems, setFridgeItems] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNutritionModalOpen, setIsNutritionModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);




  const NutritionInfo = ({ nutrition, quantity }) => {
    if (!nutrition) return null;
  
    // Calculate scaled nutrition values based on the actual quantity used
    const scale = quantity / (nutrition.serving_size || 1);
    const scaledNutrition = {
      protein_grams: (nutrition.protein_grams * scale).toFixed(1),
      fat_grams: (nutrition.fat_grams * scale).toFixed(1),
      carbs_grams: (nutrition.carbs_grams * scale).toFixed(1),
      serving_size: quantity,
      serving_unit: nutrition.serving_unit
    };
  
    return (
      <div className="text-sm text-gray-500 ml-6">
        <span>Protein: {scaledNutrition.protein_grams}g • </span>
        <span>Fat: {scaledNutrition.fat_grams}g • </span>
        <span>Carbs: {scaledNutrition.carbs_grams}g • </span>
        <span>Per {scaledNutrition.serving_size} {scaledNutrition.serving_unit}</span>
      </div>
    );
  };
  
  // Add nutrition handling functions
  const handleAddNutrition = (index) => {
    setSelectedIngredient(index);
    setIsNutritionModalOpen(true);
  };
  
  const handleNutritionSubmit = async (nutritionData) => {
    try {
      console.log('Submitting nutrition data:', nutritionData); // Debug log
      const response = await fetch(`${API_URL}/api/recipe/${id}/ingredients/${nutritionData.ingredientIndex}/nutrition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          protein_grams: nutritionData.protein_grams,
          fat_grams: nutritionData.fat_grams,
          carbs_grams: nutritionData.carbs_grams,
          serving_size: nutritionData.serving_size,
          serving_unit: nutritionData.serving_unit
        })
      });
  
      if (!response.ok) {
        throw new Error('Failed to save nutrition data');
      }
  
      // Refresh recipe data
      await fetchRecipe();
      setIsNutritionModalOpen(false);
    } catch (err) {
      console.error('Error saving nutrition:', err); // Debug log
      setError(err.message);
    }
  };

  const fetchRecipe = async () => {
    try {
      const response = await fetch(`${API_URL}/api/recipe/${id}`);
      
      if (!response.ok) 
        throw new Error('Failed to fetch recipe data');
      
      const recipeData = await response.json();
      setRecipe(recipeData);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/menus`);
      if (!response.ok) {
        throw new Error('Failed to fetch menus');
      }
      const data = await response.json();
      setMenus(data.menus || []);
    } catch (error) {
      console.error('Error fetching menus:', error);
      setError('Failed to fetch menus');
    }
  };

  const fetchGroceryLists = async () => {
    try {
      const response = await fetch(`${API_URL}/api/grocery-lists`);
      const data = await response.json();
      setGroceryLists(data.lists);
    } catch (error) {
      console.error('Error fetching grocery lists:', error);
    }
  };

  const fetchFridgeItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/fridge`);
      const data = await response.json();
      setFridgeItems(data.ingredients || []);
    } catch (error) {
      console.error('Error fetching fridge items:', error);
    }
  };

  const handleAddToMenu = async (menuId) => {
    setAddingToMenu(true);
    try {
      const response = await fetch(`${API_URL}/api/menus/${menuId}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: id }),
      });

      if (!response.ok) throw new Error('Failed to add recipe to menu');
      setShowMenuDropdown(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setAddingToMenu(false);
    }
  };

  const handleAddToGroceryList = async (listId) => {
    if (!recipe) return;
    
    try {
      // Add recipe name as header
      await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `**${recipe.name}**` }),
      });

      // Add each ingredient with proper formatting
      for (const ingredient of recipe.ingredients) {
        const inFridge = fridgeItems.some(item => 
          item.name.toLowerCase() === ingredient.name.toLowerCase() && 
          item.quantity > 0
        );
        
        // Add ingredient with bullet point prefix and quantity/unit details
        await fetch(`${API_URL}/api/grocery-lists/${listId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `${inFridge ? '✓' : '•'} ${ingredient.name}`,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }),
        });

        // Add to fridge tracking if not already present
        await fetch(`${API_URL}/api/fridge/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: ingredient.name,
            quantity: 0,
            unit: ingredient.unit
          }),
        });
      }

      setShowGroceryListModal(false);
      router.push('/grocerylistId');
    } catch (error) {
      console.error('Error adding recipe to grocery list:', error);
      setError('Failed to add recipe to grocery list');
    }
  };

  const handleDeleteRecipe = async () => {
    if (!confirm('Are you sure you want to delete this recipe?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`${API_URL}/api/recipe/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recipe');
      }

      router.push('/');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (id) {
      const fetchData = async () => {
        try {
          setLoading(true);
          await Promise.all([
            fetchRecipe(),
            fetchMenus(),
            fetchGroceryLists(),
            fetchFridgeItems()
          ]);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [id]);

  
  

const EditRecipeModal = ({ recipe, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: recipe.name || '',
    description: recipe.description || '',
    instructions: recipe.instructions || '',
    prep_time: recipe.prep_time || 0,
    ingredients: recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit || '',
      nutrition: ing.nutrition || null
    }))
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/recipe/${recipe.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
          prep_time: parseInt(formData.prep_time),
          ingredients: formData.ingredients.map(ing => ({
            name: ing.name,
            quantity: parseFloat(ing.quantity),
            unit: ing.unit,
            nutrition: ing.nutrition
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update recipe');
      }

      const updatedData = await response.json();
      
      // Call onSave with the updated data
      onSave(updatedData);
      onClose();
    } catch (error) {
      console.error('Error updating recipe:', error);
      setError('Failed to update recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', quantity: 0, unit: '', nutrition: null }]
    }));
  };

  const removeIngredient = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, index) => index !== indexToRemove)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipe Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded-md p-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border rounded-md p-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              className="w-full border rounded-md p-2"
              rows={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prep Time (minutes)
            </label>
            <input
              type="number"
              value={formData.prep_time}
              onChange={(e) => setFormData(prev => ({ ...prev, prep_time: e.target.value }))}
              className="w-full border rounded-md p-2"
              required
              min="0"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Ingredients
              </label>
              <button
                type="button"
                onClick={addIngredient}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Ingredient
              </button>
            </div>
            {formData.ingredients.map((ingredient, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  value={ingredient.name}
                  onChange={(e) => {
                    const newIngredients = [...formData.ingredients];
                    newIngredients[index].name = e.target.value;
                    setFormData(prev => ({ ...prev, ingredients: newIngredients }));
                  }}
                  className="flex-1 border rounded-md p-2"
                  placeholder="Ingredient name"
                  required
                />
                <input
                  type="number"
                  value={ingredient.quantity}
                  onChange={(e) => {
                    const newIngredients = [...formData.ingredients];
                    newIngredients[index].quantity = e.target.value;
                    setFormData(prev => ({ ...prev, ingredients: newIngredients }));
                  }}
                  className="w-24 border rounded-md p-2"
                  placeholder="Quantity"
                  required
                  min="0"
                  step="0.01"
                />
                <input
                  type="text"
                  value={ingredient.unit}
                  onChange={(e) => {
                    const newIngredients = [...formData.ingredients];
                    newIngredients[index].unit = e.target.value;
                    setFormData(prev => ({ ...prev, ingredients: newIngredients }));
                  }}
                  className="w-24 border rounded-md p-2"
                  placeholder="Unit"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="p-2 text-red-600 hover:text-red-700"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


  
  
  
  
  

// Update the useEffect for back path handling
useEffect(() => {
  // Get the stored paths
  const previousPath = localStorage.getItem('previousPath');
  const actualPreviousPath = localStorage.getItem('actualPreviousPath');

  if (actualPreviousPath) {
    setBackPath(actualPreviousPath);
  } else if (previousPath) {
    setBackPath(previousPath);
  } else {
    setBackPath('/');
  }

  // Clear the stored paths
  return () => {
    localStorage.removeItem('previousPath');
    localStorage.removeItem('actualPreviousPath');
  };
}, []);

// Helper function to get the correct label
const getBackLabel = (path) => {
  const pathLabels = {
    '/menus': 'Menus',
    '/search': 'Search',
    '/meal-prep': 'Meal Prep',
    '/all-recipes': 'My Recipes',
    '/': 'Home',
    '/my-fridge': 'My Fridge',
    '/grocery-lists': 'Grocery Lists'
  };
  return pathLabels[path] || 'Previous Page';
};

// Update your back button JSX
<Link 
  href={backPath}
  className="mb-8 inline-block text-blue-600 hover:text-blue-700"
>
  ← Back to {getBackLabel(backPath)}
</Link>

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenuDropdown && !event.target.closest('.relative')) {
        setShowMenuDropdown(false);
      }
    };
  
    if (showMenuDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showMenuDropdown]);
  

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="rounded-lg bg-red-100 p-8 text-red-700">
          <p>{error}</p>
          <Link href="/" className="mt-4 text-blue-600 hover:text-blue-800">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Recipe not found</p>
          <Link href="/" className="mt-4 text-blue-600 hover:text-blue-800">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4">
      <NavigationBar />
        

        
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-bold">{recipe.name}</h1>
            <div className="flex flex-col gap-2">
              <div className="relative">
                {/* Add this button next to the other buttons in the flex container */}
<button
  onClick={() => setIsEditModalOpen(true)}
  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
>
  Edit Recipe
</button>
{isEditModalOpen && (
  <EditRecipeModal
    recipe={recipe}
    onClose={() => setIsEditModalOpen(false)}
    onSave={() => {
      fetchRecipe();
      setIsEditModalOpen(false);
    }}
  />
)}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenuDropdown(!showMenuDropdown);
                  }}
                  disabled={addingToMenu}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-green-300"
                >
                  Add to Menu
                </button>
  
                {showMenuDropdown && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                      <h3 className="text-lg font-semibold mb-4">Select Menu</h3>
                      <div className="space-y-2">
                        {menus.map((menu) => (
                          <button
                            key={menu.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                setAddingToMenu(true);
                                const response = await fetch(`${API_URL}/api/menus/${menu.id}/recipes`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ recipe_id: id }),
                                });

                                if (!response.ok) {
                                  throw new Error('Failed to add recipe to menu');
                                }

                                alert(`Added to ${menu.name}`);
                                setShowMenuDropdown(false);
                              } catch (error) {
                                console.error('Error adding to menu:', error);
                                alert('Failed to add to menu');
                              } finally {
                                setAddingToMenu(false);
                              }
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
                          >
                            {menu.name}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => setShowMenuDropdown(false)}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
        
              <button
                onClick={() => recipe ? setShowGroceryListModal(true) : null}
                disabled={!recipe}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Add to Grocery List
              </button>

              <button
                onClick={handleDeleteRecipe}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {isDeleting ? 'Deleting...' : 'Delete Recipe'}
              </button>
            </div>
          </div>
          <div className="mb-6">
   <p className="text-gray-600">{recipe.description}</p>
   {recipe.total_nutrition && (
     <div className="mt-2 text-sm text-gray-600">
       <span>Total Nutrition: </span>
      <span>Protein: {recipe.total_nutrition.protein_grams}g • </span>
       <span>Fat: {recipe.total_nutrition.fat_grams}g • </span>
       <span>Carbs: {recipe.total_nutrition.carbs_grams}g</span>
     </div>
   )}
 </div>
          <div className="mb-6">
  <h2 className="mb-2 text-xl font-semibold">Ingredients</h2>
  <ul className="list-inside space-y-2">
  {recipe.ingredients.map((ingredient, index) => (
  <li key={index} className="text-gray-600">
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <span>{ingredient.quantity} {ingredient.unit} {ingredient.name}</span>
          <NutritionInfo 
          nutrition={ingredient.nutrition} 
          quantity={ingredient.quantity}
        />
        </div>
        <button
          onClick={() => handleAddNutrition(index)}
          className={`px-3 py-1 rounded-md ${
            ingredient.nutrition 
              ? 'bg-green-500 text-white hover:bg-green-600' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {ingredient.nutrition ? 'Edit Nutrition' : 'Add Nutrition'}
        </button>
      </div>
    </div>
  </li>
))}
  </ul>
</div>
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold">Instructions</h2>
            <p className="whitespace-pre-line text-gray-600">{recipe.instructions}</p>
          </div>

          <div className="text-sm text-gray-500">
            Prep time: {recipe.prep_time} mins
          </div>
        </div>
      </div>
      {showGroceryListModal && recipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-semibold mb-4">Select Grocery List</h3>
            <div className="space-y-2">
              {groceryLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleAddToGroceryList(list.id)}
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
      <NutritionModal
  isOpen={isNutritionModalOpen}
  onClose={() => setIsNutritionModalOpen(false)}
  onSubmit={handleNutritionSubmit}
  ingredientName={selectedIngredient !== null ? recipe.ingredients[selectedIngredient].name : ''}
  ingredientIndex={selectedIngredient}
  currentNutrition={selectedIngredient !== null ? recipe.ingredients[selectedIngredient].nutrition : null}
  ingredientQuantity={selectedIngredient !== null ? recipe.ingredients[selectedIngredient].quantity : 0}
/>
    </div>
  );
}