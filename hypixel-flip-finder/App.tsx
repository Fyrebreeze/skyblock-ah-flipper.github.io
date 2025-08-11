import React, { useState } from 'react';
import { Header } from './components/Header';
import { AuctionFlips } from './components/AuctionFlips';
import { BazaarFlips } from './components/BazaarFlips';
import { MarketTrends } from './components/MarketTrends';
import { CraftingFlips } from './components/CraftingFlips';

export type View = 'auctions' | 'bazaar' | 'trends' | 'crafting';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('auctions');

  const renderContent = () => {
    switch(currentView) {
      case 'auctions':
        return <AuctionFlips />;
      case 'crafting':
        return <CraftingFlips />;
      case 'trends':
        return <MarketTrends />;
      case 'bazaar':
        return <BazaarFlips />;
      default:
        return <AuctionFlips />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>
      <footer className="text-center p-4 text-gray-500 text-sm">
        <p>Flip data is from the official Hypixel API and may have a short delay. AI analysis is for entertainment purposes. Always double-check in-game prices.</p>
        <p>Built by a world-class senior frontend React engineer with AI expertise.</p>
      </footer>
    </div>
  );
};

export default App;