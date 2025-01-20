import React from 'react';
import { X } from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL

const DaySelectionModal = ({ isOpen, onClose, onDaySelect }) => {
  if (!isOpen) return null;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Select Day</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-2">
          {days.map((day) => (
            <button
              key={day}
              onClick={() => {
                onDaySelect(day);
                onClose();
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
            >
              {day}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DaySelectionModal;