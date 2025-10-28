import React, { useMemo, useState } from 'react';
import { getCurrencyIcon } from '../../utils/currencyIcons';
import './Widget.css';
import './CrossCurrencyGapWidget.css';

function CrossCurrencyGapWidget({ id, chaosData, divineData, onRemove }) {
  const [sortBy, setSortBy] = useState('profit'); // 'profit' or 'margin'

  const crossGaps = useMemo(() => {
    if (!chaosData || !divineData) return [];
    
    // Calculate divine price in chaos (use bestSell = price to buy)
    const divinePriceInChaos = chaosData.find(item => 
      item.currency.toLowerCase().includes('divine')
    )?.bestSell;
    
    if (!divinePriceInChaos) return [];
    
    const gaps = [];
    
    // Find matching currencies in both data sets
    for (const chaosItem of chaosData) {
      // Try exact match first
      let divineItem = divineData.find(item => 
        item.currency === chaosItem.currency
      );
      
      // If no exact match, try partial match
      if (!divineItem) {
        divineItem = divineData.find(item => 
          item.currency.toLowerCase().includes(chaosItem.currency.toLowerCase()) ||
          chaosItem.currency.toLowerCase().includes(item.currency.toLowerCase())
        );
      }
      
      if (chaosItem.bestBuy && divineItem?.bestSell) {
        // Can buy in chaos, sell for divines
        const cost = chaosItem.bestBuy;
        const revenue = divineItem.bestSell * divinePriceInChaos;
        const profit = revenue - cost;
        if (profit > 0) {
          gaps.push({
            currency: chaosItem.currency,
            profitInChaos: profit,
            profitMargin: (profit / cost) * 100,
            buy: chaosItem.bestBuy,
            sell: divineItem.bestSell,
            sellInChaos: revenue,
          });
        }
      }
      
      if (chaosItem.bestSell && divineItem?.bestBuy) {
        // Can buy in divines, sell for chaos
        const cost = divineItem.bestBuy * divinePriceInChaos;
        const revenue = chaosItem.bestSell;
        const profit = revenue - cost;
        if (profit > 0) {
          gaps.push({
            currency: chaosItem.currency,
            profitInChaos: profit,
            profitMargin: (profit / cost) * 100,
            buy: divineItem.bestBuy,
            buyInChaos: cost,
            sell: chaosItem.bestSell,
          });
        }
      }
    }
    
    // Sort based on selected column
    const sorted = sortBy === 'margin'
      ? gaps.sort((a, b) => b.profitMargin - a.profitMargin)
      : gaps.sort((a, b) => b.profitInChaos - a.profitInChaos);

    return sorted.slice(0, 10);
  }, [chaosData, divineData, sortBy]);

  return (
    <div className="widget-content">
      <div className="cross-gap-container">
        <h3 className="cross-gap-title">Cross Currency Opportunities</h3>
        {crossGaps.length === 0 ? (
          <div className="cross-gap-no-data">No cross currency opportunities</div>
        ) : (
          <div className="cross-gap-list">
            <div className="cross-gap-header">
              <div className="cross-gap-currency">Currency</div>
              <div className="cross-gap-stats">
                <span 
                  className={`cross-gap-stat profit sortable ${sortBy === 'profit' ? 'active' : ''}`}
                  onClick={() => setSortBy('profit')}
                  title="Click to sort by profit"
                >
                  Profit {sortBy === 'profit' && '▼'}
                </span>
                <span 
                  className={`cross-gap-stat margin sortable ${sortBy === 'margin' ? 'active' : ''}`}
                  onClick={() => setSortBy('margin')}
                  title="Click to sort by margin %"
                >
                  % {sortBy === 'margin' && '▼'}
                </span>
                <span className="cross-gap-stat buy">Buy</span>
                <span className="cross-gap-stat sell">Sell</span>
              </div>
            </div>
            {crossGaps.map((item, idx) => {
              const iconUrl = getCurrencyIcon(item.currency);
              return (
                <div key={idx} className="cross-gap-row">
                  <div className="cross-gap-currency">
                    {iconUrl && (
                      <img 
                        src={iconUrl} 
                        alt={item.currency} 
                        className="cross-gap-icon"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className="cross-gap-currency-name">{item.currency}</span>
                  </div>
                  <div className="cross-gap-stats">
                    <span className="cross-gap-stat profit">{item.profitInChaos.toFixed(0)}C</span>
                    <span className="cross-gap-stat margin">{item.profitMargin.toFixed(1)}%</span>
                    <span className="cross-gap-stat buy">
                      {item.buy?.toFixed(2) || 'N/A'}
                      {item.buyInChaos && ` (${item.buyInChaos.toFixed(0)}C)`}
                    </span>
                    <span className="cross-gap-stat sell">
                      {item.sell?.toFixed(2) || 'N/A'}
                      {item.sellInChaos && ` (${item.sellInChaos.toFixed(0)}C)`}
                    </span>
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

export default CrossCurrencyGapWidget;

