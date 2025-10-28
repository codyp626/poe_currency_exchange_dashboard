const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB configuration - MUST be set in .env file
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'currency';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'price_history2';

if (!MONGO_URI) {
  console.error('FATAL: MONGO_URI environment variable is not set!');
  console.error('Please create a .env file with your MongoDB connection string.');
  process.exit(1);
}

let db;
let client;

// Connect to MongoDB
async function connectDB() {
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Utility function to clean OCR artifacts and parse ratios
function cleanRatio(ratio) {
  if (!ratio || typeof ratio !== 'string') return null;
  
  let cleaned = ratio.trim();
  
  // Check for empty or just punctuation
  if (cleaned === '' || cleaned === ':' || cleaned === ',' || cleaned === '..' || cleaned === ',.') {
    return null;
  }
  
  // Handle artifacts like "425.:1" (trailing period before colon)
  cleaned = cleaned.replace(/\.:/g, ':');
  
  // Handle trailing colon (assume :1)
  if (cleaned.endsWith(':') && cleaned.length > 1) {
    cleaned = cleaned + '1';
  }
  
  // Remove multiple ':' in a row (artifact)
  cleaned = cleaned.replace(/::+/g, ':');
  
  // Check if it's a plain decimal number (no colon)
  if (!cleaned.includes(':')) {
    const plainNumber = parseFloat(cleaned);
    if (!isNaN(plainNumber) && plainNumber > 0) {
      return plainNumber;
    }
    return null;
  }
  
  // Parse the ratio format: "numerator:denominator"
  // Examples: "330:1", "1:4.50", "2.20:1", "1:2.86", "2.95:1"
  const match = cleaned.match(/^(\d+\.?\d*):(\d+\.?\d*)$/);
  if (match) {
    const numerator = parseFloat(match[1]);
    const denominator = parseFloat(match[2]);
    
    if (!isNaN(numerator) && !isNaN(denominator) && denominator > 0) {
      // Return the price (how many base currency units per item)
      return numerator / denominator;
    }
  }
  
  return null;
}

// Process data to calculate spreads and clean artifacts
function processCurrencyData(data) {
  const processed = [];
  
  for (const entry of data) {
    if (!entry.currency) continue;
    
    // Parse buy and sell prices
    let buyPrice = cleanRatio(entry.buy);
    let sellPrice = cleanRatio(entry.sell);
    
    // Skip if either buy OR sell is null (one-sided market = no opportunity)
    // This also filters out potential OCR errors
    if (buyPrice === null || sellPrice === null) {
      continue;
    }
    
    // Safety check: if buy > sell, swap them (data might be mislabeled)
    if (buyPrice > sellPrice) {
      [buyPrice, sellPrice] = [sellPrice, buyPrice];
    }
    
    // Calculate market gap
    const marketGap = sellPrice - buyPrice;
    
    processed.push({
      currency: entry.currency,
      bestBuy: buyPrice,
      bestSell: sellPrice,
      marketGap: marketGap
    });
  }
  
  return processed;
}

// API endpoint to get latest data
// Helper function to filter out outliers and get most recent valid data
function getValidDataWithOutlierProtection(docs) {
  // STEP 1: Build historical baselines from older documents (skip first 3 to avoid cascading outliers)
  const historicalBaselines = new Map(); // Map<currencyName, {buys: [], sells: []}>
  
  // Build baseline from docs 3-20 (avoiding the most recent which might have outliers)
  for (const doc of docs.slice(3, 20)) {
    const processed = processCurrencyData(doc.data);
    for (const item of processed) {
      if (!historicalBaselines.has(item.currency)) {
        historicalBaselines.set(item.currency, { buys: [], sells: [] });
      }
      const baseline = historicalBaselines.get(item.currency);
      if (item.bestBuy !== null) baseline.buys.push(item.bestBuy);
      if (item.bestSell !== null) baseline.sells.push(item.bestSell);
    }
  }
  
  // Outlier detection thresholds
  const ABSOLUTE_THRESHOLD = 5; // Allow up to 5 chaos change regardless of percentage
  const PERCENTAGE_THRESHOLD = 0.5; // 50% change (increased from 30% to be more lenient)
  const MIN_BASELINE_SIZE = 3; // Need at least 3 historical values to check
  
  // STEP 2: Check the most recent documents (first 3) against the baseline
  const validData = new Map(); // Map<currencyName, item> - only keep the most recent valid value
  
  for (let i = 0; i < Math.min(3, docs.length); i++) {
    const doc = docs[i];
    const processed = processCurrencyData(doc.data);
    
    for (const item of processed) {
      const currencyName = item.currency;
      
      // Skip if we already have valid data for this currency
      if (validData.has(currencyName)) {
        continue;
      }
      
      // Check against historical baseline if available
      const baseline = historicalBaselines.get(currencyName);
      let isValid = true;
      
      if (baseline && baseline.buys.length >= MIN_BASELINE_SIZE && item.bestBuy !== null) {
        // Use median instead of average for better outlier resistance
        const sortedBuys = [...baseline.buys].sort((a, b) => a - b);
        const medianBuy = sortedBuys[Math.floor(sortedBuys.length / 2)];
        const absoluteChange = Math.abs(item.bestBuy - medianBuy);
        const percentageChange = medianBuy > 0 ? absoluteChange / medianBuy : 0;
        
        if (absoluteChange > ABSOLUTE_THRESHOLD && percentageChange > PERCENTAGE_THRESHOLD) {
          console.log(`Outlier detected for ${currencyName} buy: ${item.bestBuy} vs median ${medianBuy.toFixed(2)} (${(percentageChange * 100).toFixed(1)}% change)`);
          isValid = false;
        }
      }
      
      if (baseline && baseline.sells.length >= MIN_BASELINE_SIZE && item.bestSell !== null && isValid) {
        const sortedSells = [...baseline.sells].sort((a, b) => a - b);
        const medianSell = sortedSells[Math.floor(sortedSells.length / 2)];
        const absoluteChange = Math.abs(item.bestSell - medianSell);
        const percentageChange = medianSell > 0 ? absoluteChange / medianSell : 0;
        
        if (absoluteChange > ABSOLUTE_THRESHOLD && percentageChange > PERCENTAGE_THRESHOLD) {
          console.log(`Outlier detected for ${currencyName} sell: ${item.bestSell} vs median ${medianSell.toFixed(2)} (${(percentageChange * 100).toFixed(1)}% change)`);
          isValid = false;
        }
      }
      
      // If valid (or no baseline available), use this data
      if (isValid) {
        validData.set(currencyName, item);
      } else if (baseline) {
        // Use median of baseline as fallback
        const fallbackItem = { ...item };
        if (baseline.buys.length >= MIN_BASELINE_SIZE) {
          const sortedBuys = [...baseline.buys].sort((a, b) => a - b);
          fallbackItem.bestBuy = sortedBuys[Math.floor(sortedBuys.length / 2)];
        }
        if (baseline.sells.length >= MIN_BASELINE_SIZE) {
          const sortedSells = [...baseline.sells].sort((a, b) => a - b);
          fallbackItem.bestSell = sortedSells[Math.floor(sortedSells.length / 2)];
        }
        fallbackItem.marketGap = fallbackItem.bestSell - fallbackItem.bestBuy;
        validData.set(currencyName, fallbackItem);
        console.log(`Using median baseline for ${currencyName}: buy=${fallbackItem.bestBuy}, sell=${fallbackItem.bestSell}`);
      }
    }
  }
  
  // Convert Map back to array
  return Array.from(validData.values());
}

app.get('/api/data', async (req, res) => {
  try {
    const collection = db.collection(COLLECTION_NAME);
    
    const result = {
      chaos: [],
      divine: [],
      timestamp: null
    };
    
    // Get recent Chaos documents (more docs for outlier detection)
    const chaosDocs = await collection.find({ type: 'Chaos' }).sort({ time: -1 }).limit(20).toArray();
    if (chaosDocs.length > 0) {
      result.chaos = getValidDataWithOutlierProtection(chaosDocs);
      result.timestamp = chaosDocs[0].time;
    }
    
    // Get recent Divine documents (more docs for outlier detection)
    const divineDocs = await collection.find({ type: 'Divine' }).sort({ time: -1 }).limit(20).toArray();
    if (divineDocs.length > 0) {
      result.divine = getValidDataWithOutlierProtection(divineDocs);
      if (!result.timestamp) {
        result.timestamp = divineDocs[0].time;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Helper function to find currency entry by exact name match
function findCurrencyEntry(currencyEntries, searchName) {
  // Simple exact match - frontend sends exact currency names
  return currencyEntries.find(item => item.currency === searchName) || null;
}

// API endpoint to get historical data for a currency pair
app.get('/api/history/:currency', async (req, res) => {
  try {
    const { currency } = req.params;
    const { marketType } = req.query; // 'chaos' or 'divine'
    const collection = db.collection(COLLECTION_NAME);
    
    // Use the market type specified by frontend (defaults to Chaos)
    const documentType = marketType === 'divine' ? 'Divine' : 'Chaos';
    
    // Get ALL documents from the appropriate type, sorted by time
    const docs = await collection.find({ type: documentType }).sort({ time: -1 }).toArray();
    
    const history = [];
    let lastBuy = null;
    let lastSell = null;
    
    for (const doc of docs) {
      // Find currency entry using flexible matching
      const currencyEntry = findCurrencyEntry(doc.data, currency);
      if (currencyEntry) {
        const processed = processCurrencyData([currencyEntry]);
        if (processed.length > 0) {
          const data = processed[0];
          
          // Outlier protection: use absolute threshold for low-value items
          const ABSOLUTE_THRESHOLD = 5; // Allow up to 5 chaos change regardless of percentage
          const PERCENTAGE_THRESHOLD = 0.5; // 50% for higher value items
          
          let isValid = true;
          if (lastBuy !== null && data.bestBuy !== null) {
            const absoluteChange = Math.abs(data.bestBuy - lastBuy);
            const percentageChange = Math.abs((data.bestBuy - lastBuy) / lastBuy);
            
            // Only flag as outlier if both absolute change > threshold AND percentage > threshold
            if (absoluteChange > ABSOLUTE_THRESHOLD && percentageChange > PERCENTAGE_THRESHOLD) {
              isValid = false;
            }
          }
          if (lastSell !== null && data.bestSell !== null) {
            const absoluteChange = Math.abs(data.bestSell - lastSell);
            const percentageChange = Math.abs((data.bestSell - lastSell) / lastSell);
            
            // Only flag as outlier if both absolute change > threshold AND percentage > threshold
            if (absoluteChange > ABSOLUTE_THRESHOLD && percentageChange > PERCENTAGE_THRESHOLD) {
              isValid = false;
            }
          }
          
          if (isValid) {
            history.push({
              time: doc.time,
              data: data
            });
            
            // Update last values
            if (data.bestBuy !== null) lastBuy = data.bestBuy;
            if (data.bestSell !== null) lastSell = data.bestSell;
          }
        }
      }
    }
    
    // Return all historical data, reversed (oldest first)
    res.json(history.reverse());
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});

