export interface Channel {
  id: string;
  name: string;
  logo: string;
  category: string;
  currentProgram: string;
  isLive: boolean;
  tid: 'ws' | 'ys';
}

export interface ChannelLine {
  id: string;
  name: string;
  url: string;
  quality: string;
  isActive?: boolean;
}

export interface UserSettings {
  theme: 'glass' | 'white' | 'black';
  autoPlay: boolean;
  quality: 'high' | 'medium' | 'low';
}

export interface AppState {
  favorites: string[];
  settings: UserSettings;
  currentCategory: string;
}
