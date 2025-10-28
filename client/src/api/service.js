import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export const fetchCurrencyData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/data`);
    return response.data;
  } catch (error) {
    console.error('Error fetching currency data:', error);
    throw error;
  }
};

export const fetchCurrencyHistory = async (currency) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/history/${currency}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching currency history:', error);
    throw error;
  }
};

export const normalizeCurrencyName = (name) => {
  if (!name) return '';
  
  // Convert to lowercase for comparison
  const lowerName = name.toLowerCase();
  
  // Handle common currency names
  const currencyMap = {
    'mirror of kalandra': 'mirror',
    'divine orb': 'divine',
    'exalted orb': 'exalted',
    'ancient orb': 'ancient',
    'tempering orb': 'tempering',
    'annul orb': 'annul',
    'orb of annulment': 'annul',
    'sacred orb': 'sacred',
    'veiled exalted orb': 'veiled exalted',
  };
  
  // Check for exact matches
  for (const [key, value] of Object.entries(currencyMap)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  
  // Try finding in the currency name
  for (const [key, value] of Object.entries(currencyMap)) {
    if (key.includes(lowerName) || lowerName.includes(key)) {
      return value;
    }
  }
  
  // Return simplified version
  return lowerName.replace(/ orb/gi, '').replace(/\s+/g, '-');
};

