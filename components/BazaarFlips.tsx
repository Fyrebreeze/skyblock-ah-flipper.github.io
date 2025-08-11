import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchBazaarFlips } from '../services/hypixelService';
import { BazaarFlip, SortConfig, SortableBazaarKeys } from '../types';
import { Spinner } from './ui/Spinner';

const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return 'N/A';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US').format(Math.round(num));
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortableBazaarKeys;
  sortConfig: SortConfig<SortableBazaarKeys> | null;
  requestSort: (key: SortableBazaarKeys) => void;
}> = ({ label, sortKey, sortConfig, requestSort }) => {
  const isSorted = sortConfig?.key === sortKey;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';

  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
      onClick={() => requestSort(sortKey)}
    >
      <span className="flex items-center">
        {label}
        <span className="ml-2">{directionIcon}</span>
      </span>
    </th>
  );
};

export const BazaarFlips: React.FC = () => {
  const [flips, setFlips] = useState<BazaarFlip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<SortableBazaarKeys> | null>({ key: 'profit', direction: 'descending' });

  const fetchFlips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newFlips = await fetchBazaarFlips();
      setFlips(newFlips);
      if (newFlips.length === 0) {
          setError('No profitable bazaar flips found right now. Markets might be stable.');
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to fetch bazaar data from Hypixel API. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlips();
    const intervalId = setInterval(fetchFlips, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestSort = (key: SortableBazaarKeys) => {
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

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Bazaar Flips</h2>
        <div className="text-right">
          <button onClick={fetchFlips} disabled={isLoading} className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-wait">
            {isLoading ? 'Refreshing...' : 'Refresh Now'}
          </button>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
        </div>
      </div>
      
      {isLoading && flips.length === 0 ? (
        <div className="flex justify-center items-center h-96 flex-col">
          <Spinner size="h-12 w-12" />
          <p className="mt-4 text-gray-400">Fetching live bazaar data from Hypixel...</p>
        </div>
      ) : error && sortedFlips.length === 0 ? (
        <div className="text-center py-10 px-4 text-orange-400 bg-gray-700/50 rounded-lg">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700/50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Item Name</th>
                <SortableHeader label="Profit Per Item" sortKey="profit" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Buy For (Each)" sortKey="buyPrice" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Sell For (Each)" sortKey="sellPrice" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Weekly Demand" sortKey="buyVolume" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Weekly Supply" sortKey="sellVolume" sortConfig={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedFlips.map((flip) => (
                <tr key={flip.id} className="hover:bg-gray-700/50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-cyan-300">{flip.itemName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-400 font-bold">+{formatNumber(flip.profit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-red-400">{formatNumber(flip.buyPrice)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-400">{formatNumber(flip.sellPrice)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400">{formatNumber(flip.buyVolume)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400">{formatNumber(flip.sellVolume)}</td>
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
