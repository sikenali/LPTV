import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, UserSettings, Channel } from '../types';
import { fetchChannels } from '../services/channelApi';

const AUTO_REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

type Action =
  | { type: 'ADD_FAVORITE'; payload: string }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'SET_FAVORITES'; payload: string[] }
  | { type: 'CLEAN_ORPHANED_FAVORITES'; payload: string[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_CHANNELS'; payload: Channel[] }
  | { type: 'SET_CHANNELS_LOADING'; payload: boolean }
  | { type: 'SET_CHANNELS_ERROR'; payload: string | null }
  | { type: 'SET_LAST_PLAYED_CHANNEL'; payload: string | null };

const initialState: AppState = {
  favorites: [],
  settings: { theme: 'glass', autoPlay: false, quality: 'high', tvMode: false },
  currentCategory: '全部',
  channels: [],
  channelsLoading: false,
  channelsError: null,
  lastPlayedChannel: null,
};

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_FAVORITE':
      return { ...state, favorites: [...state.favorites, action.payload] };
    case 'REMOVE_FAVORITE':
      return { ...state, favorites: state.favorites.filter(id => id !== action.payload) };
    case 'TOGGLE_FAVORITE':
      return state.favorites.includes(action.payload)
        ? { ...state, favorites: state.favorites.filter(id => id !== action.payload) }
        : { ...state, favorites: [...state.favorites, action.payload] };
    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload };
    case 'CLEAN_ORPHANED_FAVORITES':
      return { ...state, favorites: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_CATEGORY':
      return { ...state, currentCategory: action.payload };
    case 'SET_CHANNELS':
      return { ...state, channels: action.payload, channelsLoading: false, channelsError: null };
    case 'SET_CHANNELS_LOADING':
      return { ...state, channelsLoading: action.payload };
    case 'SET_CHANNELS_ERROR':
      return { ...state, channelsError: action.payload, channelsLoading: false };
    case 'SET_LAST_PLAYED_CHANNEL':
      return { ...state, lastPlayedChannel: action.payload };
    default:
      return state;
  }
};

interface AppContextType extends AppState {
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (id: string) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  setCategory: (category: string) => void;
  loadChannels: (refresh?: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lptv-favorites');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          dispatch({ type: 'SET_FAVORITES', payload: parsed });
        }
      } catch {
        console.error('Failed to parse favorites');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lptv-favorites', JSON.stringify(state.favorites));
  }, [state.favorites]);

  useEffect(() => {
    const saved = localStorage.getItem('lptv-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'UPDATE_SETTINGS', payload: parsed });
      } catch {
        console.error('Failed to parse settings');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lptv-settings', JSON.stringify(state.settings));
  }, [state.settings]);

  const addFavorite = (id: string) => dispatch({ type: 'ADD_FAVORITE', payload: id });
  const removeFavorite = (id: string) => dispatch({ type: 'REMOVE_FAVORITE', payload: id });
  const toggleFavorite = (id: string) => dispatch({ type: 'TOGGLE_FAVORITE', payload: id });
  const updateSettings = (settings: Partial<UserSettings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  const setCategory = (category: string) => dispatch({ type: 'SET_CATEGORY', payload: category });

  const loadChannels = useCallback(async (refresh = false) => {
    dispatch({ type: 'SET_CHANNELS_LOADING', payload: true });
    try {
      const data = await fetchChannels(refresh);
      dispatch({ type: 'SET_CHANNELS', payload: data });
      // Auto-clear orphaned favorites
      const channelIds = new Set(data.map(c => c.id));
      const validFavorites = state.favorites.filter(id => channelIds.has(id));
      if (validFavorites.length !== state.favorites.length) {
        dispatch({ type: 'CLEAN_ORPHANED_FAVORITES', payload: validFavorites });
      }
      const savedId = localStorage.getItem('lastPlayedChannel');
      if (savedId && data.some(c => c.id === savedId)) {
        dispatch({ type: 'SET_LAST_PLAYED_CHANNEL', payload: savedId });
      } else {
        dispatch({ type: 'SET_LAST_PLAYED_CHANNEL', payload: null });
      }
    } catch (err) {
      dispatch({ type: 'SET_CHANNELS_ERROR', payload: err instanceof Error ? err.message : '加载失败' });
    }
  }, []);

  const startAutoRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setInterval(() => {
      loadChannels(true);
    }, AUTO_REFRESH_INTERVAL);
  }, [loadChannels]);

  useEffect(() => {
    loadChannels();
    startAutoRefresh();
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return (
    <AppContext.Provider value={{ ...state, addFavorite, removeFavorite, toggleFavorite, updateSettings, setCategory, loadChannels }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
