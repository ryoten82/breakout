# NiagaraSystem uasset digest: stateless emitters -> modules/renderers with values
import sys, json, struct
sys.path.insert(0, __file__.rsplit("\\", 1)[0])
import ua_props as P

NOISE_KEYS = {"MergeId", "ParticleDataSetCompiledData", "ShaderOutputVariableOffsets",
              "EmitterTemplate", "UniqueEmitterName", "ComponentTags", "RandomSeed",
              "StatelessEmitterTemplate"}

def clean(v):
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if k in ("ParameterBinding", "ChannelConstantsAndRanges"):
                continue
            c = clean(x)
            if c in ({}, [], None):
                continue
            out[k] = c
        # collapse single-key struct wrappers
        return out
    if isinstance(v, list):
        return [clean(x) for x in v]
    if isinstance(v, float):
        return round(v, 4)
    return v

def digest(path):
    pkg = P.Pkg(path)
    sysname = path.split("/")[-1].replace(".uasset", "")
    kids = {}
    for i, ex in enumerate(pkg.exports):
        kids.setdefault(ex["outer"], []).append(i+1)
    result = {"system": sysname, "emitters": []}
    for i, ex in enumerate(pkg.exports):
        if ex["class"] != "NiagaraStatelessEmitter":
            continue
        eprops = P.export_props(pkg, i+1)
        einfo = {"name": ex["name"],
                 "emitterProps": {k: clean(v) for k, v in eprops.items()
                                  if k not in NOISE_KEYS and clean(v) not in ({}, [])},
                 "modules": [], "renderers": []}
        modorder = eprops.get("Modules", [])
        byname = {}
        for c in kids.get(i+1, []):
            cx = pkg.exports[c-1]
            byname[cx["name"]] = c
        for mname in modorder if isinstance(modorder, list) else []:
            c = byname.get(mname)
            if not c: continue
            cx = pkg.exports[c-1]
            try: props = P.export_props(pkg, c)
            except Exception as e: props = {"<err>": str(e)}
            enabled = props.get("bModuleEnabled", None)  # None => class default
            cp = {k: clean(v) for k, v in props.items() if k not in NOISE_KEYS and k != "bModuleEnabled"}
            cp = {k: v for k, v in cp.items() if v not in ({}, [])}
            einfo["modules"].append({"module": cx["class"].replace("NiagaraStatelessModule_", ""),
                                     "enabled": enabled, "props": cp})
        for c in kids.get(i+1, []):
            cx = pkg.exports[c-1]
            if "Renderer" in cx["class"]:
                try: props = P.export_props(pkg, c)
                except Exception as e: props = {"<err>": str(e)}
                cp = {k: clean(v) for k, v in props.items() if k not in NOISE_KEYS}
                cp = {k: v for k, v in cp.items() if v not in ({}, [])}
                einfo["renderers"].append({"class": cx["class"], "props": cp})
        result["emitters"].append(einfo)
    # regular (versioned) emitters, if any have real content
    reg = [ex["name"] for ex in pkg.exports if ex["class"] == "NiagaraEmitter"]
    if reg: result["versionedEmitterShells"] = reg
    return result

if __name__ == "__main__":
    for path in sys.argv[1:]:
        try:
            print(json.dumps(digest(path), indent=1, ensure_ascii=False, default=str))
        except Exception as e:
            print(json.dumps({"system": path, "error": str(e)}))
