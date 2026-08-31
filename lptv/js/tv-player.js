/**
 * TV Player — 导航式播放
 * 播放不再使用 hls.js 拉流(央视/央视频均有防盗链/跨域限制, 无法代理),
 * 而是「整页导航」到 央视官网直播页 或 央视频播放页, 由官网自带播放器播放。
 * 与 utao 的实现原理一致。
 */
window.TVPlayer = {
    infoTimer: null,

    init() {
        // 无内页视频, 仅保留频道信息层逻辑
    },

    /**
     * 选择一个频道 → 整页导航到官网/央视频播放页。
     * channel 来自 /api/channels, 含 { url, source }
     */
    loadChannel(channel) {
        if (!channel || !channel.url) {
            this.onError('该频道暂无可用播放地址');
            return;
        }
        this.updateChannelInfo(channel);
        // 导航到官网直播页(WebView 会跳走, 官网自带播放器播放)
        window.location.href = channel.url;
    },

    updateChannelInfo(channel) {
        const name = document.getElementById('tvChannelName');
        const line = document.getElementById('tvChannelLine');
        if (name) name.textContent = channel.name || '';
        if (line) line.textContent = channel.source === 'ysp' ? '央视频播放' : '央视官网播放';
        const info = document.getElementById('tvChannelInfo');
        if (info) {
            info.classList.remove('hidden');
            clearTimeout(this.infoTimer);
            this.infoTimer = setTimeout(() => info.classList.add('hidden'), 4000);
        }
    },

    onError(msg) {
        const text = document.getElementById('tvErrorText');
        const box = document.getElementById('tvError');
        if (text) text.textContent = msg;
        if (box) box.style.display = 'flex';
    },
};
