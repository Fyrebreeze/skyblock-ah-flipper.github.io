
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchItemsForAnalysis } from '../services/hypixelService';
import { analyzeItemValue, AIAnalysis } from '../services/geminiService';
import { MarketTrendFlip, Rarity, SortConfig, SortableTrendKeys } from '../types';
import { Spinner } from './ui/Spinner';
import { ItemCell } from './ui/ItemCell';

const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortableTrendKeys;
  sortConfig: SortConfig<SortableTrendKeys> | null;
  requestSort: (key: SortableTrendKeys) => void;
}> = ({ label, sortKey, sortConfig, requestSort }) => {
  const isSorted = sortConfig?.key === sortKey;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
  return (
    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(sortKey)}>
      <span className="flex items-center">{label}<span className="ml-2">{directionIcon}</span></span>
    </th>
  );
};

export const MarketTrends: React.FC = () => {
  const [trends, setTrends] = useState<MarketTrendFlip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<SortableTrendKeys> | null>({ key: 'potentialProfit', direction: 'descending' });
  const [progress, setProgress] = useState(0);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    try {
      const itemsToAnalyze = await fetchItemsForAnalysis();
      if (itemsToAnalyze.length === 0) {
        setError('Could not find any high-value items to analyze at the moment.');
        setTrends([]);
        setIsLoading(false);
        return;
      }

      const trendPromises = itemsToAnalyze.map(async (item, index) => {
        const analysis: AIAnalysis = await analyzeItemValue({
            name: item.name,
            lore: item.lore,
            rarity: item.rarity,
            price: item.price
        });
        setProgress(Math.round(((index + 1) / itemsToAnalyze.length) * 100));
        return {
          id: item.id,
          itemName: item.name,
          rarity: item.rarity,
          lore: item.lore,
          currentPrice: item.price,
          estimatedValue: analysis.estimatedValue,
          potentialProfit: analysis.potentialProfit,
          reasoning: analysis.reasoning,
        };
      });

      const newTrends = await Promise.all(trendPromises);
      
      const profitableTrends = newTrends.filter(t => t.potentialProfit > 10000 && t.estimatedValue > 0);

      setTrends(profitableTrends);
      if (profitableTrends.length === 0) {
        setError('AI analysis complete. No significant investment opportunities found.');
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to fetch data from Hypixel API for analysis. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
    // No auto-refresh for this tab due to API cost
  }, [fetchTrends]);

  const requestSort = (key: SortableTrendKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedTrends = useMemo(() => {
    let sortableItems = [...trends];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [trends, sortConfig]);

  const loadingMessage = `AI is analyzing market trends... (${progress}%)`;

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Market Trends (AI-Powered)</h2>
          <p className="text-sm text-gray-400 mt-1">Find undervalued items with long-term profit potential.</p>
        </div>
        <div className="text-right">
          <button onClick={fetchTrends} disabled={isLoading} className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-wait">
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
      ) : error && sortedTrends.length === 0 ? (
        <div className="text-center py-10 px-4 text-orange-400 bg-gray-700/50 rounded-lg">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Item Name</th>
                <SortableHeader label="Potential Profit" sortKey="potentialProfit" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Current Price" sortKey="currentPrice" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="AI Est. Value" sortKey="estimatedValue" sortConfig={sortConfig} requestSort={requestSort} />
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">AI Reasoning</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedTrends.map((trend) => (
                <tr key={trend.id} className="hover:bg-gray-700/50 transition-colors duration-150">
                  <ItemCell itemName={trend.itemName} rarity={trend.rarity} lore={trend.lore} />
                  <td className={`px-6 py-4 whitespace-nowrap font-bold ${trend.potentialProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{trend.potentialProfit > 0 ? '+' : ''}{formatNumber(trend.potentialProfit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{formatNumber(trend.currentPrice)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-cyan-400">{formatNumber(trend.estimatedValue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm italic">"{trend.reasoning}"</td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && sortedTrends.length > 0 && <p className="text-center text-sm mt-4 text-orange-400">{error}</p>}
        </div>
      )}
    </div>
  );
};