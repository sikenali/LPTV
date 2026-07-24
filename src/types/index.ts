export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
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
  tvMode: boolean;
  showLines: boolean;
}

export interface AppState {
  favorites: string[];
  settings: UserSettings;
  currentCategory: string;
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
}
