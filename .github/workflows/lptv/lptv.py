import os
import aiohttp
import asyncio
import time
import json
import urllib.parse
import gzip
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
import re
from typing import Dict, Iterable, List, Optional, Set, Tuple, Any

def sanitize_filename(name: str) -> str:
    """仅过滤路径穿越字符和系统保留字，保留原始频道名（含中文）以匹配 fanmingming CDN 命名"""
    # 移除 .. 防止路径穿越
    safe = name.replace('..', '').strip()
    # 仅替换会破坏文件名的绝对路径符号，保留中文/字母/数字/常见标点
    return re.sub(r'^[\/\\]+|[\/\\]+$', '', safe)


def contains_date(text):
    date_pattern = r"\d{4}-\d{2}-\d{2}"
    return re.search(date_pattern, text) is not None


def normalize_text_for_match(text: str) -> str:
    normalized = text.translate(CHAR_NORMALIZATION_MAP).strip().upper().replace("＋", "+")
    normalized = re.sub(r"[ \t\r\n\-_|·•:：,，.。/\\()\[\]【】「」'\"`]+", "", normalized)
    return normalized


CONFIG = {
    "timeout": 10,
    "max_parallel": 30,
    "max_retries": 3,
    "output_file": "channels/lptv.m3u",
    "source_quality_cache": ".github/workflows/lptv/source_quality.json",
    "min_source_streams": 20,
    "max_consecutive_failures": 3,
    "max_streams_per_source": 500,
    "stream_test_timeout": 5,
    "stream_content_verify": True,
    "cache_ttl_days": 7,
    "epg_url": "http://epg.51zmt.top:8000/e.xml.gz",
    "epg_cache_file": ".github/workflows/lptv/epg_cache.json",
    "epg_cache_ttl_hours": 12,
    "max_resolution": "1080p",  # 高于此分辨率的源降低权重
    "min_bandwidth_kbps": 50,  # 最低码率阈值(Kbps)
}

# 浏览器无法播放的协议，直接从源中过滤掉
INVALID_PROTOCOL_PATTERNS = re.compile(
    r'^(rtp|rtsp|udp|mcast|file|data):', re.IGNORECASE
)

# 危险协议（某些场景可能有用，但默认过滤）
DANGEROUS_PROTOCOL_PATTERNS = re.compile(
    r'^(javascript|vbscript):', re.IGNORECASE
)

# 有效的视频流 Content-Type
VALID_CONTENT_TYPES = {
    'application/x-mpegurl',
    'application/vnd.apple.mpegurl',
    'video/mp2t',
    'video/mp4',
    'audio/mpeg',
    'audio/aac',
    'text/plain',
    '',  # 允许无 Content-Type
}

CHAR_NORMALIZATION_MAP = str.maketrans({
    "頻": "频", "視": "视", "臺": "台", "綜": "综", "聞": "闻",
    "體": "体", "藝": "艺", "經": "经", "濟": "济", "娛": "娱",
    "樂": "乐", "電": "电", "廣": "广", "畫": "画", "劇": "剧",
    "紀": "纪", "錄": "录", "網": "网", "導": "导", "髮": "发",
    "衛": "卫", "陰": "阴", "陽": "阳", "麗": "丽", "龍": "龙",
    "鄉": "乡", "鎮": "镇", "區": "区", "縣": "县", "灣": "湾",
    "滬": "沪", "閩": "闽", "贛": "赣", "蘇": "苏", "浙": "浙",
    "魯": "鲁", "豫": "豫", "鄂": "鄂", "湘": "湘", "粵": "粤",
    "瓊": "琼", "渝": "渝", "遼": "辽", "寧": "n", "貴": "贵",
    "雲": "云", "藏": "藏", "陝": "陕", "晉": "晋", "冀": "冀",
})

PROVINCE_ALIASES = {
    "北京": {"北京台"}, "上海": {"上海台", "东方明珠", "沪上"},
    "天津": {"天津台"}, "重庆": {"重庆台"}, "河北": {"河北台"},
    "山西": {"山西台", "三晋"}, "辽宁": {"辽宁台", "辽沈"},
    "吉林": {"吉林台"}, "内蒙": {"内蒙古"}, "黑龙江": {"龙江", "黑龙江台"},
    "江苏": {"江苏台", "苏南"}, "浙江": {"浙江台", "之江"},
    "安徽": {"安徽台"}, "福建": {"福建台", "八闽"},
    "江西": {"江西台"}, "山东": {"山东台", "齐鲁"},
    "河南": {"河南台", "中原"}, "湖北": {"湖北台"},
    "湖南": {"湖南台"}, "广东": {"广东台", "南粤"},
    "广西": {"广西台"}, "海南": {"海南台"},
    "四川": {"四川台", "巴蜀"}, "贵州": {"贵州台"},
    "云南": {"云南台", "七彩云南"}, "西藏": {"西藏台"},
    "陕西": {"陕西台", "三秦"}, "甘肃": {"甘肃台", "陇原"},
    "青海": {"青海台"}, "宁夏": {"宁夏台"}, "新疆": {"新疆台"},
    "江苏": {"江苏台", "苏南"},
}

COMMON_CHANNEL_SUFFIXES = (
    "新闻综合频道", "新闻综合", "新闻频道",
    "新聞綜合頻道", "新聞綜合", "新聞頻道",
    "社会民生频道", "社会民生", "社會民生頻道", "社會民生",
    "影视娱乐频道", "影视娱乐", "影視娛樂頻道", "影視娛樂",
    "经济生活频道", "经济生活", "經濟生活頻道", "經濟生活",
    "文体旅游频道", "文体旅游", "文體旅遊頻道", "文體旅遊",
    "文旅频道", "文旅頻道", "旅游频道", "旅游", "旅遊頻道",
    "体育频道", "体育", "體育頻道", "體育",
    "教育频道", "教育頻道", "少儿频道", "少儿", "少兒頻道", "少兒",
    "科教频道", "科教頻道",
    "文化影视", "文化娱乐", "文化生活", "文化频道", "文化",
    "文化影視", "文化娛樂", "文化頻道",
    "都市频道", "都市頻道", "都市",
    "民生频道", "民生頻道", "资讯频道", "资讯", "資訊頻道", "資訊",
    "公共频道", "公共頻道", "公共",
    "综合频道", "综合", "綜合頻道",
    "娱乐频道", "娱乐頻道", "娱乐",
    "影视", "影視", "导视频道", "导视", "導視頻道", "導視",
    "生活频道", "生活頻道", "文艺频道", "文艺", "文藝頻道", "文藝",
    "法治频道", "法治頻道", "军事频道", "軍事頻道",
    "电视台", "電視台", "频道", "頻道", "直播",
    "高清", "超清", "标清",
)

NON_GEO_TOKENS = {
    "新闻", "综合", "公共", "生活", "民生", "都市", "经济", "科教", "教育", "少儿",
    "影视", "娱乐", "体育", "文旅", "旅游", "文化", "资讯", "导视", "频道", "电视",
    "法治", "军事", "党建", "购物", "健康", "养生", "时尚", "美食", "游戏", "电竞",
    "戲曲", "戏曲", "戲劇", "戏剧", "曲艺", "紀錄", "纪录", "綜藝", "综艺",
    "台", "TV", "HD", "SD", "UHD", "FHD", "4K", "8K",
}

SMART_CATEGORY_KEYWORDS = {
    "港澳台频道": ("翡翠台", "明珠台", "无线新闻", "有线新闻", "HOY", "VIU", "凤凰", "寰宇", "纬来", "东森", "中天", "台视", "华视", "民视", "三立", "非凡", "年代", "TVBS", "八大"),
    "文旅频道": ("古城", "古镇", "景区", "景点", "风景", "风光", "观景", "全景", "大佛", "雪山", "公园", "湿地", "湖景", "山景", "游览", "花布"),
    "新闻频道": ("新闻", "时政", "资讯", "观察", "焦点", "头条"),
    "体育频道": ("体育", "足球", "篮球", "网球", "高尔夫", "搏击", "赛事"),
    "影视频道": ("电影", "影院", "剧场", "电视剧", "影视", "经典剧"),
    "少儿动漫": ("少儿", "卡通", "动漫", "动画", "童话", "小当家", "柯南", "哆啦A梦", "海绵宝宝"),
    "纪录人文": ("纪录", "纪实", "人文", "自然", "地理", "探索"),
    "音乐频道": ("音乐", "MV", "演唱会", "舞曲", "戏曲"),
    "广播频道": ("广播", "电台", "FM", "AM"),
    "戏曲综艺": ("戏曲", "戏剧", "曲艺", "梨园", "相声", "小品", "综艺", "文艺"),
    "法治军事": ("法治", "军事", "国防", "军旅", "警务", "普法"),
    "游戏电竞": ("游戏", "电竞", "电子竞技"),
    "生活购物": ("购物", "导购", "时尚", "美食", "健康", "养生", "家居"),
    "教育党建": ("党建", "党史", "党员", "教育", "教科", "留学", "考试"),
}

