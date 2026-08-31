import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { iptvChannels } from '../data/iptvChannels';
import { isLazcatWebShell, setLazcatFullscreen, setLazcatControlBar, LazcatWindow } from '../utils/openChannel';

/**
 * 播放页: 负责「只出问题才自动切换」。
 * - 央视官网(tv.cctv.com): 可 iframe 内嵌 → 探测官网可播性, 若官网异常则整页跳央视频备用。
 * - 卫视频道(央视频, CSP 拒绝 iframe): 整页导航。
 */
const PlayPage: React.FC = () => {
  const { tid, id } = useParams<{ tid: string; id: string }>();
  const channel = iptvChannels.find(c => c.tid === tid && c.id === id);
  const [fallbackReady, setFallbackReady] = useState(false);
  const probing = useRef(false);

  // 懒猫容器沉浸
  useEffect(() => {
    if (isLazcatWebShell()) {
      setLazcatFullscreen(true);
      setLazcatControlBar(false);
      (window as LazcatWindow).lzcappNavigationBarHidden = true;
    }
  }, []);

  useEffect(() => {
    if (!channel) return;

    // 卫视频道(央视频) / 无官网地址 → 整页导航
    if (channel.source === 'ysp') {
      window.location.href = channel.url;
      return;
    }

    // 央视官网: 需在 iframe 前探测官网是否可播
    if (channel.source === 'cctv' && channel.backupUrl && !probing.current) {
      probing.current = true;
      const backupUrl = channel.backupUrl;
      (async () => {
        try {
          const ctl = new AbortController();
          const to = setTimeout(() => ctl.abort(), 8000);
          const resp = await fetch(`/api/check?url=${encodeURIComponent(channel.url)}`, { signal: ctl.signal });
          clearTimeout(to);
          const data = resp.ok ? await resp.json() : { ok: false };
          // 官网可播 → 停留 iframe; 官网异常 → 整页跳备用(央视频)
          if (!data.ok) {
            window.location.href = backupUrl;
            return;
          }
          setFallbackReady(true);
        } catch {
          // 探测失败视为可播, 直接停留官网 iframe
          setFallbackReady(true);
        }
      })();
    } else {
      // 无备用源 → 直接展示官网 iframe
      setFallbackReady(true);
    }
  }, [channel]);

  if (!channel) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/60 text-sm">
        频道不存在或已下线
      </div>
    );
  }

  const showIframe = channel.source === 'cctv' && !!channel.url && fallbackReady;

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      {showIframe ? (
        <iframe
          src={channel.url}
          className="w-full h-full border-0"
          style={{ background: '#000' }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black">
          <div className="w-10 h-10 border-4 border-[#c43d3d] border-t-transparent rounded-full animate-spin" />
          <div className="text-white/60 text-sm mt-4">
            {channel.source === 'cctv' ? '正在检测央视官网, 若不可用将自动切换央视频...' : '正在打开...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayPage;
