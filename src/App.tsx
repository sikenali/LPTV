import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Layout/Header';
import Toast from './components/Toast';

const LazyChannelPage = React.lazy(() => import('./pages/ChannelPage'));
const LazyFavoritePage = React.lazy(() => import('./pages/FavoritePage'));
const LazySettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const LazyTvModePage = React.lazy(() => import('./pages/TvModePage'));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full" style={{ background: '#fbf7f0' }}>
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-[#c43d3d] border-t-transparent rounded-full animate-spin mx-auto" />
      <div className="text-sm mt-4" style={{ color: '#8b7e6a' }}>加载中...</div>
    </div>
  </div>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-screen">
    <Toast />
    <Header />
    <div className="flex-1 min-h-0 overflow-hidden">
      <Suspense fallback={<LoadingSpinner />}>
        {children}
      </Suspense>
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
    <div
      className="min-h-screen transition-all duration-300 ease-in-out"
      style={{ background: isBlack ? '#0a0a0a' : '#fbf7f0' }}
      data-theme={isBlack ? 'black' : 'glass'}
    >
      <Routes>
        <Route 
          path="/" 
          element={
            <Layout>
              <LazyChannelPage />
            </Layout>
          } 
        />
        <Route 
          path="/favorites" 
          element={
            <Layout>
              <LazyFavoritePage />
            </Layout>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <Layout>
              <LazySettingsPage />
            </Layout>
          } 
        />
        <Route 
          path="/tv-mode" 
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <LazyTvModePage />
            </Suspense>
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
