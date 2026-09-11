/**
 * TV Player — CEF OSR 帧播放模式
 *
 * 通过 WebSocket 接收 CEF IPC 服务命令，加载 345iptv play 页面。
 * CSS 注入隐藏广告/导航，只保留 <video> 播放器。
 * 备用源：789iptv（同 token，仅替换域名）。
 *
 * 远程访问降级：CEF 不可用时自动切换 iframe 模式，直接嵌入直播页面。
 */
window.TVPlayer = {
    infoTimer: null,
    ws: null,
    wsUrl: null,
    reconnectTimer: null,
    currentChannel: null,
    canvasEl: null,
    ctx: null,
    isPlaying: false,
    isLoading: false,
    lastFrameData: null,   // "data:image/png;base64,..."
    lastFrameW: 0,
    lastFrameH: 0,
    imgEl: null,           // offscreen <img> for fast drawImage
    _iframeMode: false,    // true = remote, using iframe fallback
    _iframeEl: null,

    init() {
        this._pendingChannel = null;
        this._lastImg = null;
        this.canvasEl = document.getElementById('tvCanvas');
        if (this.canvasEl) {
            this.ctx = this.canvasEl.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
        }
        this.connectWs();
    },

    resizeCanvas() {
        if (!this.canvasEl) return;
        const area = document.getElementById('playerArea');
        if (area) {
            this.canvasEl.width = area.clientWidth;
            this.canvasEl.height = area.clientHeight;
        }
    },

    connectWs() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.wsUrl = `${proto}//${location.host}/lptv-ws`;

        console.log('[player] connecting to:', this.wsUrl);

        try {
            this.ws = new WebSocket(this.wsUrl);
        } catch (e) {
            console.warn('[player] WebSocket not supported, using iframe fallback');
            this._enterIframeMode();
            return;
        }

        this._wsRetryCount = 0;
        this.ws.onopen = () => {
            console.log('[player] WebSocket connected, readyState:', this.ws.readyState);
            if (this._pendingChannel) {
                const ch = this._pendingChannel;
                this._pendingChannel = null;
                this._sendPlayCommand(ch);
            }
            this.scheduleReconnect(0);
        };

        this.ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                this.onWsMessage(msg);
            } catch (e) {
                console.warn('[player] bad ws message:', ev.data);
            }
        };

        this.ws.onclose = (ev) => {
            console.log('[player] WebSocket closed, code:', ev.code, 'reconnecting...');
            this.scheduleReconnect(5000);
        };

        this.ws.onerror = (err) => {
            console.warn('[player] WebSocket error:', err.type || err);
            if (!this._wsFatal) {
                this._wsFatal = true;
                const host = location.hostname;
                const isLocal = host === 'localhost' || host === '127.0.0.1' ||
                                host.startsWith('192.168.') || host.startsWith('10.');
                if (!isLocal) {
                    console.log('[player] remote access detected, entering iframe mode');
                    this._enterIframeMode();
                } else {
                    this.onError('CEF 服务未连接，请确保后端服务已启动');
                }
            }
        };
    },

    scheduleReconnect(delay) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWs(), delay);
    },

    /**
     * 进入 iframe 播放模式（远程访问降级）
     */
    _enterIframeMode() {
        if (this._iframeMode) return;
        this._iframeMode = true;
        document.body.classList.add('tv-iframe-mode');

        // Hide canvas, show iframe container
        if (this.canvasEl) this.canvasEl.style.display = 'none';
        const area = document.getElementById('playerArea');
        if (!area) return;

        // Remove existing iframe if any
        if (this._iframeEl) {
            this._iframeEl.remove();
            this._iframeEl = null;
        }

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#000;';
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
        area.appendChild(iframe);
        this._iframeEl = iframe;

        console.log('[player] iframe mode activated');
        this.hideHero();
    },

    /**
     * 退出 iframe 模式，恢复 canvas
     */
    _exitIframeMode() {
        if (!this._iframeMode) return;
        this._iframeMode = false;
        document.body.classList.remove('tv-iframe-mode');
        if (this._iframeEl) {
            this._iframeEl.remove();
            this._iframeEl = null;
        }
        if (this.canvasEl) this.canvasEl.style.display = '';
    },

    /**
     * 绘制帧到 canvas：每帧创建独立 Image，避免 onload 覆盖
     */
    drawFrame(data, w, h) {
        if (!this.canvasEl || !this.ctx || !data) return;
        this.lastFrameData = data;
        this.lastFrameW = w || 0;
        this.lastFrameH = h || 0;

        if (this.canvasEl.width === 0 || this.canvasEl.height === 0) {
            this.resizeCanvas();
            if (this.canvasEl.width === 0 || this.canvasEl.height === 0) return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (this._lastImg !== img) return;
            this._lastImg = null;
            const c = this.canvasEl;
            const cw = c.width, ch = c.height;
            const ctx = this.ctx;
            ctx.clearRect(0, 0, cw, ch);
            const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
            const dw = img.naturalWidth * scale;
            const dh = img.naturalHeight * scale;
            const dx = (cw - dw) / 2;
            const dy = (ch - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.hideHero();
            }
        };
        img.onerror = () => {
            this._lastImg = null;
            console.error('[player] frame decode error');
        };
        this._lastImg = img;
        img.src = data;
    },

    onWsMessage(msg) {
        switch (msg.type) {
            case 'status':
                this.updateChannelInfoFromStatus(msg);
                break;
            case 'error':
                this.onError(msg.msg || msg.code || '播放失败');
                this.switchSource();
                break;
            case 'frame':
                if (msg.data) {
                    this.drawFrame(msg.data, msg.w, msg.h);
                } else if (msg.seq !== undefined) {
                    if (this.lastFrameData) {
                        this.drawFrame(this.lastFrameData, this.lastFrameW, this.lastFrameH);
                    }
                    if (!this.isPlaying) {
                        this.isPlaying = true;
                        this.hideHero();
                    }
                }
                break;
        }
    },

    updateChannelInfoFromStatus(msg) {
        const nameEl = document.getElementById('tvChannelName');
        const lineEl = document.getElementById('tvChannelLine');
        const infoEl = document.getElementById('tvChannelInfo');
        if (!nameEl) return;

        if (msg.channel) nameEl.textContent = msg.channel;
        if (lineEl) lineEl.textContent = this._iframeMode ? 'iframe 直链播放' : '345iptv CEF';
        if (infoEl) {
            infoEl.classList.remove('hidden');
            clearTimeout(this.infoTimer);
            this.infoTimer = setTimeout(() => infoEl.classList.add('hidden'), 3000);
        }
    },

    /**
     * 选择一个频道 → 通过 WebSocket 通知 CEF 服务加载对应 URL
     * 若处于 iframe 模式，则直接导航 iframe
     */
    async loadChannel(channel) {
        if (!channel) {
            this.onError('请选择频道');
            return;
        }

        this.currentChannel = channel;
        this.updateChannelInfo(channel);
        this.hideError();
        this.isPlaying = false;
        this.isLoading = true;

        if (this._iframeMode) {
            this._loadChannelIframe(channel);
            return;
        }

        // Show buffering indicator
        let bufEl = document.getElementById('tvBuffering');
        if (!bufEl) {
            bufEl = document.createElement('div');
            bufEl.id = 'tvBuffering';
            bufEl.className = 'tv-buffering';
            bufEl.innerHTML = '<div class="tv-spinner"></div>';
            document.getElementById('playerArea')?.appendChild(bufEl);
        }
        bufEl.style.display = 'flex';

        // Send play command (queue if WS not ready)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._sendPlayCommand(channel);
        } else {
            this._pendingChannel = channel;
            console.warn('[player] WS not ready, queued channel:', channel.name);
        }
    },

    /**
     * iframe 模式：导航 iframe 到频道播放页
     */
    _loadChannelIframe(channel) {
        if (!this._iframeEl) this._enterIframeMode();
        if (!this._iframeEl) return;

        this.hideHero();
        const buf = document.getElementById('tvBuffering');
        if (buf) buf.style.display = 'flex';

        console.log('[player] iframe loading:', channel.url);
        this._iframeEl.src = channel.url;
        this._iframeEl.onload = () => {
            if (buf) buf.style.display = 'none';
            this.isPlaying = true;
            this.isLoading = false;
        };
    },

    _sendPlayCommand(channel) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this._pendingChannel = channel;
            this.onError('CEF 服务未连接，请确保后端服务已启动');
            return;
        }
        this.ws.send(JSON.stringify({
            type: 'play',
            url: channel.url,
            name: channel.name,
        }));
    },

    updateChannelInfo(channel) {
        const nameEl = document.getElementById('tvChannelName');
        const lineEl = document.getElementById('tvChannelLine');
        const infoEl = document.getElementById('tvChannelInfo');
        if (nameEl) nameEl.textContent = channel.name || '';
        const lineText = this._iframeMode
            ? (channel.source === '789' ? '789iptv（备用）' : 'iframe 直链播放')
            : (channel.source === '789' ? '789iptv（备用）' : '345iptv');
        if (lineEl) lineEl.textContent = lineText;
        if (infoEl) {
            infoEl.classList.remove('hidden');
            clearTimeout(this.infoTimer);
            this.infoTimer = setTimeout(() => infoEl.classList.add('hidden'), 4000);
        }
    },

    onError(msg) {
        // Don't show error overlay in iframe mode — it's handled gracefully
        if (this._iframeMode) return;
        const text = document.getElementById('tvErrorText');
        const box = document.getElementById('tvError');
        if (text) text.textContent = msg;
        if (box) box.style.display = 'flex';
        const buf = document.getElementById('tvBuffering');
        if (buf) buf.style.display = 'none';
        this.isLoading = false;
    },

    /** 播放出错时自动切换到备用源 */
    switchSource() {
        const ch = this.currentChannel;
        if (!ch || !ch.backupUrl) {
            this.onError('无备用源');
            return;
        }
        console.log('[player] switching to backup:', ch.backupUrl);
        this.currentChannel = { ...ch, url: ch.backupUrl, source: ch.source };
        this.updateChannelInfo(this.currentChannel);
        this.hideError();
        this.isPlaying = false;
        this.isLoading = true;

        if (this._iframeMode) {
            this._loadChannelIframe(this.currentChannel);
            return;
        }

        let bufEl = document.getElementById('tvBuffering');
        if (!bufEl) {
            bufEl = document.createElement('div');
            bufEl.id = 'tvBuffering';
            bufEl.className = 'tv-buffering';
            bufEl.innerHTML = '<div class="tv-spinner"></div>';
            document.getElementById('playerArea')?.appendChild(bufEl);
        }
        bufEl.style.display = 'flex';

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'play',
                url: ch.backupUrl,
                name: ch.name + '（备用）',
            }));
        }
    },

    hideError() {
        const box = document.getElementById('tvError');
        if (box) box.style.display = 'none';
    },

    hideHero() {
        const hero = document.getElementById('tvHero');
        if (hero) hero.style.display = 'none';
        const buf = document.getElementById('tvBuffering');
        if (buf) buf.style.display = 'none';
        this.isLoading = false;
    },

    async switchBackup() {
        if (!this.currentChannel?.backupUrl) {
            this.onError('无备用源');
            return;
        }
        if (this._iframeMode) {
            this.currentChannel = { ...this.currentChannel, url: this.currentChannel.backupUrl };
            this._loadChannelIframe(this.currentChannel);
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'play',
                url: this.currentChannel.backupUrl,
                name: this.currentChannel.name + '（备用）',
            }));
        }
    },
};
