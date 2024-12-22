import React from 'react';
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="w-full bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Brand/Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-white text-xl font-bold">
              Recipe Finder
            </Link>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            <Link 
              to="/recipes" 
              className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              View All Recipes
            </Link>
            <Link 
              to="/search" 
              className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
            >
              Search Recipes
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;