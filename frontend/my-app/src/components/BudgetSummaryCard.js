import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Plus } from 'lucide-react';
import IncomeCalculatorModal from './IncomeCalculatorModal';
import ProfitLossCard from './ProfitLossCard';

const BudgetSummaryCard = ({ entries }) => {
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [salaryData, setSalaryData] = useState(null);
  const [salaryCalculations, setSalaryCalculations] = useState(null);

  useEffect(() => {
    fetchSalaryData();
  }, []);

  const fetchSalaryData = async () => {
    try {
      // Fetch basic salary info
      const salaryResponse = await fetch('/api/real-salary');
      const salaryResult = await salaryResponse.json();
      
      if (salaryResult.salary) {
        setSalaryData(salaryResult.salary);
        
        // Fetch calculations if we have salary data
        const calculationsResponse = await fetch('/api/real-salary/calculate');
        const calculationsResult = await calculationsResponse.json();
        setSalaryCalculations(calculationsResult.calculations);
      }
    } catch (error) {
      console.error('Error fetching salary data:', error);
    }
  };

  const handleIncomeSubmit = async (salary) => {
    setSalaryData(salary);
    try {
      const response = await fetch('/api/real-salary/calculate');
      const result = await response.json();
      setSalaryCalculations(result.calculations);
    } catch (error) {
      console.error('Error fetching salary calculations:', error);
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
        <ProfitLossCard summaryData={summaryData} />

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Clock size={20} />
            <span className="font-medium">Real Salary Income</span>
          </div>
          {salaryData ? (
            <>
              <div className="mb-3 text-sm text-purple-700">
                <span>Current Salary: </span>
                <span className="font-semibold">
                  {formatCurrency(salaryData.amount)} / {salaryData.frequency}
                </span>
              </div>
              {salaryCalculations && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Hourly:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.hourly)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Daily:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.daily)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Weekly:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.weekly)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Biweekly:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.biweekly)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Monthly:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.monthly)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-purple-700">
                    <span>Yearly:</span>
                    <span className="font-semibold">{formatCurrency(salaryCalculations.yearly)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-purple-700">
              No salary information set. Click "Add Income" to set your salary.
            </div>
          )}
        </div>
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