SCENIC_SINGLE_CHAR_HINTS = {"山", "湖", "河", "池", "田"}
SCENIC_EXCLUDE_HINTS = {
    "新闻", "综合", "公共", "体育", "足球", "篮球", "电影", "影视", "纪录",
    "动漫", "少儿", "音乐", "广播", "经济", "生活", "教育", "科教", "资讯",
    "法治", "军事", "购物", "党建", "游戏", "电竞"
}

ONLINE_GEO_DATA_URLS = [
    "https://raw.githubusercontent.com/modood/Administrative-divisions-of-China/master/dist/pca-code.json",
    "https://fastly.jsdelivr.net/gh/modood/Administrative-divisions-of-China/dist/pca-code.json",
]

PROVINCE_SUFFIXES = ("特别行政区", "维吾尔自治区", "壮族自治区", "回族自治区", "自治区", "省", "市")
AREA_SUFFIXES = (
    "自治县", "自治州", "自治区", "特别行政区", "新区", "开发区", "高新区",
    "地区", "林区", "矿区", "县", "市", "区", "州", "盟", "旗", "镇", "乡", "街道"
)
IGNORED_GEO_NAMES = {
    "市辖区", "城区", "郊区", "新区", "开发区", "高新区", "矿区", "城区街道",
    "其他", "直辖", "省直辖县级行政区划", "自治区直辖县级行政区划",
    "市辖县", "县级市", "直辖县级", "工业园区", "示范区", "合作区", "管理区"
}

COMMON_CHANNEL_SUFFIXES_NORMALIZED = tuple(
    sorted({normalize_text_for_match(s) for s in COMMON_CHANNEL_SUFFIXES}, key=len, reverse=True)
)
NON_GEO_TOKENS_NORMALIZED = {normalize_text_for_match(token) for token in NON_GEO_TOKENS}
SMART_CATEGORY_KEYWORDS_NORMALIZED = {
    category: tuple(sorted({normalize_text_for_match(k) for k in keywords}, key=len, reverse=True))
    for category, keywords in SMART_CATEGORY_KEYWORDS.items()
}
SCENIC_EXCLUDE_HINTS_NORMALIZED = {normalize_text_for_match(token) for token in SCENIC_EXCLUDE_HINTS}
IGNORED_GEO_NAMES_NORMALIZED = {normalize_text_for_match(name) for name in IGNORED_GEO_NAMES}

BLOCKED_M3U_KEYWORDS = (
    "更新时间", "更新時間", "维护时间", "維護時間", "维护内容", "維護内容", "维护內容",
    "公告说明", "公告說明", "公告", "说明", "說明", "支持作者", "支持打赏", "支持打賞",
    "免费订阅", "免費訂閲", "免費訂閱", "温馨提示", "溫馨提示", "建議使用", "建议使用",
    "请勿贩卖", "請勿販賣", "请勿频繁切换", "請勿頻繁切換", "个人觀看", "個人觀看", "刀刀影院"
)
BLOCKED_M3U_KEYWORDS_NORMALIZED = tuple(
    normalize_text_for_match(keyword) for keyword in BLOCKED_M3U_KEYWORDS
)

CHANNEL_NAME_MARKERS = (
    "卫视", "衛視", "频道", "頻道", "台", "TV", "CCTV", "CGTN", "CHC",
    "影视", "影視", "电影", "電影", "新闻", "新聞", "综合", "綜合", "体育", "體育",
    "少儿", "少兒", "科教", "经济", "經濟", "生活", "都市", "公共", "纪实", "紀實",
    "卡通", "动画", "動漫", "戏曲", "戲曲", "文旅", "电视台", "電視台", "电视", "電視", "台", "TV",
)


def load_cctv_channels(file_path=".github/workflows/lptv/LPTV/CCTV.txt"):
    cctv_channels = set()
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                line = line.strip()
                if line:
                    cctv_channels.add(line)
    except FileNotFoundError:
        print(f"Error: The file {file_path} was not found.")
    return cctv_channels


def normalize_cctv_name(channel_name):
    return re.sub(r'(?i)CCTV[\s-]?(\d+\+?)', r'CCTV\1', channel_name).replace("＋", "+")


def is_cctv_channel(channel_name: str, normalized_channel: str, normalized_cctv_channels: Set[str]) -> bool:
    cctv_number_match = re.search(r'(?i)CCTV[\s-]?(\d+\+?)', channel_name)
    if cctv_number_match:
        channel_id = f"CCTV{cctv_number_match.group(1).upper()}"
        if channel_id in normalized_cctv_channels:
            return True
    if normalized_channel in normalized_cctv_channels:
        return True
    for token in normalized_cctv_channels:
        if len(token) >= 4 and token in normalized_channel:
            return True
    return False


def resolve_province_aliases(province_name: str) -> Set[str]:
    aliases = {province_name}
    aliases.update(PROVINCE_ALIASES.get(province_name, set()))
    return aliases


def simplify_channel_name(channel_name: str) -> str:
    simplified = re.sub(r"[（(【\[][^\])）】]{0,24}[)）】\]]", "", channel_name)
    simplified = re.sub(r"\b(?:IPV6|HEVC|H\.?265|H\.?264|HDR|UHD|FHD|HD|SD|\d{3,4}P|4K|8K)\b", "", simplified, flags=re.IGNORECASE)
    return simplified.strip()


def strip_common_channel_suffixes(token: str) -> str:
    value = token
    value = re.sub(r"(?:TV|BTV|NBTV|CETV)\d+$", "", value)
    value = re.sub(r"[0-9一二三四五六七八九十]+套?$", "", value)
    value = re.sub(r"(?:IPV6|HEVC|H265|H264|HDR|UHD|FHD|HD|SD|4K|8K)$", "", value)
    changed = True
    while changed and value:
        changed = False
        for suffix in COMMON_CHANNEL_SUFFIXES_NORMALIZED:
            if value.endswith(suffix) and len(value) > len(suffix) + 1:
                value = value[:-len(suffix)]
                changed = True
                break
    return value


def strip_quality_suffix(name: str) -> str:
    """去除频道名中的质量后缀，对齐 iptv-checker 4.1.2 行为
    例如: 'CCTV1 [HD]' -> 'CCTV1', '体育720p*' -> '体育'
    """
    s = name.strip()
    # 去除末尾括号内的质量标签：[HD], [4K], [FHD], [SD], (720p), (1080p) 等
    s = re.sub(r'\s*[\[（(][^\]）)]*(?:HD|4K|FHD|UHD|SD|720p|1080p|2160p|8K|HDR)[^\]）)]*[\]）)]', '', s, flags=re.IGNORECASE)
    # 去除末尾 * 号（多分辨率标记）
    s = s.rstrip('*').strip()
    return s


def extract_geo_tokens(channel_name: str, normalized_aliases: Set[str]) -> Set[str]:
    tokens: Set[str] = set()
    simplified = simplify_channel_name(channel_name)
    candidates = [simplified]
    candidates.extend(part for part in re.split(r"[|｜/\\\-_·•\s]+", simplified) if part)
    for candidate in candidates:
        normalized = normalize_text_for_match(candidate)
        if not normalized:
            continue
        trimmed = normalized
        for alias in sorted(normalized_aliases, key=len, reverse=True):
            if trimmed.startswith(alias) and len(trimmed) > len(alias) + 1:
                trimmed = trimmed[len(alias):]
                break
        trimmed = strip_common_channel_suffixes(trimmed).strip()
        if 2 <= len(trimmed) <= 8 and trimmed not in NON_GEO_TOKENS_NORMALIZED:
            tokens.add(trimmed)
    return tokens


def strip_suffix_once(name: str, suffixes: Iterable[str]) -> str:
    for suffix in sorted(suffixes, key=len, reverse=True):
        if name.endswith(suffix) and len(name) > len(suffix) + 1:
            return name[:-len(suffix)]
    return name


def normalize_province_name(name: str) -> str:
    return strip_suffix_once(re.sub(r"\s+", "", name), PROVINCE_SUFFIXES)


def geo_name_variants(name: str) -> Set[str]:
    cleaned = re.sub(r"\s+", "", name)
    if not cleaned:
        return set()
    variants = {cleaned}
    stripped = strip_suffix_once(cleaned, AREA_SUFFIXES)
    if stripped and stripped != cleaned:
        variants.add(stripped)
    return {v for v in variants if len(v) >= 2 and normalize_text_for_match(v) not in IGNORED_GEO_NAMES_NORMALIZED}


def iter_named_items(payload) -> Iterable[str]:
    if isinstance(payload, list):
        for item in payload:
            yield from iter_named_items(item)
    elif isinstance(payload, dict):
        name = payload.get("name")
        if isinstance(name, str) and name.strip():
            yield name.strip()
        has_known_children = False
        for key in ("children", "cities", "districts", "items", "list", "data"):
            child = payload.get(key)
            if child is not None:
                has_known_children = True
                yield from iter_named_items(child)
        if not has_known_children and "name" not in payload:
            for key, value in payload.items():
                if isinstance(key, str) and key.strip():
                    yield key.strip()
                if isinstance(value, (list, dict)):
                    yield from iter_named_items(value)


