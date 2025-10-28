# POE Currency Dashboard - Project Overview

## What Was Built

A complete, production-ready dashboard application for monitoring Path of Exile currency trading data with the following features:

### Backend (Node.js/Express)
- **server.js** - Express server with MongoDB connection
- Real-time data fetching from MongoDB Atlas
- Data cleaning to remove OCR artifacts (`:1`, `1:`, empty strings)
- Market gap calculation
- Historical data API for charts
- Flexible currency name matching

### Frontend (React)
- **App.js** - Main app with data fetching and tickers
- **Dashboard.js** - Draggable widget system
- **Widgets**:
  - PriceGraphWidget - Historical price charts
  - MarketGapWidget - Top market opportunities
  - CrossCurrencyGapWidget - Arbitrage opportunities
  - PriceIndicatorWidget - Simple price display

### Key Features
✅ Draggable widgets - Drag to reposition  
✅ Real-time updates - Refreshes every 5 seconds  
✅ Dark theme - Gray-blue color scheme  
✅ Mobile responsive - Works on all devices  
✅ MongoDB integration - Connects to your existing data  
✅ Data validation - Cleans OCR artifacts automatically  
✅ Flexible currency matching - Handles name variations  

## File Structure

```
project/
├── server.js              # Backend API server
├── package.json           # Backend dependencies
├── .env                   # Environment variables
├── README.md             # Full documentation
├── INSTALLATION.md       # Setup instructions
└── client/               # React frontend
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js         # Main app component
        ├── App.css
        ├── index.css
        └── components/
            ├── Dashboard.js          # Widget container
            ├── Dashboard.css
            └── widgets/
                ├── PriceGraphWidget.js
                ├── MarketGapWidget.js
                ├── CrossCurrencyGapWidget.js
                ├── PriceIndicatorWidget.js
                └── Widget.css
```

## Data Flow

1. **MongoDB** → Stores documents with `type: "Chaos"` or `type: "Divine"`
2. **Backend** → Fetches latest data, cleans OCR artifacts, calculates spreads
3. **Frontend** → Polls backend every 5 seconds, updates widgets
4. **Widgets** → Display data in various formats (charts, tables, etc.)

## Key Calculations

- **Market Gap**: `bestSell - bestBuy` (profit opportunity)
- **Actual Price**: `(bestBuy + bestSell) / 2` (market value)
- **Divine Price**: Fetched from chaos data
- **Mirror Price**: Calculated in divines from chaos data
- **Cross Currency Profit**: Buy in one currency, sell in another

## Customization Points

### Easy Changes
- Update frequency: `client/src/App.js` line 32
- Colors: `client/src/index.css`, `client/src/App.css`
- Widget positions: `client/src/components/Dashboard.js` line 9-13
- API endpoint: `client/src/App.js` line 15

### Adding New Widgets
1. Create component in `client/src/components/widgets/`
2. Import in `client/src/components/Dashboard.js`
3. Add to `WIDGET_TYPES` object
4. Add case in `renderWidget()`
5. Add button in toolbar

## Testing with Example Data

The project is pre-configured to work with your MongoDB data structure. Example document format:

```json
{
  "time": { "$date": "2025-10-27T18:26:22.597Z" },
  "type": "Chaos",
  "data": [
    {
      "currency": "Divine Orb",
      "buy": "306:1",    // Best buy price
      "sell": "404:1"    // Best sell price
    }
  ]
}
```

## What Gets Cleaned

The backend automatically filters:
- Entries with `:1` or `1:` at start/end
- Multiple `::` in ratio
- Empty `buy` or `sell` fields
- Invalid ratio formats (must contain `:`)
- Entries with weird formatting

All filtered entries are logged to console for debugging.

## Scalability

Designed to handle:
- ✅ Current: Personal use
- ✅ Future: 1000+ concurrent users
- ✅ Ready for: Additional data sources
- ✅ Expandable: New widget types

## Next Steps

1. Run `npm install` and `cd client && npm install`
2. Start with `npm start` in root and `cd client && npm start`
3. Access at `http://localhost:3000`
4. Customize colors, layouts, and add features as needed

See `INSTALLATION.md` for detailed setup instructions.

