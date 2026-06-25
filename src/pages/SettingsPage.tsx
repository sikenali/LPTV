import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiPaletteLine, RiLayoutGridLine, RiTvLine, RiRefreshLine, RiRouteLine, RiCheckLine, RiHistoryLine } from '@remixicon/react';
import { useApp } from '../context/AppContext';
import { getBgClass, getSidebarMenuItemClass } from '../utils/theme';

type TabType = 'theme' | 'mode';

const themes = [
  {
    id: 'glass' as const,
    name: '液态玻璃',
    label: 'Glass',
    previewBg: 'bg-blue-50',
    navLogo: 'bg-blue-600',
    navText: 'bg-slate-300',
    sideBg: 'bg-white/55',
    mainBg: 'bg-white/30',
  },
  {
    id: 'white' as const,
    name: '白色主题',
    label: '#FFFFFF',
    previewBg: 'bg-white',
    navLogo: 'bg-blue-600',
    navText: 'bg-slate-300',
    sideBg: 'bg-[#F8F8F8]',
    mainBg: 'bg-[#EEEEEE]',
  },
  {
    id: 'black' as const,
    name: '黑色主题',
    label: '#0A0A0A',
    previewBg: 'bg-[#0A0A0A]',
    navLogo: 'bg-blue-500',
    navText: 'bg-zinc-600',
    sideBg: 'bg-[#1A1A1A]',
    mainBg: 'bg-[#1A1A1A]',
  },
];

