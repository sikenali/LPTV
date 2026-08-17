package main

import (
	"encoding/json"
	"crypto/sha256"
	"encoding/hex"
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
	streamMutex   sync.Mutex
)

const (
	m3uURL        = "https://raw.githubusercontent.com/zilong7728/Collect-IPTV/refs/heads/main/best_sorted.m3u8"
	cacheTTL      = 4 * time.Hour
	streamTimeout = 30 * time.Second
	maxStreams    = 10
	logoDir       = "logos"
)

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
	if !forceRefresh && !validate && m3uChannels != nil && time.Since(m3uTimestamp) < cacheTTL {
		result := make([]map[string]string, len(m3uChannels))
		copy(result, m3uChannels)
		m3uMutex.RUnlock()
		return result
	}
	m3uMutex.RUnlock()

	m3uMutex.Lock()
	defer m3uMutex.Unlock()

	if !forceRefresh && !validate && m3uChannels != nil && time.Since(m3uTimestamp) < cacheTTL {
		result := make([]map[string]string, len(m3uChannels))
		copy(result, m3uChannels)
		return result
	}

	useLocal := os.Getenv("USE_LOCAL_M3U") == "true"
	localPath := filepath.Join(filepath.Dir(os.Args[0]), "local.m3u8")
	var text string
	if useLocal {
		data, err := os.ReadFile(localPath)
		if err == nil {
			text = string(data)
			log.Printf("[m3u] loaded from local: %s", localPath)
		}
	}
	if text == "" {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(m3uURL)
		if err != nil {
			if m3uChannels != nil {
				result := make([]map[string]string, len(m3uChannels))
				copy(result, m3uChannels)
				return result
			}
			return nil
		}
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		text = string(data)
	}

	channels := parseM3U(text)
	if validate {
		channels = probeChannels(channels)
		channels = deduplicate(channels)
	}
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
			if priority[ch["group"]] < priority[channels[idx]["group"]] {
				seen[key] = i
			}
		} else {
			seen[key] = i
		}
	}
	result := make([]map[string]string, 0, len(seen))
	for _, ch := range channels {
		key := strings.ToLower(ch["name"])
		if idx, ok := seen[key]; ok && idx == len(result) {
			// Just append all unique ones
		}
	}
	// Simpler dedup
	seen2 := make(map[string]bool)
	for _, ch := range channels {
		key := strings.ToLower(ch["name"])
		if !seen2[key] {
			seen2[key] = true
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
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
	h := sha256.Sum256([]byte(imgURL))
	ext := filepath.Ext(imgURL)
	if ext == "" {
		ext = ".png"
	}
	localPath := filepath.Join(logoDir, hex.EncodeToString(h[:]) + ext)

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
	os.WriteFile(localPath, data, 0644)
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
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
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/api/m3u", handleM3U)
	http.HandleFunc("/api/proxy/stream", handleStream)
	http.HandleFunc("/api/proxy/image", handleImage)
	addr := ":" + port
	log.Printf("LPTV proxy server running on port %s", port)
	log.Fatal(http.ListenAndServe(addr, nil))
}
