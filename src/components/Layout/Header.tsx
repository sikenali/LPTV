import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RiTvLine, RiHeartLine, RiSettingsLine } from '@remixicon/react';
import { useApp } from '../../context/AppContext';
import { getPanelClass, getTextClass } from '../../utils/theme';

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
    <header className={`h-16 ${getPanelClass(settings.theme)} border-b flex items-center justify-between px-6 sticky top-0 z-50 transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
          <RiTvLine className="w-5 h-5 text-white" />
        </div>
        <span className={`font-bold text-xl ${getTextClass(settings.theme)}`}>LPTV</span>
      </div>

      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-[64px] ${
                isActive
                  ? 'text-blue-600'
                  : settings.theme === 'black'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-[22px] h-[22px]" />
              <span className={`text-xs ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;