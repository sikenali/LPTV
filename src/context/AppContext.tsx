import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AppState, UserSettings } from '../types';

type Action =
  | { type: 'ADD_FAVORITE'; payload: string }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'SET_FAVORITES'; payload: string[] }
  | { type: 'CLEAN_ORPHANED_FAVORITES'; payload: string[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_LAST_PLAYED_CHANNEL'; payload: string | null }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'error' | 'info' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_TV_MODE'; payload: boolean };

const initialState: AppState = {
  favorites: [],
  settings: { theme: 'glass', autoPlay: false, quality: 'high', tvMode: false, autoRefresh: true },
  currentCategory: '全部',
  channels: [],
  channelsLoading: false,
  channelsError: null,
  lastPlayedChannel: null,
  toastMessage: null,
  toastType: null,
  tvModeState: 'off',
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
    case 'SET_LAST_PLAYED_CHANNEL':
      return { ...state, lastPlayedChannel: action.payload };
    case 'SHOW_TOAST':
      return {
        ...state,
        toastMessage: action.payload.message,
        toastType: action.payload.type ?? 'success',
      };
    case 'HIDE_TOAST':
      return { ...state, toastMessage: null, toastType: null };
    case 'SET_TV_MODE':
      return {
        ...state,
        settings: { ...state.settings, tvMode: action.payload },
        tvModeState: action.payload ? 'on' : 'off',
      };
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
  setTvMode: (on: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

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
  const setCategory = (category: string) => dispatch({ type: 'SET_CATEGORY', payload: category });
  const setTvMode = (on: boolean) => dispatch({ type: 'SET_TV_MODE', payload: on });
  const showToast = useCallback((message: string, type: 'success'|'error'|'info' = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 2000);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: id })
    const wasFav = state.favorites.includes(id)
    showToast(wasFav ? '已取消收藏' : '已收藏', wasFav ? 'info' : 'success')
  }, [state.favorites, showToast])

  const updateSettings = useCallback((settings: Partial<UserSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings })
    if (settings.theme) {
      const name = settings.theme === 'glass' ? '羊皮纸' : '近黑'
      showToast(`主题已切换为「${name}」`, 'info')
    }
  }, [showToast])

  return (
    <AppContext.Provider value={{ ...state, addFavorite, removeFavorite, toggleFavorite, updateSettings, setCategory, showToast, setTvMode }}>
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
