export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export interface UserSettings {
  theme: 'glass' | 'black';
  autoPlay: boolean;
  quality: 'high' | 'medium' | 'low';
  tvMode: boolean;
  autoRefresh: boolean;
}

export type TvModeState = 'off' | 'entering' | 'on' | 'exiting'

export interface AppState {
  favorites: string[];
  settings: UserSettings;
  currentCategory: string;
  channels: Channel[];
  channelsLoading: boolean;
  channelsError: string | null;
  lastPlayedChannel: string | null;
  selectedChannel: Channel | null;
  channelStatus: Record<string, 'ok' | 'error' | 'unknown'>;
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info' | null;
  tvModeState: TvModeState;
}
