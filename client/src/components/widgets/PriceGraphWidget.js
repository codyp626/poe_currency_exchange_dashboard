import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { getCurrencyIcon } from '../../utils/currencyIcons';
import './Widget.css';

// Helper to normalize currency names
const normalizeCurrencyName = (name) => {
  if (!name) return 'Mirror of Kalandra';
  
  const nameMap = {
    'mirror': 'Mirror of Kalandra',
    'divine': 'Divine Orb',
    'exalted': 'Exalted Orb',
    'chaos': 'Chaos Orb',
  };
  
  const lowerName = name.toLowerCase();
  return nameMap[lowerName] || name;
};

function PriceGraphWidget({ id, currency, onRemove }) {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(normalizeCurrencyName(currency));
  const [marketType, setMarketType] = useState('chaos'); // 'chaos' or 'divine'
  const [displayUnit, setDisplayUnit] = useState('Chaos'); // For UI display

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      console.log('fetchHistory called with selectedCurrency:', selectedCurrency);
      
      // Hardcoded high-value currencies that are always traded in Divine market
      const divineMarketCurrencies = [
        'Mirror of Kalandra',
        'Mirror Shard',
        'Hinekora\'s Lock',
        'Orb of Remembrance',
        'Veiled Exalted Orb',
        'Orb of Unravelling',
        'Reflecting Mist'
      ];
      
      console.log('Is in divineMarketCurrencies?', divineMarketCurrencies.includes(selectedCurrency));
      
      // Check if this currency is hardcoded to Divine market
      if (divineMarketCurrencies.includes(selectedCurrency)) {
        setMarketType('divine');
        setDisplayUnit('Divine');
        
        // Fetch history from Divine market
        const response = await axios.get(`/api/history/${selectedCurrency}?marketType=divine`);
        
        console.log(`History for ${selectedCurrency} (divine market):`, response.data);
        
        const chartData = response.data.map(item => ({
          time: new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          buy: item.data.bestBuy,
          sell: item.data.bestSell,
          gap: item.data.marketGap,
        }));
        
        console.log('Chart data:', chartData);
        setData(chartData);
        setLoading(false);
        return;
      }
      
      // For other currencies, fetch current prices to determine which market to use
      const pricesResponse = await axios.get('/api/data');
      const { chaos: chaosData, divine: divineData } = pricesResponse.data;
      
      // Find Divine Orb price in Chaos market
      const divineInChaos = chaosData.find(item => item.currency === 'Divine Orb')?.bestSell || 200;
      
      // Find the selected currency in both markets
      const currencyInChaos = chaosData.find(item => item.currency === selectedCurrency);
      const currencyInDivine = divineData.find(item => item.currency === selectedCurrency);
      
      // Determine if item is worth > 2 Divines and which market to use
      let useMarketType = 'chaos';
      let useDisplayUnit = 'Chaos';
      let convertDivineToChaos = false;
      
      if (currencyInChaos && currencyInChaos.bestSell) {
        // We have Chaos market data - check if it's worth > 2 Divines
        const itemValueInDivines = currencyInChaos.bestSell / divineInChaos;
        if (itemValueInDivines > 2) {
          useMarketType = 'divine';
          useDisplayUnit = 'Divine';
        }
      } else if (currencyInDivine && currencyInDivine.bestSell) {
        // No Chaos data, but have Divine data - check Divine market value
        const itemValueInDivines = currencyInDivine.bestSell;
        
        if (itemValueInDivines > 2) {
          // High value item - show in Divines
          useMarketType = 'divine';
          useDisplayUnit = 'Divine';
        } else {
          // Low value item - fetch Divine data but convert to Chaos for display
          useMarketType = 'divine';
          useDisplayUnit = 'Chaos';
          convertDivineToChaos = true;
        }
      }
      
      setMarketType(useMarketType);
      setDisplayUnit(useDisplayUnit);
      
      // Fetch history from the appropriate market
      const response = await axios.get(`/api/history/${selectedCurrency}?marketType=${useMarketType}`);
      
      console.log(`History for ${selectedCurrency} (${useMarketType} market):`, response.data);
      
      // Build chart data, converting Divine to Chaos if needed
      const chartData = response.data.map(item => {
        let buy = item.data.bestBuy;
        let sell = item.data.bestSell;
        
        // Convert Divine prices to Chaos if needed
        if (convertDivineToChaos && buy !== null) {
          buy = buy * divineInChaos;
        }
        if (convertDivineToChaos && sell !== null) {
          sell = sell * divineInChaos;
        }
        
        return {
          time: new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          buy: buy,
          sell: sell,
          gap: sell !== null && buy !== null ? sell - buy : null,
        };
      });
      
      console.log('Chart data:', chartData);
      setData(chartData);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCurrency]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Update selectedCurrency when currency prop changes
  useEffect(() => {
    if (currency) {
      const normalizedCurrency = normalizeCurrencyName(currency);
      console.log('Currency prop changed to:', currency, '-> normalized:', normalizedCurrency);
      setSelectedCurrency(normalizedCurrency);
    }
  }, [currency]); // Only react to prop changes, not state changes

  useEffect(() => {
    // Common currencies from Names.txt
    const currencies = [
      'Mirror of Kalandra',
      'Divine Orb',
      'Exalted Orb',
      'Ancient Orb',
      'Orb of Annulment',
      'Orb of Regret',
      'Vaal Orb',
      'Regal Orb',
      'Tempering Orb',
      'Tailoring Orb',
      'Sacred Orb',
      'Veiled Exalted Orb',
      'Awakener\'s Orb',
      'Eldritch Chaos Orb',
      'Eldritch Exalted Orb',
      'Crusader\'s Exalted Orb',
      'Hunter\'s Exalted Orb',
      'Redeemer\'s Exalted Orb',
      'Warlord\'s Exalted Orb',
      'Stacked Deck',
      'Gemcutter\'s Prism',
      'Sacred Crystallised Lifeforce',
      'The Apothecary',
      'The Doctor',
      'House of Mirrors'
    ];
    setAvailableCurrencies(currencies);
  }, []);

  if (loading) {
    return (
      <div className="widget-content">
        <div className="widget-loading">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    const iconUrl = getCurrencyIcon(selectedCurrency);
    return (
      <div className="widget-content">
        <div className="widget-controls">
          {iconUrl && (
            <img 
              src={iconUrl} 
              alt={selectedCurrency} 
              className="graph-currency-icon"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <select 
            value={selectedCurrency} 
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="currency-select"
          >
            {availableCurrencies.map(curr => (
              <option key={curr} value={curr}>
                {curr}
              </option>
            ))}
          </select>
        </div>
        <div className="no-data">No data available for {selectedCurrency}</div>
      </div>
    );
  }

  const iconUrl = getCurrencyIcon(selectedCurrency);
  
  return (
    <div className="widget-content">
      <div className="widget-controls">
        {iconUrl && (
          <img 
            src={iconUrl} 
            alt={selectedCurrency} 
            className="graph-currency-icon"
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        <select 
          value={selectedCurrency} 
          onChange={(e) => setSelectedCurrency(e.target.value)}
          className="currency-select"
        >
          {availableCurrencies.map(curr => (
            <option key={curr} value={curr}>
              {curr}
            </option>
          ))}
        </select>
      </div>
      
      <div className="widget-subtitle">Price in {displayUnit} Orbs</div>
      
      <div className="graph-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
            <XAxis dataKey="time" stroke="#a0aec0" />
            <YAxis 
              stroke="#a0aec0" 
              domain={[
                (dataMin) => Math.max(0, dataMin - 5), // Don't go below 0
                (dataMax) => dataMax + 5
              ]}
              label={{ value: displayUnit, angle: -90, position: 'insideLeft', style: { fill: '#a0aec0' } }}
              tickFormatter={(value) => {
                if (typeof value !== 'number') return value;
                // Remove unnecessary trailing zeros
                return parseFloat(value.toFixed(2)).toString();
              }}
            />
            <Tooltip 
              contentStyle={{ 
                background: '#2d3748', 
                border: '1px solid #4a5568',
                borderRadius: '6px'
              }}
              formatter={(value) => {
                if (typeof value !== 'number') return [value, ''];
                // Remove unnecessary trailing zeros (1845.00 → 1845, 1845.50 → 1845.5)
                const formattedValue = parseFloat(value.toFixed(2));
                return [`${formattedValue} ${displayUnit}`, ''];
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="buy" 
              stroke="#f56565" 
              name="Best Buy (Bid)"
              strokeWidth={2}
              dot={false}
              connectNulls={true}
            />
            <Line 
              type="monotone" 
              dataKey="sell" 
              stroke="#68d391" 
              name="Best Sell (Ask)"
              strokeWidth={2}
              dot={false}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PriceGraphWidget;

