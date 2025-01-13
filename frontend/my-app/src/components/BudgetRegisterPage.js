import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownRight,
  X,
  Filter,
  Search
} from 'lucide-react';
import BudgetHistoryStats from './BudgetHistoryStats';

// Main Budget Register List Component
const BudgetRegisterPage = () => {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'savings', 'spending'
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchRegisters();
  }, []);

  const fetchRegisters = async () => {
    try {
      const response = await fetch('/api/budget-register');
      const data = await response.json();
      setRegisters(data.registers);
    } catch (error) {
      console.error('Error fetching registers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getSortedRegisters = () => {
    const filtered = registers.filter(register =>
      register.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.from_date) - new Date(a.from_date);
          break;
        case 'savings':
          comparison = b.total_saved - a.total_saved;
          break;
        case 'spending':
          comparison = b.total_spent - a.total_spent;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <BudgetHistoryStats />
        
        {selectedRegister ? (
          <BudgetRegisterDetail 
            register={selectedRegister} 
            onClose={() => setSelectedRegister(null)} 
          />
        ) : (
          <Card className="bg-white shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold">Budget Register History</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search registers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <select
                      value={sortBy}
                      onChange={(e) => handleSort(e.target.value)}
                      className="border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="date">Date</option>
                      <option value="savings">Savings</option>
                      <option value="spending">Spending</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden">
                <div className="grid grid-cols-6 gap-4 py-3 px-4 bg-gray-50 rounded-t-lg font-medium text-sm text-gray-600">
                  <div className="col-span-2">Period</div>
                  <div>Budget</div>
                  <div>Spent</div>
                  <div>Saved</div>
                  <div></div>
                </div>
                <div className="divide-y">
                  {getSortedRegisters().map((register) => (
                    <div
                      key={register.id}
                      className="grid grid-cols-6 gap-4 py-4 px-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedRegister(register)}
                    >
                      <div className="col-span-2">
                        <div className="font-medium">{register.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(register.from_date)} - {formatDate(register.to_date)}
                        </div>
                      </div>
                      <div className="text-gray-900">{formatCurrency(register.total_budgeted)}</div>
                      <div className="text-red-600">{formatCurrency(register.total_spent)}</div>
                      <div className={register.total_saved >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(Math.abs(register.total_saved))}
                        {register.total_saved >= 0 ? (
                          <ArrowUpRight className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowDownRight className="inline h-4 w-4 ml-1" />
                        )}
                      </div>
                      <div className="flex justify-end">
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Detailed Budget Register View Component
const BudgetRegisterDetail = ({ register, onClose }) => {
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    fetchRegisterDetails();
  }, [register.id]);

  const fetchRegisterDetails = async () => {
    try {
      const response = await fetch(`/api/budget-register/${register.id}`);
      const data = await response.json();
      setDetails(data);
    } catch (error) {
      console.error('Error fetching register details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const toggleEntry = (entryId) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  if (loading || !details) {
    return (
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">Loading budget details...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTransactions = (transactions) => {
    return transactions && transactions.length > 0 ? (
      <div className="mt-2 space-y-2">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="grid grid-cols-3 gap-4 py-2 px-4 bg-gray-50 rounded-md text-sm"
          >
            <div>{formatDate(transaction.payment_date)}</div>
            <div className="text-gray-600">
              {transaction.title || (transaction.is_one_time ? 'One-time payment' : 'Regular payment')}
            </div>
            <div className="text-right font-medium">{formatCurrency(transaction.amount)}</div>
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-2 text-sm text-gray-500 italic">No transactions recorded</div>
    );
  };

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">{details.name}</CardTitle>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(details.from_date)} - {formatDate(details.to_date)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total Budgeted</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {formatCurrency(details.total_budgeted)}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600 font-medium">Total Spent</div>
            <div className="text-2xl font-bold text-red-700 mt-1">
              {formatCurrency(details.total_spent)}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Total Saved</div>
            <div className="text-2xl font-bold text-green-700 mt-1">
              {formatCurrency(details.total_saved)}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {details.entries.map((entry) => (
            <div key={entry.id} className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleEntry(entry.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedEntries.has(entry.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium">
                      {entry.title}
                      {entry.is_subaccount && (
                        <span className="ml-2 text-sm text-blue-600">Subaccount</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {entry.frequency} {entry.is_recurring && '(Recurring)'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-sm text-gray-500">Budget</div>
                    <div className="font-medium">{formatCurrency(entry.amount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Spent</div>
                    <div className="font-medium text-red-600">
                      {formatCurrency(entry.total_spent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Saved</div>
                    <div className={`font-medium ${
                      entry.total_saved >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Math.abs(entry.total_saved))}
                    </div>
                  </div>
                </div>
              </div>
              {expandedEntries.has(entry.id) && (
                <div className="border-t p-4 bg-gray-50">
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    Transaction History
                  </div>
                  {renderTransactions(entry.transactions)}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetRegisterPage;