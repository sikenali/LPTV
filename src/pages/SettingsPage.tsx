import React, { useState, useEffect } from 'react';
import { RiPaletteLine, RiFullscreenLine, RiTvLine, RiRefreshLine, RiRouteLine, RiRepeatLine } from '@remixicon/react';
import { useApp } from '../context/AppContext';

type TabType = 'theme' | 'mode';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [selectedTheme, setSelectedTheme] = useState(settings.theme);
  const [tvMode, setTvMode] = useState(true);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);

  useEffect(() => {
    setSelectedTheme(settings.theme);
  }, [settings.theme]);

  const themes = [
    { id: 'glass' as const, name: '液态玻璃', color: '#E3F2FD', preview: 'bg-blue-50', borderColor: 'border-blue-400' },
    { id: 'white' as const, name: '白色主题', color: '#FFFFFF', preview: 'bg-white', borderColor: 'border-blue-500' },
    { id: 'black' as const, name: '黑色主题', color: '#4A4A4A', preview: 'bg-gray-800', borderColor: 'border-gray-600' },
  ];

  const handleApplyTheme = () => {
    updateSettings({ theme: selectedTheme });
  };

  const getBgClass = () => {
    switch (settings.theme) {
      case 'white':
        return 'bg-gray-50';
      case 'black':
        return 'bg-gray-900';
      case 'glass':
        return 'bg-gradient-to-br from-gray-100 via-blue-50 to-purple-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getSidebarClass = () => {
    switch (settings.theme) {
      case 'white':
        return 'bg-white border-gray-200';
      case 'black':
        return 'bg-gray-800 border-gray-700';
      case 'glass':
        return 'bg-white/80 backdrop-blur-lg border-gray-200/50';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getTextClass = () => {
    switch (settings.theme) {
      case 'white':
      case 'glass':
        return 'text-gray-800';
      case 'black':
        return 'text-white';
      default:
        return 'text-gray-800';
    }
  };

  const getTextGrayClass = () => {
    switch (settings.theme) {
      case 'white':
      case 'glass':
        return 'text-gray-500';
      case 'black':
        return 'text-gray-400';
      default:
        return 'text-gray-500';
    }
  };

  const getCardClass = () => {
    switch (settings.theme) {
      case 'white':
        return 'bg-white border-gray-200';
      case 'black':
        return 'bg-gray-800 border-gray-700';
      case 'glass':
        return 'bg-white/60 backdrop-blur-lg border-gray-200/50';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className={`min-h-screen ${getBgClass()} transition-colors duration-300`}>
      <div className="flex h-[calc(100vh-80px)]">
        <div className={`w-64 ${getSidebarClass()} border-r flex flex-col transition-colors duration-300`}>
          <div className="p-4 border-b border-gray-100">
            <span className={`text-sm font-medium ${getTextGrayClass()}`}>设置</span>
          </div>
          <nav className="flex-1 p-2">
            <button
              onClick={() => setActiveTab('theme')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                activeTab === 'theme'
                  ? 'bg-blue-500 text-white'
                  : `${getTextClass()} hover:bg-gray-100`
              }`}
            >
              <RiPaletteLine className="w-5 h-5" />
              <span className="text-sm font-medium">主题管理</span>
            </button>
            <button
              onClick={() => setActiveTab('mode')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeTab === 'mode'
                  ? 'bg-blue-500 text-white'
                  : `${getTextClass()} hover:bg-gray-100`
              }`}
            >
              <RiFullscreenLine className="w-5 h-5" />
              <span className="text-sm font-medium">模式管理</span>
            </button>
          </nav>
        </div>

        <div className={`flex-1 p-8 overflow-y-auto ${getBgClass()} transition-colors duration-300`}>
          {activeTab === 'theme' ? (
            <div>
              <h2 className={`text-xl font-bold ${getTextClass()} mb-2`}>主题管理</h2>
              <p className={`text-sm mb-8 ${getTextGrayClass()}`}>选择你喜欢的界面主题配色方案</p>

              <div className="grid grid-cols-3 gap-6 mb-8">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`relative rounded-xl p-4 border-2 transition-all ${
                      selectedTheme === theme.id
                        ? `${theme.borderColor} shadow-lg`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`h-32 rounded-lg mb-4 ${theme.preview} border border-gray-200`}>
                      <div className="flex flex-col p-3 gap-2">
                        <div className="flex gap-2">
                          <div className={`h-6 rounded ${theme.id === 'black' ? 'bg-gray-700' : 'bg-blue-500'}`} style={{ width: '30%' }} />
                          <div className={`h-6 rounded ${theme.id === 'black' ? 'bg-gray-600' : 'bg-gray-200'}`} style={{ width: '50%' }} />
                        </div>
                        <div className={`h-20 rounded ${theme.id === 'black' ? 'bg-gray-700' : 'bg-gray-100'}`} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-medium ${getTextClass()}`}>{theme.name}</div>
                        <div className={`text-xs ${getTextGrayClass()}`}>{theme.id === 'glass' ? 'Glass' : theme.id === 'white' ? '#FFFFFF' : '#4A4A4A'}</div>
                      </div>
                      {selectedTheme === theme.id && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button 
                onClick={handleApplyTheme}
                className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                应用主题
              </button>
            </div>
          ) : (
            <div>
              <h2 className={`text-xl font-bold ${getTextClass()} mb-2`}>模式管理</h2>
              <p className={`text-sm mb-8 ${getTextGrayClass()}`}>配置播放模式与功能选项</p>

              <div className="space-y-4">
                <div className={`rounded-xl p-4 shadow-sm border ${getCardClass()} transition-colors duration-300`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <RiTvLine className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className={`font-medium ${getTextClass()}`}>TV模式</div>
                        <div className={`text-sm ${getTextGrayClass()}`}>启用后自动适配大屏电视显示比例与遥控操作</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setTvMode(!tvMode)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        tvMode ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          tvMode ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className={`rounded-xl p-4 shadow-sm border ${getCardClass()} transition-colors duration-300`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                        <RiRefreshLine className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <div className={`font-medium ${getTextClass()}`}>回看功能</div>
                        <div className={`text-sm ${getTextGrayClass()}`}>支持回看过去7天内的节目内容</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setPlaybackMode(!playbackMode)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        playbackMode ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          playbackMode ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className={`rounded-xl p-4 shadow-sm border ${getCardClass()} transition-colors duration-300`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <RiRouteLine className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <div className={`font-medium ${getTextClass()}`}>线路设置</div>
                        <div className={`text-sm ${getTextGrayClass()}`}>管理播放地址，配置自动切换优先级</div>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 ${getTextGrayClass()}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                <div className={`rounded-xl p-4 shadow-sm border ${getCardClass()} transition-colors duration-300`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                        <RiRepeatLine className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <div className={`font-medium ${getTextClass()}`}>自动更新频道</div>
                        <div className={`text-sm ${getTextGrayClass()}`}>后台自动更新频道数据，保持频道最新</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoUpdate(!autoUpdate)}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        autoUpdate ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          autoUpdate ? 'translate-x-8' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;