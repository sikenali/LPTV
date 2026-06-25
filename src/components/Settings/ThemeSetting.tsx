import React from 'react';
import { RiCheckLine } from '@remixicon/react';
import LiquidGlass from '@m0x3mkx/liquid-glass-react';
import { useApp } from '../../context/AppContext';

const themes = [
  { id: 'white' as const, name: '白色主题', subtitle: '#FFFFFF', previewColor: 'bg-white' },
  { id: 'black' as const, name: '黑色主题', subtitle: '#4A4A4A', previewColor: 'bg-gray-800' },
  { id: 'glass' as const, name: '液态玻璃', subtitle: 'Glass', previewColor: 'bg-blue-500/10' },
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
              ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
              : 'border border-white/10 hover:border-white/20'
          }`}
        >
          <LiquidGlass
            cornerRadius={0}
            padding="0"
            displacementScale={20}
            blurAmount={settings.theme === theme.id ? 0.1 : 0.05}
            className="h-full"
          >
            <div className={`h-32 ${theme.previewColor} p-3 flex flex-col`}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 rounded bg-blue-500" />
                <div className="w-10 h-2 rounded bg-white/30" />
              </div>
              <div className="flex-1 mt-2 flex gap-2">
                <div className={`flex-1 rounded ${theme.id === 'black' ? 'bg-gray-700' : theme.id === 'white' ? 'bg-gray-100' : 'bg-white/10'}`} />
                <div className={`flex-[2] rounded ${theme.id === 'black' ? 'bg-gray-600' : theme.id === 'white' ? 'bg-gray-50' : 'bg-white/5'}`} />
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <div className="text-white font-medium text-sm">{theme.name}</div>
                <div className="text-white/40 text-xs mt-0.5">{theme.subtitle}</div>
              </div>
              {settings.theme === theme.id && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <RiCheckLine className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </LiquidGlass>
        </button>
      ))}
    </div>
  );
};

export default ThemeSetting;