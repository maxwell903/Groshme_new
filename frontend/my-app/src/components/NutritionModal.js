import React, { useState, useEffect, useCallback } from 'react';

const NutritionModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  ingredientName,
  ingredientIndex,
  currentNutrition,
  ingredientQuantity
}) => {
  const [nutritionData, setNutritionData] = useState({
    protein_grams: '',
    fat_grams: '',
    carbs_grams: '',
    serving_size: '',
    serving_unit: ''
  });

  const [displayedNutrition, setDisplayedNutrition] = useState({
    protein_grams: '',
    fat_grams: '',
    carbs_grams: ''
  });

  // Move calculateDisplayedValues to useCallback
  const calculateDisplayedValues = useCallback((data) => {
    if (!data.serving_size || data.serving_size === '0' || !ingredientQuantity) return;

    const ratio = ingredientQuantity / parseFloat(data.serving_size);
    setDisplayedNutrition({
      protein_grams: (parseFloat(data.protein_grams || 0) * ratio).toFixed(1),
      fat_grams: (parseFloat(data.fat_grams || 0) * ratio).toFixed(1),
      carbs_grams: (parseFloat(data.carbs_grams || 0) * ratio).toFixed(1)
    });
  }, [ingredientQuantity]);

  useEffect(() => {
    if (currentNutrition) {
      const parsedNutrition = {
        protein_grams: currentNutrition.protein_grams?.toString() || '',
        fat_grams: currentNutrition.fat_grams?.toString() || '',
        carbs_grams: currentNutrition.carbs_grams?.toString() || '',
        serving_size: currentNutrition.serving_size?.toString() || '',
        serving_unit: currentNutrition.serving_unit || ''
      };
      setNutritionData(parsedNutrition);
      calculateDisplayedValues(parsedNutrition);
    } else {
      setNutritionData({
        protein_grams: '',
        fat_grams: '',
        carbs_grams: '',
        serving_size: '',
        serving_unit: ''
      });
      setDisplayedNutrition({
        protein_grams: '',
        fat_grams: '',
        carbs_grams: ''
      });
    }
  }, [currentNutrition, calculateDisplayedValues]);

  const handleInputChange = (key, value) => {
    const updatedData = {
      ...nutritionData,
      [key]: value
    };
    setNutritionData(updatedData);
    calculateDisplayedValues(updatedData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formattedData = {
      ingredientIndex,
      protein_grams: parseFloat(nutritionData.protein_grams) || 0,
      fat_grams: parseFloat(nutritionData.fat_grams) || 0,
      carbs_grams: parseFloat(nutritionData.carbs_grams) || 0,
      serving_size: parseFloat(nutritionData.serving_size) || 0,
      serving_unit: nutritionData.serving_unit || ''
    };
    onSubmit(formattedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {currentNutrition ? 'Edit' : 'Add'} Nutrition Information for {ingredientName}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Protein (g)', key: 'protein_grams' },
              { label: 'Fat (g)', key: 'fat_grams' },
              { label: 'Carbs (g)', key: 'carbs_grams' },
              { label: 'Serving Size', key: 'serving_size' }
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={nutritionData[key]}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2"
                  placeholder="0.0"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serving Unit
            </label>
            <input
              type="text"
              value={nutritionData.serving_unit}
              onChange={(e) => handleInputChange('serving_unit', e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="e.g., grams, cups, oz"
            />
          </div>

          {nutritionData.serving_size && ingredientQuantity && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Calculated Nutrition Values:</h3>
              <div className="space-y-1 text-sm">
                <p>Protein: {displayedNutrition.protein_grams}g</p>
                <p>Fat: {displayedNutrition.fat_grams}g</p>
                <p>Carbs: {displayedNutrition.carbs_grams}g</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Save Nutrition Info
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NutritionModal;