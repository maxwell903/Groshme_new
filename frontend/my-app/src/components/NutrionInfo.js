// First create a utility function for calculations
const calculateScaledNutrition = (nutrition, quantity, servingSize) => {
    if (!nutrition || !servingSize || servingSize === 0) return null;
    
    const ratio = quantity / servingSize;
    return {
      protein_grams: (parseFloat(nutrition.protein_grams || 0) * ratio).toFixed(1),
      fat_grams: (parseFloat(nutrition.fat_grams || 0) * ratio).toFixed(1),
      carbs_grams: (parseFloat(nutrition.carbs_grams || 0) * ratio).toFixed(1),
      serving_size: servingSize,
      serving_unit: nutrition.serving_unit
    };
  };
  
  const NutritionInfo = ({ nutrition, quantity }) => {
    if (!nutrition) return null;
    
    const scaledNutrition = calculateScaledNutrition(
      nutrition,
      quantity,
      nutrition.serving_size
    );
  
    if (!scaledNutrition) return null;
  
    return (
      <div className="text-sm text-gray-600 ml-6">
        <span>Protein: {scaledNutrition.protein_grams}g • </span>
        <span>Fat: {scaledNutrition.fat_grams}g • </span>
        <span>Carbs: {scaledNutrition.carbs_grams}g</span>
        <span className="text-gray-400 ml-2">
          (per {quantity} {nutrition.serving_unit})
        </span>
      </div>
    );
  };
  
  export default NutritionInfo;