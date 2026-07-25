import React from 'react';
import { RiCheckLine } from '@remixicon/react';
import { useApp } from '../../context/AppContext';

const themes = [
  {
    id: 'glass' as const,
    name: '羊皮纸',
    label: '默认主题',
    previewBg: '#fbf7f0',
    previewStroke: '#e5d9c4',
    previewBars: ['#e5d9c4', '#f0e8d8', '#c43d3d', '#c9a96e', '#5b8c5a'],
  },
  {
    id: 'black' as const,
    name: '近黑',
    label: '#0A0A0A',
    previewBg: '#0a0a0a',
    previewStroke: '#2a2a2a',
    previewBars: ['#2a2a2a', '#1a1a1a', '#c43d3d', '#444444', '#666666'],
  },
];

const ThemeSetting: React.FC = () => {
  const { settings, updateSettings } = useApp();

  return (
    <div className="flex gap-6">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => updateSettings({ theme: theme.id })}
          className={`w-56 rounded-xl overflow-hidden transition-all ${
            settings.theme === theme.id
              ? 'ring-2 ring-[#c43d3d] shadow-lg'
              : 'border border-white/10 hover:border-white/20'
          }`}
        >
          <div className="h-32" style={{ background: theme.previewBg }}>
            <div className="w-full h-full p-3 flex flex-col gap-1.5">
              {theme.previewBars.slice(0, 5).map((bar, i) => (
                <div
                  key={i}
                  className="rounded-[4px]"
                  style={{
                    width: i === 0 ? '80px' : i === 1 ? '120px' : i === 2 ? '60px' : i === 3 ? '100px' : '50px',
                    height: '8px',
                    background: bar,
                    borderRadius: '4px',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="p-4 flex items-center justify-between" style={{ background: '#f8f3e8' }}>
            <div>
              <div className="text-sm font-medium" style={{ color: theme.id === 'black' ? '#fff' : '#3d2b1f' }}>{theme.name}</div>
              <div className="text-[#8b7e6a] text-xs mt-0.5">{theme.label}</div>
            </div>
            {settings.theme === theme.id && (
              <div className="w-6 h-6 rounded-full bg-[#c43d3d] flex items-center justify-center">
                <RiCheckLine className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default ThemeSetting;
