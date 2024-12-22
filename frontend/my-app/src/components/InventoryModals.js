import React from 'react';
import { X } from 'lucide-react';

export const ReceiptUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [receiptText, setReceiptText] = React.useState('');
  const [isPasting, setIsPasting] = React.useState(true);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      onUpload(text);
      onClose();
    }
  };

  const handlePastedText = () => {
    if (receiptText.trim()) {
      onUpload(receiptText);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Upload Receipt</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setIsPasting(true)}
              className={`px-4 py-2 rounded-lg ${
                isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Paste Text
            </button>
            <button
              onClick={() => setIsPasting(false)}
              className={`px-4 py-2 rounded-lg ${
                !isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Upload File
            </button>
          </div>

          {isPasting ? (
            <div className="space-y-4">
              <textarea
                value={receiptText}
                onChange={(e) => setReceiptText(e.target.value)}
                className="w-full h-64 border rounded-lg p-2"
                placeholder="Paste your receipt text here..."
              />
              <button
                onClick={handlePastedText}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Process Text
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const GroceryListModal = ({ isOpen, onClose, groceryLists, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Select Grocery List</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-2">
          {groceryLists.map((list) => (
            <button
              key={list.id}
              onClick={() => onSelect(list)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
            >
              {list.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};