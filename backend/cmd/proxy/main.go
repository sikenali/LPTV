package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	m3uChannels []map[string]string
	m3uTimestamp time.Time
	m3uMutex     sync.RWMutex
	activeStreams int
	streamMutex  sync.Mutex
)

const (
	cacheTTL      = 4 * time.Hour
	streamTimeout = 30 * time.Second
	maxStreams    = 30
	logoDir       = "logos"
	m3uFilename   = "lptv.m3u8"
)

// m3uLocalPaths 按优先级搜索本地生成的 M3U 文件（channels/ 目录）
var m3uLocalPaths = func() []string {
	exe, _ := os.Executable()
	exeDir := filepath.Dir(exe)
	return []string{
		filepath.Join("channels", m3uFilename),
		filepath.Join(exeDir, "channels", m3uFilename),
	}
}()

func parseM3U(text string) []map[string]string {
	var channels []map[string]string
	lines := strings.Split(text, "\n")
	var current map[string]string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#EXTINF") {
			name := extractAttr(line, "tvg-name")
			logo := extractAttr(line, "tvg-logo")
			group := extractAttr(line, "group-title")
			parts := strings.SplitN(line, ",", 2)
			title := ""
			if len(parts) > 1 {
				title = parts[1]
			}
			if name == "" {
				name = title
			}
			current = map[string]string{"name": name, "logo": logo, "group": group}
		} else if line != "" && !strings.HasPrefix(line, "#") && current != nil {
			current["url"] = line
			current["id"] = current["group"] + "-" + current["name"]
			channels = append(channels, current)
			current = nil
		}
	}
	return channels
}

func extractAttr(line, key string) string {
	prefix := key + "=\""
	idx := strings.Index(line, prefix)
	if idx < 0 {
		return ""
	}
	start := idx + len(prefix)
	end := strings.Index(line[start:], "\"")
	if end < 0 {
		return ""
	}
	return line[start : start+end]
}

func getM3U(forceRefresh, validate bool) []map[string]string {
	m3uMutex.RLock()
	if !forceRefresh && m3uChannels != nil && time.Since(m3uTimestamp) < cacheTTL {
		result := make([]map[string]string, len(m3uChannels))
		copy(result, m3uChannels)
		m3uMutex.RUnlock()
		if validate {
			result = probeChannels(result)
			result = deduplicate(result)
		}
		return result
	}
	m3uMutex.RUnlock()

	m3uMutex.Lock()
	defer m3uMutex.Unlock()

	// Re-check after acquiring write lock
	m3uMutex.RLock()
	if !forceRefresh && m3uChannels != nil && time.Since(m3uTimestamp) < cacheTTL {
		result := make([]map[string]string, len(m3uChannels))
		copy(result, m3uChannels)
		m3uMutex.RUnlock()
		if validate {
			result = probeChannels(result)
			result = deduplicate(result)
		}
		return result
	}
	m3uMutex.RUnlock()

	// Read local m3u8 file only
	var text string
	for _, localPath := range m3uLocalPaths {
		data, err := os.ReadFile(localPath)
		if err == nil {
			text = string(data)
			log.Printf("[m3u] loaded from local: %s", localPath)
			break
		}
	}
	if text == "" {
		log.Printf("[m3u] no local %s found; channel list will be empty until workflow generates it", m3uFilename)
	}

	channels := parseM3U(text)
	if validate {
		channels = probeChannels(channels)
	}
	channels = deduplicate(channels)
	m3uChannels = channels
	m3uTimestamp = time.Now()
	result := make([]map[string]string, len(channels))
	copy(result, channels)
	return result
}

func probeChannels(channels []map[string]string) []map[string]string {
	var valid []map[string]string
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)
	for _, ch := range channels {
		sem <- struct{}{}
		wg.Add(1)
		go func(c map[string]string) {
			defer wg.Done()
			defer func() { <-sem }()
			client := &http.Client{Timeout: 5 * time.Second}
			client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			}
			req, err := http.NewRequest("HEAD", c["url"], nil)
			if err != nil {
				return
			}
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
			resp, err := client.Do(req)
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode < 400 {
					mu.Lock()
					valid = append(valid, c)
					mu.Unlock()
				}
			}
		}(ch)
	}
	wg.Wait()
	return valid
}

func deduplicate(channels []map[string]string) []map[string]string {
	seen := make(map[string]int)
	priority := map[string]int{"央视频道": 0, "卫视频道": 1}
	for i, ch := range channels {
		key := strings.ToLower(ch["name"])
		if idx, ok := seen[key]; ok {
			oldGroup := channels[idx]["group"]
			newGroup := ch["group"]
			if priority[newGroup] < priority[oldGroup] {
				seen[key] = i
			}
		} else {
			seen[key] = i
		}
	}
	kept := make(map[int]bool)
	for i, ch := range channels {
		key := strings.ToLower(ch["name"])
		if seen[key] == i {
			kept[i] = true
		}
	}
	result := make([]map[string]string, 0, len(seen))
	for i, ch := range channels {
		if kept[i] {
			result = append(result, ch)
		}
	}
	return result
}

