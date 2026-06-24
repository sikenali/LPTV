import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Layout/Header';
import ChannelPage from './pages/ChannelPage';
import PlayerPage from './pages/PlayerPage';
import FavoritePage from './pages/FavoritePage';
import SettingsPage from './pages/SettingsPage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Header />
    {children}
  </>
);

const ThemedApp: React.FC = () => {
  const { settings } = useApp();
  
  const getThemeClass = () => {
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

  return (
    <div className={`min-h-screen ${getThemeClass()} transition-colors duration-300`}>
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
          path="/player/:tid/:channelId" 
          element={
            <PlayerPage />
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