import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Plus } from 'lucide-react';
import IncomeCalculatorModal from './IncomeCalculatorModal';
import ProfitLossCard from './ProfitLossCard';
import { fetchApi } from '@/utils/api'; 
const API_URL = process.env.NEXT_PUBLIC_API_URL


const AverageIncomeCard = ({ averageIncome, summaryData, isLoading, timeframe, onTimeframeChange }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const timeframeLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  };

  const calculations = React.useMemo(() => {
    if (!averageIncome) return null;

    const monthly = averageIncome.monthly;
    const totalSpent = summaryData.totalSpent || 0;
    const monthlyBudget = summaryData.monthly || 0;
    
    // Calculate for each timeframe
    const daily = {
      income: monthly / (7 * 4.33),
      budget: monthlyBudget / 30,
      spent: totalSpent / (4.33 * 7),
    };
    daily.projectedSaving = daily.income - daily.budget;
    daily.actualSaving = daily.income - daily.spent;

    const weekly = {
      income: averageIncome.weekly,
      budget: monthlyBudget * 12 / 52,
      spent: totalSpent / 4.33,
    };
    weekly.projectedSaving = weekly.income - weekly.budget;
    weekly.actualSaving = weekly.income - weekly.spent;

    const monthlyCalc = {
      income: monthly,
      budget: monthlyBudget,
      spent: totalSpent,
    };
    monthlyCalc.projectedSaving = monthlyCalc.income - monthlyCalc.budget;
    monthlyCalc.actualSaving = monthlyCalc.income - monthlyCalc.spent;

    const yearly = {
      income: monthly * 12,
      budget: monthlyBudget * 12,
      spent: totalSpent * 12,
    };
    yearly.projectedSaving = yearly.income - yearly.budget;
    yearly.actualSaving = yearly.income - yearly.spent;

    return {
      daily,
      weekly,
      monthly: monthlyCalc,
      yearly
    };
  }, [averageIncome, summaryData]);

  const currentTimeframe = calculations?.[timeframe];

  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <div className="flex items-center gap-2 text-purple-600 mb-4">
        <Clock size={20} />
        <span className="font-medium">Projected & Actual Savings</span>
      </div>

      <div className="flex gap-2 mb-4">
        {Object.keys(timeframeLabels).map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              timeframe === tf
                ? 'bg-purple-200 text-purple-700'
                : 'text-purple-600 hover:bg-purple-100'
            }`}
          >
            {timeframeLabels[tf]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500 py-4">
          Loading income data...
        </div>
      ) : currentTimeframe ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-purple-800">Projected Savings</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">Salary:</span>
                <span className="font-semibold text-purple-700">
                  {formatCurrency(currentTimeframe.income)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">- Budget:</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(currentTimeframe.budget)}
                </span>
              </div>
              <div className="pt-2 border-t border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">= Projected:</span>
                  <span className={`font-bold text-lg ${
                    currentTimeframe.projectedSaving >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.abs(currentTimeframe.projectedSaving))}
                    <span className="text-sm ml-1">
                      {currentTimeframe.projectedSaving >= 0 
                        ? '(Saving)' 
                        : '(Deficit)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-purple-800">Actual Savings</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">Salary:</span>
                <span className="font-semibold text-purple-700">
                  {formatCurrency(currentTimeframe.income)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">- Amount Spent:</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(currentTimeframe.spent)}
                </span>
              </div>
              <div className="pt-2 border-t border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">= Actual:</span>
                  <span className={`font-bold text-lg ${
                    currentTimeframe.actualSaving >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {formatCurrency(Math.abs(currentTimeframe.actualSaving))}
                    <span className="text-sm ml-1">
                      {currentTimeframe.actualSaving >= 0 ? '(Saving)' : '(Deficit)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-4">
          No salary information available
        </div>
      )}
    </div>
  );
};


const BudgetSummaryCard = ({ entries }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [realSalary, setRealSalary] = useState(null);
  const [averageIncome, setAverageIncome] = useState(null);
  const [loading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('monthly');

  useEffect(() => {
    const fetchRealSalary = async () => {
      try {
        // Use fetchApi instead of direct fetch
        const data = await fetchApi('/api/real-salary');
        if (data.salary) {
          setRealSalary(data.salary);
          // Use fetchApi for the calculation endpoint as well
          const calcData = await fetchApi('/api/real-salary/calculate');
          setAverageIncome(calcData.calculations);
        }
      } catch (error) {
        console.error('Error fetching salary data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealSalary();
  }, []);

  const summaryData = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    let yearlyTotal = 0;

    const processEntry = (entry) => {
      const amount = parseFloat(entry.amount) || 0;
      
      let entrySpent = 0;
      if (entry.transactions) {
        entrySpent = entry.transactions.reduce((sum, transaction) => 
          sum + (parseFloat(transaction.amount) || 0), 0);
      }
      
      totalSpent += entrySpent;

      switch (entry.frequency) {
        case 'weekly':
          weeklyTotal += amount;
          monthlyTotal += amount * 52 / 12;
          yearlyTotal += amount * 52;
          totalBudget += amount * 52;
          break;
        case 'biweekly':
          weeklyTotal += amount / 2;
          monthlyTotal += amount * 26 / 12;
          yearlyTotal += amount * 26;
          totalBudget += amount * 26;
          break;
        case 'monthly':
          weeklyTotal += amount;
          monthlyTotal += amount;
          yearlyTotal += amount * 12;
          totalBudget += amount * 12;
          break;
        case 'yearly':
          weeklyTotal += amount / 52;
          monthlyTotal += amount / 12;
          yearlyTotal += amount;
          totalBudget += amount;
          break;
      }

      if (entry.children && entry.children.length > 0) {
        entry.children.forEach(processEntry);
      }
    };

    entries.forEach(processEntry);

    return {
      totalBudget: yearlyTotal,
      totalSpent,
      remaining: yearlyTotal - totalSpent,
      weekly: weeklyTotal,
      monthly: monthlyTotal,
      yearly: yearlyTotal
    };
  }, [entries]);

  const handleIncomeSubmit = async (salaryData) => {
    try {
      setRealSalary(salaryData);
      // Use fetchApi here as well
      const calcData = await fetchApi('/api/real-salary/calculate');
      setAverageIncome(calcData.calculations);
      setShowIncomeModal(false);
    } catch (error) {
      console.error('Error updating salary calculations:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Budget Summary</h2>
        <button
          onClick={() => setShowIncomeModal(true)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          <Plus size={16} />
          Add Income
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProfitLossCard 
          summaryData={summaryData} 
          selectedTimeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />
        <AverageIncomeCard 
          averageIncome={averageIncome}
          summaryData={summaryData}
          isLoading={loading}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />
      </div>

      <IncomeCalculatorModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        onSubmit={handleIncomeSubmit}
      />
    </div>
  );
};

export default BudgetSummaryCard;