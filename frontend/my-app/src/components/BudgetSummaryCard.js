import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Plus, Edit2 } from 'lucide-react';
import IncomeCalculatorModal from './IncomeCalculatorModal';
import ProfitLossCard from './ProfitLossCard';

const STORAGE_KEY = 'savedIncomeCalculations';

const BudgetSummaryCard = ({ entries }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [calculatedIncome, setCalculatedIncome] = useState(null);
  const [hasExistingCalculations, setHasExistingCalculations] = useState(false);

  // Load saved calculations from localStorage on component mount
  useEffect(() => {
    const savedCalculations = localStorage.getItem(STORAGE_KEY);
    if (savedCalculations) {
      const parsedCalculations = JSON.parse(savedCalculations);
      setCalculatedIncome(parsedCalculations);
      setHasExistingCalculations(true);
    }
  }, []);

  const summaryData = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    let yearlyTotal = 0;

    const processEntry = (entry) => {
      const amount = parseFloat(entry.amount) || 0;
      
      // Calculate total spent from transactions
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

    // If we have calculated income, use those values instead
    if (calculatedIncome) {
      weeklyTotal = calculatedIncome.weekly;
      monthlyTotal = calculatedIncome.monthly;
      yearlyTotal = calculatedIncome.yearly;
    }

    return {
      totalBudget: yearlyTotal,
      totalSpent,
      remaining: yearlyTotal - totalSpent,
      weekly: weeklyTotal,
      monthly: monthlyTotal,
      yearly: yearlyTotal
    };
  }, [entries, calculatedIncome]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleIncomeSubmit = (calculations) => {
    setCalculatedIncome(calculations);
    setHasExistingCalculations(true);
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculations));
    setShowIncomeModal(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Budget Summary</h2>
        <button
          onClick={() => setShowIncomeModal(true)}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          {hasExistingCalculations ? <Edit2 size={16} /> : <Plus size={16} />}
          {hasExistingCalculations ? 'Edit Income' : 'Add Income'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProfitLossCard summaryData={summaryData} />

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Clock size={20} />
            <span className="font-medium">Average Income</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-purple-700">
              <span>Daily:</span>
              <span className="font-semibold">{formatCurrency(summaryData.weekly / 7)}</span>
            </div>
            <div className="flex justify-between text-sm text-purple-700">
              <span>Weekly:</span>
              <span className="font-semibold">{formatCurrency(summaryData.weekly)}</span>
            </div>
            <div className="flex justify-between text-sm text-purple-700">
              <span>Monthly:</span>
              <span className="font-semibold">{formatCurrency(summaryData.monthly)}</span>
            </div>
            <div className="flex justify-between text-sm text-purple-700">
              <span>Yearly:</span>
              <span className="font-semibold">{formatCurrency(summaryData.yearly)}</span>
            </div>
          </div>
        </div>
      </div>

      <IncomeCalculatorModal
        isOpen={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
        onSubmit={handleIncomeSubmit}
        initialData={calculatedIncome}
      />
    </div>
  );
};

export default BudgetSummaryCard;