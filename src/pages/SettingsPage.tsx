import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

const tabItems: { id: TabType; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    id: 'theme',
    label: '主题管理',
    sub: '界面配色方案',
    icon: <RiPaletteLine className="w-[18px] h-[18px]" />,
  },
  {
    id: 'mode',
    label: '模式管理',
    sub: '播放与更新功能',
    icon: <RiLayoutGridLine className="w-[18px] h-[18px]" />,
  },
];

const contentVariants = {
  enter: { opacity: 0, x: 20, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -10, scale: 0.99 },
};

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [selectedTheme, setSelectedTheme] = useState(settings.theme);
  const [tvMode, setTvMode] = useState(settings.tvMode);
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh);
  const [tabRef, setTabRef] = useState<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useEffect(() => { setSelectedTheme(settings.theme); }, [settings.theme]);
  useEffect(() => { setTvMode(settings.tvMode); }, [settings.tvMode]);
  useEffect(() => { setAutoRefresh(settings.autoRefresh); }, [settings.autoRefresh]);

  useEffect(() => {
    const el = tabRef;
    if (!el) return;
    const active = el.querySelector('[data-tab="' + activeTab + '"]');
    if (!active) return;
    const rect = (active as HTMLElement).getBoundingClientRect();
    const parentRect = el.getBoundingClientRect();
    setIndicatorStyle({
      top: (rect.top - parentRect.top).toFixed(2) + 'px',
      left: (rect.left - parentRect.left).toFixed(2) + 'px',
      width: rect.width.toFixed(2) + 'px',
      height: rect.height.toFixed(2) + 'px',
    });
  }, [activeTab, tabRef]);

  const isBlack = settings.theme === 'black';
  const sidebarBg = isBlack ? '#1a1a1a' : '#f8f3e8';
  const borderCol = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4';
  const textPri = isBlack ? '#ffffff' : '#3d2b1f';
  const inputBg = isBlack ? 'rgba(255,255,255,0.05)' : '#f8f3e8';
  const cardBg = isBlack ? 'rgba(255,255,255,0.05)' : '#fdfaf4';
  const cardBorder = isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4';
  const inactiveColor = isBlack ? 'rgba(255,255,255,0.5)' : '#8b7e6a';
  const mutedColor = isBlack ? 'rgba(255,255,255,0.4)' : '#b8a88a';

  return (
    <div className="flex h-screen" style={{ background: isBlack ? '#0a0a0a' : '#fbf7f0' }}>
      <aside className="w-[260px] flex flex-col shrink-0" style={{ background: sidebarBg, borderRight: `1px solid ${borderCol}` }}>
        <div style={{ paddingTop: 32, paddingRight: 24, paddingBottom: 16, paddingLeft: 24 }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-[2px]" style={{ background: '#c43d3d' }} />
            <span className="font-bold text-lg leading-tight" style={{ color: textPri }}>设置</span>
          </div>
        </div>

        <div ref={setTabRef} style={{ paddingTop: 0, paddingRight: 16, paddingBottom: 28, paddingLeft: 16, position: 'relative' }}>
          {/* Jelly sliding indicator */}
          <motion.div
            className="absolute rounded-[8px] pointer-events-none"
            style={{
              ...indicatorStyle,
              background: isBlack ? 'rgba(255,255,255,0.08)' : 'rgba(196,61,61,0.08)',
              border: `1px solid ${isBlack ? 'rgba(255,255,255,0.12)' : 'rgba(196,61,61,0.15)'}`,
              zIndex: 0,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />
          {tabItems.map((item) => (
            <motion.button
              key={item.id}
              data-tab={item.id}
              onClick={() => setActiveTab(item.id)}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.01 }}
              animate={activeTab === item.id
                ? { scale: [1, 1.06, 0.96, 1.02, 1], transition: { duration: 0.45, times: [0, 0.2, 0.4, 0.7, 1], ease: 'easeInOut' } }
                : {}
              }
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '14px 16px',
                gap: 12,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div className="w-9 h-9 shrink-0 rounded-[8px] flex items-center justify-center" style={{ background: inputBg }}>
                <span style={{ color: activeTab === item.id ? '#c43d3d' : inactiveColor }}>
                  {item.icon}
                </span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="leading-tight" style={{
                  color: activeTab === item.id ? '#c43d3d' : textPri,
                  fontSize: 14,
                  fontWeight: activeTab === item.id ? 600 : 500,
                  lineHeight: 1.29,
                }}>{item.label}</div>
                <div className="mt-1 leading-tight" style={{ color: mutedColor, fontSize: 11, lineHeight: 1.27 }}>{item.sub}</div>
              </div>
              {activeTab === item.id && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RiArrowRightSLine className="w-[18px] h-[18px]" style={{ color: '#c43d3d' }} />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto" style={{ paddingTop: 32, paddingRight: 40, paddingBottom: 32, paddingLeft: 40 }}>
        <div className="max-w-[700px]">
          <AnimatePresence mode="wait">
            {activeTab === 'theme' && (
              <motion.div
                key="theme"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-7 shrink-0 rounded-[2px]" style={{ background: '#c43d3d' }} />
                  <div>
                    <h1 className="font-bold leading-tight mb-1" style={{ color: textPri, fontSize: 22, lineHeight: 1.27 }}>主题管理</h1>
                    <p className="leading-tight" style={{ color: '#8b7e6a', fontSize: 13, lineHeight: 1.38 }}>选择你喜欢的界面配色方案</p>
                  </div>
                </div>

                <div className="rounded-xl border" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div style={{ paddingTop: 8 }}>
                    <div className="flex gap-5 overflow-x-auto">
                      {themes.map((theme) => {
                        const isSelected = selectedTheme === theme.id;
                        return (
                          <motion.button
                            key={theme.id}
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            onClick={() => { setSelectedTheme(theme.id); updateSettings({ theme: theme.id }); }}
                            className="w-[200px] shrink-0 flex flex-col items-center rounded-xl transition-all"
                            style={{
                              background: isBlack ? 'rgba(255,255,255,0.03)' : '#f8f3e8',
                              borderColor: isSelected ? '#c43d3d' : cardBorder,
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
                                color: isSelected ? '#c43d3d' : (isBlack ? '#fff' : '#3d2b1f'),
                                fontSize: 15,
                                lineHeight: 1.33,
                              }}>{theme.name}</span>
                              <span className="leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>{theme.label}</span>
                            </div>

                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                className="w-6 h-6 rounded-full bg-[#c43d3d] flex items-center justify-center"
                              >
                                <RiCheckLine className="w-3.5 h-3.5 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-xl border" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div style={{ padding: 24 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-base leading-tight" style={{ color: '#c9a96e', fontFamily: 'remixicon' }}></span>
                      <span className="font-medium leading-tight" style={{ color: textPri, fontSize: 14, lineHeight: 1.29 }}>实时预览</span>
                    </div>

                    <div className="rounded-lg overflow-hidden" style={{
                      background: isBlack ? '#0a0a0a' : '#fbf7f0',
                      borderColor: cardBorder,
                      borderWidth: '1px',
                    }}>
                      <div className="flex items-center justify-between" style={{
                        background: sidebarBg,
                        borderBottom: `1px solid ${cardBorder}`,
                        padding: '10px 16px',
                      }}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c43d3d' }} />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c9a96e' }} />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#5b8c5a' }} />
                        </div>
                        <span className="leading-tight" style={{ color: mutedColor, fontSize: 11, lineHeight: 1.27 }}>LPTV 预览</span>
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
                              <div className="rounded-[4px]" style={{ width: `${item.titleW}px`, height: '10px', background: cardBorder }} />
                              <div className="rounded" style={{ width: `${item.subW}px`, height: '8px', background: sidebarBg }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'mode' && (
              <motion.div
                key="mode"
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-7 shrink-0 rounded-[2px]" style={{ background: '#c43d3d' }} />
                  <div>
                    <h1 className="font-bold leading-tight mb-1" style={{ color: textPri, fontSize: 22, lineHeight: 1.27 }}>模式管理</h1>
                    <p className="leading-tight" style={{ color: '#8b7e6a', fontSize: 13, lineHeight: 1.38 }}>控制播放与频道更新相关功能</p>
                  </div>
                </div>

                <div className="rounded-xl border" style={{ background: cardBg, borderColor: cardBorder }}>
                  <div className="flex items-center justify-between" style={{
                    borderBottom: `1px solid ${cardBorder}`,
                    padding: 20,
                  }}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: sidebarBg }}>
                        <RiPaletteLine className="w-[22px] h-[22px]" style={{ color: '#c43d3d' }} />
                      </div>
                      <div>
                        <div className="font-semibold leading-tight" style={{ color: textPri, fontSize: 15, lineHeight: 1.33 }}>TV 模式</div>
                        <div className="mt-1 leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>启用传统电视模式，全屏沉浸式观看体验</div>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        const next = !tvMode;
                        setTvMode(next);
                        updateSettings({ tvMode: next });
                        if (next) navigate('/tv-mode');
                      }}
                      className="relative w-[52px] h-7 rounded-full shrink-0"
                      style={{ background: tvMode ? '#c43d3d' : '#d5cdc4' }}
                    >
                      <motion.span
                        className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                        animate={{ x: tvMode ? 24 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      />
                    </motion.button>
                  </div>

                  <div className="flex items-center justify-between" style={{ padding: 20 }}>
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: sidebarBg }}>
                        <RiRefreshLine className="w-[22px] h-[22px]" style={{ color: '#5b8c5a' }} />
                      </div>
                      <div>
                        <div className="font-semibold leading-tight" style={{ color: textPri, fontSize: 15, lineHeight: 1.33 }}>频道自动更新</div>
                        <div className="mt-1 leading-tight" style={{ color: '#8b7e6a', fontSize: 12, lineHeight: 1.33 }}>每4小时自动检测并更新频道列表与源地址</div>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.05 }}
                      onClick={() => {
                        const next = !autoRefresh;
                        setAutoRefresh(next);
                        updateSettings({ autoRefresh: next });
                        if (next) showToast('频道自动更新已开启', 'success');
                        else showToast('频道自动更新已关闭', 'info');
                      }}
                      className="relative w-[52px] h-7 rounded-full shrink-0"
                      style={{ background: autoRefresh ? '#5b8c5a' : '#d5cdc4' }}
                    >
                      <motion.span
                        className="absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                        animate={{ x: autoRefresh ? 24 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
