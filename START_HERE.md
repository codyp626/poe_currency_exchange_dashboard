# 🚀 POE Currency Dashboard - Start Here

## What You Have

A **complete, production-ready dashboard** for monitoring Path of Exile currency trading with:
- ✅ Real-time data from MongoDB
- ✅ Draggable, customizable widgets  
- ✅ Dark theme optimized for 1920x1080
- ✅ Charts showing market gaps and opportunities
- ✅ Automatic data cleaning (removes OCR artifacts)

## 🏃 Quick Start (2 minutes)

### 1. Install Dependencies

**Backend:**
```bash
npm install
```

**Frontend:**
```bash
cd client
npm install
cd ..
```

### 2. Create Environment File

Create a file named `.env` in the root directory with:

```
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/?appName=Cluster0
DB_NAME=currency
COLLECTION_NAME=price_history2
PORT=5000
```

### 3. Start Both Servers

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

### 4. Open Dashboard

Navigate to `http://localhost:3000`

---

## 📁 Key Files

- **Backend**: `server.js` - API server, data cleaning, MongoDB connection
- **Frontend**: `client/src/App.js` - Main app, data fetching
- **Dashboard**: `client/src/components/Dashboard.js` - Widget system
- **Widgets**: `client/src/components/widgets/` - All widget types

## 🎨 Features

### Default Widgets
1. **Price Graph** - Shows historical price data for Mirror
2. **Market Gaps** - Lists top 10 largest trading opportunities
3. **Cross Currency Gaps** - Shows arbitrage opportunities

### Price Tickers
- **Mirror** (in divines) - Click to view graph
- **Divine** (in chaos) - Click to view graph

### Adding Widgets
Click the `+` buttons in the top-right corner to add new widgets.

### Dragging Widgets
Click and drag the widget header to reposition.

---

## 🔧 Customization

### Change Update Frequency
Edit `client/src/App.js` line 32:
```javascript
setInterval(fetchData, 5000);  // Change to desired milliseconds
```

### Change Colors
- Main colors: `client/src/index.css`
- Widget colors: `client/src/components/Dashboard.css`
- Accent colors: Used throughout components

### Add New Widgets
1. Create component in `client/src/components/widgets/YourWidget.js`
2. Import in `client/src/components/Dashboard.js`
3. Add to `WIDGET_TYPES` object
4. Add case in `renderWidget()`
5. Add button in toolbar

---

## 📊 How It Works

1. **Data Source**: MongoDB Atlas cluster
2. **Backend**: Fetches latest documents (type: "Chaos" and "Divine")
3. **Data Cleaning**: 
   - Removes `:1`, `1:`, multiple `:` 
   - Filters empty `buy` or `sell` fields
   - Validates ratio format (must contain `:`)
4. **Calculations**:
   - Market gap = bestSell - bestBuy
   - Cross currency profit = buy in chaos, sell in divines
5. **Outlier Protection**: Rejects price changes >30%
6. **Frontend**: Updates every 5 seconds automatically

---

## 🐛 Troubleshooting

### No Data Showing?
- Check MongoDB connection in backend terminal
- Verify documents exist in database
- Check browser console for errors

### Can't Connect to MongoDB?
- Verify `.env` file exists
- Check your IP is whitelisted in MongoDB Atlas
- Test connection string with MongoDB Compass

### Widgets Not Dragging?
- Make sure you're clicking the header (not the content)
- Check browser console for errors

### Port Already in Use?
- Backend: Edit `.env` and change `PORT=5001`
- Frontend: Accept the prompt to use different port

---

## 📚 Documentation

- **INSTALLATION.md** - Detailed setup instructions
- **README.md** - Full project documentation
- **PROJECT_OVERVIEW.md** - Architecture and data flow

---

## 🎯 What to Do Next

1. ✅ Install dependencies (`npm install`, `cd client && npm install`)
2. ✅ Create `.env` file
3. ✅ Start both servers
4. ✅ Open dashboard in browser
5. 🎉 Start customizing!

## 💡 Tips

- **Double-click** widget headers to rename them
- **Resize** widgets by dragging corners (coming soon)
- **Save** positions by exporting localStorage
- **Add** more currencies by extending the dropdown

---

**Need help?** Check the browser console and backend terminal for error messages.

**Ready to customize?** Start with `client/src/index.css` for colors and layouts!

