import * as React from 'react';
import { Frame } from '@react95/core';
import { Printer, Progman24, Mailnews17, Mailnews18 } from '@react95/icons';
import { useExchangeRate } from '../hooks/useExchangeRate';
import type { ExchangeRate } from '../types';

const CurrencyCard = ({
  currency,
  data,
  icon,
}: {
  currency: string;
  data: ExchangeRate;
  icon: React.ReactNode;
}) => {
  const bid = parseFloat(data.bid);
  const pctChange = parseFloat(data.pctChange);
  const isPositive = pctChange >= 0;

  return (
    <Frame className="flex items-center gap-4">
      <div>{icon}</div>
      <div className="flex-1">
        <div className="text font-bold">{currency}</div>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">R$ {bid.toFixed(2)}</span>
          <div
            className={`flex items-center gap-1 text-sm ${
              isPositive ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {isPositive ? (
              <Mailnews17 className="w-4 h-4" variant="16x16_4" />
            ) : (
              <Mailnews18 className="w-4 h-4" variant="16x16_4" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {pctChange.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
};

export const ExchangeRateScreen = React.memo(() => {
  const { data: exchangeRates, isLoading, error } = useExchangeRate();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div>Carregando cotação...</div>
      </div>
    );
  }

  if (error || !exchangeRates) {
    return (
      <div className="flex justify-center items-center h-full">
        <div>Erro ao carregar cotações</div>
      </div>
    );
  }

  return (
    <Frame
      boxShadow="$out"
      bgColor="$material"
      className="p-4 h-full flex flex-col gap-2 justify-between"
    >
      <CurrencyCard
        icon={<Printer className="w-8 h-8" variant="32x32_4" />}
        currency="Dólar (USD/BRL)"
        data={exchangeRates.usd}
      />

      <Frame boxShadow="$in" bgColor="$material" className="flex h-[1px]" />

      <CurrencyCard
        icon={<Progman24 className="w-8 h-8" variant="32x32_4" />}
        currency="Euro (EUR/BRL)"
        data={exchangeRates.eur}
      />
    </Frame>
  );
});

ExchangeRateScreen.displayName = 'ExchangeRateScreen';
