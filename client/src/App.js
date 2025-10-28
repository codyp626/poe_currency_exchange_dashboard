import React, { useState, useEffect, useCallback } from 'react';
import Dashboard, { WIDGET_TYPES } from './components/Dashboard';
import axios from 'axios';
import { getCurrencyIcon } from './utils/currencyIcons';
import './App.css';

function App() {
  const [chaosData, setChaosData] = useState([]);
  const [divineData, setDivineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [clickedTicker, setClickedTicker] = useState(null);
  const [addWidgetFn, setAddWidgetFn] = useState(null);
  const [relativeTime, setRelativeTime] = useState('');

  const handleAddWidget = useCallback((addWidget) => {
    setAddWidgetFn(() => addWidget);
  }, []);

  // Helper function to get relative time
  const getRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - updateTime) / 1000);

    if (diffInSeconds < 10) return 'just now';
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/data');
      if (response.data.chaos) {
        setChaosData(response.data.chaos);
      }
      if (response.data.divine) {
        setDivineData(response.data.divine);
      }
      setLastUpdate(response.data.timestamp);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Update every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update relative time every second
  useEffect(() => {
    if (lastUpdate) {
      setRelativeTime(getRelativeTime(lastUpdate));
      const interval = setInterval(() => {
        setRelativeTime(getRelativeTime(lastUpdate));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lastUpdate, getRelativeTime]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading currency data...</p>
      </div>
    );
  }

  // Find Mirror and Divine prices for tickers
  // Mirror trades in divines (divineData), Divine trades in chaos (chaosData)
  const mirrorInDivines = divineData.find(item => 
    item.currency.toLowerCase().includes('mirror')
  );
  const divineInChaos = chaosData.find(item => 
    item.currency.toLowerCase().includes('divine')
  );
  
  // Get prices directly from correct markets (use bestSell = price to buy)
  const divinePriceInChaos = divineInChaos?.bestSell || null;
  const mirrorPriceInDivines = mirrorInDivines?.bestSell || null;

  return (
    <div className="App">
      <header className="app-header">
        <h1>POE Currency Dashboard</h1>
        <div className="header-info">
          {relativeTime && (
            <span className="last-update">
              Last Update: {relativeTime}
            </span>
          )}
        </div>
      </header>
      <div className="price-tickers">
        <div className="ticker-group">
          {mirrorPriceInDivines && (
            <div 
              className="price-ticker" 
              onClick={() => setClickedTicker('Mirror of Kalandra')}
              title="Click to view graph"
            >
              {getCurrencyIcon('Mirror of Kalandra') && (
                <img 
                  src={getCurrencyIcon('Mirror of Kalandra')} 
                  alt="Mirror" 
                  className="ticker-icon"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span className="ticker-label">Mirror</span>
              <span className="ticker-value">
                {mirrorPriceInDivines.toFixed(0)} div
              </span>
            </div>
          )}
          {divinePriceInChaos && (
            <div 
              className="price-ticker" 
              onClick={() => setClickedTicker('Divine Orb')}
              title="Click to view graph"
            >
              {getCurrencyIcon('Divine Orb') && (
                <img 
                  src={getCurrencyIcon('Divine Orb')} 
                  alt="Divine" 
                  className="ticker-icon"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <span className="ticker-label">Divine</span>
              <span className="ticker-value">
                {divinePriceInChaos.toFixed(0)} chaos
              </span>
            </div>
          )}
        </div>
        <div className="widget-toolbar-inline">
          {addWidgetFn && (
            <>
              <button onClick={() => addWidgetFn(WIDGET_TYPES.PRICE_GRAPH)}>
                + Graph
              </button>
              <button onClick={() => addWidgetFn(WIDGET_TYPES.MARKET_GAPS_CHAOS)}>
                + Chaos
              </button>
              <button onClick={() => addWidgetFn(WIDGET_TYPES.MARKET_GAPS_DIVINE)}>
                + Divine
              </button>
              <button onClick={() => addWidgetFn(WIDGET_TYPES.CROSS_CURRENCY_GAPS)}>
                + Cross
              </button>
            </>
          )}
        </div>
      </div>
      <Dashboard 
        chaosData={chaosData} 
        divineData={divineData}
        clickedTicker={clickedTicker}
        setClickedTicker={setClickedTicker}
        onAddWidget={handleAddWidget}
      />
    </div>
  );
}

export default App;

