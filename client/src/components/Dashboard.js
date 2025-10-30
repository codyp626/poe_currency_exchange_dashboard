import React, { useState, useCallback, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import PriceGraphWidget from './widgets/PriceGraphWidget';
import PriceIndicatorWidget from './widgets/PriceIndicatorWidget';
import MarketGapWidget from './widgets/MarketGapWidget';
import CrossCurrencyGapWidget from './widgets/CrossCurrencyGapWidget';
import './Dashboard.css';

const STORAGE_KEY = 'poe-dashboard-layout';

const DEFAULT_WIDGET_POSITIONS = {
  'price-graph-0': { x: 50, y: 50, width: 600, height: 400 },
  'market-gaps-chaos-0': { x: 670, y: 50, width: 400, height: 400 },
  'market-gaps-divine-0': { x: 1090, y: 50, width: 400, height: 400 },
  'cross-currency-gaps-0': { x: 50, y: 470, width: 400, height: 350 },
};

const WIDGET_TYPES = {
  PRICE_GRAPH: 'price-graph',
  PRICE_INDICATOR: 'price-indicator',
  MARKET_GAPS_CHAOS: 'market-gaps-chaos',
  MARKET_GAPS_DIVINE: 'market-gaps-divine',
  CROSS_CURRENCY_GAPS: 'cross-currency-gaps',
};

function Dashboard({ chaosData, divineData, clickedTicker, setClickedTicker, onAddWidget }) {
  const [widgets, setWidgets] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const nextIdRef = useRef(1);

  // Load saved layout from localStorage on mount
  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(STORAGE_KEY);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        setWidgets(parsed.widgets || []);
        nextIdRef.current = parsed.nextId || 1;
        console.log('✅ Loaded saved dashboard layout');
      } else {
        // No saved layout - use defaults
        const defaultWidgets = [
          { id: 'price-graph-0', type: WIDGET_TYPES.PRICE_GRAPH, currency: 'mirror', ...DEFAULT_WIDGET_POSITIONS['price-graph-0'] },
          { id: 'market-gaps-chaos-0', type: WIDGET_TYPES.MARKET_GAPS_CHAOS, ...DEFAULT_WIDGET_POSITIONS['market-gaps-chaos-0'] },
          { id: 'market-gaps-divine-0', type: WIDGET_TYPES.MARKET_GAPS_DIVINE, ...DEFAULT_WIDGET_POSITIONS['market-gaps-divine-0'] },
          { id: 'cross-currency-gaps-0', type: WIDGET_TYPES.CROSS_CURRENCY_GAPS, ...DEFAULT_WIDGET_POSITIONS['cross-currency-gaps-0'] },
        ];
        setWidgets(defaultWidgets);
        nextIdRef.current = 1;
      }
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
      // Fallback to defaults on error
      const defaultWidgets = [
        { id: 'price-graph-0', type: WIDGET_TYPES.PRICE_GRAPH, currency: 'mirror', ...DEFAULT_WIDGET_POSITIONS['price-graph-0'] },
        { id: 'market-gaps-chaos-0', type: WIDGET_TYPES.MARKET_GAPS_CHAOS, ...DEFAULT_WIDGET_POSITIONS['market-gaps-chaos-0'] },
        { id: 'market-gaps-divine-0', type: WIDGET_TYPES.MARKET_GAPS_DIVINE, ...DEFAULT_WIDGET_POSITIONS['market-gaps-divine-0'] },
        { id: 'cross-currency-gaps-0', type: WIDGET_TYPES.CROSS_CURRENCY_GAPS, ...DEFAULT_WIDGET_POSITIONS['cross-currency-gaps-0'] },
      ];
      setWidgets(defaultWidgets);
      nextIdRef.current = 1;
      setIsInitialized(true);
    }
  }, []);

  // Save layout to localStorage whenever widgets change (after initialization)
  useEffect(() => {
    if (isInitialized && widgets.length > 0) {
      try {
        const layoutData = {
          widgets,
          nextId: nextIdRef.current,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layoutData));
        console.log('💾 Dashboard layout saved');
      } catch (error) {
        console.error('Failed to save dashboard layout:', error);
      }
    }
  }, [widgets, isInitialized]);

  const addWidget = useCallback((type, options = {}) => {
    const id = `${type}-${nextIdRef.current}`;
    const currentId = nextIdRef.current;
    nextIdRef.current += 1;
    
    const newWidget = {
      id,
      type,
      x: 50 + (currentId * 20),
      y: 50 + (currentId * 20),
      width: type === WIDGET_TYPES.PRICE_GRAPH ? 600 : 400,
      height: type === WIDGET_TYPES.PRICE_GRAPH ? 400 : 350,
      ...options,
    };
    
    setWidgets(prev => [...prev, newWidget]);
  }, []);

  // Expose addWidget to parent
  React.useEffect(() => {
    if (onAddWidget) {
      onAddWidget(addWidget);
    }
  }, [onAddWidget, addWidget]);

  // Handle ticker click
  React.useEffect(() => {
    if (clickedTicker) {
      addWidget(WIDGET_TYPES.PRICE_GRAPH, { currency: clickedTicker });
      if (setClickedTicker) {
        setClickedTicker(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedTicker]);

  const removeWidget = useCallback((id) => {
    setWidgets(widgets => widgets.filter(w => w.id !== id));
  }, []);

  const handleStop = useCallback((id, data) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, x: data.x, y: data.y } : w
    ));
  }, []);

  const handleResize = useCallback((id, size) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, width: size.width, height: size.height } : w
    ));
  }, []);

  const resetLayout = useCallback(() => {
    if (window.confirm('Reset dashboard to default layout? This cannot be undone.')) {
      const defaultWidgets = [
        { id: 'price-graph-0', type: WIDGET_TYPES.PRICE_GRAPH, currency: 'mirror', ...DEFAULT_WIDGET_POSITIONS['price-graph-0'] },
        { id: 'market-gaps-chaos-0', type: WIDGET_TYPES.MARKET_GAPS_CHAOS, ...DEFAULT_WIDGET_POSITIONS['market-gaps-chaos-0'] },
        { id: 'market-gaps-divine-0', type: WIDGET_TYPES.MARKET_GAPS_DIVINE, ...DEFAULT_WIDGET_POSITIONS['market-gaps-divine-0'] },
        { id: 'cross-currency-gaps-0', type: WIDGET_TYPES.CROSS_CURRENCY_GAPS, ...DEFAULT_WIDGET_POSITIONS['cross-currency-gaps-0'] },
      ];
      setWidgets(defaultWidgets);
      nextIdRef.current = 1;
      localStorage.removeItem(STORAGE_KEY);
      console.log('🔄 Dashboard layout reset to defaults');
    }
  }, []);

  const renderWidget = (widget) => {
    switch (widget.type) {
      case WIDGET_TYPES.PRICE_GRAPH:
        return <PriceGraphWidget currency={widget.currency} />;
      case WIDGET_TYPES.PRICE_INDICATOR:
        return <PriceIndicatorWidget currency={widget.currency} />;
      case WIDGET_TYPES.MARKET_GAPS_CHAOS:
        return <MarketGapWidget data={chaosData} title="Chaos Market Gaps" />;
      case WIDGET_TYPES.MARKET_GAPS_DIVINE:
        return <MarketGapWidget data={divineData} title="Divine Market Gaps" />;
      case WIDGET_TYPES.CROSS_CURRENCY_GAPS:
        return <CrossCurrencyGapWidget chaosData={chaosData} divineData={divineData} />;
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-container">
      <button 
        className="reset-layout-button"
        onClick={resetLayout}
        title="Reset dashboard to default layout"
      >
        🔄 Reset Layout
      </button>
      
      <div className="widget-area">
        {widgets.map(widget => (
          <WidgetContainer 
            key={widget.id} 
            id={widget.id}
            onRemove={() => removeWidget(widget.id)}
            onStop={handleStop}
            onResize={handleResize}
            defaultPosition={{ x: widget.x, y: widget.y }}
            width={widget.width}
            height={widget.height}
          >
            {renderWidget(widget)}
          </WidgetContainer>
        ))}
      </div>
    </div>
  );
}