def build_province_lookup(province_channels: Dict[str, Set[str]]) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for province_key in province_channels:
        province_base = province_key.replace("频道", "")
        candidates = set(resolve_province_aliases(province_base))
        candidates.add(normalize_province_name(province_base))
        for candidate in candidates:
            normalized = normalize_text_for_match(normalize_province_name(candidate))
            if len(normalized) >= 2 and normalized not in lookup:
                lookup[normalized] = province_key
    return lookup


def collect_online_geo_tokens(geo_payload, province_channels: Dict[str, Set[str]]) -> Dict[str, Set[str]]:
    province_lookup = build_province_lookup(province_channels)
    added_tokens: Dict[str, Set[str]] = defaultdict(set)
    if isinstance(geo_payload, list):
        province_nodes = geo_payload
    elif isinstance(geo_payload, dict):
        if isinstance(geo_payload.get("children"), list):
            province_nodes = geo_payload["children"]
        else:
            province_nodes = [{"name": key, "children": value} for key, value in geo_payload.items() if isinstance(value, (list, dict))]
    else:
        return added_tokens
    for node in province_nodes:
        if not isinstance(node, dict):
            continue
        province_name = node.get("name")
        if not isinstance(province_name, str) or not province_name.strip():
            continue
        province_normalized = normalize_text_for_match(normalize_province_name(province_name))
        province_key = province_lookup.get(province_normalized)
        if not province_key:
            for key, matched_province in province_lookup.items():
                if key and (key in province_normalized or province_normalized in key):
                    province_key = matched_province
                    break
        if not province_key:
            continue
        for raw_name in iter_named_items(node.get("children", [])):
            for variant in geo_name_variants(raw_name):
                normalized_variant = normalize_text_for_match(variant)
                if len(normalized_variant) >= 2 and normalized_variant not in IGNORED_GEO_NAMES_NORMALIZED:
                    added_tokens[province_key].add(variant)
    return added_tokens


async def load_online_geo_tokens(session: aiohttp.ClientSession, province_channels: Dict[str, Set[str]]) -> Dict[str, Set[str]]:
    for url in ONLINE_GEO_DATA_URLS:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=CONFIG["timeout"])) as response:
                if response.status != 200:
                    continue
                raw_text = await response.text(errors="ignore")
                payload = json.loads(raw_text)
                tokens = collect_online_geo_tokens(payload, province_channels)
                if tokens:
                    total = sum(len(items) for items in tokens.values())
                    print(f"Loaded {total} online geo tokens from: {url}")
                    return tokens
        except Exception:
            continue
    return {}


def build_province_matchers(province_channels: Dict[str, Set[str]]) -> Dict[str, List[str]]:
    province_matchers: Dict[str, List[str]] = {}
    for province, channels in province_channels.items():
        patterns = set()
        province_base = province.replace("频道", "")
        aliases = resolve_province_aliases(province_base)
        normalized_aliases = {normalize_text_for_match(alias) for alias in aliases}
        for ch in channels:
            normalized = normalize_text_for_match(ch)
            for geo_token in extract_geo_tokens(ch, normalized_aliases):
                patterns.add(geo_token)
        for alias in aliases:
            normalized_alias = normalize_text_for_match(alias)
            if len(normalized_alias) >= 2:
                patterns.add(normalized_alias)
        province_matchers[province] = sorted(patterns, key=len, reverse=True)
    return province_matchers


def match_province(normalized_channel: str, province_matchers: Dict[str, List[str]]) -> Optional[str]:
    best_match_province = None
    best_score = 0
    for province, patterns in province_matchers.items():
        for pattern in patterns:
            if pattern in normalized_channel:
                score = len(pattern)
                if score > best_score:
                    best_score = score
                    best_match_province = province
                break
    return best_match_province


def match_smart_category(normalized_channel: str) -> Optional[str]:
    for category, keywords in SMART_CATEGORY_KEYWORDS_NORMALIZED.items():
        for keyword in keywords:
            if keyword and keyword in normalized_channel:
                return category
    if any(ch in normalized_channel for ch in SCENIC_SINGLE_CHAR_HINTS):
        if not any(token in normalized_channel for token in SCENIC_EXCLUDE_HINTS_NORMALIZED):
            return "文旅频道"
    return None


def natural_sort_key(text: str) -> Tuple[Any, ...]:
    parts = re.split(r"(\d+)", text)
    key: List[Any] = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part.lower())
    return tuple(key)


def cctv_sort_key(channel_name: str) -> Tuple[Any, ...]:
    match = re.search(r"(?i)CCTV[\s-]?(\d+)(\+?)", channel_name)
    if match:
        num = int(match.group(1))
        is_plus = 1 if match.group(2) == "+" else 0
        return (0, num, is_plus, natural_sort_key(channel_name))
    return (1, natural_sort_key(channel_name))


def channel_identity_key(channel: str) -> str:
    return normalize_text_for_match(normalize_cctv_name(channel))


# ─── 源质量监控 ────────────────────────────────────────────────

def _source_key(url: str) -> str:
    """取 URL 的路径部分作为缓存 key（忽略 protocol + 域名后路径）"""
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.netloc + parsed.path
    except Exception:
        return url


def load_source_quality_cache() -> Dict[str, Any]:
    path = CONFIG["source_quality_cache"]
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_source_quality_cache(cache: Dict[str, Any]) -> None:
    path = CONFIG["source_quality_cache"]
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def record_source_result(cache: Dict[str, Any], url: str, total: int, valid: int, failed: int,
                          avg_score: float = 0.0, avg_latency: float = 0.0) -> None:
    key = _source_key(url)
    prev = cache.get(key, {})
    prev["total_parsed"] = prev.get("total_parsed", 0) + total
    prev["total_valid"] = prev.get("total_valid", 0) + valid
    prev["total_failed"] = prev.get("total_failed", 0) + failed
    prev["last_run"] = time.strftime("%Y-%m-%d %H:%M")
    prev["last_success_ts"] = time.time() if valid > 0 else prev.get("last_success_ts", 0)
    prev["consecutive_zero"] = 0 if valid > 0 else prev.get("consecutive_zero", 0) + 1
    if avg_score > 0:
        prev["avg_score"] = avg_score
    if avg_latency > 0:
        prev["avg_latency"] = avg_latency
    cache[key] = prev


def is_source_deprecated(cache: Dict[str, Any], url: str) -> bool:
    key = _source_key(url)
    info = cache.get(key, {})
    if info.get("consecutive_zero", 0) >= CONFIG["max_consecutive_failures"]:
        return True
    # 超过7天未成功也视为潜在废弃
    last_success = info.get("last_success_ts", 0)
    if last_success and (time.time() - last_success) > CONFIG["cache_ttl_days"] * 86400:
        return True
    return False


def print_source_quality_summary(cache: Dict[str, Any], source_stats: List[Dict[str, Any]], all_latencies: List[float] = None) -> None:
    print("\n===== 源质量报告 =====")
    for s in sorted(source_stats, key=lambda x: -x["valid"]):
        key = _source_key(s["url"])
        info = cache.get(key, {})
        consec = info.get("consecutive_zero", 0)
        avg_score = s.get("avg_score", 0.0)
        avg_lat = s.get("avg_latency", 0.0)
        status = "✅" if s["valid"] > 0 else ("⚠️ 连续失效" if consec > 0 else "❌")
        extra = f" 均分{avg_score:.2f} 均延迟{avg_lat:.2f}s" if s["valid"] > 0 else ""
        print(f"  {status} {s['url']}: 解析{s['total']}条 → 有效{s['valid']}条 (连续零有效: {consec}){extra}")
    total_valid = sum(s['valid'] for s in source_stats)
    print(f"  合计: 有效流 {total_valid} 条")
    # 全局延迟分位数统计
    if all_latencies and len(all_latencies) >= 3:
        sorted_lat = sorted(all_latencies)
        n = len(sorted_lat)
        p50 = sorted_lat[int(n * 0.5)]
        p90 = sorted_lat[min(int(n * 0.9), n - 1)]
        p99 = sorted_lat[min(int(n * 0.99), n - 1)]
        print(f"  全局延迟: p50={p50:.2f}s  p90={p90:.2f}s  p99={p99:.2f}s  (样本{n}个)")
    print("=" * 22)


