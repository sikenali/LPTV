# LPTV 电视直播Web应用 - 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建一个电视直播Web应用，包含频道浏览、IPTV播放、收藏管理和液态玻璃主题。

**架构：** React + TypeScript + Vite + Tailwind CSS + liquid-glass-react。采用组件化架构，通过 React Context 管理全局状态，调用外部 IPTV 接口获取视频流。

**技术栈：** React 18, TypeScript, Vite 6, Tailwind CSS 3, React Router DOM 6, liquid-glass-react

---

## 文件结构

```
src/
├── components/
│   ├── Layout/Header.tsx
│   ├── Channel/{ChannelCard.tsx, ChannelList.tsx}
│   ├── Player/{IPTVPlayer.tsx, ChannelLineList.tsx, index.ts}
│   ├── Favorite/{FavoriteCard.tsx, FavoriteList.tsx, EmptyState.tsx}
│   └── Settings/{ThemeSetting.tsx, ModeSetting.tsx}
├── pages/{ChannelPage.tsx, PlayerPage.tsx, FavoritePage.tsx, SettingsPage.tsx}
├── hooks/useFavorites.ts
├── context/AppContext.tsx
├── types/index.ts
├── data/channels.ts
├── utils/iptv.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## 任务列表

### 任务 1：项目初始化

**文件：**
- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`vite.config.ts`
- 创建：`tailwind.config.js`

- [ ] **步骤 1：初始化 Vite + React + TypeScript 项目**

```bash
npm create vite@6.5.0 . -- --template react-ts
```

- [ ] **步骤 2：安装依赖**

```bash
npm install tailwindcss@3 react-router-dom@6 liquid-glass-react
npm install -D @types/node
```

- [ ] **步骤 3：配置 Tailwind CSS**

```javascript
// tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          50: 'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
        }
      },
      backdropBlur: {
        xs: '2px', sm: '4px', md: '8px', lg: '16px', xl: '24px', '2xl': '40px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.05)',
        'glass-glow': '0 0 30px rgba(100,200,255,0.3), 0 8px 32px rgba(0,0,0,0.3)',
      }
    }
  }
};
```

- [ ] **步骤 4：配置 tsconfig.json 路径别名**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **步骤 5：Commit**

```bash
git add package.json tsconfig.json vite.config.ts tailwind.config.js
git commit -m "chore: initialize project with Vite + React + TypeScript"
```

---

### 任务 2：核心类型定义

**文件：**
- 创建：`src/types/index.ts`

- [ ] **步骤 1：编写类型定义**

```typescript
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
  theme: 'dark' | 'light';
  autoPlay: boolean;
  quality: 'high' | 'medium' | 'low';
}

