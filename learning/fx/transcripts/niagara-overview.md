# SOURCE: Overview of Niagara Effects for Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/overview-of-niagara-effects-for-unreal-engine
取得方法: WebFetch（全文再現プロンプト・良質ソース）
取得日: 2026-07-04

---

Niagara is Unreal Engine's next-generation visual effects system that enables technical artists to create custom functionality without programmer assistance.

## Core Components

**Systems** serve as containers holding all necessary elements for an effect, with system-level behaviors that apply throughout.

**Emitters** generate particles and control their birth, aging, appearance, and behavior through an organized stack of groups including Emitter Spawn, Emitter Update, Particle Spawn, Particle Update, Event Handler, and Render.

**Modules** are fundamental building blocks processed sequentially from top to bottom. They perform mathematical operations on data using HLSL, though they can be built visually using graph nodes. Users can inspect and copy existing modules.

**Parameters** abstract data in simulations, with four types: Primitive (numeric data), Enum (fixed named values), Struct (combined Primitive and Enum types), and Data Interfaces (functions providing external data).

## Workflow

The typical process involves creating a Niagara System, adding or creating emitters, then adding or creating modules within emitters. Pre-existing modules typically suffice for most effects.

## Key Paradigms

**Inheritance** enables effective asset reuse through hierarchical organization, allowing child emitters to override parent values.

**Dynamic Inputs** provide extensibility by acting on value types rather than parameter maps, reducing module bloat.

**Micro Expressions** convert inline values into HLSL snippets for small, one-off features.

**Events** facilitate communication between particles, emitters, and systems through structured data payloads.

**Data Interfaces** enable access to arbitrary data including mesh information, audio, and external sources.

**Houdini integration** allows importing calculated data via CSV format for particle spawning and positioning.
