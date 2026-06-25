import React from 'react';
import { ChannelLine } from '../../types';
import { Theme } from '../../utils/theme';

interface ChannelLineListProps {
  lines: ChannelLine[];
  currentLine: ChannelLine | null;
  onLineSwitch: (line: ChannelLine) => void;
  theme: Theme;
}

const ChannelLineList: React.FC<ChannelLineListProps> = ({ lines, currentLine, onLineSwitch, theme }) => {
  const isDark = theme === 'black';
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {lines.map((line) => (
        <button
          key={line.id}
          onClick={() => onLineSwitch(line)}
          className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
            currentLine?.id === line.id
              ? 'bg-blue-500/40 border border-blue-400/50 text-white'
              : isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          {line.name}
          {line.quality && <span className={`ml-1 text-xs ${currentLine?.id === line.id ? 'text-white/60' : 'text-gray-500'}`}>{line.quality}</span>}
        </button>
      ))}
    </div>
  );
};

export default ChannelLineList;
