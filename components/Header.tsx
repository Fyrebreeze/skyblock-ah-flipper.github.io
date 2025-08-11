import React from 'react';
import type { View } from '../App';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => {
  const baseClasses = "px-3 sm:px-4 py-2 rounded-md text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900 whitespace-nowrap";
  const activeClasses = "bg-purple-600 text-white shadow-md";
  const inactiveClasses = "bg-gray-700 text-gray-300 hover:bg-gray-600";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
    >
      {label}
    </button>
  );
};


export const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex-shrink-0">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-white">
              <span className="text-purple-400">Hypixel</span> Flip Finder
            </h1>
          </div>
          <nav className="flex space-x-2 sm:space-x-4">
            <NavButton
              label="Auction Flips"
              isActive={currentView === 'auctions'}
              onClick={() => setCurrentView('auctions')}
            />
            <NavButton
              label="Crafting Analysis"
              isActive={currentView === 'crafting'}
              onClick={() => setCurrentView('crafting')}
            />
             <NavButton
              label="Market Trends"
              isActive={currentView === 'trends'}
              onClick={() => setCurrentView('trends')}
            />
            <NavButton
              label="Bazaar Flips"
              isActive={currentView === 'bazaar'}
              onClick={() => setCurrentView('bazaar')}
            />
          </nav>
        </div>
      </div>
    </header>
  );
};