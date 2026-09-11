/**
 * TV Channel Data
 * Loaded from API, structured for remote control navigation
 */
window.TVChannels = {
    groups: {},
    allChannels: [],
    currentGroup: '',
    currentIndex: 0,
    selectedId: null,
    isEmbedded: false,
    _panelMode: 'channels', // 'channels' | 'favorites' | 'settings'

    async init() {
        const params = new URLSearchParams(location.search);
        this.isEmbedded = params.has('id') || params.has('embed');

        if (this.isEmbedded) {
            document.body.classList.add('tv-embedded');
        }

        try {
            const resp = await fetch('/api/channels');
            const channels = await resp.json();
            this.allChannels = channels;
            console.log('[channels] loaded:', channels.length, 'channels');

            // Group by category
            this.groups = {};
            channels.forEach(ch => {
                if (!this.groups[ch.category]) this.groups[ch.category] = [];
                this.groups[ch.category].push(ch);
            });

            this.currentGroup = Object.keys(this.groups)[0] || '';
            this.renderCategories();
            this.renderChannelList();

            // Auto-select channel from URL ?id= param
            const selectedId = params.get('id');
            if (selectedId) {
                setTimeout(() => this.autoSelectById(selectedId), 100);
            }
        } catch (e) {
            console.error('[channels] Failed to load:', e);
            document.getElementById('tvErrorText') && (document.getElementById('tvErrorText').textContent = '频道加载失败: ' + e.message);
            document.getElementById('tvError') && (document.getElementById('tvError').style.display = 'flex');
        }
    },

    autoSelectById(id) {
        console.log('[channels] autoSelectById:', id, 'groups:', Object.keys(this.groups));
        for (const [gKey, group] of Object.entries(this.groups)) {
            const idx = group.findIndex(ch => ch.id === id);
            if (idx !== -1) {
                console.log('[channels] found in group:', gKey, 'index:', idx);
                this.currentGroup = gKey;
                this.currentIndex = idx;
                this.renderCategories();
                this.renderChannelList();
                TVPlayer.loadChannel(group[idx]);
                return;
            }
        }
        console.warn('[channels] selected id not found:', id, 'all ids:', this.allChannels.map(c => c.id).slice(0, 5));
    },

    renderCategories() {
        const container = document.getElementById('categoryTabs');
        if (!container) return;

        if (this.isEmbedded) {
            const groupButtons = Object.keys(this.groups).map(cat => `
                <button class="tv-cat-tab ${cat === this.currentGroup ? 'active' : ''}"
                        onclick="TVChannels.switchGroup('${cat}')">${cat}</button>
            `).join('');
            container.innerHTML = `
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    ${groupButtons}
                    <span style="flex:1;"></span>
                    <button class="tv-cat-tab" onclick="TVChannels.openPanel('favorites')" title="收藏">❤ 收藏</button>
                    <button class="tv-cat-tab" onclick="TVChannels.openPanel('settings')" title="设置">⚙ 设置</button>
                </div>
            `;
        } else {
            container.innerHTML = Object.keys(this.groups).map(cat => `
                <button class="tv-cat-tab ${cat === this.currentGroup ? 'active' : ''}"
                        onclick="TVChannels.switchGroup('${cat}')">${cat}</button>
            `).join('');
        }
    },

    renderChannelList() {
        const container = document.getElementById('channelList');
        if (!container) return;
        const channels = this.groups[this.currentGroup] || [];
        container.innerHTML = channels.map((ch, i) => `
            <div class="tv-channel-item ${i === this.currentIndex ? 'active' : ''}"
                  data-index="${i}" data-id="${ch.id}"
                  onclick="TVChannels.select(${i})" tabindex="0">
                <img class="tv-ch-logo" src="${ch.logo || '/api/proxy/logo/' + encodeURIComponent(ch.name)}" alt=""
                      onerror="this.style.display='none'" />
                <div class="tv-ch-icon">${ch.name.charAt(0)}</div>
                <div class="tv-ch-info">
                    <div class="tv-ch-name">${ch.name}</div>
                </div>
            </div>
        `).join('');
        this.updateCounter();
    },

    switchGroup(group) {
        this.currentGroup = group;
        this.currentIndex = 0;
        this.selectedId = null;
        this.renderCategories();
        this.renderChannelList();
        const first = document.querySelector('.tv-channel-item');
        if (first) first.focus();

        // In embedded mode: open channel panel for the selected group
        if (this.isEmbedded) {
            this._panelMode = 'channels';
            this.openPanel('channels', group);
        }
    },

    select(index) {
        this.currentIndex = index;
        const channel = this.groups[this.currentGroup][index];
        if (!channel) return;
        this.selectedId = channel.id;
        document.querySelectorAll('.tv-channel-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
        TVPlayer.loadChannel(channel);
    },

    navigate(direction) {
        const channels = this.groups[this.currentGroup] || [];
        if (channels.length === 0) return;

        if (direction === 'down') {
            this.currentIndex = Math.min(this.currentIndex + 1, channels.length - 1);
        } else if (direction === 'up') {
            this.currentIndex = Math.max(this.currentIndex - 1, 0);
        } else if (direction === 'ok') {
            this.select(this.currentIndex);
            return;
        }

        // Scroll into view
        const items = document.querySelectorAll('.tv-channel-item');
        const el = items[this.currentIndex];
        if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            el.classList.add('focused');
            setTimeout(() => el.classList.remove('focused'), 300);
            document.querySelectorAll('.tv-channel-item').forEach((item, i) => {
                item.classList.toggle('active', i === this.currentIndex);
            });
        }
        this.selectedId = channels[this.currentIndex]?.id || null;
        this.updateCounter();
    },

    updateCounter() {
        const group = this.groups[this.currentGroup] || [];
        const el = document.getElementById('tvChannelCounter');
        if (el) el.textContent = `${this.currentGroup} · ${group.length}个频道`;
    },

    // ── Panel (embedded mode) ────────────────────────────────────────────

    openPanel(mode, group) {
        this._panelMode = mode || 'channels';
        const overlay = document.getElementById('panelOverlay');
        const panel = document.getElementById('channelPanel');
        const title = document.getElementById('panelTitle');
        const content = document.getElementById('panelContent');

        if (mode === 'channels') {
            const g = group || this.currentGroup;
            title.textContent = g || '频道列表';
            content.innerHTML = this._renderGroupChannels(g);
        } else if (mode === 'favorites') {
            title.textContent = '我的收藏';
            content.innerHTML = this._renderFavoritesPanel();
        } else if (mode === 'settings') {
            title.textContent = '设置';
            content.innerHTML = this._renderSettingsPanel();
        }

        overlay?.classList.add('open');
        panel?.classList.add('open');
    },

    closePanel() {
        document.getElementById('panelOverlay')?.classList.remove('open');
        document.getElementById('channelPanel')?.classList.remove('open');
    },

    _renderGroupChannels(groupName) {
        const channels = this.groups[groupName] || [];
        if (channels.length === 0) {
            return '<div class="tv-panel-empty"><div class="tv-panel-empty-icon">📺</div><div>暂无频道</div></div>';
        }
        const activeId = this.selectedId;
        return channels.map((ch, i) => `
            <div class="tv-channel-item ${ch.id === activeId ? 'active' : ''}"
                  onclick="TVChannels.playFromPanel('${ch.id}')" tabindex="0">
                <img class="tv-ch-logo" src="${ch.logo || '/api/proxy/logo/' + encodeURIComponent(ch.name)}" alt=""
                      onerror="this.style.display='none'" />
                <div class="tv-ch-icon">${ch.name.charAt(0)}</div>
                <div class="tv-ch-info">
                    <div class="tv-ch-name">${ch.name}</div>
                </div>
            </div>
        `).join('');
    },

    playFromPanel(channelId) {
        for (const group of Object.values(this.groups)) {
            const ch = group.find(c => c.id === channelId);
            if (ch) {
                this.select(group.indexOf(ch));
                this.closePanel();
                return;
            }
        }
    },

    _renderFavoritesPanel() {
        const favIds = JSON.parse(localStorage.getItem('tv_favorites') || '[]');
        const favChannels = this.allChannels.filter(ch => favIds.includes(ch.id));

        if (favChannels.length === 0) {
            return `
                <div class="tv-panel-empty">
                    <div class="tv-panel-empty-icon">❤</div>
                    <div>还没有收藏频道<br><span style="font-size:11px;opacity:0.6">在频道列表点击 ❤ 添加收藏</span></div>
                </div>`;
        }

        const grouped = {};
        favChannels.forEach(ch => {
            if (!grouped[ch.category]) grouped[ch.category] = [];
            grouped[ch.category].push(ch);
        });

        let html = '';
        for (const [cat, chs] of Object.entries(grouped)) {
            html += `<div style="padding:8px 8px 4px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">${cat}</div>`;
            html += chs.map(ch => `
                <div class="tv-channel-item ${ch.id === this.selectedId ? 'active' : ''}"
                      onclick="TVChannels.playFromPanel('${ch.id}')" tabindex="0">
                    <img class="tv-ch-logo" src="${ch.logo || '/api/proxy/logo/' + encodeURIComponent(ch.name)}" alt=""
                          onerror="this.style.display='none'" />
                    <div class="tv-ch-icon">${ch.name.charAt(0)}</div>
                    <div class="tv-ch-info">
                        <div class="tv-ch-name">${ch.name}</div>
                    </div>
                    <button class="tv-fav-btn ${favIds.includes(ch.id) ? 'tv-fav-on' : ''}"
                            onclick="event.stopPropagation();TVChannels.toggleFavorite('${ch.id}')" tabindex="0">
                        ${favIds.includes(ch.id) ? '♥' : '♡'}
                    </button>
                </div>
            `).join('');
        }
        return html;
    },

    toggleFavorite(channelId) {
        let favIds = JSON.parse(localStorage.getItem('tv_favorites') || '[]');
        const idx = favIds.indexOf(channelId);
        if (idx === -1) {
            favIds.push(channelId);
        } else {
            favIds.splice(idx, 1);
        }
        localStorage.setItem('tv_favorites', JSON.stringify(favIds));
        document.getElementById('panelContent').innerHTML = this._renderFavoritesPanel();
    },

    _renderSettingsPanel() {
        const source = localStorage.getItem('tv_source') || '345';
        return `
            <div style="padding:16px;">
                <div style="margin-bottom:20px;">
                    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">播放源</div>
                    <div style="display:flex;gap:8px;">
                        <button class="tv-settings-btn ${source === '345' ? 'tv-settings-active' : ''}"
                                onclick="TVChannels.setSource('345')">345iptv</button>
                        <button class="tv-settings-btn ${source === '789' ? 'tv-settings-active' : ''}"
                                onclick="TVChannels.setSource('789')">789iptv</button>
                    </div>
                </div>
                <div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">关于</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.8;">
                        懒猫微视 LPTV v1.0<br>
                        CEF OSR 帧播放模式
                    </div>
                </div>
            </div>
        `;
    },

    setSource(source) {
        localStorage.setItem('tv_source', source);
        document.getElementById('panelContent').innerHTML = this._renderSettingsPanel();
    },
};
