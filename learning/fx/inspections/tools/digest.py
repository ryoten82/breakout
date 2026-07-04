"""Niagara system digest v2: condensed module inputs + dynamic input chains + renderers."""
import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mcp_call

def call(tool, args):
    resp = mcp_call.rpc("tools/call", {"name": "call_tool", "arguments": {
        "toolset_name": "NiagaraToolsets.NiagaraToolset_System",
        "tool_name": tool, "arguments": args}})
    try:
        txt = resp["result"]["content"][0]["text"]
        d = json.loads(txt)
        return d.get("returnValue", d)
    except Exception:
        return {"_error": str(resp)[:300]}

def fmtnum(v):
    return "%.5g" % v if isinstance(v, float) else str(v)

def render_value(v):
    """Return short string or None if empty/unset."""
    if v is None: return None
    if isinstance(v, (int, float)): return fmtnum(v)
    if isinstance(v, str): return v
    if isinstance(v, dict):
        if "keys" in v and "preInfinityExtrap" in v:
            pts = ", ".join("(%.3g,%.3g)" % (k.get("time",0), k.get("value",0)) for k in v["keys"])
            return "Curve[%s]" % pts
        if "propertyValues" in v and isinstance(v["propertyValues"], str):
            try: return render_value(json.loads(v["propertyValues"]))
            except Exception: pass
        if "Curve" in v and isinstance(v.get("Curve"), dict):
            return render_value(v["Curve"])
        if "struct" in v and "value" in v:
            return render_value(v["value"])
        ks = set(v.keys())
        if ks == {"value"}: return render_value(v["value"])
        if "enumName" in v: return v.get("displayName") or v["enumName"]
        if "linkedVariable" in v: return "-> " + v["linkedVariable"].get("name","?")
        if "dynamicInputAsset" in v:
            return "DYN:" + v["dynamicInputAsset"]["refPath"].split("/")[-1].split(".")[0]
        if "object" in v:
            o = v["object"]
            return o.get("refPath","?").split("/")[-1].split(".")[0] if isinstance(o,dict) else str(o)
        if "refPath" in v and len(ks) == 1:
            return v["refPath"].split("/")[-1]
        if ks >= {"r","g","b"}:
            return "RGBA(%.3g,%.3g,%.3g,%.3g)" % (v.get("r",0),v.get("g",0),v.get("b",0),v.get("a",1))
        if ks == {"x","y","z"}: return "(%.4g,%.4g,%.4g)" % (v["x"],v["y"],v["z"])
        if ks == {"x","y"}: return "(%.4g,%.4g)" % (v["x"],v["y"])
        if ks == {"x","y","z","w"}: return "(%.4g,%.4g,%.4g,%.4g)" % (v["x"],v["y"],v["z"],v["w"])
        if not v: return None
        parts = []
        for k, vv in v.items():
            if k in ("struct","type"): continue
            r = render_value(vv)
            if r is not None: parts.append("%s=%s" % (k, r))
        return "{" + ", ".join(parts) + "}" if parts else None
    if isinstance(v, list):
        rs = [render_value(x) for x in v]
        rs = [r for r in rs if r is not None]
        return "[" + ", ".join(rs[:12]) + ("…(%d)" % len(v) if len(v)>12 else "") + "]" if rs else None
    return str(v)

SKIP_CHILD = {"Randomness Mode","Random Seed","Evaluation Type","Recalculate Random Each Loop"}

def render_chain(node, depth=0):
    """node = NiagaraExt_DynamicInputChain wrapper."""
    v = node.get("value", node)
    name = v.get("name","?")
    val = render_value(v.get("value"))
    kids = []
    for c in v.get("inputs", []):
        cv = c.get("value", c)
        if not cv.get("bIsVisible", True): continue
        if cv.get("name") in SKIP_CHILD: continue
        r = render_chain(c, depth+1)
        if r: kids.append(r)
    if val and val.startswith("DYN:"):
        return "%s(%s)" % (val[4:], ", ".join(kids)) if depth==0 and not kids==[] else ("%s=%s(%s)" % (name, val[4:], ", ".join(kids)))
    s = "%s=%s" % (name, val) if val is not None else None
    if kids:
        s = (s or name) + "{" + ", ".join(kids) + "}"
    return s