export interface AppState {
  favorites: string[];
  settings: UserSettings;
  currentCategory: string;
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core type definitions"
```

---

### 任务 3：频道模拟数据

**文件：**
- 创建：`src/data/channels.ts`

- [ ] **步骤 1：编写频道数据**

```typescript
import { Channel } from '../types';

export const channels: Channel[] = [
  { id: '1', name: 'CCTV-1', logo: '', category: '卫视', currentProgram: '新闻联播', isLive: true, tid: 'ws' },
  { id: '2', name: 'CCTV-2', logo: '', category: '卫视', currentProgram: '财经新闻', isLive: true, tid: 'ws' },
  { id: '3', name: '北京卫视', logo: '', category: '卫视', currentProgram: '北京新闻', isLive: true, tid: 'ws' },
  { id: '4', name: '东方卫视', logo: '', category: '卫视', currentProgram: '娱乐星天地', isLive: true, tid: 'ws' },
  { id: '5', name: '湖南卫视', logo: '', category: '卫视', currentProgram: '快乐大本营', isLive: false, tid: 'ws' },
  { id: '6', name: '浙江卫视', logo: '', category: '卫视', currentProgram: '奔跑吧', isLive: true, tid: 'ws' },
  { id: '7', name: '电影频道', logo: '', category: '影视', currentProgram: '动作大片', isLive: false, tid: 'ys' },
  { id: '8', name: '电视剧频道', logo: '', category: '影视', currentProgram: '热播剧集', isLive: false, tid: 'ys' },
];

export const categories = ['全部', '卫视', '影视'];
```

- [ ] **步骤 2：Commit**

```bash
git add src/data/channels.ts
git commit -m "feat: add channel mock data"
```

---

### 任务 4：IPTV 工具函数

**文件：**
- 创建：`src/utils/iptv.ts`

- [ ] **步骤 1：编写 IPTV 解析函数**

```typescript
import { ChannelLine } from '../types';

const BASE_URL = 'https://iptv345.com';
const TOKEN = '096084226df84fa64f443317d448b36b';

export const fetchVideoUrl = async (tid: string, channelId: string, lineId?: string): Promise<string> => {
  const url = new URL(`${BASE_URL}/?act=play`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('tid', tid);
  url.searchParams.set('id', channelId);
  if (lineId) url.searchParams.set('line', lineId);

  const response = await fetch(url.toString());
  const html = await response.text();
  
  const videoMatch = html.match(/<video[^>]+src="([^"]+)"/);
  if (videoMatch && videoMatch[1]) {
    return videoMatch[1];
  }
  
  throw new Error('无法获取视频流');
};

export const parseChannelLines = (html: string): ChannelLine[] => {
  const lines: ChannelLine[] = [];
  const linePattern = /data-line="(\d+)"[^>]*>([^<]+)/g;
  let match;
  
  while ((match = linePattern.exec(html)) !== null) {
    lines.push({
      id: match[1],
      name: match[2].trim(),
      url: '',
      quality: '',
      isActive: false
    });
  }
  
  return lines.length > 0 ? lines : [
    { id: '1', name: '默认线路', url: '', quality: '高清', isActive: true }
  ];
};

export const fetchChannelLines = async (tid: string, channelId: string): Promise<ChannelLine[]> => {
  const url = new URL(`${BASE_URL}/?act=play`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('tid', tid);
  url.searchParams.set('id', channelId);

  const response = await fetch(url.toString());
  const html = await response.text();
  
  return parseChannelLines(html);
};
```

- [ ] **步骤 2：Commit**

```bash
git add src/utils/iptv.ts
git commit -m "feat: add IPTV utility functions"
```

---

### 任务 5：全局状态管理

**文件：**
- 创建：`src/context/AppContext.tsx`

- [ ] **步骤 1：编写 Context**

```typescript
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, UserSettings } from '../types';

type Action =
  | { type: 'ADD_FAVORITE'; payload: string }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'TOGGLE_FAVORITE'; payload: string }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'SET_CATEGORY'; payload: string };

const initialState: AppState = {
  favorites: [],
  settings: { theme: 'dark', autoPlay: false, quality: 'high' },
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
    if (saved) dispatch({ type: 'ADD_FAVORITE', payload: JSON.parse(saved) });
  }, []);

  useEffect(() => {
    localStorage.setItem('lptv-favorites', JSON.stringify(state.favorites));
  }, [state.favorites]);

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
```

- [ ] **步骤 2：Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add global state management with Context"
```

---

### 任务 6：频道卡片组件

**文件：**
- 创建：`src/components/Channel/ChannelCard.tsx`

- [ ] **步骤 1：编写频道卡片组件**

```tsx
import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { Channel } from '../../types';
import { useApp } from '../../context/AppContext';

interface ChannelCardProps {
  channel: Channel;
  onClick: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onClick }) => {
  const { favorites, toggleFavorite } = useApp();
  const isFavorite = favorites.includes(channel.id);

  return (
    <LiquidGlass
      cornerRadius={16}
      padding="16px"
      displacementScale={50}
      blurAmount={0.08}
      saturation={130}
      aberrationIntensity={1.5}
      elasticity={0.2}
      onClick={onClick}
      className="cursor-pointer transition-transform hover:scale-105"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <span className="text-white font-bold text-lg">{channel.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{channel.name}</h3>
          <p className="text-white/60 text-sm truncate">{channel.currentProgram}</p>
        </div>
        <div className="flex items-center gap-2">
          {channel.isLive && (
            <span className="px-2 py-1 rounded-full bg-red-500/80 text-white text-xs font-medium">
              LIVE
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(channel.id); }}
            className={`p-2 rounded-lg transition-colors ${isFavorite ? 'text-yellow-400' : 'text-white/60 hover:text-white'}`}
          >
            <svg className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>
    </LiquidGlass>
  );
};

export default ChannelCard;
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/Channel/ChannelCard.tsx
git commit -m "feat: add ChannelCard component with liquid glass effect"
```

