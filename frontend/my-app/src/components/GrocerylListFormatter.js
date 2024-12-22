import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

const GroceryListFormatter = ({ onFormat, onClose }) => {
  const [groceryLists, setGroceryLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroceryLists();
  }, []);

  const fetchGroceryLists = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/grocery-lists');
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
      const response = await fetch(`http://localhost:5000/api/grocery-lists/${listId}`);
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

export default GroceryListFormatter;