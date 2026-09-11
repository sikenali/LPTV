/**
 * DongYuTvWeb Style — Channel Manager
 */
window.DYChannels = {
    allChannels: [],
    groups: {},
    currentGroup: '全部',
    focusedIndex: 0,
    activeIndex: -1,
    favorites: [],

    async init() {
        try {
            const resp = await fetch('/api/channels');
            const data = await resp.json();
            this.allChannels = data;
            this._buildGroups();
            this._renderGrid();
            console.log('[DYChannels] loaded:', data.length, 'channels');
        } catch (e) {
            console.error('[DYChannels] failed:', e);
            document.getElementById('dyLoading').innerHTML =
                '<span style="color:#ff4d4d">频道加载失败，请刷新页面</span>';
        }
    },

    _buildGroups() {
        this.groups = { '全部': [] };
        this.allChannels.forEach((ch, i) => {
            const cat = ch.category || '其他';
            if (!this.groups[cat]) this.groups[cat] = [];
            this.groups[cat].push({ ...ch, idx: i });
            this.groups['全部'].push({ ...ch, idx: i });
        });
        // Add category tabs
        const cats = Object.keys(this.groups).filter(k => k !== '全部');
        const container = document.getElementById('dyCategories');
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'dy-cat-btn';
            btn.dataset.cat = cat;
            btn.textContent = cat;
            btn.onclick = () => this._switchGroup(cat);
            container.appendChild(btn);
        });
    },

    _switchGroup(cat) {
        this.currentGroup = cat;
        this.focusedIndex = 0;
        this.activeIndex = -1;
        // Update tabs
        document.querySelectorAll('.dy-cat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === cat);
        });
        this._renderGrid();
    },

    _renderGrid() {
        const grid = document.getElementById('dyGrid');
        const channels = this.groups[this.currentGroup] || [];
        grid.innerHTML = '';

        if (channels.length === 0) {
            grid.innerHTML = '<div class="dy-loading"><span>暂无频道</span></div>';
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'dy-grid-inner';

        channels.forEach((ch, i) => {
            const card = document.createElement('div');
            card.className = 'dy-chan-card' + (i === this.focusedIndex ? ' focused' : '') + (i === this.activeIndex ? ' active' : '');
            card.dataset.index = i;
            card.dataset.group = this.currentGroup;

            const numEl = document.createElement('div');
            numEl.className = 'dy-chan-num';
            numEl.textContent = ch.idx + 1;

            const logoEl = document.createElement('div');
            logoEl.className = 'dy-chan-logo';
            // Try to get logo from logos directory
            const logoName = this._getLogoName(ch.name);
            logoEl.innerHTML = `<img src="../logos/${logoName}.png" onerror="this.parentElement.textContent='${ch.name.substring(0,2)}'" alt="">`;

            const nameEl = document.createElement('div');
            nameEl.className = 'dy-chan-name';
            nameEl.textContent = ch.name;

            card.appendChild(numEl);
            card.appendChild(logoEl);
            card.appendChild(nameEl);
            card.onclick = () => this._playChannel(ch);
            wrapper.appendChild(card);
        });

        grid.appendChild(wrapper);
    },

    _getLogoName(name) {
        // Convert channel name to logo filename
        return name.replace(/\s+/g, '_');
    },

    _playChannel(ch) {
        this.activeIndex = this.focusedIndex;
        DYPlayer.play(ch);
    },

    navigate(dir) {
        const channels = this.groups[this.currentGroup] || [];
        const cols = this._getCols();
        const rows = Math.ceil(channels.length / cols);

        let row = Math.floor(this.focusedIndex / cols);
        let col = this.focusedIndex % cols;

        if (dir === 'up') row = Math.max(0, row - 1);
        else if (dir === 'down') row = Math.min(rows - 1, row + 1);
        else if (dir === 'left') col = Math.max(0, col - 1);
        else if (dir === 'right') col = Math.min(cols - 1, col + 1);

        this.focusedIndex = row * cols + col;
        this._updateFocus();
    },

    _getCols() {
        const grid = document.querySelector('.dy-grid-inner');
        if (!grid) return 5;
        const style = getComputedStyle(grid);
        const w = grid.clientWidth;
        const minW = window.innerWidth < 768 ? 80 : 100;
        return Math.max(3, Math.min(8, Math.floor(w / minW)));
    },

    _updateFocus() {
        document.querySelectorAll('.dy-chan-card').forEach((card, i) => {
            card.classList.toggle('focused', i === this.focusedIndex);
        });
        // Scroll into view
        const focused = document.querySelector('.dy-chan-card.focused');
        if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    numberInput(num) {
        // Direct channel number input
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < this.allChannels.length) {
            this.focusedIndex = idx;
            this._updateFocus();
            setTimeout(() => this._playChannel(this.allChannels[idx]), 300);
        }
    },
};
