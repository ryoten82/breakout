# 対象NiagaraSystemの詳細を一括取得してJSONダンプ（読み取り専用ツールのみ使用）
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mcp_call

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "niagara_dump")
os.makedirs(OUT, exist_ok=True)
NT = "NiagaraToolsets.NiagaraToolset_System"

def call(tool, args):
    resp = mcp_call.rpc("tools/call", {"name": "call_tool", "arguments": {
        "toolset_name": NT, "tool_name": tool, "arguments": args}})
    try:
        txt = resp["result"]["content"][0]["text"]
        return json.loads(txt)
    except Exception:
        return {"_error": resp}

DEEP = [
    "/Game/NiagaraExamples/FX_Weapons/MuzzleFlashes/NS_MuzzleFlash",
    "/Game/NiagaraExamples/FX_Weapons/Impacts/NS_Impact_Concrete",
    "/Game/NiagaraExamples/FX_Weapons/Impacts/NS_Impact_Metal",
    "/Game/NiagaraExamples/FX_Weapons/Trails/NS_BulletTracer",
    "/Game/NiagaraExamples/FX_Weapons/Trails/NS_SimpleRibbonTrail",
    "/Game/NiagaraExamples/FX_Ribbons/NS_TeslaCoil",
]
LIGHT = [
    "/Game/NiagaraExamples/FX_Weapons/Trails/NS_RocketTrail",
    "/Game/NiagaraExamples/FX_NDC/NS_NDC_Footsteps",
    "/Game/NiagaraExamples/FX_NDC/NS_NDC_Impacts",
    "/Game/NiagaraExamples/FX_NDC/NS_NDC_Footsteps_Fire",
    "/Game/NiagaraExamples/FX_NDC/NS_NDC_Footsteps_Bubbles",
    "/Game/NiagaraExamples/FX_Footstep/NS_Footstep_LW",
    "/Game/NiagaraExamples/FX_Footstep/NS_Footstep_Gravel",
    "/Game/NiagaraExamples/FX_Footstep/NS_Footstep_Fire",
    "/Game/NiagaraExamples/FX_Footstep/NS_Footstep_Bubbles",
    "/Game/NiagaraExamples/FX_Misc/NS_SkeletalMeshTris_Loop",
    "/Game/NiagaraExamples/FX_Misc/NS_SkeletalMeshTris_Burst",
    "/Game/NiagaraExamples/FX_Misc/NS_SkeletalMeshBones_Loop",
    "/Game/NiagaraExamples/FX_Misc/NS_SkeletalMeshBones_Burst",
    "/Game/NiagaraExamples/FX_Misc/NS_Boundary",
    "/Game/NiagaraExamples/FX_Misc/NS_Boundary_Box",
    "/Game/NiagaraExamples/FX_Misc/NS_Boundary_Cylinder",
    "/Game/NiagaraExamples/FX_Misc/NS_Boundary_Sphere",
    "/Game/NiagaraExamples/FX_Misc/NS_Bubble_Burst",
    "/Game/NiagaraExamples/FX_Misc/NS_Fire",
    "/Game/NiagaraExamples/FX_Misc/NS_FireworkBurst",
    "/Game/NiagaraExamples/FX_Misc/NS_HitDissolve",
]

def sysref(path):
    return {"refPath": path + "." + path.rsplit("/", 1)[1]}

def dump(name, obj):
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)

for path in DEEP:
    short = path.rsplit("/", 1)[1]
    print("DEEP", short, flush=True)
    ref = sysref(path)
    summary = call("GetSystemSummary", {"system": ref})
    dump(short + "_summary", summary)
    emitters = []
    try:
        emitters = [e["emitterName"] for e in summary["returnValue"]["emitters"]]
    except Exception:
        # try alternate keys
        rv = summary.get("returnValue", {})
        for k, v in rv.items():
            if isinstance(v, list) and v and isinstance(v[0], dict) and ("emitterName" in v[0] or "name" in v[0]):
                emitters = [e.get("emitterName", e.get("name")) for e in v]
    print("  emitters:", emitters, flush=True)
    for em in emitters:
        eref = {"system": ref, "emitterName": em}
        dump(f"{short}__{em}__topology", call("GetEmitterTopology", {"emitterRef": eref}))
        dump(f"{short}__{em}__values", call("GetEmitterInputValues", {"emitterRef": eref}))
        # renderers: probe indices 0..5
        for i in range(6):
            rd = call("GetRendererData", {"rendererRef": {"system": ref, "emitterName": em, "rendererIndex": i}})
            if isinstance(rd, dict) and rd.get("returnValue") and not rd.get("_error"):
                dump(f"{short}__{em}__renderer{i}", rd)
            else:
                break

for path in LIGHT:
    short = path.rsplit("/", 1)[1]
    print("LIGHT", short, flush=True)
    dump(short + "_summary", call("GetSystemSummary", {"system": sysref(path)}))

print("done")
