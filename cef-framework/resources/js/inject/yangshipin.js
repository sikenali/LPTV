// yangshipin.js — lptv-style injection for yangshipin.cn
(function() {
  console.log('[LPTV] yangshipin inject loaded');

  function waitVideo() {
    var video = document.querySelector('video');
    if (!video) {
      setTimeout(waitVideo, 500);
      return;
    }
    console.log('[LPTV] video found, src=', video.src);

    var origPlay = video.play.bind(video);
    video.play = function() {
      return origPlay().catch(function(e) {
        console.warn('[LPTV] play failed:', e.message);
      });
    };

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      var src = video.src;
      if (src && src.indexOf('.m3u8') !== -1) {
        var hls = new Hls({ debug: false });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          video.play().catch(function(){});
        });
        hls.on(Hls.Events.ERROR, function(evt, data) {
          console.error('[LPTV] HLS error:', data.type, data.details);
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
            else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else hls.destroy();
          }
        });
      }
    }

    if (window.LPTV && window.LPTV.onVideoFound) {
      window.LPTV.onVideoFound(video.src || 'unknown');
    }
  }

  var obs = new MutationObserver(function(mutations) {
    for (var m of mutations) {
      for (var node of m.addedNodes) {
        if (node.nodeType !== 1 || !node.classList) continue;
        var cls = node.classList.toString();
        if (/ad|advert|popup|tip|control|btn|mask|layer/i.test(cls)) {
          node.style.display = 'none';
        }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  waitVideo();
})();
