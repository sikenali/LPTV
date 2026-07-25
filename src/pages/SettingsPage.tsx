import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiPaletteLine, RiLayoutGridLine, RiRefreshLine, RiCheckLine, RiArrowRightSLine } from '@remixicon/react';
import { useApp } from '../context/AppContext';

type TabType = 'theme' | 'mode';

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

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [selectedTheme, setSelectedTheme] = useState(settings.theme);
  const [tvMode, setTvMode] = useState(settings.tvMode);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => { setSelectedTheme(settings.theme); }, [settings.theme]);
  useEffect(() => { setTvMode(settings.tvMode); }, [settings.tvMode]);

  const isBlack = settings.theme === 'black';
  const sidebarBg = isBlack ? '#1a1a1a' : '#f8f3e8';
  const borderCol = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4';
  const textPri = isBlack ? '#ffffff' : '#3d2b1f';
  const inputBg = isBlack ? 'rgba(255,255,255,0.05)' : '#f8f3e8';

  return (
    <div className="flex h-screen" style={{ background: isBlack ? '#0a0a0a' : '#fbf7f0' }}>
      <aside className="w-[260px] flex flex-col shrink-0" style={{ background: sidebarBg, borderRight: `1px solid ${borderCol}` }}>
        <div style={{ paddingTop: 32, paddingRight: 24, paddingBottom: 16, paddingLeft: 24 }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-[2px]" style={{ background: '#c43d3d' }} />
            <span className="font-bold text-lg leading-tight" style={{ color: textPri, fontFamily: 'SourceHanSans-Bold' }}>设置</span>
          </div>
        </div>

        <div style={{ paddingTop: 0, paddingRight: 16, paddingBottom: 28, paddingLeft: 16 }}>
          <button
            onClick={() => setActiveTab('theme')}
            className="w-full flex items-center rounded-[8px] transition-colors"
            style={{
              background: activeTab === 'theme' ? '#fdfaf4' : 'transparent',
              borderColor: activeTab === 'theme' ? '#e5d9c4' : 'transparent',
              borderWidth: activeTab === 'theme' ? '1px' : '0px',
              padding: '14px 16px',
              gap: 12,
            }}
          >
            <div className="w-9 h-9 shrink-0 rounded-[8px] flex items-center justify-center" style={{ background: inputBg }}>
              <RiPaletteLine className="w-[18px] h-[18px]" style={{ color: activeTab === 'theme' ? '#c43d3d' : '#8b7e6a' }} />
            </div>
            <div className="flex flex-col">
              <div className="leading-tight" style={{
                color: activeTab === 'theme' ? '#c43d3d' : '#3d2b1f',
                fontSize: 14,
                fontWeight: activeTab === 'theme' ? 600 : 500,
                lineHeight: 1.29,
                fontFamily: activeTab === 'theme' ? 'SourceHanSans-SemiBold' : 'SourceHanSans-Medium',
              }}>主题管理</div>
              <div className="mt-1 leading-tight" style={{ color: '#b8a88a', fontSize: 11, lineHeight: 1.27 }}>界面配色方案</div>
            </div>
            <div style={{ paddingRight: 35 }}>
              {activeTab === 'theme' && (
                <RiArrowRightSLine className="w-[18px] h-[18px]" style={{ color: '#c43d3d' }} />
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('mode')}
            className="w-full flex items-center rounded-[8px] transition-colors"
            style={{
              background: activeTab === 'mode' ? '#fdfaf4' : 'transparent',
              borderColor: activeTab === 'mode' ? '#e5d9c4' : 'transparent',
              borderWidth: activeTab === 'mode' ? '1px' : '0px',
              padding: '14px 16px',
              gap: 12,
            }}
          >
            <div className="w-9 h-9 shrink-0 rounded-[8px] flex items-center justify-center" style={{ background: inputBg }}>
              <RiLayoutGridLine className="w-[18px] h-[18px]" style={{ color: activeTab === 'mode' ? '#c43d3d' : '#8b7e6a' }} />
            </div>
            <div className="flex flex-col">
              <div className="leading-tight" style={{
                color: activeTab === 'mode' ? '#c43d3d' : '#3d2b1f',
                fontSize: 14,
                fontWeight: activeTab === 'mode' ? 600 : 500,
                lineHeight: 1.29,
                fontFamily: activeTab === 'mode' ? 'SourceHanSans-SemiBold' : 'SourceHanSans-Medium',
              }}>模式管理</div>
              <div className="mt-1 leading-tight" style={{ color: '#b8a88a', fontSize: 11, lineHeight: 1.27 }}>播放与更新功能</div>
            </div>
            <div style={{ paddingRight: 35 }}>
              {activeTab === 'mode' && (
                <RiArrowRightSLine className="w-[18px] h-[18px]" style={{ color: '#c43d3d' }} />
              )}
            </div>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ paddingTop: 32, paddingRight: 40, paddingBottom: 32, paddingLeft: 40 }}>
        <div className="max-w-[700px]">
          {activeTab === 'theme' ? (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-7 shrink-0 rounded-[2px]" style={{ background: '#c43d3d' }} />
                <div>
                  <h1 className="font-bold leading-tight mb-1" style={{ color: textPri, fontSize: 22, lineHeight: 1.27 }}>主题管理</h1>
                  <p className="leading-tight" style={{ color: '#8b7e6a', fontSize: 13, lineHeight: 1.38 }}>选择你喜欢的界面配色方案</p>
                </div>
              </div>

              <div className="rounded-xl border" style={{ background: '#fdfaf4', borderColor: '#e5d9c4' }}>
                <div style={{ paddingTop: 8 }}>
                  <div className="flex gap-5 overflow-x-auto">
                    {themes.map((theme) => {
                      const isSelected = selectedTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => { setSelectedTheme(theme.id); updateSettings({ theme: theme.id }); }}
                          className="w-[200px] shrink-0 flex flex-col items-center rounded-xl transition-all"
                          style={{
                            background: '#f8f3e8',
                            borderColor: isSelected ? '#c43d3d' : '#e5d9c4',
                            borderWidth: isSelected ? '2px' : '1px',
                            padding: 20,
                            gap: 16,
                          }}
                        >
                          <div className="w-[160px] h-[100px] rounded-lg overflow-hidden" style={{
                            background: theme.previewBg,
                            borderColor: theme.previewStroke,
                            borderWidth: '1px',
                          }}>
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

                          <div className="flex flex-col items-center gap-1 px-2">
                            <span className="font-semibold leading-tight" style={{
                              color: isSelected ? '#c43d3d' : '#3d2b1f',
                              fontSize: 15,
                              lineHeight: 1.33,
                              fontFamily: isSelected ? 'SourceHanSans-SemiBold' : 'SourceHanSans-Medium',
                            }}>{theme.name}</span>
                            <span className="leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>{theme.label}</span>
                          </div>

                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-[#c43d3d] flex items-center justify-center">
                              <RiCheckLine className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-xl border" style={{ background: '#fdfaf4', borderColor: '#e5d9c4' }}>
                <div style={{ padding: 24, gap: 16 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-tight" style={{ color: '#c9a96e', fontFamily: 'remixicon' }}></span>
                    <span className="font-medium leading-tight" style={{ color: '#3d2b1f', fontSize: 14, lineHeight: 1.29 }}>实时预览</span>
                  </div>

                  <div className="rounded-lg overflow-hidden" style={{
                    background: '#fbf7f0',
                    borderColor: '#e5d9c4',
                    borderWidth: '1px',
                  }}>
                    <div className="flex items-center justify-between" style={{
                      background: '#f8f3e8',
                      borderBottom: `1px solid #e5d9c4`,
                      padding: '10px 16px',
                    }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c43d3d' }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c9a96e' }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#5b8c5a' }} />
                      </div>
                      <span className="leading-tight" style={{ color: '#b8a88a', fontSize: 11, lineHeight: 1.27 }}>LPTV 预览</span>
                    </div>

                    <div className="p-4 space-y-3">
                      {[
                        { color: '#c43d3d', titleW: 160, subW: 100 },
                        { color: '#5b8c5a', titleW: 140, subW: 80 },
                        { color: '#7b9eb3', titleW: 180, subW: 120 },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-[4px]" style={{ background: item.color }} />
                          <div className="flex flex-col gap-1">
                            <div className="rounded-[4px]" style={{ width: `${item.titleW}px`, height: '10px', background: '#e5d9c4' }} />
                            <div className="rounded" style={{ width: `${item.subW}px`, height: '8px', background: '#f0e8d8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

          ) : (
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-7 shrink-0 rounded-[2px]" style={{ background: '#c43d3d' }} />
                <div>
                  <h1 className="font-bold leading-tight mb-1" style={{ color: textPri, fontSize: 22, lineHeight: 1.27 }}>模式管理</h1>
                  <p className="leading-tight" style={{ color: '#8b7e6a', fontSize: 13, lineHeight: 1.38 }}>控制播放与频道更新相关功能</p>
                </div>
              </div>

              <div className="rounded-xl border" style={{ background: '#fdfaf4', borderColor: '#e5d9c4' }}>
                <div className="flex items-center justify-between" style={{
                  borderBottom: `1px solid #f0e8d8`,
                  padding: 20,
                }}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f8f3e8' }}>
                      <RiPaletteLine className="w-[22px] h-[22px]" style={{ color: '#c43d3d' }} />
                    </div>
                    <div>
                      <div className="font-semibold leading-tight" style={{ color: '#3d2b1f', fontSize: 15, lineHeight: 1.33 }}>TV 模式</div>
                      <div className="mt-1 leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>启用传统电视模式，全屏沉浸式观看体验</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !tvMode;
                      setTvMode(next);
                      updateSettings({ tvMode: next });
                      if (next) navigate('/tv-mode');
                    }}
                    className="relative w-[52px] h-7 rounded-full transition-colors shrink-0"
                    style={{ background: tvMode ? '#c43d3d' : '#d5cdc4' }}
                  >
                    <span className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
                      style={{ transform: tvMode ? 'translateX(24px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between" style={{ padding: 20 }}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f8f3e8' }}>
                      <RiRefreshLine className="w-[22px] h-[22px]" style={{ color: '#5b8c5a' }} />
                    </div>
                    <div>
                      <div className="font-semibold leading-tight" style={{ color: '#3d2b1f', fontSize: 15, lineHeight: 1.33 }}>频道自动更新</div>
                      <div className="mt-1 leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>每4小时自动检测并更新频道列表与源地址</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !autoRefresh;
                      setAutoRefresh(next);
                      if (next) showToast('频道自动更新已开启', 'success');
                      else showToast('频道自动更新已关闭', 'info');
                    }}
                    className="relative w-[52px] h-7 rounded-full transition-colors shrink-0"
                    style={{ background: autoRefresh ? '#5b8c5a' : '#d5cdc4' }}
                  >
                    <span className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform"
                      style={{ transform: autoRefresh ? 'translateX(24px)' : 'translateX(0)' }}
                    />
                  </button>
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
