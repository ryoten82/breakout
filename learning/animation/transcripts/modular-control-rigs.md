# SOURCE: Modular Control Rigs in Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/modular-control-rigs-in-unreal-engine?lang=en-US
取得方法: WebFetch（要約モード。実験的機能=Experimental Feature と明記されている点に注意）
取得日: 2026-07-04

---

This documentation describes how to use Modular Control Rigs, an **experimental feature** for character rigging in Unreal Engine.

## Core Concepts

A **Modular Control Rig** is built by combining pre-built Control Rig components called Modules, where "each Module represents a part of the character's body, such as an Arm, Leg, or Spine." This process is called **Visual Rigging** and uses a Schematic Overlay to connect modules in the viewport.

## Key Components

- **Modules**: reusable rig components for body parts
- **Connectors**: link modules together and "need to be resolved to a rig element for the module to operate correctly"
- **Sockets**: connection points on the skeleton that resolve connectors — they can be bones, controls, or nulls

## Getting Started

Prerequisites include having a skeletal mesh and enabling the Control Rig Modules plugin (optional but recommended). The workflow involves:

1. Creating a Modular Rig asset
2. Selecting a preview mesh
3. Dragging and dropping modules onto sockets in the viewport
4. Resolving any unresolved connectors manually if needed

## Module Authoring

Module authors create custom modules by converting Control Rig assets and defining:
- **Primary Connector**: Single connector per module, typically resolves to a socket
- **Secondary Connectors**: Multiple connectors for bones, controls, or nulls
- **Connector Rules**: Define what hierarchy elements can resolve to each connector
- **Metadata and Events**: Support for auto-resolution and inter-module communication

## Technical Notes

Modules execute sequentially (root to leaf) on a single thread. Modular Control Rigs are currently more performance-intensive than inlined Control Rigs, though "the benefits of ease-of-use and speed of building a character rig" are expected to outweigh this cost.
