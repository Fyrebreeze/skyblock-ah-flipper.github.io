import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchItemsForAnalysis, fetchCraftingFlips } from '../services/hypixelService';
import { CraftingFlip, SortConfig, SortableCraftingKeys } from '../types';
import { Spinner } from './ui/Spinner';
import { ItemCell } from './ui/ItemCell';

const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortableCraftingKeys;
  sortConfig: SortConfig<SortableCraftingKeys> | null;
  requestSort: (key: SortableCraftingKeys) => void;
}> = ({ label, sortKey, sortConfig, requestSort }) => {
  const isSorted = sortConfig?.key === sortKey;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
  return (
    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(sortKey)}>
      <span className="flex items-center">{label}<span className="ml-2">{directionIcon}</span></span>
    </th>
  );
};

export const CraftingFlips: React.FC = () => {
  const [flips, setFlips] = useState<CraftingFlip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<SortableCraftingKeys> | null>({ key: 'profit', direction: 'descending' });
  const [progress, setProgress] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setFlips([]);
    try {
      const itemsToAnalyze = await fetchItemsForAnalysis(30); // Analyze more items for crafting
      if (itemsToAnalyze.length === 0) {
        setError('Could not find any suitable items to analyze for crafting flips.');
        setIsLoading(false);
        return;
      }
      
      const newFlips = await fetchCraftingFlips(itemsToAnalyze, setProgress);
      
      setFlips(newFlips);
      if (newFlips.length === 0) {
        setError('AI analysis complete. No profitable crafting flips found at the moment.');
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to fetch data for crafting analysis. The Hypixel API might be down.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const requestSort = (key: SortableCraftingKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedFlips = useMemo(() => {
    let sortableItems = [...flips];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [flips, sortConfig]);

  const loadingMessage = `AI is analyzing recipes and costs... (${progress}%)`;

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Crafting Analysis</h2>
          <p className="text-sm text-gray-400 mt-1">Find items profitable to craft from Bazaar materials and sell on the AH.</p>
        </div>
        <div className="text-right">
          <button onClick={fetchData} disabled={isLoading} className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-wait">
            {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
        </div>
      </div>
      
      {isLoading ? (
         <div className="flex justify-center items-center h-96 flex-col">
            <Spinner size="h-12 w-12" />
            <p className="mt-4 text-gray-400 text-center">{loadingMessage}</p>
         </div>
      ) : error && sortedFlips.length === 0 ? (
        <div className="text-center py-10 px-4 text-orange-400 bg-gray-700/50 rounded-lg">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Item Name</th>
                <SortableHeader label="Profit" sortKey="profit" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Craft Cost" sortKey="craftCost" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Market Price" sortKey="marketPrice" sortConfig={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedFlips.map((flip) => (
                <tr key={flip.id} className="hover:bg-gray-700/50 transition-colors duration-150">
                  <ItemCell itemName={flip.itemName} rarity={flip.rarity} recipe={flip.recipe} />
                  <td className="px-6 py-4 whitespace-nowrap text-green-400 font-bold">+{formatNumber(flip.profit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-400">{formatNumber(flip.craftCost)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-cyan-400">{formatNumber(flip.marketPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && sortedFlips.length > 0 && <p className="text-center text-sm mt-4 text-orange-400">{error}</p>}
        </div>
      )}
    </div>
  );
};