async def discover_new_sources(session: aiohttp.ClientSession, current_urls: List[str]) -> List[str]:
    """发现高质量新源：GitHub 热门仓库 + tonkiang.us 搜索引擎 + 补充源列表"""
    new_urls: List[str] = []
    seen_keys = {_source_key(u) for u in current_urls}

    # ── GitHub 热门仓库 ──────────────────────────────────────────────
    github_candidates = [
        ("xisohi/CHINA-IPTV", "Unicast/guangdong.m3u8"),
        ("xisohi/CHINA-IPTV", "Unicast/sichuan.m3u8"),
        ("xisohi/CHINA-IPTV", "Unicast/zhejiang.m3u8"),
        ("xisohi/CHINA-IPTV", "Unicast/jiangsu.m3u8"),
        ("lxhfans/iptv", "main/ipv4.m3u8"),
        ("kujin1an/iptv", "main/live.m3u8"),
        ("holywmtv/iPTV", "master/live.m3u8"),
        ("ssili198/IPTV", "master/live.m3u8"),
        ("yuanzl77/IPTV", "master/live.m3u8"),
        ("yuanzl77/IPTV", "master/ipv4.m3u"),
        # 新增：更多活跃维护的源
        ("bbsting/iptv", "master/all.m3u8"),
        ("asdjklol/iptv", "live.m3u8"),
        ("fanmingming/live", "main/tv/m3u/ipv6.m3u"),
    ]
    print("  [discover] 检查 GitHub 潜在新源...")
    for owner_repo, file_path in github_candidates:
        url = f"https://raw.githubusercontent.com/{owner_repo}/{file_path}"
        if _source_key(url) in seen_keys:
            continue
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=6), allow_redirects=True) as resp:
                if resp.status == 200:
                    body = await resp.text(errors="ignore")
                    stream_count = sum(1 for line in body.splitlines() if line.startswith(('http://', 'https://')))
                    if stream_count >= CONFIG["min_source_streams"]:
                        print(f"  [discover] ✅ GitHub 新源: {owner_repo} ({stream_count} 条)")
                        new_urls.append(url)
                        seen_keys.add(_source_key(url))
        except Exception:
            pass

    # ── tonkiang.us 搜索引擎（文章推荐） ────────────────────────────
    print("  [discover] 扫描 tonkiang.us 搜索引擎...")
    try:
        search_keywords = ["CCTV", "卫视", "体育", "电影", "新闻"]
        for kw in search_keywords:
            await _scrape_tonkiang(session, kw, new_urls, seen_keys)
    except Exception as e:
        print(f"  [discover] tonkiang.us 搜索失败: {e}")

    # ── 恩山论坛 & 其他社区 ─────────────────────────────────────────
    enshan_candidates = [
        "https://raw.githubusercontent.com/wwgk/iptv/master/tv/m3u/%E5%85%A8%E9%83%A8.m3u8",
        "https://raw.githubusercontent.com/wwgk/iptv/master/tv/m3u/CCTV.m3u8",
        "https://raw.githubusercontent.com/yuanzl77/IPTV/master/live.m3u8",
    ]
    print("  [discover] 检查社区补充源...")
    for url in enshan_candidates:
        if _source_key(url) in seen_keys:
            continue
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=6), allow_redirects=True) as resp:
                if resp.status == 200:
                    body = await resp.text(errors="ignore")
                    stream_count = sum(1 for line in body.splitlines() if line.startswith(('http://', 'https://')))
                    if stream_count >= CONFIG["min_source_streams"]:
                        print(f"  [discover] ✅ 社区新源: {url} ({stream_count} 条)")
                        new_urls.append(url)
                        seen_keys.add(_source_key(url))
        except Exception:
            pass

    return new_urls


