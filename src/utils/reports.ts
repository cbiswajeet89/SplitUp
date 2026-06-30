import { Expense, Group } from '../types';
import { convertCurrency } from './currency';

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyReport {
  monthKey: string; // YYYY-MM
  totalSpent: number; // in target currency
  comparisonToPrevMonth: number; // percentage change (e.g. +12.5 or -5)
  categorySummaries: CategorySummary[];
  dailySpending: { date: string; amount: number }[];
}

export const CATEGORIES = [
  { id: 'food', label: 'Food & Dining', color: 'bg-emerald-500', hex: '#10b981' },
  { id: 'travel', label: 'Travel & Transport', color: 'bg-sky-500', hex: '#0ea5e9' },
  { id: 'lodging', label: 'Accommodation', color: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'entertainment', label: 'Entertainment', color: 'bg-purple-500', hex: '#a855f7' },
  { id: 'utilities', label: 'Bills & Utilities', color: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'shopping', label: 'Shopping', color: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'others', label: 'Others', color: 'bg-gray-500', hex: '#6b7280' }
];

export function getCategoryInfo(categoryId: string) {
  return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
}

/**
 * Generates an automated monthly report for a given target currency and list of expenses.
 */
export function generateMonthlyReport(
  expenses: Expense[],
  targetMonth: string, // YYYY-MM
  targetCurrency: string
): MonthlyReport {
  // Filter non-settlement expenses
  const standardExpenses = expenses.filter(e => !e.isSettlement);

  // Group standard expenses by month key (YYYY-MM)
  const expensesByMonth: Record<string, Expense[]> = {};
  standardExpenses.forEach(exp => {
    const monthKey = exp.date.substring(0, 7); // "YYYY-MM"
    if (!expensesByMonth[monthKey]) {
      expensesByMonth[monthKey] = [];
    }
    expensesByMonth[monthKey].push(exp);
  });

  const getMonthTotal = (month: string): number => {
    const exps = expensesByMonth[month] || [];
    return exps.reduce((sum, exp) => {
      const amtInTarget = convertCurrency(exp.amount, exp.currency, targetCurrency);
      return sum + amtInTarget;
    }, 0);
  };

  const currentMonthTotal = getMonthTotal(targetMonth);

  // Calculate previous month total for comparison
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthTotal = getMonthTotal(prevMonthKey);

  let comparisonToPrevMonth = 0;
  if (prevMonthTotal > 0) {
    comparisonToPrevMonth = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100;
  }

  // Calculate category summaries for target month
  const targetExpenses = expensesByMonth[targetMonth] || [];
  const categoryAmounts: Record<string, number> = {};
  
  targetExpenses.forEach(exp => {
    const cat = exp.category || 'others';
    const amtInTarget = convertCurrency(exp.amount, exp.currency, targetCurrency);
    categoryAmounts[cat] = (categoryAmounts[cat] || 0) + amtInTarget;
  });

  const categorySummaries: CategorySummary[] = Object.entries(categoryAmounts).map(([cat, amt]) => {
    return {
      category: cat,
      amount: amt,
      percentage: currentMonthTotal > 0 ? (amt / currentMonthTotal) * 100 : 0
    };
  }).sort((a, b) => b.amount - a.amount);

  // Calculate daily spending for target month
  const dailyAmounts: Record<string, number> = {};
  targetExpenses.forEach(exp => {
    const date = exp.date; // YYYY-MM-DD
    const amtInTarget = convertCurrency(exp.amount, exp.currency, targetCurrency);
    dailyAmounts[date] = (dailyAmounts[date] || 0) + amtInTarget;
  });

  // Sort daily spending by date
  const dailySpending = Object.entries(dailyAmounts)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    monthKey: targetMonth,
    totalSpent: currentMonthTotal,
    comparisonToPrevMonth,
    categorySummaries,
    dailySpending
  };
}

/**
 * Gets all available months from logged expenses.
 */
export function getAvailableMonths(expenses: Expense[]): string[] {
  const monthsSet = new Set<string>();
  // Default to current month if no expenses
  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  monthsSet.add(currentMonthKey);

  expenses.forEach(exp => {
    if (exp.date && exp.date.length >= 7) {
      monthsSet.add(exp.date.substring(0, 7));
    }
  });

  return Array.from(monthsSet).sort().reverse();
}
