

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, PieChart, Calendar } from 'lucide-react';
import _ from 'lodash';

const BudgetHistoryStats = ({ currentBudgetData }) => {
  const [budgetRegisters, setBudgetRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('6m');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBudgetHistory = async () => {
      try {
        const response = await fetch('https://groshmebeta-05487aa160b2.herokuapp.com/api/budget-register', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch budget history');
        }

        const data = await response.json();
        if (!data.registers) {
          throw new Error('Invalid data format received');
        }

        setBudgetRegisters(data.registers.sort((a, b) => 
          new Date(b.from_date) - new Date(a.from_date)
        ));
      } catch (error) {
        console.error('Error fetching budget history:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBudgetHistory();
  }, []);

  const timeframeFilters = {
    '3m': 3,
    '6m': 6,
    '1y': 12,
    'all': Infinity
  };

  const getFilteredRegisters = () => {
    if (!budgetRegisters.length) return [];
    
    const months = timeframeFilters[selectedTimeframe];
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    return budgetRegisters.filter(register => 
      new Date(register.from_date) >= cutoffDate
    );
  };

  const statistics = useMemo(() => {
    const filteredRegisters = getFilteredRegisters();
    if (!filteredRegisters.length) return null;

    const latest = filteredRegisters[0];
    const previous = filteredRegisters[1];

    // Calculate trends and changes
    const spendingTrend = previous ? 
      ((latest.total_spent - previous.total_spent) / previous.total_spent) * 100 : 0;
    
    const savingsTrend = previous ?
      ((latest.total_saved - previous.total_saved) / previous.total_saved) * 100 : 0;

    // Calculate averages
    const avgSpending = _.meanBy(filteredRegisters, 'total_spent') || 0;
    const avgSavings = _.meanBy(filteredRegisters, 'total_saved') || 0;
    const avgBudget = _.meanBy(filteredRegisters, 'total_budgeted') || 0;

    // Calculate spending patterns
    const spendingData = filteredRegisters.map(register => ({
      date: new Date(register.from_date).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      }),
      spent: register.total_spent || 0,
      saved: register.total_saved || 0,
      budgeted: register.total_budgeted || 0
    })).reverse();

    // Calculate best and worst months
    const bestSavingsMonth = _.maxBy(filteredRegisters, 'total_saved') || latest;
    const worstSavingsMonth = _.minBy(filteredRegisters, 'total_saved') || latest;

    return {
      current: {
        spent: latest.total_spent || 0,
        saved: latest.total_saved || 0,
        budgeted: latest.total_budgeted || 0
      },
      trends: {
        spending: spendingTrend || 0,
        savings: savingsTrend || 0
      },
      averages: {
        spending: avgSpending,
        savings: avgSavings,
        budget: avgBudget
      },
      patterns: spendingData,
      bestWorst: {
        best: bestSavingsMonth,
        worst: worstSavingsMonth
      }
    };
  }, [budgetRegisters, selectedTimeframe]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (error) {
    return (
      <Card className="w-full bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48 text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading || !statistics) {
    return (
      <Card className="w-full bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="text-gray-500">Loading statistics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full bg-white shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Budget History Analytics</CardTitle>
          <div className="flex gap-2">
            {Object.keys(timeframeFilters).map(timeframe => (
              <button
                key={timeframe}
                onClick={() => setSelectedTimeframe(timeframe)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedTimeframe === timeframe
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {timeframe.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current Period Stats */}
              <Card className="p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Current Period</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Spent:</span>
                    <span className="font-semibold text-red-600">{formatCurrency(statistics.current.spent)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Saved:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(statistics.current.saved)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Budgeted:</span>
                    <span className="font-semibold">{formatCurrency(statistics.current.budgeted)}</span>
                  </div>
                </div>
              </Card>

              {/* Average Stats */}
              <Card className="p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Period Averages</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg. Spending:</span>
                    <span className="font-semibold text-red-600">{formatCurrency(statistics.averages.spending)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg. Savings:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(statistics.averages.savings)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Avg. Budget:</span>
                    <span className="font-semibold">{formatCurrency(statistics.averages.budget)}</span>
                  </div>
                </div>
              </Card>

              {/* Trends */}
              <Card className="p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Trends</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Spending Trend:</span>
                    <div className="flex items-center gap-1">
                      {statistics.trends.spending > 0 ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`font-semibold ${
                        statistics.trends.spending > 0 ? 'text-red-500' : 'text-green-500'
                      }`}>
                        {Math.abs(statistics.trends.spending).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Savings Trend:</span>
                    <div className="flex items-center gap-1">
                      {statistics.trends.savings > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`font-semibold ${
                        statistics.trends.savings > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {Math.abs(statistics.trends.savings).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statistics.patterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="spent" stroke="#ef4444" name="Spent" />
                  <Line type="monotone" dataKey="saved" stroke="#22c55e" name="Saved" />
                  <Line type="monotone" dataKey="budgeted" stroke="#3b82f6" name="Budgeted" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="patterns">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Best Savings Period</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {new Date(statistics.bestWorst.best.from_date).toLocaleDateString()} - 
                      {new Date(statistics.bestWorst.best.to_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Saved:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(statistics.bestWorst.best.total_saved)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Spent:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(statistics.bestWorst.best.total_spent)}
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Lowest Savings Period</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">
                      {new Date(statistics.bestWorst.worst.from_date).toLocaleDateString()} - 
                      {new Date(statistics.bestWorst.worst.to_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Saved:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(statistics.bestWorst.worst.total_saved)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Spent:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(statistics.bestWorst.worst.total_spent)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BudgetHistoryStats;