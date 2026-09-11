// hebei.js — Decrypt and play Hebei TV streams
(function() {
  console.log('[LPTV] hebei inject loaded');

  window.addLiveUrlQuery = function(obj) {
    var ts = parseInt(new Date().getTime() / 1000) + 7200;
    if (obj && obj.liveVideo && obj.liveVideo[0] && obj.liveVideo[0].formats && obj.liveVideo[0].formats[0]) {
      var url = obj.liveVideo[0].formats[0].url;
      if (obj.appCustomParams && obj.appCustomParams.movie) {
        var key = obj.appCustomParams.movie.liveUri + obj.appCustomParams.movie.liveKey;
        return url + "?t=" + ts + '&k=' + CryptoJS.MD5(key + ts);
      }
      return url + "?t=" + ts;
    }
    return null;
  };

  function fetchAndPlay(catalogId, channelName) {
    HttpUtil.get(
      'https://api.cmc.hebtv.com/scms/api/com/article/getArticleList?catalogId=' + catalogId + '&siteId=1',
      { headers: { "Referer": "https://www.hebtv.com/" } }
    ).then(function(res) {
      var news = res.data?.returnData?.news || [];
      window.channelList_hebei = news.map(function(item) {
        return { title: item.title, liveVideo: item.liveVideo, appCustomParams: item.appCustomParams };
      });
      var item = window.channelList_hebei.find(function(x) { return x.title === channelName; });
      if (item) {
        var playUrl = window.addLiveUrlQuery(item);
        if (playUrl) playLive(playUrl);
      }
    }).catch(function(err) {
      console.error('[LPTV] hebei fetch failed:', err);
    });
  }

  var _origPlayLive = window.playLive;
  window.playLive = function(url, headers) {
    var video = document.querySelector('video');
    if (!video) { console.error('[LPTV] no video element'); return; }
    if (Hls.isSupported() && url.indexOf('.m3u8') !== -1) {
      if (window._hls) { window._hls.destroy(); }
      window._hls = new Hls({ debug: false, xhrSetup: function(xhr) {
        if (headers) { for (var k in headers) xhr.setRequestHeader(k, headers[k]); }
      }});
      window._hls.loadSource(url);
      window._hls.attachMedia(video);
      window._hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play(); });
      window._hls.on(Hls.Events.ERROR, function(evt, data) {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) window._hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) window._hls.recoverMediaError();
          else window._hls.destroy();
        }
      });
    } else {
      video.src = url;
      video.play().catch(function(){});
    }
  };

  console.log('[LPTV] hebei ready. Call fetchAndPlay(catalogId, channelName)');
})();
