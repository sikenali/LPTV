import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RiTvLine, RiHeartLine, RiSettingsLine } from '@remixicon/react';
import { getPanelClass } from '../../utils/theme';
import { useApp } from '../../context/AppContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useApp();

  const navItems = [
    { label: '频道', path: '/', icon: RiTvLine },
    { label: '收藏', path: '/favorites', icon: RiHeartLine },
    { label: '设置', path: '/settings', icon: RiSettingsLine },
  ];

  return (
    <header className={`h-16 ${getPanelClass(settings.theme)} border-b flex items-center justify-between px-8 sticky top-0 z-50 transition-colors duration-300`}
      style={{
        background: settings.theme === 'black' ? '#1a1a1a' : settings.theme === 'white' ? '#f8f8f8' : '#fbf7f0',
        borderColor: settings.theme === 'black' ? 'rgba(255,255,255,0.1)' : '#e5d9c4'
      }}
    >
      {/* Logo区域 */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-11 h-11 rounded-lg bg-[#c43d3d] flex items-center justify-center">
          <RiTvLine className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-xl leading-tight" style={{ color: settings.theme === 'black' ? '#fff' : '#3d2b1f' }}>LPTV</span>
          <span className="text-xs leading-tight" style={{ color: '#c9a96e' }}>灵派电视</span>
        </div>
      </div>

      {/* 功能入口区 */}
      <nav className="flex items-center gap-10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <Icon
                className="transition-colors"
                style={{
                  fontSize: 22,
                  color: isActive ? '#c43d3d' : settings.theme === 'black' ? 'rgba(255,255,255,0.5)' : '#8b7e6a'
                }}
              />
              <span
                className="text-xs transition-colors"
                style={{
                  color: isActive ? '#c43d3d' : settings.theme === 'black' ? 'rgba(255,255,255,0.5)' : '#8b7e6a',
                  fontWeight: isActive ? 600 : 400
                }}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="w-5 h-[3px] rounded-full bg-[#c43d3d] mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;
