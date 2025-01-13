import React, { useState, useMemo } from 'react';
import { DollarSign, ArrowRight } from 'lucide-react';

const ProfitLossCard = ({ summaryData }) => {
  const [timeframe, setTimeframe] = useState('monthly');

  const calculations = useMemo(() => {
    const { weekly, monthly, yearly, totalSpent } = summaryData;
  
    const daily = {
      budget: monthly / (4.33*7), // Business days only
      spent: totalSpent / (4.33*7)
    };
    daily.remaining = daily.budget - daily.spent;

    // Calculate other timeframes
    const timeframes = {
      daily,
      weekly: {
        budget: monthly / 4.33,
        spent: totalSpent / 4.33,
        remaining: monthly / 4.33 - (totalSpent / 4.33)
      },
      monthly: {
        budget: monthly,
        spent: totalSpent,
        remaining: monthly - (totalSpent)
      },
      yearly: {
        budget: yearly,
        spent: (totalSpent * 12),
        remaining: yearly - (totalSpent * 12)
      }
    };

    return timeframes;
  }, [summaryData]);

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

  return (
    <div className="bg-white p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        
        <div className="flex gap-2">
          {Object.keys(timeframeLabels).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {timeframeLabels[tf]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-lg">
          <span className="text-gray-600">Budget:</span>
          <span className="font-semibold text-blue-600">
            {formatCurrency(calculations[timeframe].budget)}
          </span>
        </div>

        <div className="flex items-center justify-between text-lg">
          <span className="text-gray-600">Spent:</span>
          <span className="font-semibold text-red-600">
            {formatCurrency(calculations[timeframe].spent)}
          </span>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-xl">
            <span className="font-medium">Budget Remaining:</span>
            <span className={`font-bold ${
              calculations[timeframe].remaining >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {formatCurrency(Math.abs(calculations[timeframe].remaining))}
              <span className="text-sm ml-1">
                {calculations[timeframe].remaining >= 0 ? '(Under)' : '(Over)'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLossCard;