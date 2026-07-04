# FX_Player systems digest via MCP NiagaraToolset_System (read-only Get* tools only)
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mcp_call as M

def call(tool, args, toolset="NiagaraToolsets.NiagaraToolset_System"):
    r = M.rpc("tools/call", {"name": "call_tool", "arguments": {
        "toolset_name": toolset, "tool_name": tool, "arguments": args}})
    txt = r["result"]["content"][0]["text"]
    try:
        j = json.loads(txt)
        if isinstance(j, dict) and "returnValue" in j:
            return j["returnValue"] if isinstance(j["returnValue"], dict) else {"returnValue": j["returnValue"]}
        return j
    except Exception: return {"raw": txt}

def condense_value(v):
    if not isinstance(v, dict): return v
    sp = (v.get("struct") or {}).get("refPath", "")
    val = v.get("value", {})
    kind = sp.rsplit("_", 1)[-1] if "_StackInputData_" in sp else ""
    if kind == "Enum": return val.get("displayName") or val.get("enumName")
    if kind == "Linked": return "→" + (val.get("linkedVariable", {}) or {}).get("name", "?")
    if kind == "Unsupported": return None
    if kind == "Dynamic":
        fn = val.get("dynamicInput", {}) or {}
        nm = fn.get("refPath", "").split(".")[-1] or val.get("functionName", "dyn")
        return f"dyn:{nm}"
    if kind == "Data":
        di = val.get("dataInterface", {}) or {}
        return "DI:" + str(di.get("refPath", ""))[-60:]
    if isinstance(val, dict):
        if set(val.keys()) <= {"value"}: return val.get("value")
        if set(val.keys()) <= {"x", "y", "z", "w"}: return [val.get(k) for k in "xyzw" if k in val]
        if set(val.keys()) <= {"r", "g", "b", "a"}: return {k: round(val[k], 3) for k in val}
        if "asset" in val: return str((val.get("asset") or {}).get("refPath", ""))
        if "boolValue" in val: return val["boolValue"]
    return json.loads(json.dumps(val))  # fallback

def digest_system(syspath):
    ref = {"refPath": syspath}
    name = syspath.split(".")[-1]
    summ = call("GetSystemSummary", {"system": ref})
    out = {"system": name,
           "userVariables": [
               {"name": u["name"],
                "default": (u.get("defaultValue") or {}).get("value")}
               for u in summ.get("userVariables", [])],
           "emitters": []}
    for em in summ.get("emitters", []):
        ename = em["emitterName"]
        eref = {"system": ref, "emitterName": ename, "scriptName": "",
                "moduleName": "", "rendererIndex": -1, "inputNameStack": []}
        topo = call("GetEmitterTopology", {"emitterRef": eref})
        einfo = {"name": ename, "enabled": em.get("bEnabled"), "sim": em.get("simTarget"),
                 "stages": {}, "renderers": []}
        for skey in ("emitterSpawnScript", "emitterUpdateScript", "particleSpawnScript", "particleUpdateScript"):
            sc = topo.get(skey) or {}
            sname = sc.get("scriptName", "None")
            if sname == "None": continue
            mods = sc.get("modules", [])
            stage = []
            # values for whole script stack in one call
            sref = dict(eref); sref["scriptName"] = sname; sref["rendererIndex"] = 0
            vals = call("GetScriptStackInputValues", {"scriptRef": sref})
            valmap = {}
            if isinstance(vals, dict) and isinstance(vals.get("returnValue"), list):
                for mv in vals["returnValue"]:
                    mm = {}
                    for inp in mv.get("inputs", []):
                        cv = condense_value(inp.get("value"))
                        if cv is not None and cv != {} and cv != []:
                            mm[inp["name"]] = cv
                    valmap[mv.get("moduleName")] = mm
            for m in mods:
                mn = m.get("moduleName")
                stage.append({"module": mn, "enabled": m.get("enabled"),
                              "script": str((m.get("moduleScript") or {}).get("refPath", "")).split(".")[-1],
                              "inputs": valmap.get(mn, {})})
            einfo["stages"][skey] = stage
        nrend = len(topo.get("renderers", []) or topo.get("rendererClasses", []))
        for ri in range(nrend):
            rref = dict(eref); rref["rendererIndex"] = ri
            rd = call("GetRendererData", {"rendererRef": rref})
            props = {}
            pv = rd.get("propertyValues")
            if isinstance(pv, str):
                try: props = json.loads(pv)
                except Exception: props = {"raw": pv[:200]}
            keep = {k: v for k, v in props.items() if k in (
                "Material", "MaterialParameters", "Alignment", "FacingMode", "SubImageSize",
                "SortMode", "PivotInUVSpace", "MacroUVRadius", "bSubImageBlend", "RibbonWidth",
                "ParticleMesh", "Meshes", "SourceMode", "bLocalSpace", "MaterialUserParamBinding")}
            rcls = (topo.get("rendererClasses") or [{}])
            cls = str((rcls[ri] if ri < len(rcls) else {}).get("refPath", "")).split(".")[-1]
            einfo["renderers"].append({"class": cls, "props": keep})
        out["emitters"].append(einfo)
    return out

if __name__ == "__main__":
    for nm in sys.argv[1:]:
        p = f"/Game/NiagaraExamples/FX_Player/{nm}.{nm}"
        d = digest_system(p)
        fn = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"mdig_{nm}.json")
        open(fn, "w", encoding="utf-8").write(json.dumps(d, indent=1, ensure_ascii=False))
        print(nm, "->", os.path.getsize(fn), "bytes,", len(d["emitters"]), "emitters")
