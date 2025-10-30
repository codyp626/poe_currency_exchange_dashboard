import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, ReferenceLine } from 'recharts';
import axios from 'axios';
import { getCurrencyIcon } from '../../utils/currencyIcons';
import './Widget.css';

// Tooltip styles
const TOOLTIP_STYLE = {
  background: '#2d3748',
  border: '1px solid #4a5568',
  borderRadius: '6px',
  padding: '10px',
  color: '#e2e8f0'
};

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
  const [initialLoad, setInitialLoad] = useState(true);
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(normalizeCurrencyName(currency));
  const [displayUnit, setDisplayUnit] = useState('Chaos');
  const [brushIndices, setBrushIndices] = useState({ startIndex: 0, endIndex: 0 });
  
  const brushIndicesRef = useRef(brushIndices);
  brushIndicesRef.current = brushIndices;

  // Calculate if we should smooth based on zoom level
  const shouldSmooth = useMemo(() => {
    const visiblePoints = brushIndices.endIndex - brushIndices.startIndex + 1;
    return visiblePoints > 30;
  }, [brushIndices.startIndex, brushIndices.endIndex]);

  // Day boundaries
  const dayBoundaries = useMemo(() => {
    const boundaries = [];
    let lastDate = null;
    data.forEach((point, index) => {
      if (lastDate && point.date !== lastDate && index > 0) {
        boundaries.push({ x: point.shortTime, label: point.date });
      }
      lastDate = point.date;
    });
    return boundaries;
  }, [data]);

  // Smart X-axis ticks - evenly distributed at round intervals
  const xAxisTicks = useMemo(() => {
    if (!data || data.length === 0) return undefined;
    
    const visibleData = data.slice(brushIndices.startIndex, brushIndices.endIndex + 1);
    if (visibleData.length === 0) return undefined;
    
    const visiblePoints = visibleData.length;
    
    // Determine how many ticks we want based on zoom
    let targetTicks;
    if (visiblePoints > 200) targetTicks = 8;
    else if (visiblePoints > 100) targetTicks = 10;
    else if (visiblePoints > 50) targetTicks = 12;
    else targetTicks = Math.min(15, visiblePoints);
    
    // Sample evenly across visible data
    const step = Math.max(1, Math.floor(visiblePoints / targetTicks));
    const ticks = [];
    
    for (let i = 0; i < visiblePoints; i += step) {
      if (visibleData[i]) {
        ticks.push(visibleData[i].shortTime);
      }
    }
    
    // Always include last point
    const lastPoint = visibleData[visibleData.length - 1];
    if (lastPoint && !ticks.includes(lastPoint.shortTime)) {
      ticks.push(lastPoint.shortTime);
    }
    
    return ticks;
  }, [data, brushIndices.startIndex, brushIndices.endIndex]);

  const yAxisTickFormatter = useCallback((value) => {
    if (typeof value !== 'number') return value;
    if (value >= 100) return parseFloat(value.toFixed(0)).toString();
    if (value >= 10) return parseFloat(value.toFixed(1)).toString();
    return parseFloat(value.toFixed(2)).toString();
  }, []);

  const handleBrushChange = useCallback((newIndices) => {
    if (newIndices && newIndices.startIndex !== undefined && newIndices.endIndex !== undefined) {
      setBrushIndices({ startIndex: newIndices.startIndex, endIndex: newIndices.endIndex });
    }
  }, []);

  const CustomTooltip = useCallback(({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      
      return (
        <div style={TOOLTIP_STYLE}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{dataPoint.time}</p>
          {dataPoint.swapped && (
            <div style={{ fontSize: '0.85em', color: '#9333ea', marginBottom: '5px', fontWeight: 'bold' }}>
              🔄 Buy/Sell were swapped
            </div>
          )}
          {payload.map((entry, index) => {
            const isOutlier = entry.dataKey === 'buy' ? dataPoint.buyOutlier : dataPoint.sellOutlier;
            const originalValue = entry.dataKey === 'buy' ? dataPoint.originalBuy : dataPoint.originalSell;
            const isOCRCorrected = entry.dataKey === 'buy' ? dataPoint.buyOCRCorrected : dataPoint.sellOCRCorrected;
            const value = parseFloat(entry.value.toFixed(2));
            
            return (
              <div key={index} style={{ margin: '3px 0' }}>
                <span style={{ color: entry.color }}>
                  {entry.name}: {value} {displayUnit}
                </span>
                {isOutlier && originalValue && (
                  <div style={{ fontSize: '0.85em', color: isOCRCorrected ? '#10b981' : '#fbbf24', marginTop: '2px' }}>
                    {isOCRCorrected ? '🔧 OCR fixed:' : '⚠️ Replaced:'} {value} (OCR read {parseFloat(originalValue.toFixed(2))})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }, [displayUnit]);

  const fetchHistory = useCallback(async (isBackgroundUpdate = false) => {
    if (!isBackgroundUpdate) setLoading(true);
    
    try {
      const shouldInitializeBrush = brushIndicesRef.current.endIndex === 0;
      
      // High-value currencies traded in Divine market
      const divineMarketCurrencies = [
        'Mirror of Kalandra', 'Mirror Shard', 'Hinekora\'s Lock',
        'Orb of Remembrance', 'Veiled Exalted Orb', 'Orb of Unravelling', 'Reflecting Mist'
      ];
      
      let response, useDisplayUnit;
      
      if (divineMarketCurrencies.includes(selectedCurrency)) {
        response = await axios.get(`/api/history/${selectedCurrency}?marketType=divine`);
        useDisplayUnit = 'Divine';
      } else {
        // Determine market based on current prices
        const pricesResponse = await axios.get('/api/data');
        const { chaos: chaosData, divine: divineData } = pricesResponse.data;
        const divineInChaos = chaosData.find(item => item.currency === 'Divine Orb')?.bestSell || 200;
        
        const currencyInChaos = chaosData.find(item => item.currency === selectedCurrency);
        const currencyInDivine = divineData.find(item => item.currency === selectedCurrency);
        
        let useMarketType = 'chaos';
        useDisplayUnit = 'Chaos';
        let convertDivineToChaos = false;
        
        if (currencyInChaos?.bestSell) {
          const itemValueInDivines = currencyInChaos.bestSell / divineInChaos;
          if (itemValueInDivines > 2) {
            useMarketType = 'divine';
            useDisplayUnit = 'Divine';
          }
        } else if (currencyInDivine?.bestSell) {
          const itemValueInDivines = currencyInDivine.bestSell;
          if (itemValueInDivines > 2) {
            useMarketType = 'divine';
            useDisplayUnit = 'Divine';
          } else {
            useMarketType = 'divine';
            useDisplayUnit = 'Chaos';
            convertDivineToChaos = true;
          }
        }
        
        response = await axios.get(`/api/history/${selectedCurrency}?marketType=${useMarketType}`);
        
        // Convert if needed
        if (convertDivineToChaos) {
          response.data = response.data.map(item => ({
            ...item,
            data: {
              ...item.data,
              bestBuy: item.data.bestBuy ? item.data.bestBuy * divineInChaos : null,
              bestSell: item.data.bestSell ? item.data.bestSell * divineInChaos : null,
              marketGap: item.data.bestBuy && item.data.bestSell ? 
                (item.data.bestSell - item.data.bestBuy) * divineInChaos : null
            }
          }));
        }
      }
      
      setDisplayUnit(useDisplayUnit);
      
      // Map to chart data
      const chartData = response.data.map(item => {
        const timestamp = new Date(item.time);
        return {
          timestamp: timestamp.getTime(),
          time: timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          shortTime: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: timestamp.toLocaleDateString(),
          buy: item.data.bestBuy,
          sell: item.data.bestSell,
          gap: item.data.marketGap,
          buyOutlier: item.data.outlierInfo?.buyOutlier || false,
          sellOutlier: item.data.outlierInfo?.sellOutlier || false,
          originalBuy: item.data.outlierInfo?.originalBuy,
          originalSell: item.data.outlierInfo?.originalSell,
          buyOCRCorrected: item.data.outlierInfo?.buyOCRCorrected || false,
          sellOCRCorrected: item.data.outlierInfo?.sellOCRCorrected || false,
          swapped: item.data.outlierInfo?.swapped || false,
        };
      });
      
      setData(chartData);
      
      if (shouldInitializeBrush && chartData.length > 0) {
        setBrushIndices({ startIndex: 0, endIndex: chartData.length - 1 });
      } else if (chartData.length > 0 && brushIndicesRef.current.endIndex > 0) {
        // Clamp brush indices to valid range
        setBrushIndices(prev => ({
          startIndex: Math.min(prev.startIndex, chartData.length - 1),
          endIndex: Math.min(prev.endIndex, chartData.length - 1)
        }));
      }
      
      if (initialLoad) setInitialLoad(false);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCurrency, initialLoad]);

  useEffect(() => {
    fetchHistory(false);
    const interval = setInterval(() => fetchHistory(true), 10000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  useEffect(() => {
    if (currency) {
      setSelectedCurrency(normalizeCurrencyName(currency));
      setBrushIndices({ startIndex: 0, endIndex: 0 });
      setInitialLoad(true);
    }
  }, [currency]);

  useEffect(() => {
    const currencies = [
      'Mirror of Kalandra', 'Divine Orb', 'Exalted Orb', 'Ancient Orb',
      'Orb of Annulment', 'Orb of Regret', 'Vaal Orb', 'Regal Orb',
      'Tempering Orb', 'Tailoring Orb', 'Sacred Orb', 'Veiled Exalted Orb',
      'Awakener\'s Orb', 'Eldritch Chaos Orb', 'Eldritch Exalted Orb',
      'Crusader\'s Exalted Orb', 'Hunter\'s Exalted Orb', 'Redeemer\'s Exalted Orb',
      'Warlord\'s Exalted Orb', 'Stacked Deck', 'Gemcutter\'s Prism',
      'Sacred Crystallised Lifeforce', 'The Apothecary', 'The Doctor', 'House of Mirrors'
    ];
    setAvailableCurrencies(currencies);
  }, []);

  if (loading && data.length === 0) {
    return (
      <div className="widget-content">
        <div className="widget-loading">Loading...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="widget-content">
        <div className="widget-controls">
          {getCurrencyIcon(selectedCurrency) && (
            <img 
              src={getCurrencyIcon(selectedCurrency)} 
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
              <option key={curr} value={curr}>{curr}</option>
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
            <option key={curr} value={curr}>{curr}</option>
          ))}
        </select>
      </div>
      
      <div className="graph-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
            
            <XAxis 
              dataKey="shortTime" 
              stroke="#a0aec0"
              angle={-45}
              textAnchor="end"
              height={50}
              tick={{ fontSize: 11 }}
              ticks={xAxisTicks}
            />
            
            <YAxis 
              stroke="#a0aec0" 
              domain={['auto', 'auto']}
              label={{ value: displayUnit, angle: -90, position: 'insideLeft', style: { fill: '#a0aec0' } }}
              tickFormatter={yAxisTickFormatter}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Day boundary lines */}
            {dayBoundaries.map((boundary, idx) => (
              <ReferenceLine
                key={idx}
                x={boundary.x}
                stroke="#718096"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: boundary.label,
                  position: 'top',
                  fill: '#a0aec0',
                  fontSize: 11,
                  offset: 5
                }}
              />
            ))}
            
            <Line 
              type={shouldSmooth ? "monotone" : "linear"}
              dataKey="buy" 
              stroke="#f56565" 
              name="Buy"
              strokeWidth={2}
              dot={(props) => {
                if (props.payload.swapped) {
                  return <circle cx={props.cx} cy={props.cy} r={5} fill="#9333ea" stroke="#7e22ce" strokeWidth={2} />;
                }
                if (!props.payload.buyOutlier) return false;
                const color = props.payload.buyOCRCorrected ? '#10b981' : '#fbbf24';
                const strokeColor = props.payload.buyOCRCorrected ? '#059669' : '#f59e0b';
                return <circle cx={props.cx} cy={props.cy} r={4} fill={color} stroke={strokeColor} strokeWidth={2} />;
              }}
              connectNulls
              isAnimationActive={false}
            />
            
            <Line 
              type={shouldSmooth ? "monotone" : "linear"}
              dataKey="sell" 
              stroke="#68d391" 
              name="Sell"
              strokeWidth={2}
              dot={(props) => {
                if (props.payload.swapped) {
                  return <circle cx={props.cx} cy={props.cy} r={5} fill="#9333ea" stroke="#7e22ce" strokeWidth={2} />;
                }
                if (!props.payload.sellOutlier) return false;
                const color = props.payload.sellOCRCorrected ? '#10b981' : '#fbbf24';
                const strokeColor = props.payload.sellOCRCorrected ? '#059669' : '#f59e0b';
                return <circle cx={props.cx} cy={props.cy} r={4} fill={color} stroke={strokeColor} strokeWidth={2} />;
              }}
              connectNulls
              isAnimationActive={false}
            />
            
            <Brush
              dataKey="shortTime"
              height={25}
              stroke="#4a5568"
              fill="#2d3748"
              travellerWidth={8}
              startIndex={brushIndices.startIndex}
              endIndex={brushIndices.endIndex}
              onChange={handleBrushChange}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PriceGraphWidget;
