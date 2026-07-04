# .uasset package table parser (read-only): reconstructs export object tree
# Heuristic summary parsing: locate NameCount/NameOffset after PackageFlags,
# then find (ExportCount,ExportOffset,ImportCount,ImportOffset,DependsOffset).
import struct, sys, json

def read_fstring(b, o):
    ln = struct.unpack_from("<i", b, o)[0]; o += 4
    if ln == 0: return "", o
    if ln < 0:  # UTF-16
        n = -ln
        s = b[o:o+2*n].decode("utf-16-le").rstrip("\0"); o += 2*n
    else:
        s = b[o:o+ln].decode("latin-1").rstrip("\0"); o += ln
    return s, o

def parse(path):
    b = open(path, "rb").read()
    assert struct.unpack_from("<I", b, 0)[0] == 0x9E2A83C1, "bad tag"
    legacy = struct.unpack_from("<i", b, 4)[0]
    assert legacy == -9, f"unexpected legacy version {legacy}"
    # 8: LegacyUE3, 12: UE4ver, 16: UE5ver, 20: licensee, 24: SavedHash(20), 44: TotalHeaderSize
    o = 48
    ncv = struct.unpack_from("<i", b, o)[0]; o += 4 + 20*ncv
    _folder, o = read_fstring(b, o)
    pkg_flags = struct.unpack_from("<I", b, o)[0]; o += 4
    name_cnt, name_off = struct.unpack_from("<ii", b, o); o += 8
    o += 8  # SoftObjectPathsCount/Offset
    if not (pkg_flags & 0x80000000):
        _locid, o = read_fstring(b, o)
    o += 8  # GatherableTextDataCount/Offset
    sum_pos = o - 8
    # parse name map (FString + 4 bytes hashes)
    names = []; o = name_off
    for _ in range(name_cnt):
        s, o = read_fstring(b, o)
        o += 4
        names.append(s)
    name_end = o
    # find (ExportCount,ExportOffset,ImportCount,ImportOffset) quartet in summary
    exp_cnt = exp_off = imp_cnt = imp_off = None
    for p in range(sum_pos + 8, 1024, 4):
        ec, eo, ic, io_ = struct.unpack_from("<4i", b, p)
        if (0 < ec < 5000 and 0 < ic < 5000 and
            name_end <= io_ < eo <= len(b) and
            (eo - io_) % ic == 0 and 20 <= (eo - io_)//ic <= 64):
            exp_cnt, exp_off, imp_cnt, imp_off = ec, eo, ic, io_
            break
    assert exp_off, "tables not found"
    imp_size = (exp_off - imp_off)//imp_cnt
    # determine export entry size by validating ObjectName FName at +16 for all entries
    exp_size = None
    for sz in range(48, 201, 4):
        ok = True
        for i in range(exp_cnt):
            e = exp_off + i*sz
            if e + 24 > len(b): ok = False; break
            cls_i, = struct.unpack_from("<i", b, e)
            nidx, nnum = struct.unpack_from("<ii", b, e+16)
            if not (-imp_cnt <= cls_i <= exp_cnt) or not (0 <= nidx < name_cnt) or not (0 <= nnum < 1000):
                ok = False; break
        if ok:
            exp_size = sz
            break
    assert exp_size, "export size not found"
    def fname(off):
        idx, num = struct.unpack_from("<ii", b, off)
        s = names[idx] if 0 <= idx < len(names) else f"?{idx}"
        return f"{s}_{num-1}" if num > 0 else s
    imports = []
    for i in range(imp_cnt):
        e = imp_off + i*imp_size
        imports.append({
            "classPackage": fname(e), "class": fname(e+8),
            "outer": struct.unpack_from("<i", b, e+16)[0],
            "name": fname(e+20),
        })
    exports = []
    for i in range(exp_cnt):
        e = exp_off + i*exp_size
        cls_i, sup_i, tmpl_i, outer_i = struct.unpack_from("<4i", b, e)
        nm = fname(e+16)
        exports.append({"classIndex": cls_i, "outer": outer_i, "name": nm})
    def cls_name(idx):
        if idx < 0: return imports[-idx-1]["name"]
        if idx > 0: return exports[idx-1]["name"] + "(exp)"
        return "None"
    for ex in exports:
        ex["class"] = cls_name(ex["classIndex"])
    return names, imports, exports

def tree(exports):
    kids = {}
    for i, ex in enumerate(exports):
        kids.setdefault(ex["outer"], []).append(i+1)
    out = []
    def walk(idx, depth):
        ex = exports[idx-1]
        out.append("  "*depth + f"{ex['name']} [{ex['class']}]")
        for k in kids.get(idx, []): walk(k, depth+1)
    for r in kids.get(0, []): walk(r, 0)
    return "\n".join(out)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        print("="*20, path.split("/")[-1], "="*20)
        try:
            names, imports, exports = parse(path)
            print(tree(exports))
        except Exception as e:
            print("PARSE FAIL:", e)