async def _scrape_tonkiang(session: aiohttp.ClientSession, keyword: str, new_urls: List[str], seen_keys: set):
    """从 tonkiang.us 搜索 IPTV 源（文章推荐的方法）"""
    base_url = "http://tonkiang.us/"
    search_url = f"{base_url}?name={keyword}"
    try:
        async with session.get(search_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                return
            html = await resp.text(errors="ignore")
        # 解析搜索结果中的 m3u8/txt 链接
        import re as _re
        links = _re.findall(r'href="(https?://[^"]+\.m3u8?[^"]*)"', html)
        links += _re.findall(r'href="(https?://[^"]+\.txt[^"]*)"', html)
        for link in links[:5]:  # 每关键词最多取 5 个
            if _source_key(link) in seen_keys:
                continue
            try:
                async with session.get(link, timeout=aiohttp.ClientTimeout(total=6), allow_redirects=True) as r:
                    if r.status == 200:
                        body = await r.text(errors="ignore")
                        sc = sum(1 for line in body.splitlines() if line.startswith(('http://', 'https://')))
                        if sc >= CONFIG["min_source_streams"]:
                            print(f"  [discover] ✅ tonkiang 新源 [{keyword}]: {link} ({sc} 条)")
                            new_urls.append(link)
                            seen_keys.add(_source_key(link))
            except Exception:
                pass
    except Exception:
        pass


def looks_like_notice_entry(channel: str, source_group_title: Optional[str] = None) -> bool:
    haystacks = [channel]
    if source_group_title:
        haystacks.append(source_group_title)
    for text in haystacks:
        raw_text = str(text or "").strip()
        if not raw_text:
            continue
        lowered = raw_text.casefold()
        if any(keyword.casefold() in lowered for keyword in BLOCKED_M3U_KEYWORDS):
            return True
        normalized = normalize_text_for_match(raw_text)
        if normalized and any(keyword in normalized for keyword in BLOCKED_M3U_KEYWORDS_NORMALIZED):
            return True
    return False


def _cleanup_extinf_payload(text: str) -> str:
    cleaned = str(text or "")
    cleaned = re.sub(r"https?://[^\s\"',]+", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"""(?ix)\b(?:tvg-id|tvg-name|tvg-logo|group-title|catchup|catchup-source|x-tvg-url)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s,]+)""", " ", cleaned)
    cleaned = cleaned.replace("#EXTINF:-1", " ").replace(",", " ").replace('"', " ").replace("'", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _extract_channel_candidates(text: str) -> List[str]:
    candidates: List[str] = []
    raw_source = str(text or "")
    source = _cleanup_extinf_payload(raw_source)
    raw_without_urls = re.sub(r"https?://[^\s\"',]+", " ", raw_source, flags=re.IGNORECASE)
    if not raw_source and not source:
        return candidates
    patterns = [
        r"(?i)CCTV[\s-]?\d+\+?",
        r"(?i)(?:CGTN|CHC)[A-Z0-9+\-]*",
        r"[\u4e00-\u9fffA-Za-z0-9+]{1,24}(?:卫视|衛視|频道|頻道|影视|影視頻道|电影|電影|新闻|新聞|综合|綜合|体育|體育|少儿|少兒|科教|经济|經濟|生活|都市|公共|纪实|紀實|卡通|动画|動漫|戏曲|戲曲|文旅|电视台|電視台|电视|電視|台|TV)",
    ]
    for candidate_source in (raw_without_urls, source):
        if not candidate_source:
            continue
        for pattern in patterns:
            for match in re.findall(pattern, candidate_source):
                value = re.sub(r"\s+", "", match).strip("\"' ,")
                if value and len(value) <= 24:
                    candidates.append(value)
    token_source = _cleanup_extinf_payload(raw_without_urls)
    for token in re.split(r"[\s|/]+", token_source):
        token = token.strip("\"' ,")
        if 2 <= len(token) <= 16 and any(marker.lower() in token.lower() for marker in CHANNEL_NAME_MARKERS):
            candidates.append(token)
    return candidates


def sanitize_channel_name(channel: str, extinf_line: Optional[str] = None) -> str:
    raw_channel = str(channel or "").strip()
    if not raw_channel:
        return "Unknown"
    needs_repair = any(marker in raw_channel for marker in ("tvg-id=", "tvg-name=", "tvg-logo=", "group-title="))
    candidates: List[str] = []
    if needs_repair:
        candidates.extend(_extract_channel_candidates(raw_channel))
        if extinf_line:
            candidates.extend(_extract_channel_candidates(extinf_line))
    if candidates:
        scored = Counter(candidates)
        best_candidate = sorted(scored.items(), key=lambda item: (-item[1], 0 if any(marker.lower() in item[0].lower() for marker in CHANNEL_NAME_MARKERS) else 1, len(item[0])))[0][0]
        return best_candidate
    cleaned = raw_channel.strip("\"' ,")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or "Unknown"


def parse_group_title_from_extinf(extinf_line: str) -> Optional[str]:
    patterns = [
        r'group-title\s*=\s*"([^"]+)"',
        r"group-title\s*=\s*'([^']+)'",
        r"group-title\s*=\s*([^,\s]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, extinf_line, flags=re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def infer_group_from_upstream_title(source_group_title: Optional[str], province_matchers: Dict[str, List[str]]) -> Optional[str]:
    if not source_group_title:
        return None
    raw_title = source_group_title.strip()
    normalized = normalize_text_for_match(raw_title)
    if not normalized:
        return None
    if any(token in normalized for token in ("CCTV", "CGTN", "CHC")) or "央视" in raw_title:
        return "央视频道"
    if "卫视" in raw_title:
        return "卫视频道"
    province = match_province(normalized, province_matchers)
    if province:
        return province
    smart_category = match_smart_category(normalized)
    if smart_category:
        return smart_category
    return None


def deduplicate_candidate_entries(entries: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduplicated: List[Dict[str, Any]] = []
    seen: Set[Tuple[str, str]] = set()
    for entry in entries:
        channel = sanitize_channel_name(str(entry.get("channel", "")).strip())
        url = str(entry.get("url", "")).strip()
        if not channel or not url.startswith(("http://", "https://")):
            continue
        if not is_valid_channel_name(channel):
            continue
        if looks_like_notice_entry(channel, entry.get("source_group_title")):
            continue
        key = (channel_identity_key(channel), url)
        if key in seen:
            continue
        seen.add(key)
        normalized_entry = dict(entry)
        normalized_entry["channel"] = channel
        normalized_entry["url"] = url
        deduplicated.append(normalized_entry)
    return deduplicated


def choose_better_entry(current_best: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    """优先选择质量评分更高、延迟更低的源"""
    best_score = current_best.get("quality_score", 0.0)
    cand_score = candidate.get("quality_score", 0.0)
    best_latency = current_best.get("latency")
    cand_latency = candidate.get("latency")
    # 综合分：质量分 60% + 延迟归一化 40%
    def composite(e):
        s = e.get("quality_score", 0.0)
        lat = e.get("latency") if isinstance(e.get("latency"), (int, float)) else 5.0
        lat_norm = max(0.0, 1.0 - lat / 5.0)  # 5s 以内线性归一化
        return s * 0.6 + lat_norm * 0.4, -lat if lat else -999

    best_key = composite(current_best)
    cand_key = composite(candidate)
    if cand_key > best_key:
        return candidate
    return current_best


def select_best_streams(valid_entries: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    best_by_channel: Dict[str, Dict[str, Any]] = {}
    for entry in valid_entries:
        channel = sanitize_channel_name(str(entry.get("channel", "")).strip())
        url = str(entry.get("url", "")).strip()
        if not channel or not url:
            continue
        key = channel_identity_key(channel)
        current = best_by_channel.get(key)
        if current is None:
            best_by_channel[key] = dict(entry)
        else:
            best_by_channel[key] = choose_better_entry(current, entry)
    selected = list(best_by_channel.values())
    selected.sort(key=lambda x: natural_sort_key(str(x.get("channel", ""))))
    return selected


def select_multi_streams(valid_entries: Iterable[Dict[str, Any]], max_per_channel: int = 5) -> Dict[str, List[Dict[str, Any]]]:
    """保留每个频道最多 max_per_channel 条有效源，按质量评分+延迟排序"""
    by_channel: Dict[str, List[Dict[str, Any]]] = {}
    for entry in valid_entries:
        channel = sanitize_channel_name(str(entry.get("channel", "")).strip())
        url = str(entry.get("url", "")).strip()
        if not channel or not url:
            continue
        key = channel_identity_key(channel)
        by_channel.setdefault(key, []).append(dict(entry))
    result: Dict[str, List[Dict[str, Any]]] = {}
    for key, entries in by_channel.items():
        def sort_key(e):
            score = e.get("quality_score", 0.0)
            lat = e.get("latency") if isinstance(e.get("latency"), (int, float)) else 999.0
            https_bonus = 0 if str(e.get("url", "")).startswith("https://") else 1
            return (-score, lat, https_bonus)
        entries.sort(key=sort_key)
        result[key] = entries[:max_per_channel]
    return result


def extract_urls_from_txt(content):
    """增强 TXT 解析：支持逗号、竖线、制表符分隔，跳过注释行"""
    urls: List[Dict[str, Any]] = []
    for line in content.splitlines():
        line = line.strip()
        # 跳过空行和注释
        if not line or line.startswith('#'):
            continue
        # 尝试多种分隔符
        found = False
        for sep in (',', '|', '\t'):
            if sep in line:
                parts = line.split(sep, 1)
                channel = sanitize_channel_name(parts[0].strip())
                url = parts[1].strip()
                if url and not looks_like_notice_entry(channel):
                    urls.append({"channel": channel, "url": url, "source_group_title": None})
                found = True
                break
        if not found and line.startswith(('http://', 'https://')):
            urls.append({"channel": "Unknown", "url": line, "source_group_title": None})
    return urls


def extract_urls_from_m3u(content):
    """增强 M3U 解析：处理续行、EXT-X-STREAM-INF 标签"""
    urls: List[Dict[str, Any]] = []
    lines = content.splitlines()
    channel = "Unknown"
    extinf_line = ""
    source_group_title = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # 处理续行
        while line.endswith('\\') and i + 1 < len(lines):
            line = line[:-1] + lines[i + 1].strip()
            i += 1
        if line.startswith("#EXTINF:"):
            extinf_line = line
            parts = line.split(',', 1)
            raw_channel = parts[1] if len(parts) > 1 else "Unknown"
            channel = sanitize_channel_name(raw_channel, extinf_line)
            source_group_title = parse_group_title_from_extinf(line)
        elif line.startswith("#EXT-X-STREAM-INF"):
            # HLS variant stream，跳过元数据行，查找实际 URL
            i += 1
            while i < len(lines) and lines[i].strip().startswith('#'):
                i += 1
            if i < len(lines):
                url_line = lines[i].strip()
                if url_line and not url_line.startswith('#'):
                    if not looks_like_notice_entry(channel, source_group_title):
                        urls.append({"channel": channel.strip(), "url": url_line, "source_group_title": source_group_title})
            i -= 1  # 补偿下面的 i += 1
        elif line.startswith(('http://', 'https://')):
            if not looks_like_notice_entry(channel, source_group_title):
                urls.append({"channel": channel.strip(), "url": line.strip(), "source_group_title": source_group_title})
        i += 1
    return urls


def filter_invalid_protocols(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """过滤掉浏览器无法播放的协议（RTP/RTSP/UDP 组播等）和危险协议"""
    return [e for e in entries 
            if not INVALID_PROTOCOL_PATTERNS.match(str(e.get("url", "")))
            and not DANGEROUS_PROTOCOL_PATTERNS.match(str(e.get("url", "")))]


def is_valid_channel_name(channel: str) -> bool:
    """验证频道名是否有效"""
    if not channel or channel == "Unknown":
        return False
    if len(channel) < 2 or len(channel) > 50:
        return False
    # 过滤纯数字
    if channel.strip('0123456789'):
        pass  # 有非数字字符，合法
    else:
        return False  # 纯数字
    return True


async def test_stream(session: aiohttp.ClientSession, semaphore: asyncio.Semaphore, url: str):
    """测速并验证流内容质量（增强版：GET 部分探测 + 质量评分）"""
    async with semaphore:
        for attempt in range(CONFIG["max_retries"]):
            start_time = time.time()
            quality_info = {"latency": None, "content_length": 0, "content_type": "", "redirect_count": 0, "score": 0.0}
            try:
                # HEAD 快速探测
                async with session.head(url, timeout=aiohttp.ClientTimeout(total=CONFIG["stream_test_timeout"]),
                                        allow_redirects=True) as response:
                    elapsed_time = time.time() - start_time
                    quality_info["redirect_count"] = response.history.__len__()
                    content_type = response.headers.get('Content-Type', '').lower()
                    quality_info["content_type"] = content_type
                    # 允许有效的视频类型或为空（m3u8 playlist 通常无 content-type）
                    is_valid_content = not content_type or any(
                        ct in content_type for ct in VALID_CONTENT_TYPES
                    )
                    if response.status == 200 and is_valid_content:
                        quality_info["latency"] = elapsed_time
                        # HEAD 无法获取 Content-Length，尝试短 GET 探测
                        cl = await _get_partial_content_length(session, url, elapsed_time)
                        quality_info["content_length"] = cl
                        quality_info["score"] = _compute_quality_score(quality_info)
                        return True, quality_info
                    elif response.status != 200:
                        if attempt == CONFIG["max_retries"] - 1:
                            return False, None
                        await asyncio.sleep(0.3 * (attempt + 1))
                        continue
                # HEAD 被拒绝时回退到短 GET 探测（前 4KB）
                if CONFIG["stream_content_verify"]:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=CONFIG["stream_test_timeout"]),
                                            allow_redirects=True) as response:
                        elapsed_time = time.time() - start_time
                        content_type = response.headers.get('Content-Type', '').lower()
                        quality_info["redirect_count"] = len(response.history)
                        quality_info["content_type"] = content_type
                        body = await response.read(4096)
                        quality_info["content_length"] = len(body)
                        is_valid_content = not content_type or any(
                            ct in content_type for ct in VALID_CONTENT_TYPES
                        )
                        if response.status == 200 and is_valid_content:
                            quality_info["latency"] = elapsed_time
                            quality_info["score"] = _compute_quality_score(quality_info)
                            return True, quality_info
                        return False, None
            except asyncio.TimeoutError:
                if attempt == CONFIG["max_retries"] - 1:
                    return False, None
                await asyncio.sleep(0.3 * (attempt + 1))
            except Exception:
                if attempt == CONFIG["max_retries"] - 1:
                    return False, None
                await asyncio.sleep(0.3 * (attempt + 1))


async def _get_partial_content_length(session: aiohttp.ClientSession, url: str, base_latency: float) -> int:
    """用短 GET 探测 Content-Length，不读取 body"""
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=3), allow_redirects=True) as resp:
            cl = resp.headers.get('Content-Length')
            return int(cl) if cl else 0
    except Exception:
        return 0


def _compute_quality_score(info: Dict[str, Any]) -> float:
    """综合质量评分：延迟低 + 内容长度合理 + 有效视频类型 = 高分"""
    latency = info.get("latency") or 999.0
    cl = info.get("content_length", 0)
    ct = info.get("content_type", "")
    # 延迟分：0~1s=1.0, 1~3s=0.6, 3~5s=0.3, >5s=0.0
    if latency <= 1.0:
        latency_score = 1.0
    elif latency <= 3.0:
        latency_score = 0.6
    elif latency <= 5.0:
        latency_score = 0.3
    else:
        latency_score = 0.0
    # 内容长度分：m3u8 通常很小（<50KB），视频分片较大；过小的 body 可能是错误页
    if cl > 100_000:
        cl_score = 0.8
    elif cl > 10_000:
        cl_score = 0.6
    elif cl > 1_000:
        cl_score = 0.4
    elif cl > 0:
        cl_score = 0.2
    else:
        cl_score = 0.3  # HEAD 探测无法获取 CL，给中等分数
    # 类型分：m3u8 playlist 或视频流给高分
    ct_score = 0.9 if any(t in ct for t in ('mpegurl', 'mp2t', 'mp4', 'video', 'audio')) else 0.5
    return round(latency_score * 0.5 + cl_score * 0.2 + ct_score * 0.3, 2)


# ─── HLS 分辨率 & 码率解析 ────────────────────────────────────────

# 分辨率等级映射（与 flybird-iptv / iptv-checker 对齐）
RESOLUTION_RATINGS = {
    "480p": 1, "576p": 2, "720p": 3, "HD": 3,
    "1080p": 4, "FHD": 4, "1080i": 4,
    "1440p": 5, "2K": 5, "QHD": 5,
    "2160p": 6, "4K": 6, "UHD": 6,
    "4320p": 7, "8K": 7,
}


def parse_hls_resolution_from_url(stream_url: str) -> Optional[Tuple[str, int]]:
    """从 HLS manifest URL 提取分辨率和码率，返回 (resolution_label, bandwidth_kbps) 或 None"""
    parsed = urllib.parse.urlparse(stream_url)
    if not (parsed.scheme in ('http', 'https') and
            ('.m3u8' in parsed.path.lower() or 'm3u8' in stream_url)):
        return None
    return None  # 懒加载：在 test_stream 成功后再单独获取


async def fetch_hls_manifest_info(session: aiohttp.ClientSession, url: str) -> Dict[str, Any]:
    """拉取 HLS manifest，解析最高分辨率和码率（单线程，避免过多请求）"""
    info = {"resolution": None, "bandwidth_kbps": None, "variant_count": 0}
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=5), allow_redirects=True) as resp:
            if resp.status != 200:
                return info
            text = await resp.text(errors="ignore")
        # 解析所有变体流的 RESOLUTION 和 BANDWIDTH
        resolutions = re.findall(r'RESOLUTION=(\d+x\d+)', text)
        bandwidths = re.findall(r'BANDWIDTH=(\d+)', text)
        # 找最高分辨率
        best_res = None
        best_res_value = 0
        for r in resolutions:
            try:
                w, h = r.split('x')
                pixels = int(w) * int(h)
                if pixels > best_res_value:
                    best_res_value = pixels
                    # 标准化分辨率标签
                    max_dim = max(int(w), int(h))
                    if max_dim >= 3840:
                        best_res = "4K"
                    elif max_dim >= 1920:
                        best_res = "1080p"
                    elif max_dim >= 1280:
                        best_res = "720p"
                    elif max_dim >= 720:
                        best_res = "480p"
                    else:
                        best_res = "SD"
            except Exception:
                pass
        # 取最高码率
        if bandwidths:
            try:
                max_bw = max(int(b) for b in bandwidths)
                info["bandwidth_kbps"] = round(max_bw / 1000)
            except Exception:
                pass
        info["resolution"] = best_res
        info["variant_count"] = len(resolutions)
    except Exception:
        pass
    return info


def hls_resolution_boost(existing_score: float, resolution: Optional[str], bandwidth_kbps: Optional[int]) -> float:
    """根据分辨率和码率调整质量分：高分辨率+高码率加分，低质量降权"""
    if resolution is None or bandwidth_kbps is None:
        return existing_score
    boost = 0.0
    # 分辨率加分
    rating = RESOLUTION_RATINGS.get(resolution, 0)
    if rating >= 4:  # 720p+
        boost += 0.05
    if rating >= 6:  # 4K+
        boost += 0.03
    # 码率惩罚：过低码率（可能是低质转码源）
    if bandwidth_kbps < CONFIG["min_bandwidth_kbps"]:
        boost -= 0.1
    elif bandwidth_kbps < 200:
        boost -= 0.03
    return round(min(1.0, max(0.0, existing_score + boost)), 2)


async def test_multiple_streams(session: aiohttp.ClientSession, semaphore: asyncio.Semaphore, entries: Iterable[Dict[str, Any]]):
    tasks = [test_stream(session, semaphore, str(entry.get("url", "")).strip()) for entry in entries]
    results = await asyncio.gather(*tasks)
    return results


async def read_and_test_file(session: aiohttp.ClientSession, semaphore: asyncio.Semaphore, file_path: str, is_m3u: bool = False, quality_cache: Optional[Dict[str, Any]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """解析源文件、过滤无效协议、测速（含质量评分 + HLS分辨率探测），返回有效条目和本次源质量统计"""
    result: Dict[str, Any] = {"url": file_path, "total": 0, "valid": 0, "filtered_protocol": 0, "failed": 0,
                               "avg_score": 0.0, "avg_latency": 0.0, "resolutions": {}, "bandwidths": []}
    try:
        async with session.get(file_path, timeout=aiohttp.ClientTimeout(total=CONFIG["timeout"])) as response:
            if response.status != 200:
                print(f"  [warn] {file_path}: HTTP {response.status}")
                return [], result
            content = await response.text(errors="ignore")
        if not content or len(content) < 10:
            print(f"  [warn] {file_path}: 内容为空或过短 ({len(content)} bytes)")
            return [], result
        if is_m3u:
            entries = extract_urls_from_m3u(content)
        else:
            entries = extract_urls_from_txt(content)
        entries = deduplicate_candidate_entries(entries)
        result["total"] = len(entries)
        # 过滤 RTP/RTSP/UDP 组播等浏览器无法播放的协议
        before_filter = len(entries)
        entries = filter_invalid_protocols(entries)
        result["filtered_protocol"] = before_filter - len(entries)
        # 限制每个源最多测试的流数，避免超时
        if len(entries) > CONFIG["max_streams_per_source"]:
            print(f"  [limit] {file_path}: 截断至前 {CONFIG['max_streams_per_source']} 条测速（共 {len(entries)} 条）")
            entries = entries[:CONFIG["max_streams_per_source"]]
        if not entries:
            print(f"  [skip] {file_path}: 无可用 HTTP 流（{before_filter} 条全为组播/无效协议）")
            return [], result
        valid_entries: List[Dict[str, Any]] = []
        results = await test_multiple_streams(session, semaphore, entries)
        latencies, scores = [], []
        # HLS manifest 懒解析：只对 m3u8 URL 批量获取分辨率（避免每个流单独请求）
        hls_urls_to_parse: List[str] = []
        for (is_valid, quality), entry in zip(results, entries):
            if is_valid and quality:
                latencies.append(quality.get("latency") or 0)
                scores.append(quality.get("score") or 0)
                url = entry["url"]
                entry_data = {
                    "channel": entry["channel"],
                    "url": url,
                    "source_group_title": entry.get("source_group_title"),
                    "latency": quality.get("latency"),
                    "quality_score": quality.get("score", 0.0),
                    "content_length": quality.get("content_length", 0),
                    "content_type": quality.get("content_type", ""),
                    "resolution": None,
                    "bandwidth_kbps": None,
                }
                # 标记 m3u8 URL 需要后续解析分辨率
                if '.m3u8' in url.lower() or 'm3u8' in url:
                    hls_urls_to_parse.append(url)
                valid_entries.append(entry_data)
                result["valid"] += 1
            else:
                result["failed"] += 1
        if latencies:
            result["avg_latency"] = round(sum(latencies) / len(latencies), 3)
        if scores:
            result["avg_score"] = round(sum(scores) / len(scores), 2)
        # 批量获取 HLS 分辨率信息（去重后并发请求）
        if hls_urls_to_parse:
            unique_hls = list(dict.fromkeys(hls_urls_to_parse))
            print(f"  [hls] 解析 {len(unique_hls)} 个 HLS manifest 分辨率...")
            hls_tasks = [fetch_hls_manifest_info(session, u) for u in unique_hls]
            hls_results = await asyncio.gather(*hls_tasks, return_exceptions=True)
            for url, hls_info in zip(unique_hls, hls_results):
                if isinstance(hls_info, dict):
                    result["resolutions"][url] = hls_info
                    if hls_info.get("bandwidth_kbps"):
                        result["bandwidths"].append(hls_info["bandwidth_kbps"])
            success_count = sum(1 for r in hls_results if isinstance(r, dict) and r.get("resolution"))
            print(f"  [hls] 成功解析 {success_count}/{len(unique_hls)} 个 manifest")
        # 应用 HLS 分辨率调整到 valid_entries
        for entry in valid_entries:
            url = entry["url"]
            res_info = result["resolutions"].get(url, {})
            res = res_info.get("resolution")
            bw = res_info.get("bandwidth_kbps")
            entry["resolution"] = res
            entry["bandwidth_kbps"] = bw
            if res or bw:
                entry["quality_score"] = hls_resolution_boost(entry["quality_score"], res, bw)
        if quality_cache is not None:
            record_source_result(quality_cache, file_path, result["total"], result["valid"], result["failed"],
                                 avg_score=result.get("avg_score", 0.0), avg_latency=result.get("avg_latency", 0.0))
        return valid_entries, result
    except Exception as e:
        print(f"  [error] {file_path}: {type(e).__name__}: {str(e)[:50]}")
        return [], result


def generate_sorted_m3u(valid_entries, cctv_channels, province_channels, filename):
    cctv_channels_list = []
    province_channels_list = defaultdict(list)
    satellite_channels = []
    smart_category_channels = defaultdict(list)
    other_channels = []
    normalized_cctv_channels = {normalize_text_for_match(normalize_cctv_name(name)) for name in cctv_channels}
    province_matchers = build_province_matchers(province_channels)

    for entry in valid_entries:
        channel = strip_quality_suffix(str(entry.get("channel", "")).strip())
        url = str(entry.get("url", "")).strip()
        source_group_title = entry.get("source_group_title")
        if not channel or not url:
            continue
        if contains_date(channel) or contains_date(url):
            continue
        normalized_channel = normalize_text_for_match(normalize_cctv_name(channel))
        upstream_group = infer_group_from_upstream_title(source_group_title, province_matchers)
        item = {
            "channel": channel,
            "url": url,
            "logo": f"logos/{sanitize_filename(channel)}.png",
            "logo_url": f"https://raw.githubusercontent.com/fanmingming/live/main/tv/{sanitize_filename(channel)}.png",
            "group_title": None,
            "quality_score": entry.get("quality_score", 0.0),
            "latency": entry.get("latency"),
            "resolution": entry.get("resolution"),
            "bandwidth_kbps": entry.get("bandwidth_kbps"),
        }
        if is_cctv_channel(channel, normalized_channel, normalized_cctv_channels) or upstream_group == "央视频道":
            item["group_title"] = "央视频道"
            cctv_channels_list.append(item)
        elif "卫视" in channel or upstream_group == "卫视频道":
            item["group_title"] = "卫视频道"
            satellite_channels.append(item)
        else:
            province = match_province(normalized_channel, province_matchers)
            if province:
                item["group_title"] = province
                province_channels_list[province].append(item)
            else:
                smart_category = upstream_group if upstream_group in SMART_CATEGORY_KEYWORDS else match_smart_category(normalized_channel)
                if smart_category and smart_category in SMART_CATEGORY_KEYWORDS:
                    item["group_title"] = smart_category
                    smart_category_channels[smart_category].append(item)
                else:
                    item["group_title"] = "其他频道"
                    other_channels.append(item)

    cctv_channels_list.sort(key=lambda x: cctv_sort_key(x["channel"]))
    for province in province_channels_list:
        province_channels_list[province].sort(key=lambda x: natural_sort_key(x["channel"]))
    for smart_category in smart_category_channels:
        smart_category_channels[smart_category].sort(key=lambda x: natural_sort_key(x["channel"]))
    satellite_channels.sort(key=lambda x: natural_sort_key(x["channel"]))
    other_channels.sort(key=lambda x: natural_sort_key(x["channel"]))

    all_channels = cctv_channels_list + satellite_channels + \
                   [channel for province in sorted(province_channels_list) for channel in province_channels_list[province]] + \
                   [channel for smart_category in SMART_CATEGORY_KEYWORDS for channel in smart_category_channels.get(smart_category, [])] + \
                   other_channels

    # 按频道名分组，同名的多条源输出为连续 block
    channel_groups: Dict[str, List[Dict[str, Any]]] = {}
    for item in all_channels:
        channel_groups.setdefault(item["channel"], []).append(item)

    m3u8_filename = filename.replace('.m3u', '.m3u8')
    generated_at = time.strftime("%Y-%m-%d %H:%M:%S %Z", time.localtime())
    unique_count = len(channel_groups)

    # ── IPv4/IPv6 分离导出（对齐 iptv-checker 4.4.0）───────────────────
    ipv4_items, ipv6_items = [], []
    for item in all_channels:
        if item["url"].startswith("https://"):
            ipv6_items.append(item)
        else:
            ipv4_items.append(item)

    def _write_m3u(f, channels, gen_time, count):
        f.write("#EXTM3U\n")
        f.write(f"# Generated-Time: {gen_time}\n")
        f.write(f"# Channel-Count: {count}\n")
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for item in channels:
            groups.setdefault(item["channel"], []).append(item)
        for channel_name, items in groups.items():
            logo = items[0]["logo"]
            group_title = items[0]["group_title"]
            resolution_tag = items[0].get("resolution")
            for item in items:
                q = item.get("quality_score", 0.0)
                lat = item.get("latency") or 0
                bw = item.get("bandwidth_kbps")
                extra_parts = []
                if q > 0:
                    extra_parts.append(f'tvg-quality="{q:.2f}"')
                if lat > 0:
                    extra_parts.append(f'tvg-latency="{lat:.3f}"')
                if bw:
                    extra_parts.append(f'tvg-bandwidth="{bw}"')
                extra = f' {" ".join(extra_parts)}' if extra_parts else ""
                display_name = channel_name
                if resolution_tag:
                    display_name = f"{channel_name} [{resolution_tag}]"
                f.write(f"#EXTINF:-1 tvg-name=\"{channel_name}\" tvg-logo=\"{logo}\" group-title=\"{group_title}\"{extra},{display_name}\n")
                f.write(f"{item['url']}\n")

    with open(filename, 'w', encoding='utf-8') as f:
        _write_m3u(f, all_channels, generated_at, unique_count)
    with open(m3u8_filename, 'w', encoding='utf-8') as f:
        _write_m3u(f, all_channels, generated_at, unique_count)

    # IPv4 / IPv6 分别导出
    if ipv4_items:
        ipv4_file = filename.replace('.m3u', '.ipv4.m3u')
        with open(ipv4_file, 'w', encoding='utf-8') as f:
            _write_m3u(f, ipv4_items, generated_at, len(ipv4_items))
        print(f"  [export] IPv4: {len(ipv4_items)} 条 → {ipv4_file}")
    if ipv6_items:
        ipv6_file = filename.replace('.m3u', '.ipv6.m3u')
        with open(ipv6_file, 'w', encoding='utf-8') as f:
            _write_m3u(f, ipv6_items, generated_at, len(ipv6_items))
        print(f"  [export] IPv6: {len(ipv6_items)} 条 → {ipv6_file}")

    return all_channels


async def download_logos(channels: List[Dict[str, Any]], semaphore: asyncio.Semaphore, session: aiohttp.ClientSession):
    """并行下载所有频道台标到本地 logos/ 目录，文件名与 m3u8 tvg-logo 字段严格一致"""
    logo_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), 'logos')
    os.makedirs(logo_dir, exist_ok=True)
    downloaded = 0
    async def fetch_one(ch: Dict[str, Any]):
        nonlocal downloaded
        # ch['logo'] 格式为 "logos/CCTV1.png"（本地相对路径），fanmingming 原始 URL 存于 ch.get('logo_url')
        # 若没有 logo_url，尝试从 GitHub 镜像反向构造
        fanming_url = ch.get('logo_url', '')
        if not fanming_url:
            # fallback：从 ch['logo'] 路径还原 fanmingming CDN 地址
            channel_name = ch['channel'].strip()
            fanming_url = f"https://raw.githubusercontent.com/fanmingming/live/main/tv/{sanitize_filename(channel_name)}.png"
        if not fanming_url or not fanming_url.startswith('https://'):
            return
        local_path = os.path.join(logo_dir, os.path.basename(ch['logo']))
        if os.path.exists(local_path):
            downloaded += 1
            return
        try:
            async with semaphore:
                async with session.get(fanming_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.read()
                        with open(local_path, 'wb') as f:
                            f.write(data)
                        downloaded += 1
        except Exception:
            pass
    await asyncio.gather(*[fetch_one(ch) for ch in channels])
    print(f"Logo download complete: {downloaded} saved to {logo_dir}")


def load_province_channels(files):
    province_channels = defaultdict(set)
    for file_path in files:
        province_name = os.path.basename(file_path).replace(".txt", "")
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                for line in file:
                    line = line.strip()
                    if line:
                        province_channels[province_name].add(line)
        except FileNotFoundError:
            print(f"Error: The file {file_path} was not found.")
    return province_channels


async def main(file_urls, cctv_channel_file, province_channel_files):
    cctv_channels = load_cctv_channels(cctv_channel_file)
    province_channels = load_province_channels(province_channel_files)
    all_valid_entries: List[Dict[str, Any]] = []
    source_stats: List[Dict[str, Any]] = []
    quality_cache = load_source_quality_cache()
    semaphore = asyncio.Semaphore(CONFIG["max_parallel"])
    timeout = aiohttp.ClientTimeout(total=CONFIG["timeout"])
    connector = aiohttp.TCPConnector(limit=CONFIG["max_parallel"] * 2)
    async with aiohttp.ClientSession(cookie_jar=None, timeout=timeout, connector=connector) as session:
        online_geo_tokens = await load_online_geo_tokens(session, province_channels)
        if online_geo_tokens:
            for province, tokens in online_geo_tokens.items():
                province_channels[province].update(tokens)
            print("Online geo classification tokens merged.")
        else:
            print("Online geo tokens unavailable, fallback to local province txt only.")
        # 过滤掉连续失效的源
        active_urls = [u for u in file_urls if not is_source_deprecated(quality_cache, u)]
        if len(active_urls) < len(file_urls):
            print(f"[monitor] 跳过 {len(file_urls) - len(active_urls)} 个连续失效源")
        for file_url in active_urls:
            if file_url.endswith(('.m3u', '.m3u8')):
                valid_entries, stat = await read_and_test_file(session, semaphore, file_url, is_m3u=True, quality_cache=quality_cache)
            elif file_url.endswith('.txt'):
                valid_entries, stat = await read_and_test_file(session, semaphore, file_url, is_m3u=False, quality_cache=quality_cache)
            else:
                valid_entries, stat = [], {}
            source_stats.append(stat)
            all_valid_entries.extend(valid_entries)
        # 尝试发现新的高质量源
        print("[discover] 扫描潜在新源...")
        new_urls = await discover_new_sources(session, active_urls)
        if new_urls:
            print(f"[discover] 发现 {len(new_urls)} 个新源，加入本次采集...")
            for new_url in new_urls:
                if new_url.endswith(('.m3u', '.m3u8')):
                    valid_entries, stat = await read_and_test_file(session, semaphore, new_url, is_m3u=True, quality_cache=quality_cache)
                else:
                    valid_entries, stat = [], {}
                source_stats.append(stat)
                all_valid_entries.extend(valid_entries)
    save_source_quality_cache(quality_cache)
    deduplicated_entries = deduplicate_candidate_entries(all_valid_entries)
    multi_entries = select_multi_streams(deduplicated_entries)
    total_unique = len(multi_entries)
    total_streams = sum(len(v) for v in multi_entries.values())
    # 收集所有延迟用于分位数统计
    all_latencies = [e.get("latency") for items in multi_entries.values() for e in items if e.get("latency")]
    # 分辨率分布统计
    res_dist: Dict[str, int] = defaultdict(int)
    for items in multi_entries.values():
        for e in items:
            res = e.get("resolution")
            if res:
                res_dist[res] += 1
    print(f"Valid streams: {len(all_valid_entries)}, deduplicated: {len(deduplicated_entries)}, channels: {total_unique} ({total_streams} total URLs)")
    if res_dist:
        print(f"  分辨率分布: {dict(res_dist)}")
    all_items = [item for items in multi_entries.values() for item in items]
    all_channels = generate_sorted_m3u(all_items, cctv_channels, province_channels, CONFIG["output_file"])
    print(f"Generated sorted M3U file: {CONFIG['output_file']}")
    print_source_quality_summary(quality_cache, source_stats, all_latencies)

    # 下载台标（复用同一 session 减少连接开销）
    logo_semaphore = asyncio.Semaphore(CONFIG["max_parallel"])
    logo_connector = aiohttp.TCPConnector(limit=CONFIG["max_parallel"] * 2)
    async with aiohttp.ClientSession(cookie_jar=None, timeout=aiohttp.ClientTimeout(total=10), connector=logo_connector) as logo_session:
        await download_logos(all_channels, logo_semaphore, logo_session)


if __name__ == "__main__":
    file_urls = [
        # 高质量：频道最多
        "https://raw.githubusercontent.com/suxuang/myIPTV/refs/heads/main/ipv4.m3u",
        # IPv6 补充（853条）
        "https://raw.githubusercontent.com/suxuang/myIPTV/refs/heads/main/ipv6.m3u",
        # 高质量：频道多，稳定；同时补充 txt 版本获取额外 284 条独立流
        "https://raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.m3u",
        "https://raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.txt",
        # 国家广电官方源，⭐28k stars
        "https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/itv.m3u",
        "https://raw.githubusercontent.com/fanmingming/live/main/tv/m3u/ipv6.m3u",
        # 央视频道全量（405条）+ 港澳台补充
        "https://raw.githubusercontent.com/hujingguang/ChinaIPTV/master/cnTV1_ALL.m3u8",
        "https://raw.githubusercontent.com/hujingguang/ChinaIPTV/master/TaiWan.m3u8",
        "https://raw.githubusercontent.com/hujingguang/ChinaIPTV/master/HongKong.m3u8",
        # 移动运营商IPTV补充（124条）
        "https://raw.githubusercontent.com/suxuang/myIPTV/refs/heads/main/移动IPTV.m3u",
        # 教育类频道
        "https://raw.githubusercontent.com/lylehust/Chinese-IPTV/master/TV-SXYD.m3u",
        # 稳定备用源
        "https://raw.githubusercontent.com/Kimentanm/aptv/master/m3u/iptv.m3u",
        "https://raw.githubusercontent.com/BurningC4/Chinese-IPTV/master/TV-IPV4.m3u",
        "https://raw.githubusercontent.com/zwc456baby/iptv_alive/refs/heads/master/live.m3u",
    ]
    cctv_channel_file = ".github/workflows/lptv/LPTV/CCTV.txt"
    province_channel_files = [
        ".github/workflows/lptv/LPTV/重庆频道.txt", ".github/workflows/lptv/LPTV/四川频道.txt", ".github/workflows/lptv/LPTV/云南频道.txt",
        ".github/workflows/lptv/LPTV/安徽频道.txt", ".github/workflows/lptv/LPTV/福建频道.txt", ".github/workflows/lptv/LPTV/甘肃频道.txt",
        ".github/workflows/lptv/LPTV/广东频道.txt", ".github/workflows/lptv/LPTV/广西频道.txt", ".github/workflows/lptv/LPTV/贵州频道.txt",
        ".github/workflows/lptv/LPTV/海南频道.txt", ".github/workflows/lptv/LPTV/河北频道.txt", ".github/workflows/lptv/LPTV/河南频道.txt",
        ".github/workflows/lptv/LPTV/黑龙江频道.txt", ".github/workflows/lptv/LPTV/湖北频道.txt", ".github/workflows/lptv/LPTV/湖南频道.txt",
        ".github/workflows/lptv/LPTV/吉林频道.txt", ".github/workflows/lptv/LPTV/江苏频道.txt", ".github/workflows/lptv/LPTV/江西频道.txt",
        ".github/workflows/lptv/LPTV/辽宁频道.txt", ".github/workflows/lptv/LPTV/内蒙频道.txt", ".github/workflows/lptv/LPTV/宁夏频道.txt",
        ".github/workflows/lptv/LPTV/青海频道.txt", ".github/workflows/lptv/LPTV/山东频道.txt", ".github/workflows/lptv/LPTV/山西频道.txt",
        ".github/workflows/lptv/LPTV/陕西频道.txt", ".github/workflows/lptv/LPTV/上海频道.txt", ".github/workflows/lptv/LPTV/天津频道.txt",
        ".github/workflows/lptv/LPTV/卫视频道.txt", ".github/workflows/lptv/LPTV/新疆频道.txt", ".github/workflows/lptv/LPTV/浙江频道.txt",
        ".github/workflows/lptv/LPTV/北京频道.txt",
    ]
    asyncio.run(main(file_urls, cctv_channel_file, province_channel_files))