func resolveURL(base, relative string) string {
	if strings.HasPrefix(relative, "http://") || strings.HasPrefix(relative, "https://") {
		return relative
	}
	if strings.HasPrefix(relative, "//") {
		u, _ := url.Parse("https:" + relative)
		return u.String()
	}
	baseURL, _ := url.Parse(base)
	return baseURL.ResolveReference(&url.URL{Path: relative}).String()
}

func rewriteManifest(text, masterURL string) string {
	lines := strings.Split(text, "\n")
	var result []string
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			if strings.HasPrefix(trimmed, "#EXT-X-STREAM-INF") || strings.HasPrefix(trimmed, "#EXT-X-MEDIA:") {
				if i+1 < len(lines) {
					next := strings.TrimSpace(lines[i+1])
					if next != "" && !strings.HasPrefix(next, "#") {
						resolved := resolveURL(masterURL, next)
						if strings.Contains(resolved, "m3u8") {
							result = append(result, line)
							result = append(result, "/api/proxy/stream?url="+url.QueryEscape(resolved))
							i++
							continue
						}
					}
				}
			}
			result = append(result, line)
			continue
		}
		resolved := resolveURL(masterURL, trimmed)
		result = append(result, "/api/proxy/stream?url="+url.QueryEscape(resolved))
	}
	return strings.Join(result, "\n")
}