function WidgetContainer({ id, onRemove, onStop, onResize, children, defaultPosition, width, height }) {
  const [size, setSize] = useState({ width: width || 600, height: height || 400 });
  
  const handleResize = (e, data) => {
    const newSize = { width: data.size.width, height: data.size.height };
    setSize(newSize);
    // Notify parent to save to localStorage
    if (onResize) {
      onResize(id, newSize);
    }
  };
  
  const handleDragStop = (e, data) => {
    if (onStop) {
      onStop(id, data);
    }
  };
  
  return (
    <Draggable 
      handle=".widget-drag-handle"
      defaultPosition={defaultPosition}
      onStop={handleDragStop}
    >
      <div>
        <Resizable
          width={size.width}
          height={size.height}
          onResize={handleResize}
          minConstraints={[300, 200]}
          maxConstraints={[1200, 800]}
          resizeHandles={['se']}
        >
          <div className="widget-wrapper" style={{ width: size.width, height: size.height }}>
            <div className="widget-drag-handle" title="Drag to move">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="4" r="1.5"/>
                <circle cx="4" cy="8" r="1.5"/>
                <circle cx="4" cy="12" r="1.5"/>
                <circle cx="8" cy="4" r="1.5"/>
                <circle cx="8" cy="8" r="1.5"/>
                <circle cx="8" cy="12" r="1.5"/>
              </svg>
            </div>
            <button className="widget-close" onClick={onRemove} title="Close widget">×</button>
            {children}
          </div>
        </Resizable>
      </div>
    </Draggable>
  );
}

export default Dashboard;
export { WIDGET_TYPES };
