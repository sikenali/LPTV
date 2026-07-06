import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Layout/Header';
import ChannelPage from './pages/ChannelPage';
import FavoritePage from './pages/FavoritePage';
import SettingsPage from './pages/SettingsPage';
import TvModePage from './pages/TvModePage';
import { getBgClass } from './utils/theme';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <Header />
    {children}
  </>
);

const ThemedApp: React.FC = () => {
  const { settings } = useApp();

  return (
    <div className={`min-h-screen ${getBgClass(settings.theme)} transition-colors duration-300`}>
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