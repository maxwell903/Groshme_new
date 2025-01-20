import { useState, useEffect } from 'react';
import Link from 'next/link';
import { debounce } from 'lodash';
const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function InventoryView() {
  const [recipes, setRecipes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [fridgeItems, setFridgeItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [viewMode, setViewMode] = useState('recipe'); // 'recipe' or 'menu'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/all-recipes`).then(res => res.json()),
      fetch(`${API_URL}/api/menus`).then(res => res.json()),
      fetch(`${API_URL}/api/fridge`).then(res => res.json())
    ]).then(([recipesData, menusData, fridgeData]) => {
      setRecipes(recipesData.recipes);
      setMenus(menusData.menus);
      setFridgeItems(fridgeData.ingredients);
      setLoading(false);
    });
  }, []);

  // Real-time recipe filtering
  useEffect(() => {
    if (searchTerm) {
      const filtered = recipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRecipes(filtered);
    } else {
      setFilteredRecipes([]);
    }
  }, [searchTerm, recipes]);

  const handleMenuSelect = async (menuId) => {
    const response = await fetch(`${API_URL}/api/menus/${menuId}/recipes`);
    const data = await response.json();
    setFilteredRecipes(data.recipes);
    setSelectedMenu(menuId);
  };

  const checkIngredientStatus = (ingredient) => {
    const fridgeItem = fridgeItems.find(item => 
      item.name.toLowerCase() === ingredient.toLowerCase()
    );
    return fridgeItem?.quantity > 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/my-fridge" className="text-blue-600 hover:text-blue-800">
            ← Back to My Fridge
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Inventory Check</h1>

        {/* View Mode Toggle */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setViewMode('recipe')}
            className={`px-4 py-2 rounded ${
              viewMode === 'recipe' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Search by Recipe
          </button>
          <button
            onClick={() => setViewMode('menu')}
            className={`px-4 py-2 rounded ${
              viewMode === 'menu' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Filter by Menu
          </button>
        </div>

        {/* Search/Filter Controls */}
        <div className="mb-8">
          {viewMode === 'recipe' ? (
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          ) : (
            <select
              onChange={(e) => handleMenuSelect(e.target.value)}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select a menu...</option>
              {menus.map(menu => (
                <option key={menu.id} value={menu.id}>
                  {menu.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Results Display */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">{recipe.name}</h3>
              <p className="text-gray-600 mb-4">{recipe.description}</p>
              <div className="space-y-2">
                <h4 className="font-medium">Required Ingredients:</h4>
                {recipe.ingredients.map((ingredient, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded ${
                      checkIngredientStatus(ingredient)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {ingredient}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-8">
            <p>Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}