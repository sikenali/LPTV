/**
 * TV Player — CEF OSR 帧播放模式
 * 
 * 通过 WebSocket 接收 CEF OSR 渲染帧，显示在 <img> 中。
 * 选台命令通过 HTTP POST 发送到 node-ipc 服务。
 * 
 * 回退：如果 WebSocket 不可用，降级到整页导航模式。
 */
window.TVPlayer = {
    infoTimer: null,
    ws: null,
    wsUrl: null,
    reconnectTimer: null,
    currentChannel: null,
    imgEl: null,
    canvasEl: null,
    ctx: null,

    init() {
        this.imgEl = document.getElementById('tvScreen');
        this.canvasEl = document.getElementById('tvCanvas');
        if (this.canvasEl) {
            this.ctx = this.canvasEl.getContext('2d');
        }
        this.connectWs();
    },

    /**
     * 连接 WebSocket（CEF IPC 服务）
     */
    connectWs() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Try local IPC first, then fall back to remote
        this.wsUrl = `${protocol}//${location.host}/lptv-ws`;

        try {
            this.ws = new WebSocket(this.wsUrl);
        } catch (e) {
            console.warn('[player] WebSocket not supported, using fallback navigation');
            return;
        }

        this.ws.onopen = () => {
            console.log('[player] WebSocket connected');
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

        this.ws.onclose = () => {
            console.log('[player] WebSocket closed, reconnecting...');
            this.scheduleReconnect(5000);
        };

        this.ws.onerror = (err) => {
            console.warn('[player] WebSocket error:', err);
        };
    },

    scheduleReconnect(delay) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectWs(), delay);
    },

    onWsMessage(msg) {
        switch (msg.type) {
            case 'frame':
                // Frame metadata event (CEF outputs frame_paint events)
                // In full mode, frames would be base64 PNG data
                // For now, just log
                if (msg.w && msg.h) {
                    console.log(`[player] frame ${msg.seq}: ${msg.w}x${msg.h}`);
                }
                break;

            case 'status':
                this.updateChannelInfoFromStatus(msg);
                break;

            case 'error':
                console.error('[player] cef error:', msg.code, msg.msg);
                this.onError(msg.msg || msg.code || '播放失败');
                break;

            case 'pong':
                // heartbeat
                break;
        }
    },

    updateChannelInfoFromStatus(msg) {
        const nameEl = document.getElementById('tvChannelName');
        const lineEl = document.getElementById('tvChannelLine');
        const infoEl = document.getElementById('tvChannelInfo');
        if (!nameEl) return;

        if (msg.channel) nameEl.textContent = msg.channel;
        if (msg.state) {
            if (lineEl) lineEl.textContent = msg.state === 'playing' ? 'CEF OSR 播放中' : '加载中...';
            if (infoEl) {
                infoEl.classList.remove('hidden');
                clearTimeout(this.infoTimer);
                this.infoTimer = setTimeout(() => infoEl.classList.add('hidden'), 3000);
            }
        }
    },

    /**
     * 选择一个频道 → 通过 WebSocket/HTTP 通知 CEF 服务
     */
    async loadChannel(channel) {
        if (!channel) {
            this.onError('请选择频道');
            return;
        }

        this.currentChannel = channel;
        this.updateChannelInfo(channel);

        // Try WebSocket command first
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'play',
                channel_id: channel.id,
                source: 0,
                name: channel.name,
            }));
            return;
        }

        // Fallback: HTTP API
        try {
            const resp = await fetch('/lptv-api/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_id: channel.id, source: 0 }),
            });
            if (!resp.ok) throw new Error('play failed');
        } catch (e) {
            // Last resort: legacy navigation
            console.warn('[player] IPC unavailable, falling back to navigation');
            this.fallbackNavigate(channel);
        }
    },

    /**
     * _legacy 整页导航回退_
     */
    fallbackNavigate(channel) {
        if (channel.url) {
            window.location.href = channel.url;
        } else {
            this.onError('该频道暂无可用播放地址');
        }
    },

    updateChannelInfo(channel) {
        const nameEl = document.getElementById('tvChannelName');
        const lineEl = document.getElementById('tvChannelLine');
        const infoEl = document.getElementById('tvChannelInfo');
        if (nameEl) nameEl.textContent = channel.name || '';
        if (lineEl) lineEl.textContent = 'CEF OSR · ' + (channel.source === 'ysp' ? '央视频' : '央视官网');
        if (infoEl) {
            infoEl.classList.remove('hidden');
            clearTimeout(this.infoTimer);
            this.infoTimer = setTimeout(() => infoEl.classList.add('hidden'), 4000);
        }
    },

    onError(msg) {
        const text = document.getElementById('tvErrorText');
        const box = document.getElementById('tvError');
        if (text) text.textContent = msg;
        if (box) box.style.display = 'flex';
    },

    /**
     * 切换线路（下一源）
     */
    async switchLine() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'switch' }));
        } else {
            try {
                await fetch('/lptv-api/switch', { method: 'POST' });
            } catch (_) {}
        }
    },

    /**
     * 停止播放
     */
    async stop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'stop' }));
        } else {
            try { await fetch('/lptv-api/stop', { method: 'POST' }); } catch (_) {}
        }
    },
};
