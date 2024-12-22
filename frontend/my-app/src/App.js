import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import RecipeSearch from './components/RecipeSearch'; // Your existing search component
import AllRecipes from './components/AllRecipes';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/recipes" element={<AllRecipes />} />
            <Route path="/search" element={<RecipeSearch />} />
            <Route path="/" element={<RecipeSearch />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;