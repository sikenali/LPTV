/**
 * TV App — Main entry point
 * Handles remote control key events and app lifecycle
 */
window.TVApp = {
    init() {
        TVPlayer.init();
        TVChannels.init();
        TVCommon.initFocus();

        // Category buttons
        document.querySelectorAll('.tv-cat-btn').forEach(btn => {
            btn.onclick = () => TVChannels.switchGroup(btn.dataset.cat);
        });

        // Fullscreen button
        document.getElementById('tvFullscreenBtn').onclick = () => TVPlayer.toggleFullscreen();

        // Hide loading after a moment
        setTimeout(() => TVCommon.hide('tvLoading'), 800);

        // Remote control key handler
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    },

    onKeyDown(e) {
        const key = e.key;

        switch (key) {
            case 'ArrowDown':
                e.preventDefault();
                TVChannels.navigate('down');
                break;
            case 'ArrowUp':
                e.preventDefault();
                TVChannels.navigate('up');
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                TVChannels.navigate('ok');
                break;
            case 'Escape':
                e.preventDefault();
                window.location.href = '/';
                break;
        }
    },
};

// Expose for Android JS interface
window._tvKeyCtrl = {
    up: () => TVApp.onKeyDown({ key: 'ArrowUp', preventDefault: () => {} }),
    down: () => TVApp.onKeyDown({ key: 'ArrowDown', preventDefault: () => {} }),
    left: () => TVApp.onKeyDown({ key: 'ArrowLeft', preventDefault: () => {} }),
    right: () => TVApp.onKeyDown({ key: 'ArrowRight', preventDefault: () => {} }),
    ok: () => TVApp.onKeyDown({ key: 'Enter', preventDefault: () => {} }),
    menu: () => {},
    back: () => { window.location.href = '/'; },
};

// Start app
document.addEventListener('DOMContentLoaded', () => TVApp.init());