---

### 任务 7：频道列表组件

**文件：**
- 创建：`src/components/Channel/ChannelList.tsx`

- [ ] **步骤 1：编写频道列表组件**

```tsx
import React from 'react';
import ChannelCard from './ChannelCard';
import { Channel } from '../../types';

interface ChannelListProps {
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({ channels, onChannelClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onClick={() => onChannelClick(channel)}
        />
      ))}
    </div>
  );
};

export default ChannelList;
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/Channel/ChannelList.tsx
git commit -m "feat: add ChannelList component"
```

---

### 任务 8：头部导航组件

**文件：**
- 创建：`src/components/Layout/Header.tsx`

- [ ] **步骤 1：编写头部导航组件**

```tsx
import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: '频道', path: '/' },
    { label: '收藏', path: '/favorites' },
    { label: '设置', path: '/settings' },
  ];

  return (
    <LiquidGlass
      cornerRadius={0}
      padding="0"
      displacementScale={20}
      blurAmount={0.12}
      saturation={110}
      elasticity={0.1}
      className="sticky top-0 z-50"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-white font-bold text-xl">LPTV</span>
          </div>
          
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-2 rounded-lg text-white text-sm transition-all ${
                  location.pathname === item.path
                    ? 'bg-white/20'
                    : 'bg-white/10 hover:bg-white/15'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </LiquidGlass>
  );
};

export default Header;
```

- [ ] **步骤 2：Commit**

```bash
git add src/components/Layout/Header.tsx
git commit -m "feat: add Header component with liquid glass effect"
```

---

### 任务 9：播放器组件

**文件：**
- 创建：`src/components/Player/IPTVPlayer.tsx`
- 创建：`src/components/Player/ChannelLineList.tsx`
- 创建：`src/components/Player/index.ts`

- [ ] **步骤 1：编写线路列表组件**

```tsx
// ChannelLineList.tsx
import React from 'react';
import { ChannelLine } from '../../types';

interface ChannelLineListProps {
  lines: ChannelLine[];
  currentLine: ChannelLine | null;
  onLineSwitch: (line: ChannelLine) => void;
}

const ChannelLineList: React.FC<ChannelLineListProps> = ({ lines, currentLine, onLineSwitch }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {lines.map((line) => (
        <button
          key={line.id}
          onClick={() => onLineSwitch(line)}
          className={`px-4 py-2 rounded-lg text-white text-sm whitespace-nowrap transition-all ${
            currentLine?.id === line.id
              ? 'bg-blue-500/40 border border-blue-400/50'
              : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          {line.name}
          {line.quality && <span className="ml-1 text-white/60 text-xs">{line.quality}</span>}
        </button>
      ))}
    </div>
  );
};

export default ChannelLineList;
```

- [ ] **步骤 2：编写 IPTV 播放器组件**

```tsx
// IPTVPlayer.tsx
import React, { useState, useEffect, useRef } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { Channel, ChannelLine } from '../../types';
import { fetchVideoUrl, fetchChannelLines } from '../../utils/iptv';
import ChannelLineList from './ChannelLineList';

interface IPTVPlayerProps {
  channel: Channel;
  onBack: () => void;
}

