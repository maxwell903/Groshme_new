import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Upload, X, FileText, Clipboard, ChevronDown, AlertCircle, Loader, ArrowLeft } from 'lucide-react';
import DebugReceiptUploadModal from '../src/components/DebugReceiptUploadModal';
import { words } from 'lodash';


// Keep the existing EditableRow component exactly as is
const EditableRow = ({ item, onUpdate, isEven }) => {
  const [localData, setLocalData] = useState({
    quantity: item.quantity || 0,
    unit: item.unit || '',
    price_per: item.price_per || 0,
    total: item.total || 0
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const total = localData.quantity * localData.price_per;
    setLocalData(prev => ({ ...prev, total }));
  }, [localData.quantity, localData.price_per]);

  const handleUpdate = async (field, value) => {
    try {
      setIsUpdating(true);
      const updatedData = { ...localData, [field]: value };
      
      if (field === 'quantity' || field === 'price_per') {
        updatedData.total = updatedData.quantity * updatedData.price_per;
      }

      const response = await fetch(`http://localhost:5000/api/grocery-lists/${item.list_id}/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) throw new Error('Failed to update item');
      setLocalData(updatedData);
      onUpdate(item.id, updatedData);
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <tr className={`border-b ${isEven ? 'bg-gray-50' : ''}`}>
      <td className="py-2 px-4">{item.name}</td>
      <td className="py-2 px-4">
        <input
          type="number"
          value={localData.quantity}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            setLocalData(prev => ({
              ...prev,
              quantity: value,
              total: value * prev.price_per
            }));
          }}
          onBlur={(e) => handleUpdate('quantity', parseFloat(e.target.value) || 0)}
          className="w-20 p-1 border rounded text-right"
          min="0"
          step="1"
          disabled={isUpdating}
        />
      </td>
      <td className="py-2 px-4">
        <input
          type="text"
          value={localData.unit}
          onChange={(e) => setLocalData(prev => ({ ...prev, unit: e.target.value }))}
          onBlur={(e) => handleUpdate('unit', e.target.value)}
          className="w-20 p-1 border rounded"
          disabled={isUpdating}
        />
      </td>
      <td className="py-2 px-4">
        <input
          type="number"
          value={localData.price_per}
          onChange={(e) => {
            const value = parseFloat(e.target.value) || 0;
            setLocalData(prev => ({
              ...prev,
              price_per: value,
              total: prev.quantity * value
            }));
          }}
          onBlur={(e) => handleUpdate('price_per', parseFloat(e.target.value) || 0)}
          className="w-24 p-1 border rounded text-right"
          min="0"
          step="0.01"
          disabled={isUpdating}
        />
      </td>
      <td className="py-2 px-4 text-right">
        ${localData.total.toFixed(2)}
      </td>
    </tr>
  );
};

// Add Receipt Upload Modal Component
const ReceiptUploadModal = ({ isOpen, onClose, handleParsedResults, handleError }) => {
  const [receiptText, setReceiptText] = useState('');
  const [isPasting, setIsPasting] = useState(true);
  const [preview, setPreview] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  
const processReceiptData = (text) => {
  const lines = text.split('\n');
  const items = new Map();
  let totalSavings = 0;

  // Common brand prefixes to remove
  const brandPrefixes = new Set(['KRO', 'KROGER', 'SMRTWY', 'XRO', 'HTGF']);
  
  const cleanItemName = (name) => {
    // Split into words
    let nameWords = words(name);
    
    // Remove brand prefix if first word matches
    if (brandPrefixes.has(nameWords[0])) {
      nameWords = nameWords.slice(1);
    }
    
    // Handle common abbreviations
    const abbreviations = {
      
        // Common product descriptors
        'SHRD': 'SHREDDED',
        'SHRED': 'SHREDDED',
        'CINNAMN': 'CINNAMON',
        'RLS': 'ROLLS',
        'BRST': 'BREAST',
        'SR': 'SOUR',
        'CRM': 'CREAM',
        'CHK': 'CHICKEN',
        'BF': 'BEEF',
        'GRND': 'GROUND',
        'TSTD': 'TOASTED',
        'SWTN': 'SWEETENED',
        'UNSWT': 'UNSWEETENED',
        'WHL': 'WHOLE',
        'PEPR': 'PEPPER',
        'VEG': 'VEGETABLE',
        'VEGS': 'VEGETABLES',
        'FRT': 'FRUIT',
        'FRTS': 'FRUITS',
        'YOG': 'YOGURT',
        'ORGN': 'ORGANIC',
        'SNGL': 'SINGLE',
        'SGLE': 'SINGLE',
        
        // Unit abbreviations
        'PKG': 'PACKAGE',
        'PKGS': 'PACKAGES',
        'CTN': 'CARTON',
        'DOZ': 'DOZEN',
        'LBS': 'POUNDS',
        'OZS': 'OUNCES',
        'GAL': 'GALLON',
        'QT': 'QUART',
        'PT': 'PINT',
        
        // Common food terms
        'CHDR': 'CHEDDAR',
        'MOZZ': 'MOZZARELLA',
        'PARM': 'PARMESAN',
        'TOM': 'TOMATO',
        'TOMS': 'TOMATOES',
        'POT': 'POTATO',
        'POTS': 'POTATOES',
        'CARR': 'CARROT',
        'CRRS': 'CARROTS',
        'ONS': 'ONIONS',
        'BNS': 'BEANS',
        'BCON': 'BACON',
        'SAUS': 'SAUSAGE',
        'TKY': 'TURKEY',
        'HAM': 'HAMBURGER',
        
        // Preparation/style
        'FRZ': 'FROZEN',
        'FRZN': 'FROZEN',
        'FRS': 'FRESH',
        'FRSH': 'FRESH',
        'SFT': 'SOFT',
        'HRD': 'HARD',
        'LRG': 'LARGE',
        'MED': 'MEDIUM',
        'SML': 'SMALL',
        
        // Container/packaging
        'BTL': 'BOTTLE',
        'BTLS': 'BOTTLES',
        'CAN': 'CANNED',
        'CNS': 'CANS',
        'BOX': 'BOXED',
        'BXS': 'BOXES',
        'BAG': 'BAGGED',
        'BGS': 'BAGS',
        
        // Colors/varieties
        'WHT': 'WHITE',
        'BLK': 'BLACK',
        'BRN': 'BROWN',
        'GRN': 'GREEN',
        'YLW': 'YELLOW',
        'RED': 'RED',
        
        // Common qualifiers
        'LT': 'LIGHT',
        'DK': 'DARK',
        'NAT': 'NATURAL',
        'ORIG': 'ORIGINAL',
        'TRAD': 'TRADITIONAL',
        'REG': 'REGULAR',
        'XTR': 'EXTRA',
        'XTRA': 'EXTRA',
        'SPL': 'SPECIAL',
        'PREM': 'PREMIUM'
      
    };

    // Expand any abbreviated words
    nameWords = nameWords.map(word => abbreviations[word] || word);
    
    // Remove common unit/location markers
    nameWords = nameWords.filter(word => 
      !['PC', 'FO', 'PL', 'B', 'F', 'T'].includes(word)
    );
    
    return nameWords.join(' ').trim();
  };

  // Process lines in pairs/groups
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';
    
    // Handle Kroger Savings
    if (currentLine.includes('KROGER SAVINGS')) {
      const savingsMatch = nextLine.match(/(\d+\.\d+)/);
      if (savingsMatch) {
        totalSavings += parseFloat(savingsMatch[1]);
        i++;
        continue;
      }
    }

    // Skip non-item lines
    if (currentLine.match(/^(SC|TAX|BALANCE|AID:|TC:|REF#:|CHANGE|VERIFIED|MASTERCARD)/i)) {
      continue;
    }

    // Look for price pattern on next line
    const priceMatch = nextLine.match(/(\d+\.\d+)\s*[FB6T]/);
    if (priceMatch) {
      let name = currentLine;
      let unit = '';
      
      // Handle multi-part names with units
      const pkMatch = currentLine.match(/^(.+?)\s+(\d+PK)$/i);
      if (pkMatch) {
        name = pkMatch[1];
        unit = pkMatch[2];
      }

      // Clean up the item name
      name = cleanItemName(name);

      // Only add if we have a valid name after cleaning
      if (name) {
        const itemKey = `${name}-${unit}-${priceMatch[1]}`;
        if (items.has(itemKey)) {
          items.get(itemKey).quantity += 1;
        } else {
          items.set(itemKey, {
            name: name,
            unit: unit,
            price_per: parseFloat(priceMatch[1]),
            quantity: 1
          });
        }
      }
      
      i++; // Skip price line
    }
  }

  // Add total savings
  if (totalSavings > 0) {
    items.set('total-savings', {
      name: 'Total Kroger Savings',
      unit: '',
      price_per: totalSavings,
      quantity: 1
    });
  }
  
  return Array.from(items.values()).filter(item => 
    item.name && 
    item.price_per > 0 &&
    !item.name.match(/^\d+\.\d+$/)
  );
};

  const handleImport = async () => {
    if (!extractedText) return;
    
    try {
      setIsImporting(true);
      const items = processReceiptData(extractedText);
      
      console.log('About to process receipt data');
      console.log('Extracted Text:', extractedText);
      console.log('Processed Items:', items);
  
      // First check if we have items to send
      if (!items || items.length === 0) {
        throw new Error('No items found in receipt');
      }
  
      // Log the request before sending
      console.log('Sending POST request with data:', {
        url: 'http://localhost:5000/api/grocery-bill/import',
        body: { items }
      });
  
      const response = await fetch('http://localhost:5000/api/grocery-bill/import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ items })
      });
  
      // Log the raw response
      console.log('Raw response:', response);
  
      // Get response text first to debug potential JSON parse errors
      const responseText = await response.text();
      console.log('Response text:', responseText);
  
      if (!response.ok) {
        // Try to parse error message if it's JSON
        let errorMessage = 'Failed to import items to grocery bill';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.log('Response was not JSON:', responseText);
        }
        throw new Error(errorMessage);
      }
  
      alert('Successfully imported items to grocery bill');
      onClose();
    } catch (error) {
      console.error('Full error details:', error);
      console.error('Error stack:', error.stack);
      handleError(error.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await fetch('http://localhost:5000/api/parse-receipt-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process receipt image');
      }

      const data = await response.json();
      setPreview(URL.createObjectURL(file));
      setExtractedText(data.text);
      handleParsedResults(data);

    } catch (error) {
      console.error('Error processing receipt:', error);
      handleError(error.message);
    }
  };

  const handlePastedText = async () => {
    if (!receiptText.trim()) return;
    try {
      const response = await fetch('http://localhost:5000/api/grocery-bill/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt_text: receiptText })
      });

      if (!response.ok) {
        throw new Error('Failed to parse receipt text');
      }

      const data = await response.json();
      setExtractedText(receiptText);
      handleParsedResults(data);
    } catch (error) {
      console.error('Error parsing receipt:', error);
      handleError(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Upload Receipt</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setIsPasting(true)}
              className={`px-4 py-2 rounded-lg ${isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Paste Text
            </button>
            <button
              onClick={() => setIsPasting(false)}
              className={`px-4 py-2 rounded-lg ${!isPasting ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Upload Image
            </button>
          </div>

          {isPasting ? (
            <div>
              <textarea
                value={receiptText}
                onChange={(e) => setReceiptText(e.target.value)}
                className="w-full h-64 border rounded-lg p-2"
                placeholder="Paste your receipt text here..."
              />
              <button
                onClick={handlePastedText}
                className="w-full py-2 bg-blue-600 text-white rounded-lg mt-4"
              >
                Process Text
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {preview ? (
                  <div className="space-y-4">
                    <img src={preview} alt="Receipt preview" className="max-h-64 mx-auto"/>
                    <button
                      onClick={() => {
                        setPreview(null);
                        setExtractedText('');
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="receipt-upload"
                    />
                    <label
                      htmlFor="receipt-upload"
                      className="cursor-pointer text-blue-600 hover:text-blue-700"
                    >
                      Click to upload receipt image
                    </label>
                  </div>
                )}
              </div>

              {extractedText && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Extracted Text:</h4>
                  <pre className="whitespace-pre-wrap text-sm">{extractedText}</pre>
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="w-full mt-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400"
                  >
                    {isImporting ? 'Importing...' : 'Import to Grocery Bill'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Modify the main GroceryBill component
const GroceryBill = () => {
  const [billItems, setBillItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchGroceryBill();
  }, []);

  const fetchGroceryBill = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/grocery-bill');
      if (!response.ok) {
        throw new Error('Failed to fetch grocery bill');
      }
      const data = await response.json();
      setBillItems(data.items || []);
    } catch (error) {
      setError('Failed to fetch grocery bill');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return billItems.reduce((sum, item) => sum + (item.quantity * item.price_per), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
              Back
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Grocery Bill</h1>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Item</th>
                  <th className="text-center py-2 px-4">Quantity</th>
                  <th className="text-center py-2 px-4">Unit</th>
                  <th className="text-center py-2 px-4">Price Per</th>
                  <th className="text-right py-2 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="py-2 px-4">{item.name}</td>
                    <td className="py-2 px-4 text-center">{item.quantity}</td>
                    <td className="py-2 px-4 text-center">{item.unit || '-'}</td>
                    <td className="py-2 px-4 text-center">${item.price_per.toFixed(2)}</td>
                    <td className="py-2 px-4 text-right">
                      ${(item.quantity * item.price_per).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan="4" className="py-2 px-4 text-right">Total:</td>
                  <td className="py-2 px-4 text-right">${calculateTotal().toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroceryBill;