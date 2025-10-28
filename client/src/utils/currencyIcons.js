// Import currency, fragment, and item overview JSON data
import currencyOverview from './currencyoverview.json';
import fragmentOverview from './fragmentoverview.json';
import itemOverview from './itemoverview.json';

// Build icon map from all JSON files on initialization
const CURRENCY_ICONS = {};

// Load currency icons
if (currencyOverview && currencyOverview.currencyDetails) {
  currencyOverview.currencyDetails.forEach(currency => {
    if (currency.name && currency.icon) {
      CURRENCY_ICONS[currency.name] = currency.icon;
    }
  });
}

// Load fragment icons
if (fragmentOverview && fragmentOverview.currencyDetails) {
  fragmentOverview.currencyDetails.forEach(fragment => {
    if (fragment.name && fragment.icon) {
      CURRENCY_ICONS[fragment.name] = fragment.icon;
    }
  });
}

// Load item icons (scarabs, etc.) - different structure with 'lines' array
if (itemOverview && itemOverview.lines) {
  itemOverview.lines.forEach(item => {
    if (item.name && item.icon) {
      CURRENCY_ICONS[item.name] = item.icon;
    }
  });
}

// Default fallback icon for items that don't match any currency/fragment/item
const DEFAULT_ICON = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvRGl2aW5hdGlvbi9JbnZlbnRvcnlJY29uIiwidyI6MSwiaCI6MSwic2NhbGUiOjF9XQ/f34bf8cbb5/InventoryIcon.png';

// Helper function to get currency icon URL
// Uses exact name matching - no lowercase shenanigans
export function getCurrencyIcon(currencyName) {
  if (!currencyName) return null;

  // Exact match (MongoDB name directly to JSON name)
  // Falls back to divination card icon if no match found
  return CURRENCY_ICONS[currencyName] || DEFAULT_ICON;
}

