// src/pages/add-recipe.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { fetchWithAuth } from '@/utils/fetch';

const AddRecipe = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backPath, setBackPath] = useState('/');
  const [recipe, setRecipe] = useState({
    name: '',
    description: '',
    instructions: '',
    prep_time: '',
    ingredients: [{ name: '', quantity: '', unit: '' }]
  });

  useEffect(() => {
    const prevPath = localStorage.getItem('previousPath') || '/';
    setBackPath(prevPath);
  }, []);

  const validateIngredients = (ingredients) => {
    return ingredients.every(ingredient => 
      ingredient.name.trim() !== '' && 
      !isNaN(ingredient.quantity) && 
      ingredient.quantity > 0
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate ingredients
      if (!validateIngredients(recipe.ingredients)) {
        throw new Error('Please fill in all ingredient fields with valid values');
      }

      // Create the recipe payload
      const recipePayload = {
        name: recipe.name.trim(),
        description: recipe.description.trim(),
        instructions: recipe.instructions.trim(),
        prep_time: parseInt(recipe.prep_time),
        ingredients: recipe.ingredients.map(ingredient => ({
          name: ingredient.name.trim(),
          quantity: parseFloat(ingredient.quantity),
          unit: ingredient.unit.trim()
        })).filter(ingredient => ingredient.name !== '')
      };

      // Validate that there is at least one ingredient
      if (recipePayload.ingredients.length === 0) {
        throw new Error('At least one ingredient is required');
      }

      // Send the authenticated request
      await fetchWithAuth('/api/recipe', {
        method: 'POST',
        body: JSON.stringify(recipePayload)
      });

      // If successful, redirect to all recipes
      router.push('/all-recipes');
    } catch (err) {
      console.error('Error adding recipe:', err);
      setError(err.message || 'Failed to add recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...recipe.ingredients];
    newIngredients[index] = {
      ...newIngredients[index],
      [field]: value
    };
    setRecipe({ ...recipe, ingredients: newIngredients });
  };

  const addIngredientField = () => {
    setRecipe({
      ...recipe,
      ingredients: [...recipe.ingredients, { name: '', quantity: '', unit: '' }]
    });
  };

  const removeIngredientField = (index) => {
    // Don't remove if it's the last ingredient
    if (recipe.ingredients.length === 1) {
      return;
    }
    const newIngredients = recipe.ingredients.filter((_, i) => i !== index);
    setRecipe({ ...recipe, ingredients: newIngredients });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Add New Recipe</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Recipe Name
              </label>
              <input
                type="text"
                id="name"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                value={recipe.name}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                required
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                value={recipe.description}
                onChange={(e) => setRecipe({ ...recipe, description: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700">
                Instructions
              </label>
              <textarea
                id="instructions"
                required
                rows={5}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                value={recipe.instructions}
                onChange={(e) => setRecipe({ ...recipe, instructions: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="prep_time" className="block text-sm font-medium text-gray-700">
                Preparation Time (minutes)
              </label>
              <input
                type="number"
                id="prep_time"
                required
                min="1"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                value={recipe.prep_time}
                onChange={(e) => setRecipe({ ...recipe, prep_time: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients</label>
              <div className="space-y-2">
                {recipe.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                        value={ingredient.name}
                        onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                        placeholder="Enter ingredient"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                        value={ingredient.quantity}
                        onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                        placeholder="Qty"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                        value={ingredient.unit}
                        onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                        placeholder="Unit"
                      />
                    </div>
                    
                    {recipe.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredientField(index)}
                        className="rounded-md bg-red-100 px-3 py-2 text-red-700 hover:bg-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addIngredientField}
                className="mt-2 rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
              >
                Add Ingredient
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-100 p-4 text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? 'Adding Recipe...' : 'Add Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddRecipe;