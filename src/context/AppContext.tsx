import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, UserSettings } from '../types';

type Action =
  | { type: 'ADD_FAVORITE'; payload: string }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'SET_FAVORITES'; payload: string[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_CATEGORY'; payload: string };

const initialState: AppState = {
  favorites: [],
  settings: { theme: 'black', autoPlay: false, quality: 'high', tvMode: false, showLines: false },
  currentCategory: '全部',
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
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_CATEGORY':
      return { ...state, currentCategory: action.payload };
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
  const toggleFavorite = (id: string) => dispatch({ type: 'TOGGLE_FAVORITE', payload: id });
  const updateSettings = (settings: Partial<UserSettings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  const setCategory = (category: string) => dispatch({ type: 'SET_CATEGORY', payload: category });

  return (
    <AppContext.Provider value={{ ...state, addFavorite, removeFavorite, toggleFavorite, updateSettings, setCategory }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
