
import { AuctionFlip, BazaarFlip, CraftingFlip, Ingredient, Rarity, RawAuction } from '../types';
import { analyzeCraftingRecipe } from './geminiService';

const API_BASE_URL = 'https://api.hypixel.net/v2/skyblock';
const PROFIT_THRESHOLD = 50000; // Minimum profit to be considered a flip
const MIN_PRICE = 1; // Minimum price for an item to be considered, to filter out junk

// Helper to clean up item names from auctions for grouping.
const normalizeAuctionName = (name: string): string => {
    // We remove color codes and reforge prefixes like "⚚ " or "✪"
    return name.replace(/§[a-f0-9k-or]/g, '').replace(/^[✪⚚\s]+|[\s✪⚚]+$/g, '').trim();
};

const formatItemName = (name: string): string => {
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const calculateAhTax = (price: number): number => {
  if (price >= 1_000_000) {
    return price * 0.02; // 2% tax for 1M+
  }
  return price * 0.01; // 1% tax under 1M
};

// --- BAZAAR LOGIC ---

// Helper to get all bazaar prices
export const fetchBazaarPrices = async (): Promise<Map<string, { price: number; name: string }>> => {
    const response = await fetch(`${API_BASE_URL}/bazaar`);
    if (!response.ok) throw new Error('Failed to fetch Bazaar data');
    const data = await response.json();
    if (!data.success) throw new Error(data.cause || 'Bazaar API call failed');

    const priceMap = new Map<string, { price: number; name: string }>();
    for (const productId in data.products) {
        const product = data.products[productId];
        const status = product.quick_status;
        if (status && status.sellPrice > 0) {
            priceMap.set(productId, {
                price: status.sellPrice, // Player buys from Bazaar at this price
                name: formatItemName(product.product_id)
            });
        }
    }
    return priceMap;
};

export const fetchBazaarFlips = async (): Promise<BazaarFlip[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/bazaar`);
    if (!response.ok) throw new Error('Failed to fetch Bazaar data');
    const data = await response.json();
    if (!data.success) throw new Error(data.cause || 'Bazaar API call failed');

    const flips: BazaarFlip[] = [];

    for (const productId in data.products) {
        const product = data.products[productId];
        const status = product.quick_status;
        if (status && status.sellPrice > 0 && status.buyPrice > 0) {
            const buyFor = status.sellPrice; // Instant buy price
            const sellFor = status.buyPrice; // Instant sell price
            const profit = sellFor - buyFor;
            if (profit > 100 && status.buyMovingWeek > 100) { // Filter for decent profit and volume
                flips.push({
                    id: productId,
                    itemName: formatItemName(product.product_id),
                    buyPrice: buyFor,
                    sellPrice: sellFor,
                    profit,
                    buyVolume: status.buyMovingWeek,
                    sellVolume: status.sellMovingWeek,
                });
            }
        }
    }
    return flips;
  } catch (error) {
    console.error("Error fetching bazaar flips:", error);
    throw error;
  }
};

// --- AUCTION FLIP LOGIC ---

/**
 * Finds a realistic market price for an item by analyzing a list of its auctions.
 * This method filters outliers and identifies the "wall" where prices stabilize.
 * @param sortedAuctions A list of auctions for a single item, sorted by price ascending.
 * @returns The auction representing the market price, or null if one cannot be determined.
 */
const findMarketPriceAuction = (sortedAuctions: RawAuction[]): RawAuction | null => {
    // We need at least 3 auctions: one to buy, and two to establish a market price.
    if (sortedAuctions.length < 3) {
        // Not enough data for analysis, fallback to 2nd lowest if it exists.
        return sortedAuctions[1] || null;
    }

    const marketCandidates = sortedAuctions.slice(1);

    // 1. Outlier removal using IQR to filter unusually high prices.
    const prices = marketCandidates.map(a => a.starting_bid);
    const q1Index = Math.floor(prices.length / 4);
    const q3Index = Math.floor(prices.length * 3 / 4);
    
    // Ensure indices are valid, especially for small arrays
    if (q1Index >= prices.length || q3Index >= prices.length) {
       return marketCandidates[0] || null; // Not enough data for IQR
    }

    const q1 = prices[q1Index];
    const q3 = prices[q3Index];
    const iqr = q3 - q1;

    // Define a generous upper bound to trim only extreme outliers.
    const upperBound = q3 + 2.0 * iqr;

    const filteredCandidates = marketCandidates.filter(a => a.starting_bid <= upperBound);

    // If filtering was too aggressive, it's safer to just use the 2nd lowest BIN.
    if (filteredCandidates.length < 2) {
        return marketCandidates[0] || null;
    }

    // 2. Find the "market wall" by looking for a significant price jump.
    // A wall is the start of a dense cluster of prices. We find it by locating the
    // first large gap between items. The wall starts right after that gap.
    const GAP_THRESHOLD = 0.08; // 8% price jump is considered significant.
    
    let wallStartIndex = -1;

    for (let i = 0; i < filteredCandidates.length - 1; i++) {
        const priceA = filteredCandidates[i].starting_bid;
        const priceB = filteredCandidates[i+1].starting_bid;

        if (priceA > 0) {
            const gap = (priceB - priceA) / priceA;
            if (gap > GAP_THRESHOLD) {
                wallStartIndex = i + 1;
                break;
            }
        }
    }
    
    if (wallStartIndex !== -1) {
        // We found a jump, so the market wall is the first item after the jump.
        return filteredCandidates[wallStartIndex];
    } else {
        // No significant jump found, meaning prices are relatively clustered.
        // The first item in our filtered list is the most reliable floor price.
        return filteredCandidates[0];
    }
};


export const fetchAuctionFlips = async (): Promise<AuctionFlip[]> => {
  const allAuctions = await fetchAllAuctionPages();

  // Filter for active BINs and group by item name.
  const activeBins = allAuctions.filter(auc => auc.bin && !auc.claimed);
  const groupedAuctions = new Map<string, RawAuction[]>();

  activeBins.forEach(auction => {
    const normalizedName = normalizeAuctionName(auction.item_name);
    if (!groupedAuctions.has(normalizedName)) {
      groupedAuctions.set(normalizedName, []);
    }
    groupedAuctions.get(normalizedName)!.push(auction);
  });
  
  // Find flips within each group.
  const flips: AuctionFlip[] = [];

  for (const [itemName, auctions] of groupedAuctions.entries()) {
    if (auctions.length < 2) continue;
    
    const sortedAuctions = auctions.sort((a, b) => a.starting_bid - b.starting_bid);
    
    const buyAuction = sortedAuctions[0];
    const buyPrice = buyAuction.starting_bid;
    
    if (buyPrice < MIN_PRICE) continue;

    // Use the advanced algorithm to find a realistic market price
    const marketPriceAuction = findMarketPriceAuction(sortedAuctions);
    
    if (!marketPriceAuction) continue;

    const marketPrice = marketPriceAuction.starting_bid;
    
    if (marketPrice <= buyPrice) continue;

    const postTaxSellPrice = marketPrice - calculateAhTax(marketPrice);
    const profit = postTaxSellPrice - buyPrice;
    
    if (profit > PROFIT_THRESHOLD) {
      flips.push({
        id: buyAuction.uuid,
        itemName: itemName, // Use the grouped (normalized) name
        rarity: buyAuction.tier,
        lore: buyAuction.item_lore,
        lowestBin: buyPrice,
        marketPrice: marketPrice,
        profit: Math.round(profit),
      });
    }
  }

  return flips;
};

// --- HELPER for fetching all auction pages ---
const fetchAllAuctionPages = async (maxPages: number = 35): Promise<RawAuction[]> => {
    const firstPageResponse = await fetch(`${API_BASE_URL}/auctions?page=0`);
    if (!firstPageResponse.ok) throw new Error(`Hypixel API error: ${firstPageResponse.statusText}`);
    const firstPageData = await firstPageResponse.json();
    if (!firstPageData.success) throw new Error(firstPageData.cause || 'Failed to fetch auctions.');
    
    let allAuctions: RawAuction[] = firstPageData.auctions;
    const totalPages = Math.min(firstPageData.totalPages, maxPages);
    
    // Fetch pages in chunks to avoid too many parallel requests
    const chunkSize = 5;
    for (let i = 1; i < totalPages; i += chunkSize) {
        const pagePromises = [];
        const end = Math.min(i + chunkSize, totalPages);
        for (let j = i; j < end; j++) {
            pagePromises.push(
                fetch(`${API_BASE_URL}/auctions?page=${j}`)
                .then(res => res.json())
                .catch(e => {
                    console.warn(`Failed to fetch auction page ${j}:`, e);
                    return null; // Continue even if one page fails
                })
            );
        }
        
        const pagesData = await Promise.all(pagePromises);
        pagesData.forEach(page => {
          if (page && page.success) {
            allAuctions = allAuctions.concat(page.auctions);
          }
        });
    }

    return allAuctions;
}

// --- AI-POWERED ANALYSIS LOGIC ---
export interface ItemForAnalysis {
  id: string;
  name: string;
  lore: string;
  rarity: Rarity;
  price: number;
}

export const fetchItemsForAnalysis = async (maxItems: number = 15): Promise<ItemForAnalysis[]> => {
    const allAuctions = await fetchAllAuctionPages(10); // Fetch fewer pages for this analysis
    const activeBins = allAuctions.filter(auc => auc.bin && !auc.claimed);

    // Group auctions by normalized name to find the lowest BIN for each
    const itemMap = new Map<string, RawAuction>();
    activeBins.forEach(auction => {
        const normalizedName = normalizeAuctionName(auction.item_name);
        const existing = itemMap.get(normalizedName);
        if (!existing || auction.starting_bid < existing.starting_bid) {
            itemMap.set(normalizedName, auction);
        }
    });

    // Filter for interesting items to send to the AI
    const candidates = Array.from(itemMap.values()).filter(auc => {
        const isHighRarity = [Rarity.EPIC, Rarity.LEGENDARY, Rarity.MYTHIC].includes(auc.tier);
        const hasLore = auc.item_lore && auc.item_lore.length > 50; // Ensure item has substantial lore/stats
        const isDecentPrice = auc.starting_bid > 250000;
        return isHighRarity && hasLore && isDecentPrice;
    });

    // Sort by price to get a mix of items, then take a sample
    const sortedCandidates = candidates.sort((a, b) => b.starting_bid - a.starting_bid);
    
    return sortedCandidates.slice(0, maxItems).map(auc => ({
        id: auc.uuid,
        name: normalizeAuctionName(auc.item_name),
        lore: auc.item_lore,
        rarity: auc.tier,
        price: auc.starting_bid
    }));
};

// --- CRAFTING FLIP LOGIC ---
const CRAFT_PROFIT_THRESHOLD = 100000;

export const fetchCraftingFlips = async (
    itemsToAnalyze: ItemForAnalysis[],
    progressCallback: (progress: number) => void
): Promise<CraftingFlip[]> => {
    const bazaarPrices = await fetchBazaarPrices();
    const craftingFlips: CraftingFlip[] = [];

    let processedCount = 0;

    for (const item of itemsToAnalyze) {
        const recipeIngredients = await analyzeCraftingRecipe(item.name);
        processedCount++;
        progressCallback(Math.round((processedCount / itemsToAnalyze.length) * 100));

        if (recipeIngredients.length === 0) {
            continue; // Not craftable or AI failed
        }

        let craftCost = 0;
        let isCraftable = true;
        const recipeForDisplay: Ingredient[] = [];

        for (const ingredient of recipeIngredients) {
            const materialInfo = bazaarPrices.get(ingredient.ingredientId);
            if (!materialInfo) {
                isCraftable = false; // A material isn't on the bazaar
                break;
            }
            craftCost += materialInfo.price * ingredient.quantity;
            recipeForDisplay.push({
                id: ingredient.ingredientId,
                name: materialInfo.name,
                quantity: ingredient.quantity,
            });
        }

        if (isCraftable && craftCost > 0) {
            const profit = (item.price - calculateAhTax(item.price)) - craftCost;
            if (profit > CRAFT_PROFIT_THRESHOLD) {
                craftingFlips.push({
                    id: item.id,
                    itemName: item.name,
                    rarity: item.rarity,
                    marketPrice: item.price,
                    craftCost: Math.round(craftCost),
                    profit: Math.round(profit),
                    recipe: recipeForDisplay
                });
            }
        }
    }

    return craftingFlips;
};
