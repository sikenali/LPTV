import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, } from 'framer-motion';
import { RiTvLine, RiHeartLine, RiSettingsLine } from '@remixicon/react';
import { useApp } from '../../context/AppContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useApp();
  const navRef = useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const active = el.querySelector('[data-nav="' + location.pathname + '"]');
    if (!active) return;
    const rect = (active as HTMLElement).getBoundingClientRect();
    const parentRect = el.getBoundingClientRect();
    setIndicatorStyle({
      top: (rect.top - parentRect.top).toFixed(2) + 'px',
      left: (rect.left - parentRect.left).toFixed(2) + 'px',
      width: rect.width.toFixed(2) + 'px',
      height: rect.height.toFixed(2) + 'px',
    });
  }, [location.pathname]);

  const navItems = [
    { label: '频道', path: '/', icon: RiTvLine },
    { label: '收藏', path: '/favorites', icon: RiHeartLine },
    { label: '设置', path: '/settings', icon: RiSettingsLine },
  ];

  const isBlack = settings.theme === 'black';

  return (
    <header className="h-16 flex items-center justify-between px-8 sticky top-0 z-50"
      style={{
        background: isBlack ? '#1a1a1a' : '#fbf7f0',
        borderBottom: `1px solid ${isBlack ? 'rgba(255,255,255,0.1)' : '#e5d9c4'}`,
      }}
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-11 h-11 rounded-lg bg-[#c43d3d] flex items-center justify-center">
          <RiTvLine className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xl leading-tight" style={{ color: isBlack ? '#fff' : '#3d2b1f' }}>LPTV</span>
          <span className="text-xs leading-tight text-[#c9a96e]">Unofficial Web Client - LPTV</span>
        </div>
      </div>

      <nav ref={navRef} className="flex items-center gap-10 relative">
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            ...indicatorStyle,
            background: isBlack ? 'rgba(255,255,255,0.08)' : 'rgba(196,61,61,0.08)',
            border: `1px solid ${isBlack ? 'rgba(255,255,255,0.12)' : 'rgba(196,61,61,0.15)'}`,
            zIndex: 0,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <motion.button
              key={item.path}
              data-nav={item.path}
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.015 }}
              animate={isActive
                ? { scale: [1, 1.06, 0.96, 1.02, 1], transition: { duration: 0.45, times: [0, 0.2, 0.4, 0.7, 1], ease: 'easeInOut' } }
                : {}
              }
              className="relative flex flex-col items-center gap-1 cursor-pointer"
              style={{ zIndex: 1 }}
            >
              <Icon
                className="transition-colors"
                style={{
                  fontSize: 22,
                  color: isActive ? '#c43d3d' : isBlack ? 'rgba(255,255,255,0.55)' : '#8b7e6a'
                }}
              />
              <span className="text-xs transition-colors" style={{
                color: isActive ? '#c43d3d' : isBlack ? 'rgba(255,255,255,0.55)' : '#8b7e6a',
                fontWeight: isActive ? 600 : 400
              }}>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;
