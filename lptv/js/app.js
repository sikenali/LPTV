/**
 * LPTV — Main App Controller
 */
window.TVApp = {
    init() {
        // Restore last channel position (but don't auto-play — requires user gesture)
        const savedId = localStorage.getItem('lptv-last-channel');
        if (savedId) {
            const [tid, id] = savedId.split('-');
            const ch = TVChannels.all.find(c => c.tid === tid && c.id === id);
            if (ch) {
                TVChannels.currentGroup = tid === 'ys' ? 'cctv' : 'ws';
                const idx = TVChannels[TVChannels.currentGroup].indexOf(ch);
                if (idx >= 0) TVChannels.focusedIndex = idx;
            }
        }

        // Start channel loading
        TVChannels.init();

        // Category buttons
        document.querySelectorAll('.tv-cat-btn').forEach(btn => {
            btn.onclick = () => TVChannels.switchGroup(btn.dataset.cat);
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => this._onKey(e));
    },

    _onKey(e) {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                TVChannels.navigate('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                TVChannels.navigate('down');
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (TVChannels.activeChannel) {
                    // Already playing, could toggle pause
                } else {
                    const ch = TVChannels[TVChannels.currentGroup][TVChannels.focusedIndex];
                    if (ch) TVChannels._playChannel(ch);
                }
                break;
            case 'Escape':
                e.preventDefault();
                TVPlayer.stop();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                if (TVChannels.activeChannel) {
                    TVPlayer.toggleFullscreen();
                }
                break;
            default:
                // Number keys for direct channel input
                if (/^[0-9]$/.test(e.key)) {
                    e.preventDefault();
                    TVChannels.numberInput(e.key);
                }
        }
    }
};

// Start the app
document.addEventListener('DOMContentLoaded', () => TVApp.init());

// Auto-hide splash after channels load (or 3s timeout as fallback)
(function autoHideSplash() {
    const check = () => {
        const list = document.getElementById('tvChannelsList');
        if (list && list.children.length > 1) { // more than just loading spinner
            const splash = document.getElementById('tvSplash');
            if (splash) splash.classList.add('hidden');
            return;
        }
        setTimeout(check, 200);
    };
    setTimeout(check, 500);
    // Fallback: force hide after 3s
    setTimeout(() => {
        const splash = document.getElementById('tvSplash');
        if (splash) splash.classList.add('hidden');
    }, 3000);
})();
