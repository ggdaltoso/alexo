import { useQuery } from '@tanstack/react-query';
import type { ExchangeRate } from '../types';

const EXCHANGE_API_URL =
  'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL';

interface ExchangeRates {
  usd: ExchangeRate;
  eur: ExchangeRate;
}

async function fetchExchangeRate(): Promise<ExchangeRates> {
  const response = await fetch(EXCHANGE_API_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch exchange rate');
  }
  const data = await response.json();
  return {
    usd: data.USDBRL,
    eur: data.EURBRL,
  };
}

export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchangeRate'],
    queryFn: fetchExchangeRate,
    refetchInterval: 43200000, // Refetch every 12 hours (2x per day)
    staleTime: 43200000, // Consider data stale after 12 hours
  });
}
