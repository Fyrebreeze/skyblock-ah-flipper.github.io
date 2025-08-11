
import { GoogleGenAI, Type } from "@google/genai";
import { Rarity } from "../types";

// This check is to prevent running on the server, where process might be defined.
// The API key is injected by the hosting environment.
if (typeof process === 'undefined') {
  (globalThis as any).process = { env: {} };
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    estimatedValue: {
      type: Type.NUMBER,
      description: "The estimated fair market value of the item in coins.",
    },
    potentialProfit: {
      type: Type.NUMBER,
      description: "The potential profit after subtracting the current price and an auction tax from the estimated value."
    },
    reasoning: {
      type: Type.STRING,
      description: "A brief (max 20 words) explanation for the valuation."
    },
  },
  required: ["estimatedValue", "potentialProfit", "reasoning"],
};

export interface AIAnalysis {
  estimatedValue: number;
  potentialProfit: number;
  reasoning: string;
}

const generatePrompt = (name: string, lore: string, rarity: Rarity, price: number): string => {
  return `
    You are a Hypixel Skyblock economy expert. Your task is to evaluate an item from the Auction House and determine if it's undervalued.

    Item Details:
    - Name: "${name}"
    - Rarity: ${rarity}
    - Current Lowest Price: ${price.toLocaleString()} coins
    - Raw Lore & Stats: "${lore.replace(/§[a-f0-9klmnor]/g, '')}"

    Your Task:
    1.  Estimate the item's true "Fair Market Value" in coins. This is what a knowledgeable player would typically pay.
        - To do this, analyze the item's enchantments, stats, and other modifiers from its lore.
        - For craftable items, consider the cost of its base materials (e.g., enchanted diamond blocks for armor).
        - Factor in the value of applied upgrades like Hot Potato Books, Recombobulator 3000 usage, gemstones, etc.
        - Your final valuation should reflect the price of a similarly-upgraded item on the market.
    2.  Calculate the "Potential Profit". This is the Fair Market Value minus the Current Lowest Price, with an auction tax also subtracted. The tax is 1% for items under 1M, and 2% for items 1M and over. The formula is: (Profit = (FairMarketValue - Tax) - CurrentLowestPrice). If the item is overpriced, the profit can be negative.
    3.  Provide a brief "Reasoning" (max 20 words) explaining your valuation. Example: "Undervalued due to desirable 'Ultimate Wise V' enchant." or "Priced well for a clean version."

    Return your analysis ONLY in the provided JSON format. Do not include any other text or explanation.
  `;
};


export const analyzeItemValue = async (
  item: { name: string, lore: string, rarity: Rarity, price: number }
): Promise<AIAnalysis> => {
  try {
    const prompt = generatePrompt(item.name, item.lore, item.rarity, item.price);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.3,
      },
    });

    const jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    return {
      estimatedValue: Math.round(parsedJson.estimatedValue),
      potentialProfit: Math.round(parsedJson.potentialProfit),
      reasoning: parsedJson.reasoning,
    }

  } catch (error) {
    console.error("Error analyzing item with Gemini:", item.name, error);
    // Return a default error object so the UI can handle it gracefully
    return {
      estimatedValue: 0,
      potentialProfit: 0,
      reasoning: "AI analysis failed for this item."
    };
  }
};

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

const recipeSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      ingredientId: {
        type: Type.STRING,
        description: "The official Bazaar Product ID for the ingredient (e.g., 'ENCHANTED_DIAMOND_BLOCK')."
      },
      quantity: {
        type: Type.NUMBER,
        description: "The total quantity of this ingredient needed for one craft."
      }
    },
    required: ["ingredientId", "quantity"]
  }
}

export const analyzeCraftingRecipe = async (itemName: string): Promise<RecipeIngredient[]> => {
  try {
    const prompt = `
      You are an expert on Hypixel Skyblock crafting recipes.
      Item to analyze: "${itemName}"

      Your task:
      1. Identify the primary crafting recipe for this item. Focus on recipes using materials available on the Bazaar.
      2. If the item is an upgraded version (e.g., a weapon with stars), determine the recipe for its base version.
      3. If the item is not craftable from common materials or is primarily a drop (e.g., 'Summoning Eye'), return an empty array.
      4. List the total quantity of each base ingredient. For example, for an 'Aspect of the End', list 'ENCHANTED_EYE_OF_ENDER' and 'ENCHANTED_DIAMOND' not the intermediate 'Ender Eye Blocks'.

      Respond ONLY with a JSON array in the specified format. Do not add any explanation.
    `;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
        temperature: 0.1,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as RecipeIngredient[];

  } catch (error) {
    console.error(`Error analyzing recipe for ${itemName}:`, error);
    return []; // Return empty on error
  }
};
