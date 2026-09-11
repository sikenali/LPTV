/**
 * TV Common Utilities
 * Adapted from utao's common.js — remote-control friendly
 */
window.TVCommon = {
    /** Focus management for remote control */
    _focusIndex: 0,
    _focusableElements: [],

    initFocus() {
        this._focusableElements = Array.from(document.querySelectorAll('[tabindex="0"], .tv-channel-item, .tv-btn, .tv-cat-tab'));
        if (this._focusableElements.length > 0) {
            this._focusableElements[0].focus();
        }
    },

    focusNext(direction) {
        if (this._focusableElements.length === 0) return;
        const current = document.activeElement;
        const idx = this._focusableElements.indexOf(current);
        let nextIdx;
        if (direction === 'down' || direction === 'right') {
            nextIdx = idx < this._focusableElements.length - 1 ? idx + 1 : 0;
        } else {
            nextIdx = idx > 0 ? idx - 1 : this._focusableElements.length - 1;
        }
        this._focusableElements[nextIdx].focus();
    },

    /** Format time display */
    formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    },

    formatDate(date) {
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}/${day} 周${weekdays[date.getDay()]}`;
    },

    /** Debounce utility */
    debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    },

    /** Show/hide element */
    show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; },
    hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; },
    toggle(id) { const el = document.getElementById(id); if (el) el.style.display = el.style.display === 'none' ? '' : 'none'; },
};

// Polyfill for replaceAll
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(str, replace) {
        return this.split(str).join(replace);
    };
}
