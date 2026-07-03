# SOURCE: Essential Unreal Engine Material Concepts
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/essential-unreal-engine-material-concepts
取得方法: WebFetch（1回目は著作権懸念で全文再現を拒否・要約のみ返却）
取得日: 2026-07-04

---

## Materials Fundamentals
Materials define surface properties and control how objects interact with light in Unreal Engine scenes. They're created visually without writing HLSL code directly.

## Shading Pipeline
The Material Editor uses a visual node-based interface to create shaders, which are automatically converted to HLSL code behind the scenes.

## Material Creation Process
Users create materials by combining Material Expression nodes in a graph, configuring three essential properties (**Material Domain**, **Blend Mode**, and **Shading Model**), then connecting data to the Main Material Node before compiling.

## Material Expressions
These nodes represent HLSL code snippets and perform specific actions. Data flows between them via connection cables.

## Efficiency Features
**Material Instances** allow rapid variations from parent materials without recompilation, while **Material Functions** enable reusable node networks.

## Data Types
Four floating-point data types (Float, Float2, Float3, Float4) represent all information in material graphs, with proper type matching being essential for node operations.
