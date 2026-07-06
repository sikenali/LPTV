const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// 固定站点token
const SITE_FIX_TOKEN = "94102973569333ec596b874e5a401fd0";
const BASE_URL = "https://iptv345.com";

// 通用资源代理（JS、CSS、图片、AJAX等）
app.get('/proxy/asset/:path', async (req, res) => {
    const assetPath = req.params.path;
    const targetUrl = `${BASE_URL}/${assetPath}`;
    try {
        const resp = await axios.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL + "/"
            },
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        // 设置内容类型
        const contentType = resp.headers['content-type'] || '';
        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.send(resp.data);
    } catch(err) {
        console.error('资源代理失败:', targetUrl, err.message);
        res.status(500).send("资源加载失败");
    }
});

// 代理AJAX接口（获取流地址）
app.all('/proxy/api/:path', async (req, res) => {
    const apiPath = req.params.path;
    const targetUrl = `${BASE_URL}/${apiPath}`;
    try {
        const resp = await axios({
            method: req.method,
            url: targetUrl,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL + "/",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data: req.body,
            timeout: 10000
        });
        
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', resp.headers['content-type'] || 'application/json');
        res.send(resp.data);
    } catch(err) {
        console.error('API代理失败:', targetUrl, err.message);
        res.status(500).send("API请求失败");
    }
});

// 注入脚本：隐藏页面元素、自动选择线路、重写资源路径、监听video blob变更、向父页面传流地址
const INJECT_SCRIPT = `
<script>
(function() {
    const PROXY_BASE = '/proxy';

    // 重写资源URL（JS、CSS、AJAX等）
    function rewriteResourceUrls() {
        // 重写script src
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && src.startsWith('/')) {
                script.setAttribute('src', PROXY_BASE + '/asset' + src);
            }
        });
        
        // 重写link href
        document.querySelectorAll('link[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/')) {
                link.setAttribute('href', PROXY_BASE + '/asset' + href);
            }
        });
        
        // 重写form action
        document.querySelectorAll('form[action]').forEach(form => {
            const action = form.getAttribute('action');
            if (action && action.startsWith('/')) {
                form.setAttribute('action', PROXY_BASE + '/api' + action);
            }
        });
    }

    function hideAllExceptPlayer() {
        document.querySelectorAll("body > *").forEach(el => {
            if (el.id !== "vstPlayer" && !el.classList.contains('vst-container')) {
                el.style.display = "none";
            }
        });
    }

    function sendVideoSrc(src) {
        if (src && (src.startsWith('blob:') || src.startsWith('http'))) {
            window.parent.postMessage({type: "videoSrc", src: src}, "*");
        }
    }

    function observeVideoElement(video) {
        if (!video) return;
        
        // 发送当前src
        sendVideoSrc(video.src);

        // 监听src属性变化
        const srcObserver = new MutationObserver(() => {
            sendVideoSrc(video.src);
        });
        srcObserver.observe(video, {attributes: true, attributeFilter: ["src"]});

        // 也监听source子元素变化
        const childObserver = new MutationObserver(() => {
            sendVideoSrc(video.src);
        });
        childObserver.observe(video, {childList: true, subtree: true});
    }

    function tryAutoSelectStream() {
        const select = document.getElementById("playURL");
        if (select && select.options.length > 0) {
            // 选择第一个选项
            select.selectedIndex = 0;
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
            console.log('[Proxy] Auto-selected first stream:', select.options[0].value);
            return true;
        }
        return false;
    }

    function findAndObserveVideo() {
        // 尝试多个可能的video元素ID
        const possibleIds = ['vstPlayer', 'video', 'player', 'myPlayer', 'hlsPlayer'];
        for (const id of possibleIds) {
            const video = document.getElementById(id);
            if (video) {
                observeVideoElement(video);
                return true;
            }
        }
        // 也查找所有video标签
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
            videos.forEach(observeVideoElement);
            return true;
        }
        return false;
    }

    function init() {
        rewriteResourceUrls();
        hideAllExceptPlayer();
        
        // 先尝试自动选择线路
        tryAutoSelectStream();
        
        // 然后定期检查视频元素
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            if (findAndObserveVideo()) {
                clearInterval(checkInterval);
            }
            checkCount++;
            if (checkCount > 100) clearInterval(checkInterval); // 10秒后停止检查
        }, 200);
    }

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
</script>
<style>
body { margin:0; padding:0; background:#000; overflow:hidden; }
#vstPlayer { position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; }
.vst-container { display: none !important; }
video { position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; }
</style>
`;

// 代理分类页面（获取频道列表页）
app.get('/proxy/category', async (req, res) => {
    const { tid } = req.query;
    if (!tid) {
        return res.status(400).send('Missing tid parameter');
    }
    
    const targetUrl = `${BASE_URL}/?tid=${tid}&token=${SITE_FIX_TOKEN}`;
    try {
        const resp = await axios.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL + "/"
            },
            timeout: 10000
        });
        let html = resp.data;
        
        // 注入脚本
        html = html.replace("</body>", INJECT_SCRIPT + "</body>");
        res.send(html);
    } catch(err) {
        console.error('代理分类页请求失败:', err.message);
        res.status(500).send("分类页面加载失败");
    }
});

// 代理播放页面
app.get('/proxy/play', async (req, res) => {
    const { tid, id } = req.query;
    if (!tid || !id) {
        return res.status(400).send('Missing tid or id parameter');
    }
    
    const targetUrl = `${BASE_URL}/?act=play&token=${SITE_FIX_TOKEN}&tid=${tid}&id=${id}`;
    try {
        const resp = await axios.get(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": BASE_URL + "/"
            },
            timeout: 10000
        });
        let html = resp.data;
        
        // 注入脚本
        html = html.replace("</body>", INJECT_SCRIPT + "</body>");
        res.send(html);
    } catch(err) {
        console.error('代理播放页请求失败:', err.message);
        res.status(500).send("播放页面加载失败");
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`代理服务器运行在 http://localhost:${PORT}`);
    console.log(`分类页代理: http://localhost:${PORT}/proxy/category?tid=ys`);
    console.log(`播放页代理: http://localhost:${PORT}/proxy/play?tid=ys&id=1`);
});