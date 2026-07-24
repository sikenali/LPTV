import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiPaletteLine, RiLayoutGridLine, RiTvLine, RiRefreshLine, RiRouteLine, RiCheckLine, RiHistoryLine, RiArrowRightSLine, RiQuestionLine } from '@remixicon/react';
import { useApp } from '../context/AppContext';

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

const ThemeCard: React.FC<{
  theme: typeof themes[0];
  isSelected: boolean;
  onClick: () => void;
}> = ({ theme, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-[220px] shrink-0 rounded-2xl overflow-hidden bg-white transition-all ${
      isSelected
        ? 'border-2 border-[#c43d3d] shadow-[0_4px_16px_rgba(196,61,61,0.15)]'
        : 'border-2 border-[#e5d9c4] hover:border-gray-300'
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
        <div className="w-6 h-6 rounded-full bg-[#c43d3d] flex items-center justify-center">
          <RiCheckLine className="w-4 h-4 text-white" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-slate-200" />
      )}
    </div>
  </button>
);

interface SettingToggleProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  toggled: boolean;
  onToggle: () => void;
  borderColor: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ icon, iconBg, iconColor, title, description, toggled, onToggle, borderColor, cardBg, textPrimary, textSecondary }) => {
  return (
    <div className={`w-full rounded-xl px-6 py-5 flex items-center justify-between`} style={{ background: cardBg, borderColor: borderColor }}>
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div>
          <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>{title}</div>
          <div className="text-xs mt-1" style={{ color: textSecondary }}>{description}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-[52px] h-7 rounded-full transition-colors shrink-0 ${toggled ? 'bg-[#c43d3d]' : 'bg-[#d5cf c4]'}`}
        style={{ background: toggled ? '#c43d3d' : '#d5cdc4' }}
      >
        <span
          className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
          style={{
            transform: toggled ? 'translateX(24px)' : 'translateX(0)'
          }}
        />
      </button>
    </div>
  );
};

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

  const sidebarBg = settings.theme === 'black' ? '#1a1a1a' : settings.theme === 'white' ? '#eee' : '#f8f3e8';
  const borderColor = settings.theme === 'black' ? 'rgba(255,255,255,0.1)' : '#e5d9c4';
  const textPrimary = settings.theme === 'black' ? '#ffffff' : '#3d2b1f';
  const textSecondary = settings.theme === 'black' ? 'rgba(255,255,255,0.5)' : '#8b7e6a';
  const cardBg = settings.theme === 'black' ? 'rgba(255,255,255,0.05)' : '#fdfaf4';
  const inputBg = settings.theme === 'black' ? 'rgba(255,255,255,0.05)' : '#fbf7f0';
  const subText = settings.theme === 'black' ? 'rgba(255,255,255,0.4)' : '#b8a88a';

  return (
    <div className="flex h-screen" style={{ background: settings.theme === 'black' ? '#0a0a0a' : '#fbf7f0' }}>
      {/* 左侧标签导航 */}
      <aside className="w-[260px] flex flex-col shrink-0" style={{ background: sidebarBg, borderRight: `1px solid ${borderColor}` }}>
        <div className="px-6 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-[#c43d3d]" />
            <span className="text-lg font-bold" style={{ color: textPrimary }}>设置</span>
          </div>
        </div>
        <div className="flex-1 px-4 pb-6 space-y-1">
          <button
            onClick={() => setActiveTab('theme')}
            className={`w-full flex items-center gap-3 rounded-lg transition-colors ${activeTab === 'theme' ? '' : ''}`}
            style={{
              background: activeTab === 'theme' ? cardBg : 'transparent',
              borderColor: activeTab === 'theme' ? borderColor : 'transparent',
              borderWidth: activeTab === 'theme' ? '1px' : '0px'
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: inputBg }}>
              <RiPaletteLine className="w-[18px] h-[18px]" style={{ color: activeTab === 'theme' ? '#c43d3d' : textSecondary }} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium" style={{ color: activeTab === 'theme' ? '#c43d3d' : textPrimary }}>主题管理</div>
              <div className="text-xs mt-0.5" style={{ color: subText }}>界面配色方案</div>
            </div>
            {activeTab === 'theme' && (
              <RiArrowRightSLine className="w-4 h-4" style={{ color: '#c43d3d' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('mode')}
            className={`w-full flex items-center gap-3 rounded-lg transition-colors`}
            style={{
              background: activeTab === 'mode' ? cardBg : 'transparent',
              borderColor: activeTab === 'mode' ? borderColor : 'transparent',
              borderWidth: activeTab === 'mode' ? '1px' : '0px'
            }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: inputBg }}>
              <RiLayoutGridLine className="w-[18px] h-[18px]" style={{ color: activeTab === 'mode' ? '#c43d3d' : textSecondary }} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium" style={{ color: activeTab === 'mode' ? '#c43d3d' : textPrimary }}>模式管理</div>
              <div className="text-xs mt-0.5" style={{ color: subText }}>播放与更新功能</div>
            </div>
            {activeTab === 'mode' && (
              <RiArrowRightSLine className="w-4 h-4" style={{ color: '#c43d3d' }} />
            )}
          </button>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 overflow-y-auto p-10">
        <div className="max-w-[700px]">
          {activeTab === 'theme' ? (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-7 rounded-full bg-[#c43d3d]" />
                <div>
                  <h1 className="text-xl font-bold" style={{ color: textPrimary }}>主题管理</h1>
                  <p className="text-sm mt-0.5" style={{ color: textSecondary }}>选择你喜欢的界面主题配色方案</p>
                </div>
              </div>

              <div className="flex gap-5 mb-8 overflow-x-auto pb-4">
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
                className="px-8 py-3 bg-[#c43d3d] text-white text-sm font-semibold rounded-lg hover:bg-[#a83232] transition-colors"
              >
                应用主题
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-7 rounded-full bg-[#c43d3d]" />
                <div>
                  <h1 className="text-xl font-bold" style={{ color: textPrimary }}>模式管理</h1>
                  <p className="text-sm mt-0.5" style={{ color: textSecondary }}>控制播放与频道更新相关功能</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border overflow-hidden" style={{ background: cardBg, borderColor }}>
                  <SettingToggle
                    icon={<RiTvLine className="w-[22px] h-[22px]" />}
                    iconBg="bg-[#f8f3e8]"
                    iconColor="text-[#c43d3d]"
                    title="TV 模式"
                    description="启用传统电视模式，全屏沉浸式观看体验"
                    toggled={tvMode}
                    borderColor={borderColor}
                    cardBg={cardBg}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    onToggle={() => {
                      const next = !tvMode;
                      setTvMode(next);
                      updateSettings({ tvMode: next });
                      if (next) {
                        navigate('/tv-mode');
                      }
                    }}
                  />
                  <div className={`px-5 py-5 flex items-center justify-between`} style={{ borderTop: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-[#f8f3e8] rounded-xl flex items-center justify-center">
                        <RiHistoryLine className="w-[22px] h-[22px] text-[#7b9eb3]" />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>回看功能</div>
                        <div className="text-xs mt-1" style={{ color: textSecondary }}>支持回看过去 7 天内的节目内容</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setPlaybackMode(!playbackMode)}
                      className="relative w-[52px] h-7 rounded-full transition-colors shrink-0"
                      style={{ background: playbackMode ? '#c43d3d' : '#d5cdc4' }}
                    >
                      <span
                        className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
                        style={{ transform: playbackMode ? 'translateX(24px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  <div className={`px-5 py-5 flex items-center justify-between`} style={{ borderTop: `1px solid ${borderColor}` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-[#f8f3e8] rounded-xl flex items-center justify-center">
                        <RiRefreshLine className="w-[22px] h-[22px] text-[#5b8c5a]" />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>频道自动更新</div>
                        <div className="text-xs mt-1" style={{ color: textSecondary }}>后台自动检测并更新频道列表与源地址</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoUpdate(!autoUpdate)}
                      className="relative w-[52px] h-7 rounded-full transition-colors shrink-0"
                      style={{ background: autoUpdate ? '#c43d3d' : '#d5cdc4' }}
                    >
                      <span
                        className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
                        style={{ transform: autoUpdate ? 'translateX(24px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  <div className={`px-5 py-5 flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-[#f8f3e8] rounded-xl flex items-center justify-center">
                        <RiRouteLine className="w-[22px] h-[22px] text-[#c9a96e]" />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold" style={{ color: textPrimary }}>线路切换</div>
                        <div className="text-xs mt-1" style={{ color: textSecondary }}>启用后在播放页面显示线路切换功能</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const next = !showLines;
                        setShowLines(next);
                        updateSettings({ showLines: next });
                      }}
                      className="relative w-[52px] h-7 rounded-full transition-colors shrink-0"
                      style={{ background: showLines ? '#c43d3d' : '#d5cdc4' }}
                    >
                      <span
                        className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
                        style={{ transform: showLines ? 'translateX(24px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 关于卡片 */}
              <div className="mt-8 rounded-xl border overflow-hidden" style={{ background: cardBg, borderColor }}>
                <div className="px-6 py-5 flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#f8f3e8] rounded-lg flex items-center justify-center">
                    <RiQuestionLine className="w-[18px] h-[18px] text-[#7b9eb3]" />
                  </div>
                  <span className="text-base font-semibold" style={{ color: textPrimary }}>关于 LPTV</span>
                </div>
                <div className="px-6 space-y-0">
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <span style={{ color: textSecondary }}>当前版本</span>
                    <span className="font-medium" style={{ color: textPrimary }}>v1.0.0 Beta</span>
                  </div>
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <span style={{ color: textSecondary }}>开发者</span>
                    <span className="font-medium" style={{ color: textPrimary }}>LPTV Studio</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span style={{ color: textSecondary }}>许可证</span>
                    <span className="font-medium" style={{ color: textPrimary }}>MIT License</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