func getReferer(u string) string {
	parsed, err := url.Parse(u)
	if err != nil {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host + "/"
}

func handleM3U(w http.ResponseWriter, r *http.Request) {
	forceRefresh := r.URL.Query().Get("refresh") == "1"
	validate := r.URL.Query().Get("validate") == "true"
	channels := getM3U(forceRefresh, validate)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(channels)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	m3uMutex.RLock()
	channelCount := len(m3uChannels)
	m3uMutex.RUnlock()
	json.NewEncoder(w).Encode(map[string]string{
		"status":       "ok",
		"channelCount": strconv.Itoa(channelCount),
	})
}

func handleStream(w http.ResponseWriter, r *http.Request) {
	streamURL := r.URL.Query().Get("url")
	quality := r.URL.Query().Get("quality")
	if streamURL == "" {
		http.Error(w, "Missing url", 400)
		return
	}

	streamMutex.Lock()
	if activeStreams >= maxStreams {
		streamMutex.Unlock()
		http.Error(w, "Too many streams", 503)
		return
	}
	activeStreams++
	streamMutex.Unlock()
	defer func() {
		streamMutex.Lock()
		activeStreams--
		streamMutex.Unlock()
	}()

	client := &http.Client{Timeout: streamTimeout}
	referer := getReferer(streamURL)
	req, err := http.NewRequest("GET", streamURL, nil)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Referer", referer)
	req.Header.Set("Origin", referer)

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	isM3U8 := strings.Contains(contentType, "mpegurl") || strings.Contains(contentType, "x-mpegurl") || strings.HasSuffix(streamURL, ".m3u8")

	if isM3U8 {
		body, _ := io.ReadAll(resp.Body)
		text := string(body)
		if strings.Contains(text, "#EXT-X-STREAM-INF") {
			lines := strings.Split(text, "\n")
			type variant struct {
				URL        string
				Bandwidth  int
				Resolution int
			}
			var variants []variant
			for i, line := range lines {
				if strings.HasPrefix(strings.TrimSpace(line), "#EXT-X-STREAM-INF") {
					if i+1 < len(lines) {
						urlLine := strings.TrimSpace(lines[i+1])
						if urlLine != "" && !strings.HasPrefix(urlLine, "#") {
							resolved := resolveURL(streamURL, urlLine)
							bw := 0
							res := 0
							for _, part := range strings.Split(line, ",") {
								part = strings.TrimSpace(part)
								if strings.HasPrefix(part, "BANDWIDTH=") {
									if v, err := strconv.Atoi(part[10:]); err == nil {
										bw = v
									}
								}
								if strings.HasPrefix(part, "RESOLUTION=") {
									parts := strings.SplitN(part[11:], "x", 2)
									if len(parts) == 2 {
										if x, err := strconv.Atoi(parts[0]); err == nil {
											if y, err := strconv.Atoi(parts[1]); err == nil {
												res = x
												if y < res {
													res = y
												}
											}
										}
									}
								}
							}
							variants = append(variants, variant{resolved, bw, res})
						}
					}
				}
			}
			if len(variants) > 0 {
				qMap := map[string]int{"high": 99999, "low": 0, "4k": 2160, "1080p": 1080, "720p": 720, "480p": 480}
				target := 0
				if quality != "" {
					target = qMap[strings.ToLower(quality)]
				}
				var chosen variant
				if target > 0 {
					var matched []variant
					for _, v := range variants {
						if v.Resolution == target {
							matched = append(matched, v)
						}
					}
					if len(matched) > 0 {
						chosen = matched[0]
						for _, m := range matched[1:] {
							if m.Bandwidth > chosen.Bandwidth {
								chosen = m
							}
						}
					}
				}
				if chosen.URL == "" {
					chosen = variants[0]
					for _, v := range variants[1:] {
						if v.Bandwidth > chosen.Bandwidth {
							chosen = v
						}
					}
				}
				newURL := "/api/proxy/stream?url=" + url.QueryEscape(chosen.URL)
				if quality != "" {
					newURL += "&quality=" + quality
				}
				http.Redirect(w, r, newURL, http.StatusFound)
				return
			}
		}
		rewritten := rewriteManifest(text, streamURL)
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Write([]byte(rewritten))
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	for k, v := range resp.Header {
		if k == "Content-Type" || k == "Content-Length" {
			w.Header()[k] = v
		}
	}
	io.Copy(w, resp.Body)
}

func handleImage(w http.ResponseWriter, r *http.Request) {
	imgURL := r.URL.Query().Get("url")
	name := r.URL.Query().Get("name")
	if imgURL == "" {
		http.Error(w, "Missing url", 400)
		return
	}

	// Local logo: path is relative to project root (e.g. "logos/湖南卫视.png")
	BASE_DIR := filepath.Join(filepath.Dir(os.Args[0]), "..")
	ext := filepath.Ext(imgURL)
	if ext == "" {
		ext = ".png"
	}
	// Strip path traversal, keep Chinese/letters/digits
	sanitized := strings.ReplaceAll(imgURL, "..", "")
	sanitized = strings.TrimPrefix(sanitized, "/")
	localPath := filepath.Join(BASE_DIR, "logos", sanitized)

	if data, err := os.ReadFile(localPath); err == nil {
		ctype := mime.TypeByExtension(ext)
		if ctype == "" {
			ctype = "image/png"
		}
		w.Header().Set("Content-Type", ctype)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Write(data)
		return
	}

	// Fallback: hash-based remote cache
	h := sha256.Sum256([]byte(imgURL))
	hashPath := filepath.Join(logoDir, hex.EncodeToString(h[:]) + ext)
	if data, err := os.ReadFile(hashPath); err == nil {
		ctype := mime.TypeByExtension(ext)
		if ctype == "" {
			ctype = "image/png"
		}
		w.Header().Set("Content-Type", ctype)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Write(data)
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(imgURL)
	if err != nil {
		svg := generateLogoSVG(name)
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Write([]byte(svg))
		return
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	os.MkdirAll(logoDir, 0755)
	os.WriteFile(hashPath, data, 0644)
	w.Header().Set("Content-Type", resp.Header.Get("content-type"))
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Write(data)
}

func generateLogoSVG(name string) string {
	colors := []string{"#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"}
	idx := 0
	for _, c := range name {
		idx += int(c)
	}
	color := colors[idx%len(colors)]
	letter := "?"
	if len(name) > 0 {
		for _, c := range name {
			letter = string(c)
			break
		}
	}
	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="12" fill="%s" opacity="0.8"/>
  <text x="40" y="44" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="sans-serif">%s</text>
</svg>`, color, letter)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("BACKEND_PORT")
	}
	if port == "" {
		port = "8080"
	}
	os.MkdirAll(logoDir, 0755)

	loadM3U()

	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/api/m3u", handleM3U)
	http.HandleFunc("/api/proxy/stream", handleStream)
	http.HandleFunc("/api/proxy/image", handleImage)
	addr := ":" + port
	log.Printf("LPTV proxy server running on port %s (local m3u: %v)", port, m3uLocalPaths)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func loadM3U() {
	for _, localPath := range m3uLocalPaths {
		data, err := os.ReadFile(localPath)
		if err == nil {
			channels := parseM3U(string(data))
			m3uMutex.Lock()
			m3uChannels = channels
			m3uTimestamp = time.Now()
			m3uMutex.Unlock()
			log.Printf("[m3u] loaded %d channels from %s", len(channels), localPath)
			return
		}
	}
	log.Printf("[m3u] no local %s found; channel list will be empty until workflow generates it", m3uFilename)
}
