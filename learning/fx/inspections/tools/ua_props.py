# Best-effort UE5.8 tagged-property decoder for editor .uasset exports (read-only).
import struct, sys, json
sys.path.insert(0, __file__.rsplit("\\", 1)[0])
import ua_parse as U

class Pkg:
    def __init__(self, path):
        self.b = b = open(path, "rb").read()
        self.names, self.imports, self.exports = U.parse(path)
        # recompute export table offsets for serial size/offset
        o = 48
        ncv = struct.unpack_from("<i", b, o)[0]; o += 4 + 20*ncv
        _f, o = U.read_fstring(b, o)
        flags = struct.unpack_from("<I", b, o)[0]; o += 4
        self.name_cnt, self.name_off = struct.unpack_from("<ii", b, o); o += 8
        o += 8
        if not (flags & 0x80000000): _l, o = U.read_fstring(b, o)
        o += 8
        self.exp_cnt, self.exp_off, self.imp_cnt, self.imp_off = struct.unpack_from("<4i", b, o)
        # export entry size: same detection as ua_parse
        self.exp_size = None
        for sz in range(48, 201, 4):
            ok = True
            for i in range(self.exp_cnt):
                e = self.exp_off + i*sz
                if e + 24 > len(b): ok = False; break
                ci, = struct.unpack_from("<i", b, e)
                ni, nn = struct.unpack_from("<ii", b, e+16)
                if not (-self.imp_cnt <= ci <= self.exp_cnt) or not (0 <= ni < self.name_cnt) or not (0 <= nn < 1000):
                    ok = False; break
            if ok: self.exp_size = sz; break
        for i, ex in enumerate(self.exports):
            e = self.exp_off + i*self.exp_size
            ex["serialSize"], ex["serialOffset"] = struct.unpack_from("<qq", b, e+28)

    def objname(self, pkg_index):
        if pkg_index < 0: return self.imports[-pkg_index-1]["name"]
        if pkg_index > 0: return self.exports[pkg_index-1]["name"]
        return "None"
    def objpath(self, pkg_index):
        # for imports, walk outer to give Package.Object
        if pkg_index < 0:
            imp = self.imports[-pkg_index-1]
            chain = [imp["name"]]
            outer = imp["outer"]
            while outer < 0:
                p = self.imports[-outer-1]
                chain.append(p["name"]); outer = p["outer"]
            return "/".join(reversed(chain))
        return self.objname(pkg_index)

class Reader:
    def __init__(self, pkg, data):
        self.p = pkg; self.d = data; self.o = 0
    def fname(self):
        i, n = struct.unpack_from("<ii", self.d, self.o); self.o += 8
        if not (0 <= i < len(self.p.names)): raise ValueError(f"bad fname {i}")
        s = self.p.names[i]
        return f"{s}_{n-1}" if n > 0 else s
    def i32(self):
        v, = struct.unpack_from("<i", self.d, self.o); self.o += 4; return v
    def u8(self):
        v = self.d[self.o]; self.o += 1; return v
    def typetree(self):
        name = self.fname()
        cnt = self.i32()
        kids = [self.typetree() for _ in range(cnt)]
        return (name, kids)

NATIVE = {
    "Guid": lambda d: d.hex().upper(),
    "LinearColor": lambda d: dict(zip("RGBA", struct.unpack("<4f", d))),
    "Vector": lambda d: list(struct.unpack("<3d", d)),
    "Vector3f": lambda d: list(struct.unpack("<3f", d)),
    "Vector2f": lambda d: list(struct.unpack("<2f", d)),
    "Vector2D": lambda d: list(struct.unpack("<2d", d)),
    "Vector4f": lambda d: list(struct.unpack("<4f", d)),
    "Quat4f": lambda d: list(struct.unpack("<4f", d)),
    "Rotator": lambda d: list(struct.unpack("<3d", d)),
    "IntPoint": lambda d: list(struct.unpack("<2i", d)),
}

def parse_props(pkg, data, depth=0):
    r = Reader(pkg, data)
    return parse_props_stream(r, depth)

def parse_props_stream(r, depth=0):
    """Parse tagged properties until None terminator; returns dict."""
    pkg, data = r.p, r.d
    out = {}
    while r.o + 8 <= len(data):
        name = r.fname()
        if name == "None":
            break
        tname, tkids = r.typetree()
        size = r.i32()
        flags = r.u8()
        if flags & 0x02:
            r.i32()  # ArrayIndex
        if flags & 0x04:
            r.o += 16  # PropertyGuid
        boolval = 1 if (flags & 0x10) else 0  # BoolTrue flag (observed 0x10)
        payload = data[r.o:r.o+size]; r.o += size
        out[name] = decode_value(pkg, tname, tkids, payload, boolval, depth)
    return out

