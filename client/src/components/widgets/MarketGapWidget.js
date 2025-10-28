import React, { useMemo, useState } from 'react';
import { getCurrencyIcon } from '../../utils/currencyIcons';
import './Widget.css';
import './MarketGapWidget.css';

function MarketGapWidget({ data, title = 'Top Market Gaps' }) {
  const [sortBy, setSortBy] = useState('gap'); // 'gap' or 'margin'

  const topGaps = useMemo(() => {
    if (!data) return [];

    const filtered = data
      .filter(item => item.marketGap !== null && item.marketGap > 0)
      .map(item => ({
        currency: item.currency,
        gap: item.marketGap,
        bestBuy: item.bestBuy,
        bestSell: item.bestSell,
        profitMargin: item.bestBuy && item.bestBuy > 0 
          ? (item.marketGap / item.bestBuy) * 100 
          : 0
      }));

    // Sort based on selected column
    const sorted = sortBy === 'margin'
      ? filtered.sort((a, b) => b.profitMargin - a.profitMargin)
      : filtered.sort((a, b) => b.gap - a.gap);

    return sorted.slice(0, 10);
  }, [data, sortBy]);

  return (
    <div className="widget-content">
      <div className="market-gap-container">
        <h3 className="market-gap-title">{title}</h3>
        {topGaps.length === 0 ? (
          <div className="market-gap-no-data">No gap data available</div>
        ) : (
          <div className="market-gap-list">
            <div className="market-gap-header">
              <div className="market-gap-currency">Currency</div>
              <div className="market-gap-stats">
                <span 
                  className={`market-gap-stat profit sortable ${sortBy === 'gap' ? 'active' : ''}`}
                  onClick={() => setSortBy('gap')}
                  title="Click to sort by profit"
                >
                  Profit {sortBy === 'gap' && '▼'}
                </span>
                <span 
                  className={`market-gap-stat margin sortable ${sortBy === 'margin' ? 'active' : ''}`}
                  onClick={() => setSortBy('margin')}
                  title="Click to sort by margin %"
                >
                  % {sortBy === 'margin' && '▼'}
                </span>
                <span className="market-gap-stat buy">Buy</span>
                <span className="market-gap-stat sell">Sell</span>
              </div>
            </div>
            {topGaps.map((item, idx) => {
              const iconUrl = getCurrencyIcon(item.currency);
              return (
                <div key={idx} className="market-gap-row">
                  <div className="market-gap-currency">
                    {iconUrl && (
                      <img 
                        src={iconUrl} 
                        alt={item.currency} 
                        className="market-gap-icon"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className="market-gap-currency-name">{item.currency}</span>
                  </div>
                  <div className="market-gap-stats">
                    <span className="market-gap-stat profit">{item.gap.toFixed(2)}</span>
                    <span className="market-gap-stat margin">{item.profitMargin.toFixed(1)}%</span>
                    <span className="market-gap-stat buy">{item.bestBuy?.toFixed(2) || 'N/A'}</span>
                    <span className="market-gap-stat sell">{item.bestSell?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketGapWidget;

