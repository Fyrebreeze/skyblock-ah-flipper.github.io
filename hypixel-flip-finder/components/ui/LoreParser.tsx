import React, { useMemo } from 'react';

const colorMap: { [key: string]: string } = {
  '0': 'text-black',
  '1': 'text-blue-900',
  '2': 'text-green-700',
  '3': 'text-cyan-700',
  '4': 'text-red-700',
  '5': 'text-purple-700',
  '6': 'text-gold',
  '7': 'text-gray-400',
  '8': 'text-gray-500',
  '9': 'text-blue-400',
  'a': 'text-green-400',
  'b': 'text-cyan-300',
  'c': 'text-red-500',
  'd': 'text-pink-400',
  'e': 'text-yellow-300',
  'f': 'text-white',
};

const styleMap: { [key: string]: boolean } = {
  'l': true, // bold
  'm': true, // strikethrough
  'n': true, // underline
  'o': true, // italic
};

export const LoreParser: React.FC<{ lore: string }> = ({ lore }) => {
  const parsedLore = useMemo(() => {
    if (!lore) return null;

    return lore.split('\n').map((line, lineIndex) => {
      if (line.trim() === '') {
        return <div key={lineIndex} className="h-3" />;
      }
      
      const segments: { text: string; classes: string[] }[] = [];
      
      let currentStyles = {
        color: 'text-gray-400',
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      };

      const parts = line.split('§');
      const firstPartText = parts.shift();

      if (firstPartText) {
        const classes = [currentStyles.color];
        segments.push({ text: firstPartText, classes });
      }

      parts.forEach(part => {
        const code = part[0];
        const text = part.substring(1);

        if (colorMap[code]) {
          // Reset all styles on color change, as Minecraft does
          currentStyles = {
            color: colorMap[code],
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          };
        } else if (styleMap[code]) {
            if (code === 'l') currentStyles.bold = true;
            if (code === 'o') currentStyles.italic = true;
            if (code === 'n') currentStyles.underline = true;
            if (code === 'm') currentStyles.strikethrough = true;
        } else if (code === 'r') { // Reset
          currentStyles = {
            color: 'text-gray-400',
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          };
        }
        
        if (text) {
          const classes = [currentStyles.color];
          if (currentStyles.bold) classes.push('font-bold');
          if (currentStyles.italic) classes.push('italic');
          if (currentStyles.underline) classes.push('underline');
          if (currentStyles.strikethrough) classes.push('line-through');
          segments.push({ text, classes });
        }
      });

      return (
        <p key={lineIndex} className="text-sm">
          {segments.map((segment, segIndex) => (
            <span key={segIndex} className={segment.classes.join(' ')}>
              {segment.text}
            </span>
          ))}
        </p>
      );
    });
  }, [lore]);

  return <>{parsedLore}</>;
};