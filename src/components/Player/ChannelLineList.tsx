import React from 'react';
import { ChannelLine } from '../../types';

interface ChannelLineListProps {
  lines: ChannelLine[];
  currentLine: ChannelLine | null;
  onLineSwitch: (line: ChannelLine) => void;
}

const ChannelLineList: React.FC<ChannelLineListProps> = ({ lines, currentLine, onLineSwitch }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {lines.map((line) => (
        <button
          key={line.id}
          onClick={() => onLineSwitch(line)}
          className={`px-4 py-2 rounded-lg text-white text-sm whitespace-nowrap transition-all ${
            currentLine?.id === line.id
              ? 'bg-blue-500/40 border border-blue-400/50'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {line.name}
          {line.quality && <span className="ml-1 text-white/60 text-xs">{line.quality}</span>}
        </button>
      ))}
    </div>
  );
};

export default ChannelLineList;
