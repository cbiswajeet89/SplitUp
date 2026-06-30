import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { generateMonthlyReport, getAvailableMonths, getCategoryInfo, CATEGORIES } from '../utils/reports';
import { formatCurrency, SUPPORTED_CURRENCIES } from '../utils/currency';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Coins, Sparkles, AlertCircle } from 'lucide-react';

export const Reports: React.FC = () => {
  const { allExpenses } = useApp();
  
  // Set defaults
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    const months = getAvailableMonths(allExpenses);
    setAvailableMonths(months);
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0]);
    }
  }, [allExpenses]);

  const report = generateMonthlyReport(allExpenses, selectedMonth, targetCurrency);

  // SVG Chart Calculations
  const maxDailySpend = report.dailySpending.length > 0
    ? Math.max(...report.dailySpending.map(d => d.amount))
    : 0;

  return (
    <div className="space-y-6">
      {/* Upper selector banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
            Monthly Spend Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated budget summaries with multi-currency conversion and category spend analyses.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          {/* Month select */}
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <Calendar className="h-3.5 w-3.5 text-slate-400 ml-1" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {availableMonths.map(month => {
                const [year, m] = month.split('-');
                const dateObj = new Date(parseInt(year), parseInt(m) - 1, 1);
                const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                return (
                  <option key={month} value={month}>
                    {monthName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Currency select */}
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <Coins className="h-3.5 w-3.5 text-slate-400 ml-1" />
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map(curr => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} ({curr.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Total Spending */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-400">Total Month's Expenses</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold font-display text-slate-900">
              {formatCurrency(report.totalSpent, targetCurrency)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Sum of all non-settlement group spending converted to <span className="font-semibold text-slate-600">{targetCurrency}</span>
            </p>
          </div>
        </div>

        {/* Trend Comparison */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-400">Budget Trend (vs. Prev Month)</span>
            <div className={`p-2 rounded-xl ${report.comparisonToPrevMonth <= 0 ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>
              {report.comparisonToPrevMonth <= 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-bold font-display ${report.comparisonToPrevMonth <= 0 ? 'text-green-600' : 'text-rose-600'}`}>
              {report.comparisonToPrevMonth === 0 ? '0.0%' : `${report.comparisonToPrevMonth > 0 ? '+' : ''}${report.comparisonToPrevMonth.toFixed(1)}%`}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {report.comparisonToPrevMonth === 0 
                ? 'No previous month history logged' 
                : report.comparisonToPrevMonth > 0 
                  ? 'Your shared group spending increased this month' 
                  : 'Great! Shared spending decreased compared to last month'}
            </p>
          </div>
        </div>
      </div>

      {/* Charts & Category break down section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Spend Trend Line (Custom SVG) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Daily Spending Flow</h3>
            <p className="text-xs text-slate-500 mt-1">Daily trend in chosen currency ({targetCurrency})</p>
          </div>

          <div className="h-64 flex items-end justify-center py-6 w-full relative">
            {report.dailySpending.length === 0 ? (
              <div className="text-center space-y-2 py-10">
                <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-400">No active spending flow recorded for this month.</p>
              </div>
            ) : (
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                {/* Grid Lines */}
                <line x1="0" y1="0" x2="500" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="50" x2="500" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="#f1f5f9" strokeWidth="1" />

                {/* Draw SVG Path line */}
                <path
                  d={report.dailySpending.reduce((acc, curr, idx) => {
                    const x = (idx / (report.dailySpending.length - 1)) * 500;
                    const y = 150 - (curr.amount / (maxDailySpend || 1)) * 130 - 10;
                    return acc + `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '')}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots on line vertices */}
                {report.dailySpending.map((curr, idx) => {
                  const x = (idx / (report.dailySpending.length - 1)) * 500;
                  const y = 150 - (curr.amount / (maxDailySpend || 1)) * 130 - 10;
                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#4f46e5"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <title>{curr.date}: {formatCurrency(curr.amount, targetCurrency)}</title>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {report.dailySpending.length > 0 && (
            <div className="flex justify-between text-[10px] font-mono text-slate-400 border-t border-slate-200 pt-2">
              <span>{report.dailySpending[0].date}</span>
              <span>Daily Timeline Flow</span>
              <span>{report.dailySpending[report.dailySpending.length - 1].date}</span>
            </div>
          )}
        </div>

        {/* Categories breakdown and Progress list */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Spend by Category</h3>
            <p className="text-xs text-slate-500 mt-1">Allocation breakdown</p>
          </div>

          {report.categorySummaries.length === 0 ? (
            <p className="text-xs text-slate-400 py-6">No itemized category logs found.</p>
          ) : (
            <div className="space-y-4">
              {report.categorySummaries.map((summary) => {
                const catInfo = getCategoryInfo(summary.category);
                return (
                  <div key={summary.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <div className="flex items-center space-x-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${catInfo.color}`} />
                        <span>{catInfo.label}</span>
                      </div>
                      <span className="font-mono">{formatCurrency(summary.amount, targetCurrency)} ({summary.percentage.toFixed(0)}%)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${summary.percentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full ${catInfo.color} rounded-full`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
