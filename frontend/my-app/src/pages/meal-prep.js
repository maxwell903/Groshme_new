// src/pages/meal-prep.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Plus, X, Search, Check, Loader } from 'lucide-react';
import ExerciseDisplay from '../components/ExerciseDisplay';
import WorkoutDisplay from '../components/WorkoutDisplay';
import { Calendar } from 'lucide-react';
import NutritionSummary from '@/components/NutritionModal';
import { fetchWithAuth } from '@/utils/fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL


const SearchableRecipeSelector = ({ isOpen, onClose, onSelect, mealType }) => {
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filteredRecipes, setFilteredRecipes] = useState([]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/all-recipes`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        const data = await response.json();
        setRecipes(data.recipes || []);
        setFilteredRecipes(data.recipes || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching recipes:', error);
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchRecipes();
    }
  }, [isOpen]);

  useEffect(() => {
    const filtered = recipes.filter(recipe => 
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRecipes(filtered);
  }, [searchTerm, recipes]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Select Recipe for {mealType}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
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
                <div className="text-sm text-gray-500 mt-1">
                  {recipe.prep_time} mins • 
                  Protein: {recipe.total_nutrition?.protein_grams || 0}g • 
                  Fat: {recipe.total_nutrition?.fat_grams || 0}g • 
                  Carbs: {recipe.total_nutrition?.carbs_grams || 0}g
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MenuSelector = ({ isOpen, onClose, weekId, onMealsAdded }) => {
  const [step, setStep] = useState('day'); // 'day', 'menu', 'recipes'
  const [selectedDay, setSelectedDay] = useState(null);
  const [menus, setMenus] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [selectedMeals, setSelectedMeals] = useState(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/menus`);
        const data = await response.json();
        setMenus(data.menus || []);
      } catch (error) {
        console.error('Error fetching menus:', error);
      }
    };

    if (isOpen && step === 'menu') {
      fetchMenus();
    }
  }, [isOpen, step]);

  const handleMenuSelect = async (menu) => {
    setSelectedMenu(menu);
    try {
      const response = await fetch(`${API_URL}/api/menus/${menu.id}/recipes`);
      const data = await response.json();
      setRecipes(data.recipes || []);
      setStep('recipes');
    } catch (error) {
      console.error('Error fetching menu recipes:', error);
    }
  };

  const handleMealTypeToggle = (recipeId, mealType) => {
    setSelectedMeals(prev => {
      const current = new Map(prev);
      const recipeMeals = current.get(recipeId) || new Set();
      
      if (recipeMeals.has(mealType)) {
        recipeMeals.delete(mealType);
      } else {
        recipeMeals.add(mealType);
      }
      
      if (recipeMeals.size === 0) {
        current.delete(recipeId);
      } else {
        current.set(recipeId, recipeMeals);
      }
      
      return current;
    });
  };

  const handleAddSelected = async () => {
    setLoading(true);
    try {
      const meals = [];
      selectedMeals.forEach((mealTypes, recipeId) => {
        mealTypes.forEach(mealType => {
          meals.push({
            day: selectedDay,
            meal_type: mealType.toLowerCase(),
            recipe_id: recipeId
          });
        });
      });

      for (const meal of meals) {
        await fetch(`${API_URL}/api/meal-prep/weeks/${weekId}/meals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meal)
        });
      }

      onMealsAdded();
      onClose();
      setStep('day');
     setSelectedDay(null);
     setSelectedMenu(null);
     setRecipes([]);
     setSelectedMeals(new Map());
    } catch (error) {
      console.error('Error adding meals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[800px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {step === 'day' ? 'Select Day' :
             step === 'menu' ? 'Select Menu' :
             'Select Meals'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {step === 'day' && (
          <div className="space-y-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <button
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  setStep('menu');
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {step === 'menu' && (
          <div className="space-y-2">
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => handleMenuSelect(menu)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
              >
                {menu.name} ({menu.recipe_count} recipes)
              </button>
            ))}
          </div>
        )}

        {step === 'recipes' && (
          <>
            <div className="mb-4">
              <h3 className="font-medium mb-2">Select meal types for each recipe:</h3>
              <div className="space-y-4">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="p-4 border rounded-lg">
                    <div className="font-medium mb-2">{recipe.name}</div>
                    <div className="flex gap-4">
                      {['Breakfast', 'Lunch', 'Dinner'].map((mealType) => (
                        <label key={mealType} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectedMeals.get(recipe.id)?.has(mealType)}
                            onChange={() => handleMealTypeToggle(recipe.id, mealType)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{mealType}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddSelected}
                disabled={loading || selectedMeals.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
              >
                {loading ? 'Adding...' : 'Add Selected'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SafeNutrition = ({ meal }) => {
  // Safe defaults and null checks for nutrition data
  const nutrition = meal?.total_nutrition || {};
  const protein = parseFloat(nutrition?.protein_grams || 0).toFixed(1);
  const fat = parseFloat(nutrition?.fat_grams || 0).toFixed(1);
  const carbs = parseFloat(nutrition?.carbs_grams || 0).toFixed(1);

  return (
    <p className="text-xs text-gray-500 mb-2">
      Protein: {protein}g •
      Fat: {fat}g •
      Carbs: {carbs}g
    </p>
  );
};

const MealDisplay = ({ meal, onDelete }) => {
  if (!meal) return null;

  return (
    <div className="bg-white rounded-lg p-4 relative mb-2 border">
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
      >
        <X size={16} />
      </button>
      
      <p className="text-lg font-bold text-gray-500 mt-2">
        {meal.name}
      </p>
      <SafeNutrition meal={meal} />
      <Link 
        href={`/recipe/${meal.recipe_id}`}
        className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        onClick={() => {
          localStorage.setItem('actualPreviousPath', '/meal-prep');
          localStorage.setItem('lastPath', '/meal-prep');
        }}
      >
        View Recipe →
      </Link>
    </div>
  );
};
  
  
  const DayDropdown = ({ 
    day, 
    weekId, 
    meals, 
    onMealAdd, 
    onMealDelete, 
    startDate, 
    showDates,
    showNutrition 
  }) => {
    const [showRecipeSelector, setShowRecipeSelector] = useState(false);
    const [selectedMealType, setSelectedMealType] = useState(null);
  
    const handleAddMeal = async (recipe, mealType) => {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/meal-prep/weeks/${weekId}/meals`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          },
          body: JSON.stringify({
            day,
            meal_type: mealType.toLowerCase(),
            recipe_id: recipe.id
          })
        });
    
        if (!response.ok) throw new Error('Failed to add meal');
        
        setShowRecipeSelector(false);
        onMealAdd();
      } catch (error) {
        console.error('Error adding meal:', error);
      }
    };
  
    const getDayDate = () => {
      if (!startDate || !showDates) return null;
      const date = new Date(startDate);
      const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
      date.setDate(date.getDate() + dayIndex);
      return date.toLocaleDateString();
    };
  
    return (
      <div className="flex-1 p-2">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{day}</h3>
            {showDates && getDayDate() && (
              <span className="text-sm text-gray-500">{getDayDate()}</span>
            )}
            {showNutrition && meals && (
              <NutritionSummary meals={meals} />
            )}
          </div>
          
          <div className="space-y-4">
            {['Breakfast', 'Lunch', 'Dinner'].map(mealType => (
              <div key={mealType}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{mealType}</span>
                  <button
                    onClick={() => {
                      setSelectedMealType(mealType);
                      setShowRecipeSelector(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {meals?.[mealType.toLowerCase()]?.map((meal, index) => (
                  <MealDisplay
                    key={`${meal.recipe_id}-${index}`}
                    meal={meal}
                    onDelete={() => onMealDelete(day, mealType.toLowerCase(), meal.recipe_id)}
                  />
                ))}
              </div>
            ))}
          </div>
  
          <SearchableRecipeSelector
            isOpen={showRecipeSelector}
            onClose={() => setShowRecipeSelector(false)}
            onSelect={(recipe) => handleAddMeal(recipe, selectedMealType)}
            mealType={selectedMealType}
          />
        </div>
      </div>
    );
  };
  
  const Week = ({ week, onDeleteWeek, onMealDelete, onMealsAdded, onToggleDates }) => {
    const [showMenuSelector, setShowMenuSelector] = useState(false);
  
    const generateWeekDays = (startDay) => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const startIndex = days.indexOf(startDay);
      const weekSchedule = [];
  
      for (let i = 1; i <= 7; i++) {
        const index = (startIndex + i) % 7;
        weekSchedule.push(days[index]);
      }
  
      return weekSchedule;
    };
  
    const formatDateRange = () => {
      if (!week.start_date || !week.end_date) return '';
      const startDate = new Date(week.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6); // End date is 6 days after start date
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    };

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {week.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => onToggleDates(week.id)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Calendar size={16} />
                {week.show_dates ? 'Hide Dates' : 'Show Dates'}
              </button>
              {week.show_dates && (
                <span className="text-sm text-gray-500">{formatDateRange()}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMenuSelector(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Add from Menu
            </button>
            <button
              onClick={() => onDeleteWeek(week.id)}
              className="text-red-500 hover:text-red-700"
            >
              <X size={20} />
            </button>
          </div>
        </div>
  
        <div className="flex gap-2 overflow-x-auto pb-4">
          {generateWeekDays(week.start_day).map((day) => (
            <DayDropdown
              key={day}
              day={day}
              weekId={week.id}
              meals={week.meal_plans[day]}
              onMealAdd={onMealsAdded}
              onMealDelete={(day, mealType, recipeId) =>
                onMealDelete(week.id, day, mealType, recipeId)
              }
              startDate={week.start_date}
              showDates={week.show_dates}
            />
          ))}
        </div>
  
        <MenuSelector
          isOpen={showMenuSelector}
          onClose={() => setShowMenuSelector(false)}
          weekId={week.id}
          onMealsAdded={onMealsAdded}
        />
      </div>
    );
  };

  const DaySelector = ({ isOpen, onClose, onDaySelect }) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    
    if (!isOpen) return null;
  
    const handleSubmit = () => {
      if (!title.trim() || !startDate) {
        alert('Please enter a title and start date');
        return;
      }
  
      const selectedDate = new Date(startDate);
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 7);
  
      const dayIndex = selectedDate.getDay();
      // Convert Sunday from 0 to 7 to match our days array
      const adjustedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      
      onDaySelect({
        title,
        startDate: startDate,
        endDate: endDate.toISOString().split('T')[0],
        day: days[adjustedDayIndex]
      });
      onClose();
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96">
          <h2 className="text-xl font-semibold mb-4">Create New Week</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Week Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded-md p-2"
                placeholder="Enter week title"
              />
            </div>
  
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded-md p-2"
              />
            </div>
          </div>
  
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create Week
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  const MealPrepPage = () => {
    const [viewMode, setViewMode] = useState(() => {
        if (typeof window !== 'undefined') {
            // Get the last selected tab from localStorage, default to 'mealprep' if none exists
            return localStorage.getItem('lastMealPrepTab') || 'mealprep';
          }
          // Return default value for server-side rendering
          return 'mealprep';
        });
    const [showDaySelector, setShowDaySelector] = useState(false);
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGroceryListSelector, setShowGroceryListSelector] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [groceryLists, setGroceryLists] = useState([]);
  
    // Update localStorage whenever viewMode changes
    useEffect(() => {
        // Check if localStorage is available
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastMealPrepTab', viewMode);
        }
      }, [viewMode]);

    const handleToggleDates = async (weekId) => {
        try {
          const response = await fetch(`${API_URL}/api/meal-prep/weeks/${weekId}/toggle-dates`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });
    
          if (!response.ok) throw new Error('Failed to toggle dates');
          await fetchWeeks(); // Refresh the weeks data
        } catch (error) {
          console.error('Error toggling dates:', error);
        }
      };

    
      const GroceryListSelector = ({ onClose }) => {
        const [step, setStep] = useState(1); // 1 for list selection, 2 for week selection
        const [groceryLists, setGroceryLists] = useState([]);
        const [selectedList, setSelectedList] = useState(null);
        const [selectedWeeks, setSelectedWeeks] = useState(new Set());
        const [loading, setLoading] = useState(true);
        const [importing, setImporting] = useState(false);
        const [error, setError] = useState(null);
        const [weeks, setWeeks] = useState([]);
      
        useEffect(() => {
          const fetchData = async () => {
            try {
              setLoading(true);
              const [groceryResponse, weeksResponse] = await Promise.all([
                fetch(`${API_URL}/api/grocery-lists`),
                fetch(`${API_URL}/api/meal-prep/weeks`)
              ]);
      
              if (!groceryResponse.ok || !weeksResponse.ok) {
                throw new Error('Failed to fetch data');
              }
      
              const groceryData = await groceryResponse.json();
              const weeksData = await weeksResponse.json();
      
              setGroceryLists(groceryData.lists || []);
              setWeeks(weeksData.weeks || []);
            } catch (err) {
              setError('Failed to load data');
            } finally {
              setLoading(false);
            }
          };
      
          fetchData();
        }, []);
      
        const handleWeekToggle = (weekId) => {
          const newSelected = new Set(selectedWeeks);
          if (newSelected.has(weekId)) {
            newSelected.delete(weekId);
          } else {
            newSelected.add(weekId);
          }
          setSelectedWeeks(newSelected);
        };
      
        const handleImport = async () => {
          if (!selectedList) return;
        
          try {
            setImporting(true);
        
            // Process each selected week
            for (const weekId of selectedWeeks) {
              const week = weeks.find(w => w.id === weekId);
              if (!week) continue;
        
              // Add week header
              try {
                await fetch(`${API_URL}/api/grocery-lists/${selectedList}/items`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    name: `### ${week.title || `Week of ${week.start_day}`} ###` 
                  }),
                });
              } catch (error) {
                console.error('Error adding week header:', error);
              }
        
              // Process each day's meals
              for (const [day, meals] of Object.entries(week.meal_plans)) {
                // Process each meal type (breakfast, lunch, dinner)
                for (const [mealType, mealsList] of Object.entries(meals)) {
                  for (const meal of mealsList) {
                    // Add recipe header
                    try {
                      await fetch(`${API_URL}/api/grocery-lists/${selectedList}/items`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: `**${meal.recipe_name}**` }),
                      });
                    } catch (error) {
                      console.error('Error adding recipe header:', error);
                    }
        
                    // Get and add recipe ingredients
                    try {
                      const recipeResponse = await fetch(`${API_URL}/api/recipe/${meal.recipe_id}/ingredients`);
                      const recipeData = await recipeResponse.json();
        
                      for (const ingredient of recipeData.ingredients) {
                        await fetch(`${API_URL}/api/grocery-lists/${selectedList}/items`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: `• ${ingredient.name}`,
                            quantity: ingredient.quantity,
                            unit: ingredient.unit,
                          }),
                        });
                      }
                    } catch (error) {
                      console.error('Error fetching recipe ingredients:', error);
                    }
                  }
                }
              }
            }
        
            onClose();
          } catch (err) {
            console.error('Error importing to grocery list:', err);
            setError('Failed to import to grocery list');
          } finally {
            setImporting(false);
          }
        };
      
        if (loading) {
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader className="animate-spin h-8 w-8 text-blue-600" />
                  <p className="text-gray-600">Loading...</p>
                </div>
              </div>
            </div>
          );
        }
      
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-[32rem] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {step === 1 ? 'Select Grocery List' : 'Select Weeks to Import'}
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
      
              {error && (
                <div className="mb-4 bg-red-100 text-red-600 p-3 rounded">
                  {error}
                </div>
              )}
      
              {step === 1 ? (
                <div className="space-y-2">
                  {groceryLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => {
                        setSelectedList(list.id);
                        setStep(2);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md flex items-center justify-between"
                    >
                      <span>{list.name}</span>
                      <span className="text-gray-400">→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-6">
                    {weeks.map((week) => (
                      <div
                        key={week.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{week.title || `Week of ${week.start_day}`}</p>
                          {week.start_date && (
                            <p className="text-sm text-gray-500">
                              {new Date(week.start_date).toLocaleDateString()} - {new Date(week.end_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleWeekToggle(week.id)}
                          className={`p-2 rounded-md ${
                            selectedWeeks.has(week.id)
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Check size={20} className={selectedWeeks.has(week.id) ? 'opacity-100' : 'opacity-0'} />
                        </button>
                      </div>
                    ))}
                  </div>
      
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={selectedWeeks.size === 0 || importing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2"
                    >
                      {importing ? (
                        <>
                          <Loader className="animate-spin h-4 w-4" />
                          Importing...
                        </>
                      ) : (
                        'Import Selected'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      };
      
      useEffect(() => {
        const fetchGroceryLists = async () => {
          try {
            const response = await fetchWithAuth(`${API_URL}/api/grocery-lists`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            });
            const data = await response.json();
            setGroceryLists(data.lists || []);
          } catch (error) {
            console.error('Error fetching grocery lists:', error);
          }
        };
      
        fetchGroceryLists();
      }, []);
    
  
    const fetchWeeks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/meal-prep/weeks`);
        const data = await response.json();
        setWeeks(data.weeks || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching weeks:', error);
        setLoading(false);
      }
    };
  
    useEffect(() => {
      if (viewMode === 'mealprep') {
        fetchWeeks();
      }
    }, [viewMode]);
  
    const handleDaySelect = async (weekData) => {
      try {
        const response = await fetch(`${API_URL}/api/meal-prep/weeks`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            start_day: weekData.day,
            title: weekData.title,
            start_date: weekData.startDate,
            end_date: weekData.endDate
          })
        });
    
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create week');
        }
    
        await fetchWeeks();
        setShowDaySelector(false);
      } catch (error) {
        console.error('Error creating week:', error);
        alert(error.message);
      }
    };
  
    const handleDeleteWeek = async (weekId) => {
      if (!confirm('Are you sure you want to delete this week?')) return;
  
      try {
        const response = await fetch(`${API_URL}/api/meal-prep/weeks/${weekId}`, {
          method: 'DELETE'
        });
  
        if (!response.ok) throw new Error('Failed to delete week');
        await fetchWeeks();
      } catch (error) {
        console.error('Error deleting week:', error);
      }
    };
  
    const handleDeleteMeal = async (weekId, day, mealType, recipeId) => {
      try {
        const response = await fetch(`${API_URL}/api/meal-prep/weeks/${weekId}/meals`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day,
            meal_type: mealType,
            recipe_id: recipeId
          })
        });
  
        if (!response.ok) throw new Error('Failed to delete meal');
        await fetchWeeks();
      } catch (error) {
        console.error('Error deleting meal:', error);
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Back
            </Link>
          </div>
        </nav>
  
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex gap-4 mb-6">
            <Link
    href="/menus"
    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
  >
    My Food
  </Link>
              <button
                onClick={() => setViewMode('mealprep')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'mealprep'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                My Meal Prep
              </button>
              <button
                onClick={() => setViewMode('workout')}
                className={`px-4 py-2 rounded-lg ${
                  viewMode === 'workout'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                My Exercises
              </button>
              <Link
  href="/gym"
  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-blue-600 hover:text-gray-100"
>
  My Workouts
</Link>
            </div>
  
            {viewMode === 'workout' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-3xl font-bold text-gray-900">My Exercises</h1>
                  <Link
                    href="/exercise-form"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    Add Exercises
                  </Link>
                </div>
                <ExerciseDisplay />
              </div>
            )}
             {viewMode === 'workouts' && (
        <div>
           <WorkoutDisplay />
         </div>
       )}
  
            {viewMode === 'mealprep' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-3xl font-bold text-gray-900">My Meal Prep</h1>
                  <button
                    onClick={() => setShowDaySelector(true)}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    <Plus size={20} />
                    Add A Week
                  </button>
                </div>
                <button
      onClick={() => {
        if (weeks.length === 0) {
          alert('No weeks available to import');
          return;
        }
        setSelectedWeek(weeks[0]);
        setShowGroceryListSelector(true);
      }}
      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
    >
      Import to Grocery List
    </button>
    {showGroceryListSelector && selectedWeek && (
  <GroceryListSelector
    isOpen={showGroceryListSelector}
    onClose={() => {
      setShowGroceryListSelector(false);
      setSelectedWeek(null);
    }}
    week={selectedWeek}
    groceryLists={groceryLists}
  />
)}
  

  
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-8">
                    {weeks.map((week) => (
                      <Week
                        key={week.id}
                        week={week}
                        onDeleteWeek={handleDeleteWeek}
                        onMealDelete={handleDeleteMeal}
                        onMealsAdded={fetchWeeks}
                        onToggleDates={handleToggleDates}  
                      />
                    ))}
                  </div>
                  
                )}
              </>
            )}
          </div>
  
          <DaySelector
            isOpen={showDaySelector}
            onClose={() => setShowDaySelector(false)}
            onDaySelect={handleDaySelect}
          />
        </div>
      </div>
    );
  
  };
  
  export default MealPrepPage;
    