const IPTVPlayer: React.FC<IPTVPlayerProps> = ({ channel, onBack }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [lines, setLines] = useState<ChannelLine[]>([]);
  const [currentLine, setCurrentLine] = useState<ChannelLine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadChannel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const channelLines = await fetchChannelLines(channel.tid, channel.id);
        setLines(channelLines);
        
        const firstLine = channelLines[0];
        setCurrentLine({ ...firstLine, isActive: true });
        
        const url = await fetchVideoUrl(channel.tid, channel.id, firstLine.id);
        setVideoUrl(url);
        
        setIsLoading(false);
      } catch (err) {
        setError('加载失败，请重试');
        setIsLoading(false);
      }
    };
    
    loadChannel();
  }, [channel]);

  const handleLineSwitch = async (line: ChannelLine) => {
    if (currentLine?.id === line.id) return;
    
    try {
      setIsLoading(true);
      const url = await fetchVideoUrl(channel.tid, channel.id, line.id);
      
      setLines(lines.map(l => ({ ...l, isActive: l.id === line.id })));
      setCurrentLine({ ...line, url, isActive: true });
      setVideoUrl(url);
      setIsLoading(false);
    } catch (err) {
      setError('切换线路失败');
      setIsLoading(false);
    }
  };

  const handleTouch = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white">{error}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white/10 text-white rounded-lg">
          重试
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black flex flex-col"
      onTouchStart={handleTouch}
      onMouseMove={handleTouch}
    >
      {/* 顶部信息栏 */}
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <LiquidGlass
          cornerRadius={0}
          padding="0"
          displacementScale={20}
          blurAmount={0.1}
          saturation={110}
          elasticity={0.1}
          className="sticky top-0 z-50"
        >
          <div className="px-4 py-3 flex items-center gap-4">
            <button 
              onClick={onBack} 
              className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="text-white font-semibold">{channel.name}</div>
              <div className="text-white/60 text-sm">{channel.currentProgram}</div>
            </div>
          </div>
        </LiquidGlass>
      </div>

      {/* 视频区域 */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          id="vstPlayer"
          className="w-full h-full"
          webkit-playsinline
          playsinline
          src={videoUrl}
          autoPlay
        />
      </div>

      {/* 线路切换 */}
      <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <LiquidGlass
          cornerRadius={16}
          padding="16px"
          displacementScale={30}
          blurAmount={0.1}
          elasticity={0.15}
          className="mx-4 mb-4"
        >
          <div className="text-white/60 text-sm mb-3">线路选择</div>
          <ChannelLineList lines={lines} currentLine={currentLine} onLineSwitch={handleLineSwitch} />
        </LiquidGlass>
      </div>
    </div>
  );
};

export default IPTVPlayer;
```

- [ ] **步骤 3：编写导出文件**

```tsx
// index.ts
export { default as IPTVPlayer } from './IPTVPlayer';
export { default as ChannelLineList } from './ChannelLineList';
```

- [ ] **步骤 4：Commit**

```bash
git add src/components/Player/
git commit -m "feat: add IPTVPlayer and ChannelLineList components"
```

---

### 任务 10：收藏组件

**文件：**
- 创建：`src/components/Favorite/FavoriteCard.tsx`
- 创建：`src/components/Favorite/FavoriteList.tsx`
- 创建：`src/components/Favorite/EmptyState.tsx`

- [ ] **步骤 1：编写收藏卡片组件**

```tsx
// FavoriteCard.tsx
import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { Channel } from '../../types';
import { useApp } from '../../context/AppContext';

interface FavoriteCardProps {
  channel: Channel;
  onClick: () => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ channel, onClick }) => {
  const { toggleFavorite } = useApp();

  return (
    <LiquidGlass
      cornerRadius={12}
      padding="12px"
      displacementScale={40}
      blurAmount={0.07}
      saturation={120}
      aberrationIntensity={1}
      elasticity={0.15}
      onClick={onClick}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
          <span className="text-white font-bold">{channel.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium truncate">{channel.name}</h4>
          <p className="text-white/50 text-xs truncate">{channel.currentProgram}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(channel.id); }}
          className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>
    </LiquidGlass>
  );
};

export default FavoriteCard;
```

- [ ] **步骤 2：编写收藏列表组件**

```tsx
// FavoriteList.tsx
import React from 'react';
import FavoriteCard from './FavoriteCard';
import EmptyState from './EmptyState';
import { Channel } from '../../types';

interface FavoriteListProps {
  channels: Channel[];
  onChannelClick: (channel: Channel) => void;
}

const FavoriteList: React.FC<FavoriteListProps> = ({ channels, onChannelClick }) => {
  if (channels.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {channels.map((channel) => (
        <FavoriteCard
          key={channel.id}
          channel={channel}
          onClick={() => onChannelClick(channel)}
        />
      ))}
    </div>
  );
};

export default FavoriteList;
```

- [ ] **步骤 3：编写空状态组件**

```tsx
// EmptyState.tsx
import React from 'react';

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <h3 className="text-white/60 text-lg mb-2">暂无收藏</h3>
      <p className="text-white/40 text-sm">去频道页添加喜欢的频道吧</p>
    </div>
  );
};

