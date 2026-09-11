/**
 * DongYuTvWeb Style — Player Manager
 */
window.DYPlayer = {
    currentChannel: null,
    ws: null,
    wsUrl: null,
    reconnectTimer: null,

    play(channel) {
        this.currentChannel = channel;
        const overlay = document.getElementById('dyPlayerOverlay');
        overlay.classList.add('visible');

        // Update header
        document.getElementById('dyPlayingInfo').textContent = `正在播放: ${channel.name}`;
        document.getElementById('dyChName').textContent = channel.name;
        document.getElementById('dyChCat').textContent = channel.category;

        // Update fav button
        const isFaved = DYChannels.favorites.includes(channel.idx);
        document.getElementById('dyFavBtn').textContent = isFaved ? '★ 已收藏' : '☆ 收藏';
        document.getElementById('dyFavBtn').classList.toggle('faved', isFaved);

        // Show buffering
        document.getElementById('dyBuffering').style.display = 'flex';

        // Setup backup channels
        this._setupBackup(channel);

        // Try WebSocket CEF connection first
        this._connectWS();
    },

    _connectWS() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.wsUrl = `${proto}//${location.host}/lptv-ws`;

        try {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => {
                console.log('[DYPlayer] WS connected');
                this._sendPlayCmd();
            };
            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'state') {
                        document.getElementById('dyBuffering').style.display = 'none';
                    }
                } catch(err) {}
            };
            this.ws.onclose = () => {
                console.log('[DYPlayer] WS closed, fallback to iframe');
                this.ws = null;
                this._loadIframe();
            };
            this.ws.onerror = () => {
                console.log('[DYPlayer] WS error, fallback to iframe');
                this.ws = null;
                this._loadIframe();
            };
        } catch (e) {
            console.log('[DYPlayer] WebSocket not supported, using iframe');
            this._loadIframe();
        }
    },

    _sendPlayCmd() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const url = this.currentChannel.streams?.[0] || '';
        this.ws.send(JSON.stringify({ type: 'play', url: url }));
        console.log('[DYPlayer] sent play:', url);
    },

    _loadIframe() {
        const iframe = document.getElementById('dyIframe');
        const url = this.currentChannel.streams?.[0] || '';
        iframe.src = url;
        iframe.onload = () => {
            document.getElementById('dyBuffering').style.display = 'none';
        };
        iframe.onerror = () => {
            document.getElementById('dyBuffering').style.display = 'none';
        };
        // Timeout fallback
        setTimeout(() => {
            document.getElementById('dyBuffering').style.display = 'none';
        }, 5000);
    },

    _setupBackup(channel) {
        const bars = document.getElementById('dyBackupBar');
        const list = document.getElementById('dyBackupList');
        list.innerHTML = '';

        if (!channel.streams || channel.streams.length <= 1) {
            bars.style.display = 'none';
            return;
        }

        bars.style.display = 'flex';
        channel.streams.forEach((url, i) => {
            if (i === 0) return; // Skip primary
            const btn = document.createElement('button');
            btn.className = 'dy-backup-btn';
            btn.textContent = `线路${i + 1}`;
            btn.onclick = () => this._switchBackup(url);
            list.appendChild(btn);
        });
    },

    _switchBackup(url) {
        console.log('[DYPlayer] switching to backup:', url);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'play', url: url }));
        } else {
            document.getElementById('dyIframe').src = url;
        }
    },

    stop() {
        document.getElementById('dyPlayerOverlay').classList.remove('visible');
        document.getElementById('dyIframe').src = '';
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.currentChannel = null;
    },

    toggleFavorite() {
        if (!this.currentChannel) return;
        const idx = this.currentChannel.idx;
        const pos = DYChannels.favorites.indexOf(idx);
        const btn = document.getElementById('dyFavBtn');
        if (pos >= 0) {
            DYChannels.favorites.splice(pos, 1);
            btn.textContent = '☆ 收藏';
            btn.classList.remove('faved');
        } else {
            DYChannels.favorites.push(idx);
            btn.textContent = '★ 已收藏';
            btn.classList.add('faved');
        }
        // Persist
        try { localStorage.setItem('lptv_favs', JSON.stringify(DYChannels.favorites)); } catch(e) {}
    },
};
