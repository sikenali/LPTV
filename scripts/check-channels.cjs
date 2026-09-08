const http = require('http');
http.get('http://127.0.0.1:3000/api/m3u?refresh=1', function(r) {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', function() {
    var j = JSON.parse(d);
    console.log('Total channels:', j.length);
    ['CCTV1', 'CCTV4', 'CCTV4欧洲', 'CCTV4美洲', '湖南卫视', '广东卫视', '云南卫视', 'CGTN英语', 'CGTN法语', 'CHC动作电影', '兵团卫视'].forEach(function(name) {
      var c = j.find(function(ch) { return ch.name === name; });
      if (c) {
        console.log(name + ': url=' + c.url.substring(0, 50) + ' urls=' + (c.urls || []).length);
      } else {
        console.log(name + ': NOT FOUND');
      }
    });
  });
}).on('error', function(e) { console.log('Error:', e.message); });
