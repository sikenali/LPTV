"""
LPTV Web — EPG protobuf 解析器

央视频 EPG 接口 (/api/yspepg/program/{pid}/{ymd}) 返回 protobuf。
本模块是 static/layer.js 中 parseEpg() 的服务端等价实现，字段映射保持一致：

    f1=id  f2=name  f3=s0(开始秒)  f4=e0(结束秒)
    f5=start  f6=end  f7=dur  f9/f10=extra
"""

MAX_PROGRAMS = 200


def _utf8_str(data: bytes, a: int, n: int) -> str:
    if n <= 0:
        return ""
    try:
        return data[a:a + n].decode("utf-8")
    except Exception:
        return data[a:a + n].decode("utf-8", errors="replace")


def _read_varint(data: bytes, i: int, end: int) -> tuple:
    v = 0
    s = 0
    k = 0
    while i < end and k < 5:
        b = data[i]
        i += 1
        v += (b & 0x7F) << s
        s += 7
        k += 1
        if not (b & 0x80):
            break
    return v, i


def _parse_entry(data: bytes, a: int, b: int) -> dict:
    """解析单条节目记录 (字节区间 [a, b))"""
    p: dict = {}
    i = a
    while i < b:
        tag, i = _read_varint(data, i, b)
        if tag == 0:
            break
        f = tag >> 3
        wt = tag & 7
        if wt == 2:
            ln, i = _read_varint(data, i, b)
            if i + ln > b:
                break
            if f == 1:
                p["id"] = _utf8_str(data, i, ln)
            elif f == 2:
                p["name"] = _utf8_str(data, i, ln)
            elif f == 5:
                p["start"] = _utf8_str(data, i, ln)
            elif f == 6:
                p["end"] = _utf8_str(data, i, ln)
            elif f in (9, 10):
                p["extra"] = _utf8_str(data, i, ln)
            i += ln
        elif wt == 0:
            v, i = _read_varint(data, i, b)
            if f == 3:
                p["s0"] = v
            elif f == 4:
                p["e0"] = v
            elif f == 7:
                p["dur"] = v
        else:
            _, i = _read_varint(data, i, b)
    return p if p.get("name") else None


def parse_epg(buf) -> list:
    """解析 EPG protobuf 响应，返回节目列表 (list[dict])

    解析失败时返回空列表，不抛异常 —— 上游返回 HTML 错误页时不应导致 500。
    """
    programs: list = []
    try:
        data = buf if isinstance(buf, (bytes, bytearray)) else bytes(buf)
        n = len(data)
        i = 0
        while i < n:
            tag, i = _read_varint(data, i, n)
            if tag == 0:
                break
            wt = tag & 7
            if wt == 2:
                ln, i = _read_varint(data, i, n)
                if i + ln > n:
                    break
                entry = _parse_entry(data, i, i + ln)
                if entry:
                    programs.append(entry)
                i += ln
            elif wt == 0:
                _, i = _read_varint(data, i, n)
            elif wt == 5:
                i += 4
            elif wt == 1:
                i += 8
            else:
                break
            if len(programs) >= MAX_PROGRAMS:
                break
    except Exception:
        return programs
    return programs