export default EmptyState;
```

- [ ] **步骤 4：Commit**

```bash
git add src/components/Favorite/
git commit -m "feat: add FavoriteCard, FavoriteList and EmptyState components"
```

---

### 任务 11：设置组件

**文件：**
- 创建：`src/components/Settings/ThemeSetting.tsx`
- 创建：`src/components/Settings/ModeSetting.tsx`

- [ ] **步骤 1：编写主题设置组件**

```tsx
// ThemeSetting.tsx
import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { useApp } from '../../context/AppContext';

const ThemeSetting: React.FC = () => {
  const { settings, updateSettings } = useApp();

  return (
    <LiquidGlass
      cornerRadius={16}
      padding="20px"
      displacementScale={30}
      blurAmount={0.08}
      saturation={120}
      elasticity={0.15}
    >
      <h3 className="text-white font-semibold mb-4">主题设置</h3>
      <div className="flex gap-4">
        <button
          onClick={() => updateSettings({ theme: 'dark' })}
          className={`flex-1 py-3 px-4 rounded-lg transition-all ${
            settings.theme === 'dark'
              ? 'bg-blue-500/40 border border-blue-400/50'
              : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600" />
            <span className="text-white text-sm">深色模式</span>
          </div>
        </button>
        <button
          onClick={() => updateSettings({ theme: 'light' })}
          className={`flex-1 py-3 px-4 rounded-lg transition-all ${
            settings.theme === 'light'
              ? 'bg-blue-500/40 border border-blue-400/50'
              : 'bg-white/10 hover:bg-white/15'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-300 border border-yellow-400" />
            <span className="text-white text-sm">浅色模式</span>
          </div>
        </button>
      </div>
    </LiquidGlass>
  );
};

export default ThemeSetting;
```

- [ ] **步骤 2：编写播放模式设置组件**

```tsx
// ModeSetting.tsx
import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { useApp } from '../../context/AppContext';

const ModeSetting: React.FC = () => {
  const { settings, updateSettings } = useApp();

  const qualities = [
    { value: 'high', label: '高清' },
    { value: 'medium', label: '标清' },
    { value: 'low', label: '流畅' },
  ];

  return (
    <LiquidGlass
      cornerRadius={16}
      padding="20px"
      displacementScale={30}
      blurAmount={0.08}
      saturation={120}
      elasticity={0.15}
    >
      <h3 className="text-white font-semibold mb-4">播放设置</h3>
      
      {/* 自动播放 */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-white/80">自动播放</span>
        <button
          onClick={() => updateSettings({ autoPlay: !settings.autoPlay })}
          className={`w-12 h-6 rounded-full transition-all ${
            settings.autoPlay ? 'bg-blue-500' : 'bg-white/20'
          }`}
        >
          <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
            settings.autoPlay ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* 画质选择 */}
      <div className="mb-2">
        <span className="text-white/80">默认画质</span>
      </div>
      <div className="flex gap-2">
        {qualities.map((quality) => (
          <button
            key={quality.value}
            onClick={() => updateSettings({ quality: quality.value as 'high' | 'medium' | 'low' })}
            className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
              settings.quality === quality.value
                ? 'bg-blue-500/40 border border-blue-400/50 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            {quality.label}
          </button>
        ))}
      </div>
    </LiquidGlass>
  );
};

export default ModeSetting;
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/Settings/
git commit -m "feat: add ThemeSetting and ModeSetting components"
```

---

### 任务 12：页面组件

**文件：**
- 创建：`src/pages/ChannelPage.tsx`
- 创建：`src/pages/PlayerPage.tsx`
- 创建：`src/pages/FavoritePage.tsx`
- 创建：`src/pages/SettingsPage.tsx`

- [ ] **步骤 1：编写频道页面**

```tsx
// ChannelPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import ChannelList from '../components/Channel/ChannelList';
import { channels, categories } from '../data/channels';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';

const ChannelPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentCategory, setCategory } = useApp();

  const filteredChannels = currentCategory === '全部'
    ? channels
    : channels.filter(c => c.category === currentCategory);

  const handleChannelClick = (channel: Channel) => {
    navigate(`/player/${channel.tid}/${channel.id}`);
  };

  return (
    <div>
      {/* 分类筛选 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setCategory(category)}
            className={`px-4 py-2 rounded-full text-white text-sm whitespace-nowrap transition-all ${
              currentCategory === category
                ? 'bg-blue-500'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 频道列表 */}
      <ChannelList channels={filteredChannels} onChannelClick={handleChannelClick} />
    </div>
  );
};