def sref(syspath, emitter="", script="", module="", ridx=-1, inputs=None):
    return {"system": {"refPath": syspath}, "emitterName": emitter, "scriptName": script,
            "moduleName": module, "rendererIndex": ridx, "inputNameStack": inputs or []}

STACKS = ["EmitterSpawnScript","EmitterUpdateScript","ParticleSpawnScript","ParticleUpdateScript"]
BORING = {"Loop Count","Recalculate Duration Each Loop","UseLoopDelay","Loop Delay","Delay First Loop Only",
          "MinDistance","Min Distance Response","MaxDistance","Max Distance Response","Scale Spawn Count",
          "Spawn Count Scale","Spawn Count Scale By Distance","Enable Visibility Culling","Visibility Cull Response",
          "Visibility Cull Delay","Reset Age On Awaken","Enable Distance Culling"}

def dump_stack(syspath, emitter, script):
    vals = call("GetScriptStackInputValues", {"scriptRef": sref(syspath, emitter, script)})
    if isinstance(vals, dict) and "_error" in vals:
        print("    (error)", vals["_error"][:150]); return
    items = vals if isinstance(vals, list) else vals.get("modules", [vals])
    for m in items:
        if not isinstance(m, dict): continue
        mn = m.get("moduleName") or m.get("name") or "?"
        dis = "" if m.get("enabled", m.get("bEnabled", True)) else " [DISABLED]"
        lines = []
        for inp in m.get("inputs", []):
            nm = inp.get("name") or "?"
            if nm in BORING: continue
            if not inp.get("bIsVisible", True): continue
            r = render_value(inp.get("value"))
            if r is None: continue
            skipvals = {"Unset","Simulation Defaults"}
            if r in skipvals: continue
            if r.startswith("DYN:"):
                chain = call("GetDynamicInputChain", {"stackInputRef": sref(syspath, emitter, script, mn, -1, [nm])})
                if isinstance(chain, dict) and "_error" not in chain:
                    cr = render_chain(chain if "value" in chain else {"value": chain.get("value", chain)})
                    r = cr or r
            lines.append("        %s = %s" % (nm, r))
        print("    *", mn + dis)
        for l in lines: print(l)

def main():
    syspath = sys.argv[1]
    only = sys.argv[2].split(",") if len(sys.argv) > 2 else None
    summ = call("GetSystemSummary", {"system": {"refPath": syspath}})
    print("=== SYSTEM:", summ.get("systemName"))
    for uv in summ.get("userVariables", []):
        print("  UserVar:", uv["name"], "=", render_value(uv.get("defaultValue",{}).get("value")))
    for em in summ.get("emitters", []):
        en = em["emitterName"]
        if only and en not in only: continue
        print("\n## EMITTER: %s | sim: %s | enabled: %s" % (en, em.get("simTarget"), em.get("bEnabled")))
        for st in STACKS:
            print("  [%s]" % st)
            dump_stack(syspath, en, st)
        for i, rc in enumerate(em.get("rendererClasses", [])):
            cls = rc.get("refPath","?").split(".")[-1]
            rd = call("GetRendererData", {"rendererRef": sref(syspath, en, ridx=i)})
            print("  [RENDERER %d: %s]" % (i, cls))
            pv = rd.get("propertyValues") if isinstance(rd, dict) else None
            if isinstance(pv, str):
                try: pv = json.loads(pv)
                except Exception: pass
            print("    ", json.dumps(pv, ensure_ascii=False)[:6000] if pv is not None else str(rd)[:2000])

if __name__ == "__main__":
    main()
