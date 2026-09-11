/**
 * DongYuTvWeb Style — Main App
 */
window.DYApp = {
    init() {
        // Load favorites
        try {
            const saved = localStorage.getItem('lptv_favs');
            if (saved) DYChannels.favorites = JSON.parse(saved);
        } catch(e) {}

        // Start channel loading
        DYChannels.init();

        // Update time
        this._updateTime();
        setInterval(() => this._updateTime(), 1000);

        // Back button
        document.getElementById('dyBackBtn').onclick = () => DYPlayer.stop();

        // Favorite button
        document.getElementById('dyFavBtn').onclick = () => DYPlayer.toggleFavorite();

        // Modal close
        document.getElementById('dyModalClose').onclick = () => {
            document.getElementById('dyModal').classList.remove('visible');
        };
        document.getElementById('dyModal').onclick = (e) => {
            if (e.target.id === 'dyModal') {
                document.getElementById('dyModal').classList.remove('visible');
            }
        };

        // Keyboard controls
        document.addEventListener('keydown', (e) => this._onKey(e));
    },

    _updateTime() {
        const el = document.getElementById('dyTime');
        if (!el) return;
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const date = `${now.getMonth()+1}/${now.getDate()} ${h}:${m}`;
        el.textContent = date;
    },

    _onKey(e) {
        const overlay = document.getElementById('dyPlayerOverlay');
        const isPlaying = overlay.classList.contains('visible');

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                DYChannels.navigate('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                DYChannels.navigate('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                DYChannels.navigate('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                DYChannels.navigate('right');
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (isPlaying) {
                    // Toggle pause in iframe (if supported)
                } else {
                    DYChannels._playChannel(DYChannels.allChannels[DYChannels.focusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (isPlaying) DYPlayer.stop();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                if (isPlaying) DYPlayer.toggleFavorite();
                break;
            default:
                // Number keys for direct channel input
                if (/^[0-9]$/.test(e.key)) {
                    e.preventDefault();
                    DYChannels.numberInput(e.key);
                }
        }
    },
};

// Start the app
document.addEventListener('DOMContentLoaded', () => DYApp.init());
