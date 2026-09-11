/**
 * LPTV — Player Manager
 * 直接在 iframe 中加载频道页面
 */
window.TVPlayer = {
    currentChannel: null,
    iframeLoaded: false,
    _timeoutId: null,

    play(channel) {
        this.currentChannel = channel;

        document.getElementById('tvPlayingBar').style.display = 'flex';
        document.getElementById('tvPlayingName').textContent = channel.name;
        document.getElementById('tvPlayingCat').textContent = channel.category;

        const key = `${channel.tid}-${channel.id}`;
        const isFaved = TVChannels.favorites.includes(key);
        const btn = document.getElementById('tvFavBtn');
        btn.textContent = isFaved ? '★ 已收藏' : '☆ 收藏';
        btn.classList.toggle('faved', isFaved);
        btn.onclick = () => TVChannels.toggleFavorite(channel);

        document.getElementById('tvPlaceholder').style.display = 'none';
        document.getElementById('tvBuffering').style.display = 'flex';
        this.iframeLoaded = false;
        this._stopPolling();

        // Hide splash on first play
        this._hideSplash();

        const iframe = document.getElementById('tvIframe');
        const video = document.getElementById('tvVideo');

        // Use proxied URL — hides all non-video elements server-side
        const url = `/proxy/345iptv/${channel.tid}/${channel.id}`;
        console.log('[TVPlayer] loading via proxy:', channel.name, url);

        // Clear previous listeners
        if (this._timeoutId) clearTimeout(this._timeoutId);
        iframe.removeAttribute('onerror');
        iframe.onload = null;

        iframe.src = url;

        iframe.onload = () => {
            console.log('[TVPlayer] iframe loaded via proxy, polling for #vstPlayer...');
            this._pollForVideo(iframe, video);
        };

        iframe.onerror = () => {
            console.error('[TVPlayer] iframe load error');
            this._stopPolling();
            document.getElementById('tvBuffering').style.display = 'none';
            document.getElementById('tvPlaceholder').style.display = 'flex';
            document.getElementById('tvPlaceholder').querySelector('.tv-placeholder-text').textContent = '播放失败，请重试';
            this.iframeLoaded = false;
        };

        // Fallback: show iframe after timeout
        this._timeoutId = setTimeout(() => {
            this._stopPolling();
            if (!this.iframeLoaded) {
                console.warn('[TVPlayer] timeout, iframe fallback');
                document.getElementById('tvBuffering').style.display = 'none';
                video.style.display = 'none';
                iframe.style.display = 'block';
                this.iframeLoaded = true;
            }
        }, 12000);
    },

    _stopPolling() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    },

    /**
     * 轮询 iframe 内的 #vstPlayer，出现后切换到原生 video 并隐藏侧边栏/底部栏
     */
    _pollForVideo(iframe, video) {
        let tries = 0;
        const maxTries = 60; // ~10s at 200ms interval

        this._pollTimer = setInterval(() => {
            tries++;
            let el = null;
            try {
                el = iframe.contentDocument?.querySelector('#vstPlayer');
            } catch(e) {}

            if (el) {
                console.log('[TVPlayer] vstPlayer found, switching to native video');
                this._stopPolling();
                clearTimeout(this._timeoutId);

                video.style.display = 'block';
                iframe.style.display = 'none';
                video.src = el.src || '';
                video.muted = true;
                video.play().catch(e => console.warn('[TVPlayer] autoplay blocked:', e));

                document.getElementById('tvBuffering').style.display = 'none';
                this.iframeLoaded = true;

                // Hide sidebar and bottom-bar during playback
                document.body.classList.add('tv-playback-mode');
                return;
            }

            if (tries >= maxTries) {
                console.warn('[TVPlayer] vstPlayer not found after', maxTries, 'tries');
                this._stopPolling();
                clearTimeout(this._timeoutId);
                document.getElementById('tvBuffering').style.display = 'none';
            }
        }, 200);
    },

    _hideSplash() {
        const splash = document.getElementById('tvSplash');
        if (splash && !splash.classList.contains('hidden')) {
            splash.classList.add('hidden');
        }
    },

    stop() {
        this._stopPolling();
        clearTimeout(this._timeoutId);

        document.getElementById('tvPlayingBar').style.display = 'none';
        const iframe = document.getElementById('tvIframe');
        iframe.src = '';
        iframe.style.display = 'block';
        const video = document.getElementById('tvVideo');
        video.style.display = 'none';
        video.src = '';

        document.getElementById('tvPlaceholder').style.display = 'flex';
        document.getElementById('tvBuffering').style.display = 'none';
        this.iframeLoaded = false;

        // Restore sidebar and bottom-bar
        document.body.classList.remove('tv-playback-mode');

        TVChannels.activeChannel = null;
        TVChannels._renderList();
    },

    toggleFullscreen() {
        const section = document.getElementById('tvPlayerSection');
        const btn = document.getElementById('tvFullscreenBtn');
        const sidebar = document.querySelector('.tv-sidebar');
        const isFullscreen = section.classList.toggle('fullscreen');
        btn.classList.toggle('active', isFullscreen);
        sidebar?.classList.toggle('fullscreen-hidden', isFullscreen);
        btn.textContent = isFullscreen ? '⛶ 退出' : '⛶ 全屏';
    },

    exitFullscreen() {
        const section = document.getElementById('tvPlayerSection');
        const btn = document.getElementById('tvFullscreenBtn');
        const sidebar = document.querySelector('.tv-sidebar');
        if (section.classList.contains('fullscreen')) {
            section.classList.remove('fullscreen');
            sidebar?.classList.remove('fullscreen-hidden');
            btn.classList.remove('active');
            btn.textContent = '⛶ 全屏';
        }
    }
};
