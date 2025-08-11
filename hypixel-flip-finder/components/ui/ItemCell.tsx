import React, { useState } from 'react';
import { Rarity, Ingredient } from '../../types';
import { LoreParser } from './LoreParser';

interface ItemCellProps {
  itemName: string;
  rarity: Rarity;
  lore?: string;
  recipe?: Ingredient[];
}

const getRarityColor = (rarity: Rarity): string => {
  switch (rarity) {
    case Rarity.COMMON: return 'text-white';
    case Rarity.UNCOMMON: return 'text-green-400';
    case Rarity.RARE: return 'text-blue-400';
    case Rarity.EPIC: return 'text-purple-500';
    case Rarity.LEGENDARY: return 'text-gold';
    case Rarity.MYTHIC: return 'text-pink-400';
    case Rarity.SPECIAL: return 'text-red-500';
    case Rarity.VERY_SPECIAL: return 'text-red-500';
    default: return 'text-gray-300';
  }
};

export const ItemCell: React.FC<ItemCellProps> = ({ itemName, rarity, lore, recipe }) => {
  const [isHovered, setIsHovered] = useState(false);

  const renderTooltipContent = () => {
    if (recipe && recipe.length > 0) {
      return (
        <div>
          <h4 className="font-bold text-white mb-2 border-b border-gray-700 pb-1">Crafting Recipe</h4>
          <ul className="space-y-1">
            {recipe.map(ing => (
              <li key={ing.id} className="text-sm text-cyan-300">
                <span className="text-gray-300">{ing.quantity.toLocaleString()}x</span> {ing.name}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (lore) {
      return (
        <div>
          <h3 className={`font-bold text-lg mb-2 ${getRarityColor(rarity)}`}>{itemName}</h3>
          <div className="border-t border-gray-700 pt-2 font-mono">
            <LoreParser lore={lore} />
          </div>
        </div>
      );
    }
    return null;
  };

  const hasTooltip = !!(lore || (recipe && recipe.length > 0));

  return (
    <td className="px-6 py-4 whitespace-nowrap">
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className={`font-semibold ${getRarityColor(rarity)} ${hasTooltip ? 'cursor-help' : ''}`}>
          {itemName}
        </span>

        {isHovered && hasTooltip && (
          <div className="absolute bottom-full left-0 mb-2 w-max max-w-sm bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-3 z-50 pointer-events-none">
            {renderTooltipContent()}
          </div>
        )}
      </div>
    </td>
  );
};