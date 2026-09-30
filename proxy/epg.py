"""
LX TV Web — EPG protobuf 解析器
从 pytv/frontend/inject.js 中拆出, 供代理侧使用 (缓存 EPG 数据)
"""


def _utf8_bytes(bytes_arr, a, n):
    try:
        return bytes_arr[a:a + n].decode("utf-8")
    except Exception:
        return ""


def parse_epg(buf):
    """解析央视频 EPG protobuf (arraybuffer) 返回节目列表"""
    programs = []
    try:
        bytes_arr = buf if isinstance(buf, bytes) else bytes(buf)
        length = len(bytes_arr)
        i = 0

        def varint():
            nonlocal i
            v = 0
            s = 0
            k = 0
            while i < length and k < 5:
                b = bytes_arr[i]
                i += 1
                v += (b & 0x7f) * (1 << s)
                s += 7
                k += 1
                if not (b & 0x80):
                    break
            return v

        while i < length:
            tag = varint()
            if tag == 0:
                break
            f = tag >> 3
            wt = tag & 7
            if wt == 2:
                len_ = varint()
                entry_start = i
                entry = {}
                inner_i = i
                inner_end = i + len_

                def inner_varint():
                    nonlocal inner_i
                    v = 0
                    s = 0
                    k = 0
                    while inner_i < inner_end and k < 5:
                        b = bytes_arr[inner_i]
                        inner_i += 1
                        v += (b & 0x7f) * (1 << s)
                        s += 7
                        k += 1
                        if not (b & 0x80):
                            break
                    return v

                while inner_i < inner_end:
                    itag = inner_varint()
                    if itag == 0:
                        break
                    if = itag >> 3
                    w = itag & 7
                    if w == 2:
                        elen = inner_varint()
                        val = _utf8_bytes(bytes_arr, inner_i, elen)
                        inner_i += elen
                        if f == 1:
                            entry["id"] = val
                        elif f == 2:
                            entry["name"] = val
                        elif f == 5:
                            entry["start"] = val
                        elif f == 6:
                            entry["end"] = val
                        elif f in (9, 10):
                            entry["extra"] = val
                    elif w == 0:
                        vv = inner_varint()
                        if f == 3:
                            entry["s0"] = vv
                        elif f == 4:
                            entry["e0"] = vv
                        elif f == 7:
                            entry["dur"] = vv
                    else:
                        inner_i += inner_varint()

                if entry.get("name"):
                    programs.append(entry)
                i += len_
            elif wt == 0:
                varint()
            else:
                i += varint()
            if len(programs) > 200:
                break
    except Exception as e:
        pass
    return programs