interface SettingToggleProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  toggled: boolean;
  onToggle: () => void;
  theme: string;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ icon, iconBg, iconColor, title, description, toggled, onToggle, theme }) => {
  const cardBg = theme === 'black' ? 'bg-gray-800' : theme === 'glass' ? 'bg-white/80 backdrop-blur-lg' : 'bg-white';
  const titleClass = theme === 'black' ? 'text-gray-100' : 'text-slate-800';
  const descClass = theme === 'black' ? 'text-gray-400' : 'text-slate-400';
  return (
    <div className={`w-full ${cardBg} rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] px-6 py-5 flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <div className={`text-[15px] font-semibold ${titleClass}`}>{title}</div>
          <div className={`text-xs ${descClass} mt-1`}>{description}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-[52px] h-7 rounded-full transition-colors shrink-0 ${toggled ? 'bg-blue-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform ${
            toggled ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

const ThemeCard: React.FC<{
  theme: typeof themes[0];
  isSelected: boolean;
  onClick: () => void;
}> = ({ theme, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-[220px] shrink-0 rounded-2xl overflow-hidden bg-white transition-all ${
      isSelected
        ? 'border-2 border-blue-600 shadow-[0_4px_16px_rgba(37,99,235,0.15)]'
        : 'border-2 border-[#E8E8E8] hover:border-gray-300'
    }`}
  >
    <div className={`h-[140px] ${theme.previewBg} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-[15px] h-[14px] ${theme.navLogo} rounded-[4px]`} />
        <div className={`w-[41px] h-2 ${theme.navText} rounded-[4px]`} />
      </div>
      <div className="flex gap-2">
        <div className={`w-[51px] h-[92px] ${theme.sideBg} rounded-[6px]`} />
        <div className={`flex-1 h-[92px] ${theme.mainBg} rounded-[6px]`} />
      </div>
    </div>
    <div className="flex items-center justify-between px-4 py-4">
      <div className="text-left">
        <div className="text-sm font-semibold text-slate-800">{theme.name}</div>
        <div className="text-[11px] text-slate-400 mt-1">{theme.label}</div>
      </div>
      {isSelected ? (
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
          <RiCheckLine className="w-4 h-4 text-white" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
      )}
    </div>
  </button>
);

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [selectedTheme, setSelectedTheme] = useState(settings.theme);
  const [tvMode, setTvMode] = useState(settings.tvMode);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [showLines, setShowLines] = useState(settings.showLines);

  useEffect(() => {
    setSelectedTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    setTvMode(settings.tvMode);
  }, [settings.tvMode]);

  useEffect(() => {
    setShowLines(settings.showLines);
  }, [settings.showLines]);

  const handleApplyTheme = () => {
    updateSettings({ theme: selectedTheme });
  };

  return (
    <div className={`min-h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
      <div className="flex h-[calc(100vh-64px)]">
        <aside className={`w-[260px] ${settings.theme === 'black' ? 'bg-gray-800' : 'bg-white'} border-r ${settings.theme === 'black' ? 'border-gray-700' : 'border-gray-200'} flex flex-col shrink-0`}>
          <div className="px-5 pt-5 pb-3">
            <span className={`text-xs font-semibold ${settings.theme === 'black' ? 'text-gray-400' : 'text-slate-400'}`}>设置</span>
          </div>
          <div className="flex-1 px-0">
            <button
              onClick={() => setActiveTab('theme')}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${getSidebarMenuItemClass(settings.theme, activeTab === 'theme')}`}
            >
              <RiPaletteLine className="w-5 h-5 shrink-0" />
              <span className={activeTab === 'theme' ? 'font-semibold' : ''}>主题管理</span>
            </button>
            <button
              onClick={() => setActiveTab('mode')}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors ${getSidebarMenuItemClass(settings.theme, activeTab === 'mode')}`}
            >
              <RiLayoutGridLine className="w-5 h-5 shrink-0" />
              <span className={activeTab === 'mode' ? 'font-semibold' : ''}>模式管理</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'theme' ? (
            <div className="max-w-[800px]">
              <h1 className={`text-xl font-bold ${settings.theme === 'black' ? 'text-gray-100' : 'text-slate-800'}`}>主题管理</h1>
              <p className={`text-sm ${settings.theme === 'black' ? 'text-gray-400' : 'text-slate-400'} mt-1 mb-6`}>选择你喜欢的界面主题配色方案</p>

              <div className="flex gap-5 mb-8">
                {themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={selectedTheme === theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                  />
                ))}
              </div>

              <button
                onClick={handleApplyTheme}
                className="w-[160px] py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                应用主题
              </button>
            </div>
          ) : (
            <div className="max-w-[800px]">
              <h1 className={`text-xl font-bold ${settings.theme === 'black' ? 'text-gray-100' : 'text-slate-800'}`}>模式管理</h1>
              <p className={`text-sm ${settings.theme === 'black' ? 'text-gray-400' : 'text-slate-400'} mt-1 mb-6`}>配置播放模式与功能选项</p>

              <div className="space-y-4">
                <SettingToggle
                  icon={<RiTvLine className="w-[22px] h-[22px]" />}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                  title="TV 模式"
                  description="启用后自动适配大屏电视显示比例与遥控操作"
                  toggled={tvMode}
                  theme={settings.theme}
                  onToggle={() => {
                    const next = !tvMode;
                    setTvMode(next);
                    updateSettings({ tvMode: next });
                    if (next) {
                      navigate('/tv-mode');
                    }
                  }}
                />
                <SettingToggle
                  icon={<RiHistoryLine className="w-[22px] h-[22px]" />}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-500"
                  title="回看功能"
                  description="支持回看过去7天内的节目内容"
                  toggled={playbackMode}
                  theme={settings.theme}
                  onToggle={() => setPlaybackMode(!playbackMode)}
                />
                <SettingToggle
                  icon={<RiRouteLine className="w-[22px] h-[22px]" />}
                  iconBg="bg-green-50"
                  iconColor="text-emerald-500"
                  title="线路切换"
                  description="启用后在播放页面显示线路切换功能"
                  toggled={showLines}
                  theme={settings.theme}
                  onToggle={() => {
                    const next = !showLines;
                    setShowLines(next);
                    updateSettings({ showLines: next });
                  }}
                />
                <SettingToggle
                  icon={<RiRefreshLine className="w-[22px] h-[22px]" />}
                  iconBg="bg-purple-50"
                  iconColor="text-purple-500"
                  title="自动更新频道"
                  description="后台自动更新频道列表数据，保持频道最新"
                  toggled={autoUpdate}
                  theme={settings.theme}
                  onToggle={() => setAutoUpdate(!autoUpdate)}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;