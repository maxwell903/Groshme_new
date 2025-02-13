import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User } from 'lucide-react';


const Navigation = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Navigation links */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/" 
              className="text-blue-600 hover:text-blue-800"
            >
              Home
            </Link>
            <Link 
              href="/all-recipes"
              className="text-gray-600 hover:text-gray-800"
            >
              All Recipes
            </Link>
            <Link 
              href="/search"
              className="text-gray-600 hover:text-gray-800"
            >
              Search
            </Link>
            <Link 
              href="/add-recipe"
              className="text-gray-600 hover:text-gray-800"
            >
              Add Recipe
            </Link>
            <Link 
              href="/grocerylistId"
              className="text-gray-600 hover:text-gray-800"
            >
              Lists
            </Link>
            <Link 
              href="/my-fridge"
              className="text-gray-600 hover:text-gray-800"
            >
              Fridge
            </Link>
            <Link 
              href="/menus"
              className="text-gray-600 hover:text-gray-800"
            >
              Menus
            </Link>
            <Link 
              
              href="/meal-prep"
              
              className="text-gray-600 hover:text-gray-800"
            >
              Meal Plans
            </Link>
            <Link 
              href="/gym"
              className="text-gray-600 hover:text-gray-800"
            >
              Workouts
            </Link>
            <Link 
              
              href="/meal-prep?viewMode=workout"
              
              className="text-gray-600 hover:text-gray-800"
            >
              Sets
            </Link>
            <Link 
              href="/my-bills"
              className="text-gray-600 hover:text-gray-800"
            >
              Budgets
            </Link>
          </div>

          {/* Right side - User profile and sign out */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">{user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;