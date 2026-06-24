import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RiTvLine, RiHeartLine, RiSettingsLine } from '@remixicon/react';
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

  const getHeaderClass = () => {
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

  const getBtnClass = (isActive: boolean) => {
    if (isActive) {
      return 'bg-blue-500 text-white';
    }
    switch (settings.theme) {
      case 'white':
      case 'glass':
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
      case 'black':
        return 'bg-gray-700 text-gray-300 hover:bg-gray-600';
      default:
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
    }
  };

  return (
    <header className={`h-20 ${getHeaderClass()} border-b flex items-center justify-between px-6 sticky top-0 z-50 transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <RiTvLine className="w-5 h-5 text-white" />
        </div>
        <span className={`font-bold text-xl ${getTextClass()}`}>LPTV</span>
      </div>
      
      <nav className="flex gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1 min-w-[80px] ${getBtnClass(isActive)}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export default Header;