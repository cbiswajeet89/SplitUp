import { Currency } from '../types';

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', rateToUSD: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', rateToUSD: 1.08 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rateToUSD: 1.27 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateToUSD: 0.012 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rateToUSD: 0.0062 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', rateToUSD: 0.73 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rateToUSD: 0.66 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rateToUSD: 0.74 }
];

export function getCurrencySymbol(code: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === code);
  return currency ? currency.symbol : code;
}

/**
 * Converts an amount from one currency to another using rateToUSD.
 */
export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  if (fromCode === toCode) return amount;
  const fromCurrency = SUPPORTED_CURRENCIES.find(c => c.code === fromCode);
  const toCurrency = SUPPORTED_CURRENCIES.find(c => c.code === toCode);
  
  if (!fromCurrency || !toCurrency) return amount;
  
  // Amount in USD = amount * fromCurrency.rateToUSD
  const amountInUSD = amount * fromCurrency.rateToUSD;
  // Amount in target currency = amountInUSD / toCurrency.rateToUSD
  return amountInUSD / toCurrency.rateToUSD;
}

export function formatCurrency(amount: number, code: string): string {
  const symbol = getCurrencySymbol(code);
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
