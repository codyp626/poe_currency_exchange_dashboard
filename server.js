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

// ============================================================================
// OUTLIER DETECTION - Shared utilities
// ============================================================================

// Track logged outliers to prevent spam within the same data batch
const loggedOutliers = new Set();
let lastMongoTimestamp = null;

// Outlier detection thresholds
const OUTLIER_CONFIG = {
  ABSOLUTE_THRESHOLD: 5, // Allow up to 5 chaos/divine change regardless of percentage
  PERCENTAGE_THRESHOLD: 0.5, // 50% change threshold
  MIN_BASELINE_SIZE: 3, // Need at least 3 historical values to check
  BASELINE_START_INDEX: 3, // Skip first 3 docs to avoid cascading outliers
  BASELINE_END_INDEX: 20, // Use up to 20 historical docs for baseline
};

/**
 * Calculate median from an array of numbers
 */
function calculateMedian(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Build historical baseline from documents
 * Returns Map<currencyName, {buys: [], sells: []}>
 */
function buildHistoricalBaseline(docs, startIndex = OUTLIER_CONFIG.BASELINE_START_INDEX, endIndex = OUTLIER_CONFIG.BASELINE_END_INDEX) {
  const baselines = new Map();
  
  for (const doc of docs.slice(startIndex, Math.min(endIndex, docs.length))) {
    const processed = processCurrencyData(doc.data);
    for (const item of processed) {
      if (!baselines.has(item.currency)) {
        baselines.set(item.currency, { buys: [], sells: [] });
      }
      const baseline = baselines.get(item.currency);
      if (item.bestBuy !== null) baseline.buys.push(item.bestBuy);
      if (item.bestSell !== null) baseline.sells.push(item.bestSell);
    }
  }
  
  return baselines;
}

/**
 * Attempt to fix common OCR errors where ":1" is read as "31", "41", "51", or just "1"
 * Returns corrected value if successful, or null if no fix found
 */
function attemptOCRFix(price, baselineValues) {
  if (!price || price === 0 || !baselineValues || baselineValues.length === 0) {
    return null;
  }
  
  const priceStr = price.toString();
  const median = calculateMedian(baselineValues);
  if (!median || median <= 0) return null;
  
  // Try all possible suffixes and find the best match
  const suffixes = ['1', '31', '41', '51'];
  let bestCandidate = null;
  let bestDistance = Infinity;
  
  for (const suffix of suffixes) {
    if (priceStr.endsWith(suffix) && priceStr.length > suffix.length) {
      // Try removing the suffix
      const withoutSuffix = priceStr.slice(0, -suffix.length);
      const corrected = parseFloat(withoutSuffix);
      
      if (corrected > 0) {
        const absoluteChange = Math.abs(corrected - median);
        const percentageChange = median > 0 ? absoluteChange / median : 0;
        
        // If corrected value is NOT an outlier, consider it
        if (absoluteChange <= OUTLIER_CONFIG.ABSOLUTE_THRESHOLD || percentageChange <= OUTLIER_CONFIG.PERCENTAGE_THRESHOLD) {
          // Use the candidate closest to the median
          if (absoluteChange < bestDistance) {
            bestDistance = absoluteChange;
            bestCandidate = corrected;
          }
        }
      }
    }
  }
  
  return bestCandidate;
}

/**
 * Check if a price is an outlier compared to baseline
 * Returns { isOutlier: boolean, median: number|null, percentageChange: number, correctedValue: number|null }
 */
function checkOutlier(price, baselineValues) {
  // Zero means OCR failed completely - treat as outlier
  if (price === 0) {
    return { isOutlier: true, median: null, percentageChange: 0, correctedValue: null, isZero: true };
  }
  
  if (price === null || !baselineValues || baselineValues.length < OUTLIER_CONFIG.MIN_BASELINE_SIZE) {
    return { isOutlier: false, median: null, percentageChange: 0, correctedValue: null };
  }
  
  const median = calculateMedian(baselineValues);
  if (median === null) {
    return { isOutlier: false, median: null, percentageChange: 0, correctedValue: null };
  }
  
  const absoluteChange = Math.abs(price - median);
  const percentageChange = median > 0 ? absoluteChange / median : 0;
  
  const isOutlier = (
    absoluteChange > OUTLIER_CONFIG.ABSOLUTE_THRESHOLD && 
    percentageChange > OUTLIER_CONFIG.PERCENTAGE_THRESHOLD
  );
  
  // If it's an outlier, try to fix common OCR errors
  let correctedValue = null;
  if (isOutlier) {
    correctedValue = attemptOCRFix(price, baselineValues);
  }
  
  return { isOutlier, median, percentageChange, correctedValue };
}

/**
 * Process currency data with outlier detection
 * Returns items with outlier metadata
 */
function processDataWithOutlierDetection(item, baseline, currencyName, logOutliers = true) {
  const result = { ...item, outlierInfo: {} };
  
  // Check buy price
  if (item.bestBuy !== null && baseline) {
    const buyCheck = checkOutlier(item.bestBuy, baseline.buys);
    if (buyCheck.isOutlier) {
      result.outlierInfo.buyOutlier = true;
      result.outlierInfo.originalBuy = item.bestBuy;
      result.outlierInfo.medianBuy = buyCheck.median;
      result.bestBuy = buyCheck.median; // Replace with median
      
      if (logOutliers) {
        const logKey = `${currencyName}-buy`;
        if (!loggedOutliers.has(logKey)) {
          console.log(`⚠️  Outlier detected for ${currencyName} buy: ${item.bestBuy} → ${buyCheck.median.toFixed(2)} (${(buyCheck.percentageChange * 100).toFixed(1)}% change)`);
          loggedOutliers.add(logKey);
        }
      }
    }
  }
  
  // Check sell price
  if (item.bestSell !== null && baseline) {
    const sellCheck = checkOutlier(item.bestSell, baseline.sells);
    if (sellCheck.isOutlier) {
      result.outlierInfo.sellOutlier = true;
      result.outlierInfo.originalSell = item.bestSell;
      result.outlierInfo.medianSell = sellCheck.median;
      result.bestSell = sellCheck.median; // Replace with median
      
      if (logOutliers) {
        const logKey = `${currencyName}-sell`;
        if (!loggedOutliers.has(logKey)) {
          console.log(`⚠️  Outlier detected for ${currencyName} sell: ${item.bestSell} → ${sellCheck.median.toFixed(2)} (${(sellCheck.percentageChange * 100).toFixed(1)}% change)`);
          loggedOutliers.add(logKey);
        }
      }
    }
  }
  
  // Recalculate market gap with cleaned prices
  if (result.bestBuy !== null && result.bestSell !== null) {
    result.marketGap = result.bestSell - result.bestBuy;
  }
  
  return result;
}

// ============================================================================
// API ENDPOINT HELPERS
// ============================================================================

/**
 * Get latest valid data with outlier protection
 * Used by /api/data endpoint
 */
function getValidDataWithOutlierProtection(docs) {
  // Clear outlier log on new MongoDB data
  if (docs.length > 0 && docs[0].time) {
    const currentTimestamp = docs[0].time.toString();
    if (currentTimestamp !== lastMongoTimestamp) {
      loggedOutliers.clear();
      lastMongoTimestamp = currentTimestamp;
      console.log(`📊 New MongoDB data detected at ${new Date(docs[0].time).toLocaleString()}`);
    }
  }
  
  // Build historical baselines from older documents
  const historicalBaselines = buildHistoricalBaseline(docs);
  
  const validData = new Map(); // Map<currencyName, item>
  
  // Process most recent 3 documents
  for (let i = 0; i < Math.min(3, docs.length); i++) {
    const doc = docs[i];
    const processed = processCurrencyData(doc.data);
    
    for (const item of processed) {
      const currencyName = item.currency;
      
      // Skip if we already have valid data for this currency
      if (validData.has(currencyName)) {
        continue;
      }
      
      // Get baseline for this currency
      const baseline = historicalBaselines.get(currencyName);
      
      // Process with outlier detection
      const processedItem = processDataWithOutlierDetection(item, baseline, currencyName, true);
      
      validData.set(currencyName, processedItem);
    }
  }
  
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
    
    // Build historical baseline for this specific currency
    const currencyBaselines = new Map();
    
    // Build baseline from docs 3-50 for more history context
    for (const doc of docs.slice(OUTLIER_CONFIG.BASELINE_START_INDEX, 50)) {
      const currencyEntry = findCurrencyEntry(doc.data, currency);
      if (currencyEntry) {
        const processed = processCurrencyData([currencyEntry]);
        if (processed.length > 0) {
          const item = processed[0];
          if (!currencyBaselines.has(currency)) {
            currencyBaselines.set(currency, { buys: [], sells: [] });
          }
          const baseline = currencyBaselines.get(currency);
          if (item.bestBuy !== null) baseline.buys.push(item.bestBuy);
          if (item.bestSell !== null) baseline.sells.push(item.bestSell);
        }
      }
    }
    
    const baseline = currencyBaselines.get(currency);
    const history = [];
    
    // Track last known good values (we process in chronological order - oldest first)
    let lastValidBuy = null;
    let lastValidSell = null;
    
    // Process documents in chronological order (oldest first) to properly track last valid values
    const docsChronological = [...docs].reverse();
    
    for (const doc of docsChronological) {
      const currencyEntry = findCurrencyEntry(doc.data, currency);
      if (currencyEntry) {
        const processed = processCurrencyData([currencyEntry]);
        if (processed.length > 0) {
          const data = processed[0];
          
          // Check for outliers
          const result = { ...data, outlierInfo: {} };
          let shouldSkipDataPoint = false;
          
          // Check buy price
          if (data.bestBuy !== null && baseline) {
            const buyCheck = checkOutlier(data.bestBuy, baseline.buys);
            if (buyCheck.isOutlier) {
              result.outlierInfo.buyOutlier = true;
              result.outlierInfo.originalBuy = data.bestBuy;
              
              if (buyCheck.isZero) {
                // Zero means OCR failed - skip this data point entirely
                shouldSkipDataPoint = true;
              } else if (buyCheck.correctedValue !== null) {
                // Use OCR-corrected value
                result.bestBuy = buyCheck.correctedValue;
                result.outlierInfo.buyOCRCorrected = true;
                result.outlierInfo.correctedBuy = buyCheck.correctedValue;
                console.log(`🔧 OCR-corrected ${currency} buy: ${data.bestBuy} → ${buyCheck.correctedValue} (stripped misread suffix)`);
                // Update last valid with corrected value
                lastValidBuy = buyCheck.correctedValue;
              } else {
                // Use last valid buy, or median as fallback
                const replacementSource = lastValidBuy !== null ? 'last valid' : 'median';
                result.bestBuy = lastValidBuy !== null ? lastValidBuy : buyCheck.median;
                result.outlierInfo.replacedBuyWith = result.bestBuy;
                console.log(`⚠️  ${currency} buy outlier ${data.bestBuy} replaced with ${result.bestBuy} (${replacementSource})`);
              }
            } else {
              // Update last valid buy with this good value
              lastValidBuy = data.bestBuy;
            }
          }
          
          // Check sell price
          if (data.bestSell !== null && baseline) {
            const sellCheck = checkOutlier(data.bestSell, baseline.sells);
            if (sellCheck.isOutlier) {
              result.outlierInfo.sellOutlier = true;
              result.outlierInfo.originalSell = data.bestSell;
              
              if (sellCheck.isZero) {
                // Zero means OCR failed - skip this data point entirely
                shouldSkipDataPoint = true;
              } else if (sellCheck.correctedValue !== null) {
                // Use OCR-corrected value
                result.bestSell = sellCheck.correctedValue;
                result.outlierInfo.sellOCRCorrected = true;
                result.outlierInfo.correctedSell = sellCheck.correctedValue;
                console.log(`🔧 OCR-corrected ${currency} sell: ${data.bestSell} → ${sellCheck.correctedValue} (stripped misread suffix)`);
                // Update last valid with corrected value
                lastValidSell = sellCheck.correctedValue;
              } else {
                // Use last valid sell, or median as fallback
                const replacementSource = lastValidSell !== null ? 'last valid' : 'median';
                result.bestSell = lastValidSell !== null ? lastValidSell : sellCheck.median;
                result.outlierInfo.replacedSellWith = result.bestSell;
                console.log(`⚠️  ${currency} sell outlier ${data.bestSell} replaced with ${result.bestSell} (${replacementSource})`);
              }
            } else {
              // Update last valid sell with this good value
              lastValidSell = data.bestSell;
            }
          }
          
          // Skip data point if either price is zero (OCR complete failure)
          if (shouldSkipDataPoint) {
            console.log(`⚠️  Skipping ${currency} data point due to zero value (OCR failure)`);
            continue;
          }
          
          // Ensure buy < sell (market spread validation)
          if (result.bestBuy !== null && result.bestSell !== null && result.bestBuy > result.bestSell) {
            console.log(`🔄 ${currency} buy/sell swapped: buy=${result.bestBuy}, sell=${result.bestSell}. Correcting...`);
            // Swap them
            const temp = result.bestBuy;
            result.bestBuy = result.bestSell;
            result.bestSell = temp;
            
            // Mark as swapped in outlier info
            result.outlierInfo.swapped = true;
            
            // Update last valid values with corrected order
            lastValidBuy = result.bestBuy;
            lastValidSell = result.bestSell;
          }
          
          // Recalculate market gap with cleaned prices
          if (result.bestBuy !== null && result.bestSell !== null) {
            result.marketGap = result.bestSell - result.bestBuy;
          }
          
          history.push({
            time: doc.time,
            data: result
          });
        }
      }
    }
    
    // Return all historical data (already in chronological order - oldest first)
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});

