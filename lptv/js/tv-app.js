/**
 * TV App — Main entry point
 * Handles remote control key events and app lifecycle
 */
window.TVApp = {
    timeTimer: null,

    init() {
        TVPlayer.init();
        TVChannels.init();
        TVCommon.initFocus();
        this.updateTime();
        this.timeTimer = setInterval(() => this.updateTime(), 1000);

        // Hide loading after a moment
        setTimeout(() => TVCommon.hide('tvLoading'), 800);

        // Remote control key handler
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    },

    updateTime() {
        const timeEl = document.getElementById('tvTime');
        if (timeEl) {
            timeEl.textContent = `${TVCommon.formatDate(new Date())} ${TVCommon.formatTime(new Date())}`;
        }
    },

    onKeyDown(e) {
        const key = e.key;
        const panel = document.getElementById('channelPanel');
        const panelVisible = panel && panel.style.display !== 'none';

        switch (key) {
            case 'ArrowDown':
            case 's':
                e.preventDefault();
                if (panelVisible) TVChannels.navigate('down');
                else this.showPanelOrHint();
                break;
            case 'ArrowUp':
            case 'w':
                e.preventDefault();
                if (panelVisible) TVChannels.navigate('up');
                else this.showPanelOrHint();
                break;
            case 'ArrowRight':
            case 'd':
            case 'ArrowLeft':
            case 'a':
                e.preventDefault();
                if (panelVisible) TVChannels.navigate(panelVisible && e.key === 'ArrowDown' || e.key === 's' ? 'down' : 'up');
                else this.togglePanel();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (panelVisible) TVChannels.navigate('ok');
                else this.togglePanel();
                break;
            case 'Escape':
            case 'Backspace':
                e.preventDefault();
                if (panelVisible) TVChannels.closePanel();
                else window.location.href = '/';
                break;
            case 'm':
                e.preventDefault();
                this.togglePanel();
                break;
        }
    },

    showPanelOrHint() {
        // 无内页播放, 直接打开频道面板
        TVChannels.openPanel();
    },

    togglePanel() {
        const panel = document.getElementById('channelPanel');
        if (panel && panel.style.display !== 'none') {
            TVChannels.closePanel();
        } else {
            TVChannels.openPanel();
        }
    },

    closeChannelPanel() {
        TVChannels.closePanel();
    },
};

// Expose for Android JS interface
window._tvKeyCtrl = {
    up: () => TVApp.onKeyDown({ key: 'ArrowUp', preventDefault: () => {} }),
    down: () => TVApp.onKeyDown({ key: 'ArrowDown', preventDefault: () => {} }),
    left: () => TVApp.onKeyDown({ key: 'ArrowLeft', preventDefault: () => {} }),
    right: () => TVApp.onKeyDown({ key: 'ArrowRight', preventDefault: () => {} }),
    ok: () => TVApp.onKeyDown({ key: 'Enter', preventDefault: () => {} }),
    menu: () => TVApp.togglePanel(),
    back: () => {
        const panel = document.getElementById('channelPanel');
        if (panel && panel.style.display !== 'none') {
            TVChannels.closePanel();
        } else {
            window.location.href = '/';
        }
    },
};

// Start app
document.addEventListener('DOMContentLoaded', () => TVApp.init());
