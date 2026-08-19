import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Header from './components/Layout/Header';
import ChannelPage from './pages/ChannelPage';
import FavoritePage from './pages/FavoritePage';
import SettingsPage from './pages/SettingsPage';
import TvModePage from './pages/TvModePage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="min-h-screen bg-[#0a0a0a]">
          <Header />
          <Routes>
            <Route path="/" element={<ChannelPage />} />
            <Route path="/favorites" element={<FavoritePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tv-mode" element={<TvModePage />} />
          </Routes>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
