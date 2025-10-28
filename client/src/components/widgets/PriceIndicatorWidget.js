import React from 'react';
import './Widget.css';

function PriceIndicatorWidget({ id, currency, data, onRemove }) {
  return (
    <div className="widget-content">
      <div className="price-indicator">
        <div className="currency-icon">
          {/* Icon would go here */}
          <div className="icon-placeholder">{currency[0]?.toUpperCase()}</div>
        </div>
        <div className="price-info">
          <div className="currency-name">{currency}</div>
          <div className="price-value">
            {data?.bestSell ? data.bestSell.toFixed(2) : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PriceIndicatorWidget;

