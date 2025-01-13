import React, { useState } from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';

const IncomeTable = ({ entries }) => {
  const [sortField, setSortField] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');

  const calculateTotals = (entry) => {
    let total = parseFloat(entry.amount) || 0;
    let spent = parseFloat(entry.total_spent) || 0;

    if (entry.children && entry.children.length > 0) {
      entry.children.forEach(child => {
        const childTotals = calculateTotals(child);
        total += childTotals.total;
        spent += childTotals.spent;
      });
    }

    return { total, spent };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortEntries = (entriesToSort) => {
    return [...entriesToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'amount':
          comparison = calculateTotals(a).total - calculateTotals(b).total;
          break;
        case 'remaining':
          const aRemaining = calculateTotals(a).total - calculateTotals(a).spent;
          const bRemaining = calculateTotals(b).total - calculateTotals(b).spent;
          comparison = aRemaining - bRemaining;
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={16} />;
    return sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />;
  };

  const renderTableRows = (entries, level = 0) => {
    const sortedEntries = sortEntries(entries);

    return sortedEntries.map(entry => {
      const { total, spent } = calculateTotals(entry);
      const remaining = total - spent;

      return (
        <React.Fragment key={entry.id}>
          <tr className={`${entry.is_subaccount ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100`}>
            <td className={`p-3 ${level > 0 ? 'pl-8' : ''}`}>
              <span className="font-medium">{entry.title}</span>
              {entry.is_subaccount && (
                <span className="ml-2 text-sm text-blue-600">(Subaccount)</span>
              )}
            </td>
            <td className="p-3 text-right font-medium">
              {formatCurrency(total)}
            </td>
            <td className="p-3 text-right font-medium text-red-600">
              {formatCurrency(spent)}
            </td>
            <td className={`p-3 text-right font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(remaining))}
              <span className="text-sm ml-1">
                {remaining >= 0 ? '(Available)' : '(Over)'}
              </span>
            </td>
          </tr>
          {entry.children && entry.children.length > 0 && renderTableRows(entry.children, level + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="p-3 text-left">
              <button 
                onClick={() => handleSort('title')}
                className="flex items-center gap-2 hover:text-blue-600"
              >
                Title {getSortIcon('title')}
              </button>
            </th>
            <th className="p-3 text-right">
              <button 
                onClick={() => handleSort('amount')}
                className="flex items-center gap-2 hover:text-blue-600 ml-auto"
              >
                Budget {getSortIcon('amount')}
              </button>
            </th>
            <th className="p-3 text-right">Spent</th>
            <th className="p-3 text-right">
              <button 
                onClick={() => handleSort('remaining')}
                className="flex items-center gap-2 hover:text-blue-600 ml-auto"
              >
                Available {getSortIcon('remaining')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {renderTableRows(entries)}
        </tbody>
      </table>
    </div>
  );
};

export default IncomeTable;