import React, { useState } from 'react';
import { X, Upload, Clipboard, FileText } from 'lucide-react';
const API_URL = process.env.NEXT_PUBLIC_API_URL


const DebugReceiptUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [receiptText, setReceiptText] = useState('');
  const [isPasting, setIsPasting] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (e) => {
    try {
      setIsLoading(true);
      setError(null);
      setDebugInfo(null);
      
      const file = e.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('receipt', file);
      
      const response = await fetch(`${API_URL}/api/parse-receipt-image`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      console.log('Response data:', data); // Debug log

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process receipt');
      }

      setDebugInfo(data);
      onUpload(data);
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to process receipt');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePastedText = async () => {
    if (!receiptText.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setDebugInfo(null);
      
      const response = await fetch(`${API_URL}/api/parse-receipt-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receipt_text: receiptText })
      });

      const data = await response.json();
      console.log('Response data:', data); // Debug log

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process receipt');
      }

      setDebugInfo(data);
      onUpload(data);
      
    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process receipt');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[800px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Upload Receipt</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tab buttons */}
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setIsPasting(true)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <Clipboard size={20} />
              <span>Paste Text</span>
            </button>
            <button
              onClick={() => setIsPasting(false)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                !isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <FileText size={20} />
              <span>Upload File</span>
            </button>
          </div>

          {/* Input section */}
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
                disabled={isLoading}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? 'Processing...' : 'Process Text'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*,.txt,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-red-700 font-medium mb-2">Error</h4>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {/* Debug info display */}
          {debugInfo && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-gray-700 font-medium mb-2">Processing Results</h4>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugReceiptUploadModal;