/**
 * LPTV — Channel Data Manager
 * 基于 main 分支 iptvChannels.ts 结构
 */
window.TVChannels = {
    cctv: [],
    ws: [],
    all: [],
    currentGroup: 'cctv',
    focusedIndex: 0,
    activeChannel: null,
    favorites: [],

    logoMap: {
        'CCTV1 综合': 'CCTV1',
        'CCTV2 财经': 'CCTV2',
        'CCTV3 综艺': 'CCTV3',
        'CCTV4 中文国际': 'CCTV4',
        'CCTV5 体育': 'CCTV5',
        'CCTV5+ 体育赛事': 'CCTV5+',
        'CCTV6 电影': 'CCTV6',
        'CCTV7 国防军事': 'CCTV7',
        'CCTV8 电视剧': 'CCTV8',
        'CCTV9 纪录': 'CCTV9',
        'CCTV10 科教': 'CCTV10',
        'CCTV11 戏曲': 'CCTV11',
        'CCTV12 社会与法': 'CCTV12',
        'CCTV13 新闻': 'CCTV13',
        'CCTV14 少儿': 'CCTV14',
        'CCTV15 音乐': 'CCTV15',
        'CCTV16 奥林匹克': 'CCTV16',
        'CCTV17 农业农村': 'CCTV17',
        '湖南卫视': '湖南卫视',
        '江苏卫视': '江苏卫视',
        '浙江卫视': '浙江卫视',
        '东方卫视': '东方卫视',
        '北京卫视': '北京卫视',
        '深圳卫视': '深圳卫视',
        '广东卫视': '广东卫视',
        '安徽卫视': '安徽卫视',
        '东南卫视': '东南卫视',
        '河北卫视': '河北卫视',
        '黑龙江卫视': '黑龙江卫视',
        '湖北卫视': '湖北卫视',
        '江西卫视': '江西卫视',
        '辽宁卫视': '辽宁卫视',
        '海南卫视': '海南卫视',
        '山东卫视': '山东卫视',
        '四川卫视': '四川卫视',
        '天津卫视': '天津卫视',
        '重庆卫视': '重庆卫视',
        '贵州卫视': '贵州卫视',
        '吉林卫视': '吉林卫视',
        '广西卫视': '广西卫视',
        '河南卫视': '河南卫视',
        '甘肃卫视': '甘肃卫视',
        '青海卫视': '青海卫视',
        '云南卫视': '云南卫视',
        '内蒙古卫视': '内蒙古卫视',
        '山西卫视': '山西卫视',
        '陕西卫视': '陕西卫视',
        '兵团卫视': '兵团卫视',
        '新疆卫视': '新疆卫视',
        '西藏卫视': '西藏卫视',
        '宁夏卫视': '宁夏卫视',
        '延边卫视': '延边卫视',
        '康巴卫视': '康巴卫视',
        '大湾区卫视': '大湾区卫视',
        '广东珠江频道': '广东珠江',
        '厦门卫视': '厦门卫视',
        '安多卫视': '安多卫视',
        '农林卫视': '农林卫视',
        '三沙卫视': '三沙卫视',
    },

    getLogoUrl(name) {
        const key = this.logoMap[name];
        if (key) return `/lptv/logos/${key}.png`;
        return '';
    },

    async init() {
        // Load favorites
        try {
            const saved = localStorage.getItem('lptv_favs');
            if (saved) this.favorites = JSON.parse(saved);
        } catch(e) {}

        // Fetch channels from API
        try {
            const resp = await fetch('/api/channels');
            const data = await resp.json();

            // Map API channels to internal structure
            this.cctv = data.filter(ch => ch.category === '央视').map((ch, i) => ({
                id: ch.id,
                name: ch.name,
                category: ch.category,
                currentProgram: '',
                tid: 'ys',
                idx: ch.idx || i,
                streams: ch.streams || []
            }));

            this.ws = data.filter(ch => ch.category === '卫视').map((ch, i) => ({
                id: ch.id,
                name: ch.name,
                category: ch.category,
                currentProgram: '',
                tid: 'ws',
                idx: ch.idx || i,
                streams: ch.streams || []
            }));

            this.all = [...this.cctv, ...this.ws];

            // Update counts
            document.getElementById('cctvCount').textContent = this.cctv.length;
            document.getElementById('wsCount').textContent = this.ws.length;

            this._renderList();
            console.log('[TVChannels] loaded:', this.all.length, 'channels');
        } catch (e) {
            console.error('[TVChannels] failed:', e);
            document.getElementById('tvLoading').innerHTML =
                '<span style="color:#c43d3d">频道加载失败</span>';
        }
    },

    _renderList() {
        const list = document.getElementById('tvChannelsList');
        const channels = this[this.currentGroup] || [];
        list.innerHTML = '';

        channels.forEach((ch, i) => {
            const card = document.createElement('div');
            card.className = 'tv-chan-card' +
                (i === this.focusedIndex ? ' focused' : '') +
                (this.activeChannel?.id === ch.id && this.activeChannel?.tid === ch.tid ? ' active' : '');
            card.dataset.index = i;
            card.dataset.group = this.currentGroup;

            card.innerHTML = `
                <img class="tv-chan-logo" src="${TVChannels.getLogoUrl(ch.name)}" alt=""
                      onerror="this.style.display='none'" />
                <div class="tv-chan-name">${ch.name}</div>
            `;

            card.onclick = () => this._playChannel(ch);
            list.appendChild(card);
        });
    },

    _playChannel(ch) {
        this.activeChannel = ch;
        TVPlayer.play(ch);
        this._renderList();
        // Save last channel
        localStorage.setItem('lptv-last-channel', `${ch.tid}-${ch.id}`);
    },

    navigate(dir) {
        const channels = this[this.currentGroup] || [];
        if (channels.length === 0) return;

        if (dir === 'up') {
            this.focusedIndex = (this.focusedIndex - 1 + channels.length) % channels.length;
        } else if (dir === 'down') {
            this.focusedIndex = (this.focusedIndex + 1) % channels.length;
        }

        this._updateFocus();
    },

    _updateFocus() {
        document.querySelectorAll('.tv-chan-card').forEach((card, i) => {
            card.classList.toggle('focused', i === this.focusedIndex);
        });
        // Scroll into view
        const focused = document.querySelector('.tv-chan-card.focused');
        if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    numberInput(num) {
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < this.all.length) {
            const ch = this.all[idx];
            this.currentGroup = ch.tid === 'ys' ? 'cctv' : 'ws';
            this.focusedIndex = this[this.currentGroup].indexOf(ch);
            this._renderList();
            this._updateFocus();
            this._playChannel(ch);
        }
    },

    switchGroup(group) {
        this.currentGroup = group;
        this.focusedIndex = 0;
        document.querySelectorAll('.tv-cat-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === group);
        });
        this._renderList();
    },

    toggleFavorite(ch) {
        const key = `${ch.tid}-${ch.id}`;
        const pos = this.favorites.indexOf(key);
        if (pos >= 0) {
            this.favorites.splice(pos, 1);
        } else {
            this.favorites.push(key);
        }
        localStorage.setItem('lptv_favs', JSON.stringify(this.favorites));
        // Update button
        const btn = document.getElementById('tvFavBtn');
        const isFaved = this.favorites.includes(key);
        btn.textContent = isFaved ? '★ 已收藏' : '☆ 收藏';
        btn.classList.toggle('faved', isFaved);
    }
};
