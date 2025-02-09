import React, { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const ExerciseSearchModal = ({ isOpen, onClose, onExercisesSelected, weekId, day }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    workoutTypes: [],
    majorGroups: new Set(),
    minorGroups: new Set()
  });
  
  // Available filter options
  const [filterOptions, setFilterOptions] = useState({
    workoutTypes: ['Push', 'Pull', 'Legs', 'Cardio'],
    majorGroups: new Set(),
    minorGroups: new Set()
  });

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/exercises', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch exercises');
        
        const data = await response.json();
        setExercises(data.exercises);
        
        // Collect unique major and minor groups
        const majorGroups = new Set();
        const minorGroups = new Set();
        
        data.exercises.forEach(exercise => {
          exercise.major_groups.forEach(group => majorGroups.add(group));
          exercise.minor_groups.forEach(group => minorGroups.add(group));
        });
        
        setFilterOptions(prev => ({
          ...prev,
          majorGroups,
          minorGroups
        }));
        
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchExercises();
    }
  }, [isOpen]);

  useEffect(() => {
    let filtered = [...exercises];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(exercise => 
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply workout type filter
    if (filters.workoutTypes.length > 0) {
      filtered = filtered.filter(exercise => 
        filters.workoutTypes.includes(exercise.workout_type)
      );
    }
    
    // Apply major groups filter
    if (filters.majorGroups.size > 0) {
      filtered = filtered.filter(exercise => 
        exercise.major_groups.some(group => filters.majorGroups.has(group))
      );
    }
    
    // Apply minor groups filter
    if (filters.minorGroups.size > 0) {
      filtered = filtered.filter(exercise => 
        exercise.minor_groups.some(group => filters.minorGroups.has(group))
      );
    }
    
    setFilteredExercises(filtered);
  }, [searchTerm, filters, exercises]);

  const handleExerciseSelect = (exercise) => {
    setSelectedExercises(prev => {
      const isSelected = prev.some(e => e.id === exercise.id);
      if (isSelected) {
        return prev.filter(e => e.id !== exercise.id)
                  .map((e, idx) => ({ ...e, order: idx + 1 }));
      } else {
        return [...prev, { ...exercise, order: prev.length + 1 }];
      }
    });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/workout-weeks/${weekId}/exercises`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          day,
          exercises: selectedExercises.map(exercise => ({
            id: exercise.id,
            target_sets: exercise.amount_sets,
            target_reps: exercise.amount_reps,
            target_weight: exercise.weight,
            rest_time: exercise.rest_time
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to save exercises');
      
      onExercisesSelected();
      onClose();
    } catch (error) {
      setError(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[90vw] max-w-5xl max-h-[90vh] flex">
        {/* Selected Exercises Panel */}
        <div className="w-64 border-r pr-4 mr-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Selected Exercises</h3>
          <div className="space-y-2">
            {selectedExercises.map((exercise) => (
              <div 
                key={exercise.id}
                className="flex items-center justify-between bg-gray-50 p-2 rounded"
              >
                <span className="font-medium mr-2">{exercise.order}.</span>
                <span className="flex-1">{exercise.name}</span>
                <button
                  onClick={() => handleExerciseSelect(exercise)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main Search and Filter Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Search Exercises</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full border rounded-md p-2"
            />
          </div>

          {/* Filters */}
          <div className="mb-4 space-y-4">
            {/* Workout Type Filter */}
            <div>
              <h3 className="font-medium mb-2">Workout Type</h3>
              <div className="flex flex-wrap gap-2">
                {filterOptions.workoutTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      workoutTypes: prev.workoutTypes.includes(type)
                        ? prev.workoutTypes.filter(t => t !== type)
                        : [...prev.workoutTypes, type]
                    }))}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.workoutTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Major Groups Filter */}
            <div>
              <h3 className="font-medium mb-2">Major Muscle Groups</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(filterOptions.majorGroups).map(group => (
                  <button
                    key={group}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      majorGroups: new Set(
                        prev.majorGroups.has(group)
                          ? Array.from(prev.majorGroups).filter(g => g !== group)
                          : [...prev.majorGroups, group]
                      )
                    }))}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.majorGroups.has(group)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Minor Groups Filter */}
            <div>
              <h3 className="font-medium mb-2">Minor Muscle Groups</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(filterOptions.minorGroups).map(group => (
                  <button
                    key={group}
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      minorGroups: new Set(
                        prev.minorGroups.has(group)
                          ? Array.from(prev.minorGroups).filter(g => g !== group)
                          : [...prev.minorGroups, group]
                      )
                    }))}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.minorGroups.has(group)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">Loading exercises...</div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredExercises.map((exercise) => {
                  const isSelected = selectedExercises.some(e => e.id === exercise.id);
                  const selectedOrder = selectedExercises.find(e => e.id === exercise.id)?.order;
                  
                  return (
                    <div
                      key={exercise.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => handleExerciseSelect(exercise)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{exercise.name}</h3>
                          <p className="text-sm text-gray-600">{exercise.workout_type}</p>
                          <p className="text-sm text-gray-500">
                            {exercise.amount_sets} sets × {exercise.amount_reps} reps
                          </p>
                        </div>
                        {isSelected && (
                          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-medium">
                            {selectedOrder}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedExercises.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
            >
              <Plus size={20} />
              Add Selected ({selectedExercises.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseSearchModal;