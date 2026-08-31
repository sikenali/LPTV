/**
 * TV Channel Data
 * Loaded from API, structured for remote control navigation
 */
window.TVChannels = {
    groups: {},       // { '央视频道': [...], '卫视频道': [...] }
    allChannels: [],
    currentGroup: '',
    currentIndex: 0,

    async init() {
        try {
            const resp = await fetch('/api/channels');
            const channels = await resp.json();
            this.allChannels = channels;

            // Group by category
            this.groups = {};
            channels.forEach(ch => {
                if (!this.groups[ch.category]) this.groups[ch.category] = [];
                this.groups[ch.category].push(ch);
            });

            this.currentGroup = Object.keys(this.groups)[0] || '';
            this.renderCategories();
            this.renderChannelList();
        } catch (e) {
            console.error('[channels] Failed to load:', e);
        }
    },

    renderCategories() {
        const container = document.getElementById('categoryTabs');
        if (!container) return;
        container.innerHTML = Object.keys(this.groups).map(cat => `
            <button class="tv-cat-tab ${cat === this.currentGroup ? 'active' : ''}"
                    onclick="TVChannels.switchGroup('${cat}')">${cat}</button>
        `).join('');
    },

    renderChannelList() {
        const container = document.getElementById('channelList');
        if (!container) return;
        const channels = this.groups[this.currentGroup] || [];
        container.innerHTML = channels.map((ch, i) => `
            <div class="tv-channel-item" data-index="${i}" data-tid="${ch.tid}" data-id="${ch.id}"
                 onclick="TVChannels.select(${i})" tabindex="0">
                <div class="tv-ch-icon">${ch.name.charAt(0)}</div>
                <div class="tv-ch-info">
                    <div class="tv-ch-name">${ch.name}</div>
                    <div class="tv-ch-program">${ch.currentProgram || ''}</div>
                </div>
            </div>
        `).join('');
        this.updateCounter();
    },

    switchGroup(group) {
        this.currentGroup = group;
        this.currentIndex = 0;
        this.renderCategories();
        this.renderChannelList();
        // Focus first item
        const first = document.querySelector('.tv-channel-item');
        if (first) first.focus();
    },

    select(index) {
        this.currentIndex = index;
        const channel = this.groups[this.currentGroup][index];
        if (!channel) return;
        // Update active state
        document.querySelectorAll('.tv-channel-item').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
        TVPlayer.loadChannel(channel);
        this.closePanel();
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
        }
        this.updateCounter();
    },

    updateCounter() {
        const total = this.allChannels.length;
        const group = this.groups[this.currentGroup] || [];
        const el = document.getElementById('tvChannelCounter');
        if (el) el.textContent = `${this.currentGroup} · ${group.length}个频道`;
    },

    openPanel() {
        const panel = document.getElementById('channelPanel');
        if (panel) panel.style.display = 'flex';
        this.renderChannelList();
    },

    closePanel() {
        const panel = document.getElementById('channelPanel');
        if (panel) panel.style.display = 'none';
    },
};
