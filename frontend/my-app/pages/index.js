// pages/index.js

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Plus, X, Search, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { supabase } from '../src/lib/supabaseClient'
import { fetchApi, API_URL } from '@/utils/api';

import emailjs from '@emailjs/browser';


  




const GroceryListFormatter = ({ onFormat, onClose }) => {
  const [groceryLists, setGroceryLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroceryLists();
  }, []);

  const fetchGroceryLists = async () => {
    try {
      const response = await fetch(`${API_URL}/api/grocery-lists`);
      const data = await response.json();
      setGroceryLists(data.lists || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching grocery lists:', error);
      setLoading(false);
    }
  };

  const formatGroceryList = async (listId) => {
    try {
      const response = await fetch(`${API_URL}/api/grocery-lists/${listId}`);
      const data = await response.json();
      
      let emailText = `Grocery List: ${data.name}\n\n`;
      
      data.items.forEach(item => {
        if (item.name.startsWith('###') || item.name.startsWith('**')) {
          emailText += `\n${item.name}\n`;
        } else {
          emailText += `${item.name}: ${item.quantity} ${item.unit || ''}\n`;
        }
      });

      onFormat(emailText);
      onClose();
    } catch (error) {
      console.error('Error formatting grocery list:', error);
    }
  };

  if (loading) return <div className="p-4">Loading grocery lists...</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Select a Grocery List</h2>
      
      <div className="space-y-2 mb-6">
        {groceryLists.map(list => (
          <button
            key={list.id}
            onClick={() => formatGroceryList(list.id)}
            className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left"
          >
            <span>{list.name}</span>
            {selectedList === list.id && <Check size={16} className="text-green-600" />}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};



const WorkoutEmailFormatter = ({ onFormat, onClose }) => {
  const [workouts, setWorkouts] = useState({});
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/weekly-workouts`);
      const data = await response.json();
      setWorkouts(data.workouts || {});
      setLoading(false);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      setLoading(false);
    }
  };

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const formatWorkouts = () => {
    let emailText = "Weekly Workout Schedule:\n\n";

    selectedDays.forEach(day => {
      const dayWorkouts = workouts[day] || [];
      emailText += `${day}:\n`;
      
      dayWorkouts.forEach(exercise => {
        const latestSet = exercise.latestSet;
        emailText += `${exercise.name}\n`;
        emailText += `Last Top Set: ${latestSet ? `${latestSet.weight}lbs × ${latestSet.reps} reps` : 'No sets recorded'}\n`;
        emailText += `Target: ${exercise.amount_sets} sets × ${exercise.amount_reps} reps @ ${exercise.weight}lbs\n\n`;
      });
      
      emailText += '\n';
    });

    onFormat(emailText);
    onClose();
  };

  if (loading) return <div className="p-4">Loading workouts...</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Select Days to Include</h2>
      
      <div className="space-y-2 mb-6">
        {Object.keys(workouts).map(day => (
          <label key={day} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selectedDays.includes(day)}
              onChange={() => toggleDay(day)}
              className="rounded border-gray-300"
            />
            <span>{day}</span>
            {selectedDays.includes(day) && <Check size={16} className="text-green-600" />}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={formatWorkouts}
          disabled={selectedDays.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
        >
          Format Selected
        </button>
      </div>
    </div>
  );
};




const EmailToMyselfButton = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    body: ''
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showFormatter, setShowFormatter] = useState(false);
  const [showGroceryFormatter, setShowGroceryFormatter] = useState(false);

  // Initialize EmailJS
  emailjs.init("QqE08nkW6tzZt-BxE");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    
    try {
      const templateParams = {
        subject: formData.subject,
        message: formData.body,
        to_email: "maxwayne903@gmail.com", // The email where you want to receive messages
      };

      await emailjs.send(
        "service_5llnra5", //service ID
        "template_nqd74bz", //template ID
        templateParams
      );

      setSuccess('Email sent successfully!');
      setFormData({ subject: '', body: '' });
      
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 2000);

    } catch (error) {
      setError('Failed to send email. Please try again.');
      console.error('Send email error:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Email to Myself
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Send Email to Myself</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <button
              onClick={() => setShowFormatter(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mb-4"
            >
              Import Workouts
            </button>
            
            <button
              onClick={() => setShowGroceryFormatter(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 mb-4 ml-2"
            >
              Import Grocery List
            </button>

            {showFormatter && (
              <WorkoutEmailFormatter
                onFormat={(text) => setFormData(prev => ({...prev, body: text}))}
                onClose={() => setShowFormatter(false)}
              />
            )}
            
            {showGroceryFormatter && (
              <GroceryListFormatter
                onFormat={(text) => setFormData(prev => ({...prev, body: text}))}
                onClose={() => setShowGroceryFormatter(false)}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({...prev, subject: e.target.value}))}
                  className="w-full border rounded-md p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData(prev => ({...prev, body: e.target.value}))}
                  rows={6}
                  className="w-full border rounded-md p-2"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 text-green-600 p-3 rounded-md">
                  {success}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                  disabled={sending}
                >
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};





export default function Home() {


  const handleSignUp = async (e) => {
    e.preventDefault()
    const { email, password } = e.target.elements
    
    try {
      const { user, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
      })
      
      if (error) throw error
      
      // Create a new user record in the Supabase database
      await supabase.from('users').insert({ id: user.id, email: user.email })
    } catch (error) {
      console.error('Error signing up:', error)
    }
  }

  
  const router = useRouter();
  const [homeData, setHomeData] = useState({
    total_recipes: 0,
    latest_recipes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchApi('/api/home-data');
        console.log('Fetched data:', data); // Debug log
        setHomeData(data);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <p className="text-gray-600">Loading recipes...</p>
        </div>
      </div>
    );
  }




    
  

  

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative bg-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100" />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-900">
              Recipe Finder
            </h1>
            
            <p className="mb-8 text-gray-600">
              Total Recipes: {homeData.total_recipes}
            </p>
            
            
            <Link 
  href="/all-recipes"
  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
>
  My Recipes
</Link>
              <Link 
  href="/my-fridge"
  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
  onClick={() => localStorage.setItem('previousPath', '/')}
>
  My Food
</Link>

               <Link 
   href="/meal-prep"
   className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
   onClick={() => localStorage.setItem('previousPath', '/')}
 >
  My Fitness
 </Link>

              <Link 
                href="/grocery-bill"
                className="inline-block rounded-lg bg-gray-600 px-6 py-3 text-white hover:bg-yellow-700 transition-colors duration-200"
                onClick={() => localStorage.setItem('previousPath', '/')}
              >
                Grocery Bill
              </Link>
              <div className="mt-8">
          <EmailToMyselfButton />
        </div>
             
           

            {error && (
              <div className="mb-8 rounded-lg bg-green-100 p-4 text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Latest Recipes</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {homeData.latest_recipes.map((recipe) => (
  <Link 
    href={`/recipe/${recipe.id}`}
    key={recipe.id}
    className="block no-underline"
    onClick={() => {
      localStorage.setItem('actualPreviousPath', '/');
      localStorage.setItem('lastPath', '/');
    }}
  >
    <div className="rounded-lg bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer">
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{recipe.name}</h3>
      <p className="mb-4 text-gray-600">{recipe.description}</p>
      {/* Add Total Nutrition Information */}
      <p className="text-sm text-gray-500 mb-1">
        
        Protein: {recipe.total_nutrition?.protein_grams || 0}g • 
        Fat: {recipe.total_nutrition?.fat_grams || 0}g • 
        Carbs: {recipe.total_nutrition?.carbs_grams || 0}g
      </p>
      <p className="text-m text-gray-500">
        Prep time: {recipe.name} 
      </p>
      <div className="mt-4 text-green-600 hover:text-green-700">
        View Recipe →
      </div>
    </div>
  </Link>
  
))}
          </div>
        </div>
      </div>
    </div>
  );
}