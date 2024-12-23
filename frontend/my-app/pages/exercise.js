// pages/exercise.js
import React from 'react';
import Link from 'next/link';
import ExerciseDisplay from '../src/components/ExerciseDisplay';

const ExercisePage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/meal-prep" className="text-blue-600 hover:text-blue-800">
            ← Back to Meal Prep
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Exercises</h1>
          <Link
            href="/exercise-form"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Add Exercise
          </Link>
        </div>

        <ExerciseDisplay />
      </div>
    </div>
  );
};

export default ExercisePage;