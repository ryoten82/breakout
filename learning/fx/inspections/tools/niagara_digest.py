# ダンプJSONからコンパクトなダイジェストを生成（topology+values+renderer統合）
import json, os, glob, sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "niagara_dump")

def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def fmt_input(inp):
    name = inp["name"]
    v = inp.get("value") or {}
    st = (v.get("struct") or {}).get("refPath", "")
    val = v.get("value")
    if st.endswith("_Enum"):
        return f"{name} = <{(val or {}).get('displayName','?')}>"
    if st.endswith("_DynamicInput"):
        dia = ((val or {}).get("dynamicInputAsset") or {}).get("refPath", "?")
        return f"{name} = DYN[{dia.rsplit('/',1)[-1].split('.')[0]}]"
    if st.endswith("_LinkedParameter") or st.endswith("_Linked"):
        return f"{name} = LINK[{json.dumps(val,ensure_ascii=False)[:60]}]"
    if st.endswith("_Unsupported"):
        return None
    if isinstance(val, dict):
        if "value" in val and len(val) == 1:
            return f"{name} = {val['value']}"
        if set(val.keys()) <= {"x","y","z","w"}:
            return f"{name} = ({','.join(str(round(val[k],4)) for k in ('x','y','z','w') if k in val)})"
        if set(val.keys()) <= {"r","g","b","a"}:
            return f"{name} = RGBA({round(val.get('r',0),3)},{round(val.get('g',0),3)},{round(val.get('b',0),3)},{round(val.get('a',0),3)})"
        if "refPath" in val:
            return f"{name} = {val['refPath'].rsplit('/',1)[-1].split('.')[0]}"
        s = json.dumps(val, ensure_ascii=False)
        return f"{name} = {s[:100]}"
    return f"{name} = {val}"

RKEYS = ["Material","MaterialParameters","Alignment","FacingMode","SortMode","SortOrderHint",
         "SubImageSize","bSubImageBlend","SubUVAnimationMode","ParticleMesh","Meshes",
         "FacingCameraOffset","MacroUVRadius","bGpuLowLatencyTranslucency",
         "CurveTension","TessellationFactor","UV0Settings","UV1Settings","DrawDirection",
         "RibbonWidthBinding","Shape","WidthSegmentationCount","MultiPlaneCount",
         "bCastShadows","bUseHeterogeneousVolumes","RendererVisibility","LightExponent",
         "RadiusScale","ColorAdd","bAffectsTranslucency"]

def digest_system(sysname):
    print(f"\n{'='*70}\nSYSTEM: {sysname}\n{'='*70}")
    sp = os.path.join(OUT, sysname + "_summary.json")
    if os.path.exists(sp):
        rv = load(sp).get("returnValue", {})
        uvs = rv.get("userVariables") or []
        if uvs:
            print("UserParams:")
            for u in uvs:
                dv = (u.get("defaultValue") or {}).get("value")
                print(f"  {u['name']} = {json.dumps(dv,ensure_ascii=False)[:80]}  # {u.get('description','')[:60]}")
    tops = sorted(glob.glob(os.path.join(OUT, f"{sysname}__*__topology.json")))
    for tp in tops:
        em = os.path.basename(tp)[len(sysname)+2:-len("__topology.json")]
        top = load(tp).get("returnValue", {})
        vals_p = os.path.join(OUT, f"{sysname}__{em}__values.json")
        vals = {}
        if os.path.exists(vals_p):
            for m in load(vals_p).get("returnValue", []):
                vals.setdefault(m["moduleName"], []).append(m["inputs"])
        used = {}
        print(f"\n--- Emitter: {em}  (sim={top.get('simTarget')}, renderers={[r['rendererClass']['refPath'].rsplit('.',1)[-1] for r in top.get('renderers',[])]})")
        for sk in ("emitterSpawnScript","emitterUpdateScript","particleSpawnScript","particleUpdateScript"):
            st = top.get(sk) or {}
            mods = st.get("modules") or []
            if not mods: continue
            print(f"  [{sk}]")
            for m in mods:
                mn = m["moduleName"]
                en = "" if m.get("enabled", True) else " (DISABLED)"
                print(f"    * {mn}{en}")
                idx = used.get(mn, 0)
                arr = vals.get(mn) or []
                inputs = arr[idx] if idx < len(arr) else (arr[0] if arr else [])
                used[mn] = idx + 1
                for inp in inputs:
                    s = fmt_input(inp)
                    if s: print(f"        {s}")
        for rp in sorted(glob.glob(os.path.join(OUT, f"{sysname}__{em}__renderer*.json"))):
            ridx = os.path.basename(rp).split("renderer")[1].split(".")[0]
            try:
                props = json.loads(load(rp)["returnValue"]["propertyValues"])
            except Exception:
                continue
            cls = ""
            for r in top.get("renderers", []):
                if str(r["rendererIndex"]) == ridx:
                    cls = r["rendererClass"]["refPath"].rsplit(".",1)[-1]
            print(f"  [Renderer {ridx}: {cls}]")
            for k in RKEYS:
                if k in props:
                    v = props[k]
                    if isinstance(v, dict) and "refPath" in v:
                        v = v["refPath"]
                    print(f"        {k} = {json.dumps(v,ensure_ascii=False)[:160]}")

def main():
    if len(sys.argv) > 1:
        digest_system(sys.argv[1]); return
    names = sorted({os.path.basename(p).split("__")[0] for p in glob.glob(os.path.join(OUT, "*__*__topology.json"))})
    for n in names:
        digest_system(n)

main()