def decode_value(pkg, tname, tkids, payload, boolval, depth):
    try:
        if tname == "BoolProperty": return bool(boolval)
        if tname == "FloatProperty": return round(struct.unpack("<f", payload)[0], 6)
        if tname == "DoubleProperty": return struct.unpack("<d", payload)[0]
        if tname == "IntProperty": return struct.unpack("<i", payload)[0]
        if tname == "Int64Property": return struct.unpack("<q", payload)[0]
        if tname == "UInt16Property": return struct.unpack("<H", payload)[0]
        if tname == "UInt32Property": return struct.unpack("<I", payload)[0]
        if tname == "ByteProperty":
            if len(payload) == 1: return payload[0]
            if len(payload) == 8:
                i, n = struct.unpack("<ii", payload)
                return pkg.names[i] if 0 <= i < len(pkg.names) else payload.hex()
            return payload.hex()
        if tname == "EnumProperty" or (tname == "NameProperty"):
            if len(payload) == 8:
                i, n = struct.unpack("<ii", payload)
                return pkg.names[i] if 0 <= i < len(pkg.names) else payload.hex()
            return payload.hex()
        if tname == "StrProperty":
            s, _ = U.read_fstring(payload, 0); return s
        if tname in ("ObjectProperty", "SoftObjectProperty"):
            if len(payload) == 4:
                return pkg.objpath(struct.unpack("<i", payload)[0])
            return payload[:64].hex()
        if tname == "StructProperty":
            stype = tkids[0][0] if tkids else "?"
            if stype in NATIVE:
                try: return {f"<{stype}>": NATIVE[stype](payload)}
                except Exception: return {f"<{stype}>": payload.hex()}
            if depth < 6:
                try:
                    return {f"<{stype}>": parse_props(pkg, payload, depth+1)}
                except Exception:
                    return {f"<{stype}>": payload[:48].hex() + ("..." if len(payload) > 48 else "")}
            return {f"<{stype}>": "deep"}
        if tname == "ArrayProperty":
            inner = tkids[0][0] if tkids else "?"
            cnt = struct.unpack_from("<i", payload, 0)[0]
            body = payload[4:]
            if inner == "StructProperty":
                # body: count already consumed; elements back-to-back (tagged streams or native)
                try:
                    stype = tkids[0][1][0][0] if tkids and tkids[0][1] else "?"
                    r = Reader(pkg, body)
                    elems = []
                    if stype in NATIVE:
                        esz = len(body) // cnt if cnt else 0
                        for k in range(cnt):
                            elems.append(NATIVE[stype](body[k*esz:(k+1)*esz]))
                    else:
                        for k in range(cnt):
                            try:
                                elems.append(parse_props_stream(r, depth+1))
                            except Exception as e:
                                elems.append(f"<elem err {e}>"); break
                    return {f"<array of {stype} x{cnt}>": elems}
                except Exception:
                    return f"<array {inner} x{cnt}> " + payload[:32].hex()
            if inner in ("ObjectProperty",):
                vals = [pkg.objpath(struct.unpack_from("<i", body, 4*k)[0]) for k in range(cnt)]
                return vals
            if inner == "NameProperty":
                vals = []
                for k in range(cnt):
                    i, n = struct.unpack_from("<ii", body, 8*k)
                    vals.append(pkg.names[i])
                return vals
            if inner == "FloatProperty":
                return list(struct.unpack_from(f"<{cnt}f", body, 0))
            if inner == "IntProperty":
                return list(struct.unpack_from(f"<{cnt}i", body, 0))
            return f"<array {inner} x{cnt}>"
        return payload[:32].hex() + ("..." if len(payload) > 32 else "")
    except Exception as e:
        return f"<decode err {tname}: {e}>"

def export_props(pkg, exp_index1):
    ex = pkg.exports[exp_index1-1]
    d = pkg.b[ex["serialOffset"]: ex["serialOffset"]+ex["serialSize"]]
    if len(d) == 0: return {}
    # leading byte observed before first tag
    return parse_props(pkg, d[1:])

if __name__ == "__main__":
    path = sys.argv[1]
    pkg = Pkg(path)
    if len(sys.argv) > 2:
        idx = int(sys.argv[2])
        print(json.dumps(export_props(pkg, idx), indent=1, ensure_ascii=False, default=str))
    else:
        for i, ex in enumerate(pkg.exports):
            print(i+1, ex["name"], ex["class"], "outer", ex["outer"], "size", ex["serialSize"])
