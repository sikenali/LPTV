import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Layout/Header';
import ChannelPage from './pages/ChannelPage';
import FavoritePage from './pages/FavoritePage';
import SettingsPage from './pages/SettingsPage';
import TvModePage from './pages/TvModePage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-screen">
    <Header />
    <div className="flex-1 min-h-0 overflow-hidden">
      {children}
    </div>
  </div>
);

const ThemedApp: React.FC = () => {
  const { settings, loadChannels } = useApp();

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const isBlack = settings.theme === 'black';

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: isBlack ? '#0a0a0a' : '#fbf7f0' }}>
      <Routes>
        <Route 
          path="/" 
          element={
            <Layout>
              <ChannelPage />
            </Layout>
          } 
        />
        <Route 
          path="/favorites" 
          element={
            <Layout>
              <FavoritePage />
            </Layout>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <Layout>
              <SettingsPage />
            </Layout>
          } 
        />
        <Route 
          path="/tv-mode" 
          element={<TvModePage />} 
        />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <ThemedApp />
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
