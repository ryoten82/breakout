import sys, re
sys.stdout.reconfigure(encoding="utf-8")
KEYS = "Material|SortMode|SortOrderHint|RendererSortOrder|SubImageSize|bSubImageBlend|Alignment|FacingMode|SourceMode|MeshBoundsScale|bCastShadows|FacingCameraMode|ComponentType|bLocalSpace|RibbonWidthMode|Shape|DrawDirection|CurveTension|TemplateComponent|bVelocityBlend|VelocityScale|PixelCoverageMode|MacroUVRadius|BaseExtents|Meshes|MaterialOverride"
PAT = re.compile('"(' + KEYS + ')"[ ]*:[ ]*("[^"]*"|[{]"refPath":[ ]*"[^"]*"[}]|[[][^]]{0,600}[]]|[-0-9.]+|true|false)')
for line in sys.stdin:
    st = line.strip()
    if st.startswith('{"') and len(st) > 500:
        outs = []
        for m in PAT.finditer(st):
            v = m.group(2)
            rps = re.findall('refPath":[ ]*"([^"]*)"', v)
            if rps: v = ",".join(p.split("/")[-1] for p in rps)
            outs.append(m.group(1) + "=" + v)
        print("      " + " | ".join(outs))
    else:
        print(line, end="")
