
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAuctionFlips } from '../services/hypixelService';
import { AuctionFlip, SortConfig, SortableAuctionKeys } from '../types';
import { Spinner } from './ui/Spinner';
import { ItemCell } from './ui/ItemCell';

const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return 'N/A';
  return new Intl.NumberFormat('en-US').format(num);
};

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortableAuctionKeys;
  sortConfig: SortConfig<SortableAuctionKeys> | null;
  requestSort: (key: SortableAuctionKeys) => void;
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

export const AuctionFlips: React.FC = () => {
  const [flips, setFlips] = useState<AuctionFlip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<SortableAuctionKeys> | null>({ key: 'profit', direction: 'descending' });
  const [copiedId, setCopiedId] = useState<string | null>(null);


  const fetchFlips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newFlips = await fetchAuctionFlips();
      setFlips(newFlips);
      if (newFlips.length === 0) {
        setError('No profitable auction flips found at the moment. Check back soon!');
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to fetch data from Hypixel API. This can happen during high traffic. Please try again later.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlips();
    const intervalId = setInterval(fetchFlips, 60000); // Refresh every 60 seconds
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestSort = (key: SortableAuctionKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleCopyCommand = (auctionId: string) => {
    const command = `/viewauction ${auctionId}`;
    navigator.clipboard.writeText(command);
    setCopiedId(auctionId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000); // Reset after 2 seconds
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
  
  const loadingMessage = 'Scanning all active auctions for flips... This may take a moment.';

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Auction Flips</h2>
        <div className="text-right">
          <button onClick={fetchFlips} disabled={isLoading} className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-wait">
            {isLoading && flips.length === 0 ? 'Refreshing...' : 'Refresh Now'}
          </button>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
        </div>
      </div>
      
      {isLoading && flips.length === 0 ? (
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
                <SortableHeader label="Lowest BIN" sortKey="lowestBin" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Market Price" sortKey="marketPrice" sortConfig={sortConfig} requestSort={requestSort} />
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedFlips.map((flip) => (
                <tr key={flip.id} className="hover:bg-gray-700/50 transition-colors duration-150">
                  <ItemCell itemName={flip.itemName} rarity={flip.rarity} lore={flip.lore} />
                  <td className="px-6 py-4 whitespace-nowrap text-green-400 font-bold">+{formatNumber(flip.profit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{formatNumber(flip.lowestBin)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300">{formatNumber(flip.marketPrice)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => handleCopyCommand(flip.id)}
                      className={`px-3 py-1 text-sm rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                        copiedId === flip.id
                          ? 'bg-green-500 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {copiedId === flip.id ? 'Copied!' : 'Copy Command'}
                    </button>
                  </td>
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