export default ChannelPage;
```

- [ ] **步骤 2：编写播放器页面**

```tsx
// PlayerPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import IPTVPlayer from '../components/Player/IPTVPlayer';
import { channels } from '../data/channels';

const PlayerPage: React.FC = () => {
  const { tid, channelId } = useParams<{ tid: string; channelId: string }>();
  const navigate = useNavigate();

  const channel = channels.find(
    c => c.id === channelId && c.tid === tid
  );

  if (!channel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">频道不存在</div>
      </div>
    );
  }

  return <IPTVPlayer channel={channel} onBack={() => navigate('/')} />;
};

export default PlayerPage;
```

- [ ] **步骤 3：编写收藏页面**

```tsx
// FavoritePage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import FavoriteList from '../components/Favorite/FavoriteList';
import { channels } from '../data/channels';
import { Channel } from '../types';
import { useApp } from '../context/AppContext';

const FavoritePage: React.FC = () => {
  const navigate = useNavigate();
  const { favorites } = useApp();

  const favoriteChannels = channels.filter(c => favorites.includes(c.id));

  const handleChannelClick = (channel: Channel) => {
    navigate(`/player/${channel.tid}/${channel.id}`);
  };

  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">我的收藏</h1>
      <FavoriteList channels={favoriteChannels} onChannelClick={handleChannelClick} />
    </div>
  );
};

export default FavoritePage;
```

- [ ] **步骤 4：编写设置页面**

```tsx
// SettingsPage.tsx
import React from 'react';
import ThemeSetting from '../components/Settings/ThemeSetting';
import ModeSetting from '../components/Settings/ModeSetting';

const SettingsPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-white text-2xl font-bold mb-6">设置</h1>
      <div className="space-y-4">
        <ThemeSetting />
        <ModeSetting />
      </div>
    </div>
  );
};

export default SettingsPage;
```

- [ ] **步骤 5：Commit**

```bash
git add src/pages/
git commit -m "feat: add all page components"
```

---

### 任务 13：主应用入口

**文件：**
- 创建：`src/App.tsx`
- 创建：`src/main.tsx`
- 创建：`src/index.css`

- [ ] **步骤 1：编写 App.tsx**

```tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Header from './components/Layout/Header';
import ChannelPage from './pages/ChannelPage';
import PlayerPage from './pages/PlayerPage';
import FavoritePage from './pages/FavoritePage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20">
          {/* 动态背景装饰 */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500/5 rounded-full blur-3xl" />
          </div>

          <Header />
          
          <main className="container mx-auto px-4 py-6 relative z-10">
            <Routes>
              <Route path="/" element={<ChannelPage />} />
              <Route path="/player/:tid/:channelId" element={<PlayerPage />} />
              <Route path="/favorites" element={<FavoritePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
```

- [ ] **步骤 2：编写 main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **步骤 3：编写全局样式**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.video-container video {
  object-fit: contain;
}
```

- [ ] **步骤 4：Commit**

```bash
git add src/App.tsx src/main.tsx src/index.css
git commit -m "feat: add main application entry"
```

---

### 任务 14：构建验证

**文件：**
- 修改：`index.html`

- [ ] **步骤 1：配置 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0f172a" />
    <title>LPTV - 电视直播</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **步骤 2：运行构建命令**

```bash
npm run build
```

预期：构建成功，无错误

- [ ] **步骤 3：Commit**

```bash
git add index.html
git commit -m "chore: update index.html with meta tags"
```

---

## 自检清单

### 1. 规格覆盖度
- ✅ 频道浏览页面
- ✅ IPTV播放器（线路切换）
- ✅ 收藏管理页面（空态处理）
- ✅ 设置页面（主题/模式）
- ✅ 液态玻璃主题
- ✅ 移动端适配

### 2. 技术要点
- ✅ IPTV接口集成
- ✅ 线路切换功能
- ✅ 路由配置
- ✅ 状态管理（Context）
- ✅ 本地存储（localStorage）
- ✅ liquid-glass-react 集成
- ✅ 响应式设计

---

**计划已完成并保存到 `docs/superpowers/plans/2026-06-24-lptv-implementation.md`。**

**两种执行方式：**

1. **子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

2. **内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**