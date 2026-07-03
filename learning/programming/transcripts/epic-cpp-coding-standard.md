# SOURCE: Epic C++ Coding Standard for Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine
取得方法: WebFetch（全文再現プロンプト）
取得日: 2026-07-04

---

## Overview
Epic Games maintains mandatory coding standards emphasizing that "80% of the lifetime cost of a piece of software goes to maintenance." Standards improve readability, enable quick comprehension of new code, and ensure cross-compiler compatibility.

## Class Organization
Classes should be organized for readers, with public interfaces declared first, followed by private implementation.

## Copyright Notice
Public source files must begin with: `// Copyright Epic Games, Inc. All Rights Reserved.`

## Naming Conventions
- **PascalCase formatting**: Capitalize first letters without underscores (e.g., `Health`, `UPrimitiveComponent`)
- **Type prefixes**:
  - `T` for templates (e.g., `TArray`)
  - `U` for UObject-derived classes
  - `A` for AActor-derived classes
  - `S` for SWidget-derived classes
  - `I` for abstract interfaces
  - `C` for concept-alike structs
  - `E` for enums
  - `b` for booleans
  - `F` for most other classes
- **Method naming**: Use verbs; boolean functions should ask true/false questions
- **Macro naming**: Fully capitalized with underscores, prefixed with `UE_`

## Inclusive Word Choice
The standard emphasizes respectful language:
- Avoid metaphors reinforcing stereotypes (e.g., "blacklist/whitelist")
- Avoid references to historical trauma ("slave," "master," "nuke")
- Use gender-neutral pronouns ("they/them" for people; "it/its" for software)
- Avoid slang and colloquialisms

**Recommended replacements**: Use "allow list" instead of "whitelist," "primary" instead of "master," "replica" instead of "slave."

## Portable C++ Code
Use explicitly-sized types for consistency across platforms:
- `bool`, `TCHAR`, `uint8`, `int8`, `uint16`, `int16`, `uint32`, `int32`, `uint64`, `int64`, `float`, `double`, `PTRINT`

## Standard Library Usage
Prefer standard library features when they provide superior results and maintain API consistency. `<atomic>`, `<type_traits>`, `<initializer_list>`, `<regex>` (editor-only), `<limits>`, `<cmath>`, and `<cstring>` functions are acceptable. Avoid standard containers in non-interop code.

## Comments
- Write self-documenting code
- Provide useful, non-contradictory comments
- Rewrite bad code instead of over-commenting
- Use const as documentation; maintain const-correctness throughout

**Const guidelines**:
- Pass non-modified arguments by const reference/pointer
- Flag non-mutating methods as const
- Use const in loops when containers aren't modified
- Never const return values (inhibits move semantics)

## Modern C++ Language Syntax
- **C++20 required minimum**; use `static_assert`, `override`, `final`, `nullptr`
- **Avoid `auto`** except: lambda binding, verbose iterators, or complex template expressions
- **Range-based for loops** preferred over traditional iterators
- **Lambdas acceptable** but should be brief; use explicit captures instead of `[&]` or `[=]`
- **Strongly-typed enums**: Use `enum class` with underlying type
- **Move semantics**: Supported in containers; use `MoveTemp` for explicit invocation
- **Default member initializers**: Useful for simple values but consider rebuild implications

## Code Formatting
- **Braces**: Always on new lines; always include in single-statement blocks
- **Indentation**: Use tabs (4 characters), not spaces
- **Switch statements**: Include `break` or "falls through" comments; always include default case
- **If-else**: Always use braces; indent multi-way statements consistently

## Namespaces
- Most UE code avoids global namespaces; new APIs should use `UE::` namespace
- Implementation details in `UE::*::Private::`
- Avoid `using` declarations in global scope (affects unity builds)
- Forward-declare types within appropriate namespaces
- Macros cannot reside in namespaces; use `UE_` prefix instead

## Physical Dependencies
- Minimize file name prefixes (e.g., `Scene.cpp` not `UScene.cpp`)
- Use `#pragma once` for header guards
- Prefer forward declarations over includes
- Include specific headers, not broad ones like `Core.h`
- Separate Public and Private source directories for module visibility

## Encapsulation
Members should be private unless part of public/protected interface. Use `final` for non-derivable classes. Provide accessors for protected-only fields.

## General Style Issues
- Minimize dependency distance
- Split large methods into sub-methods
- No space between function name and parentheses
- Address compiler warnings
- Always use `TEXT()` macro for string literals
- Avoid shadowed variables
- Use named constants instead of anonymous literals
- Avoid extensive non-behavioral changes

## API Design Guidelines
- **Avoid boolean parameters**; use enum flags instead
- Keep parameter lists reasonable; use struct parameters when many values needed
- Avoid overloading by `bool` or `FString`
- Interface classes must be abstract
- Use `virtual` and `override` keywords together
- Pass UObjects by pointer, not reference

## Platform-Specific Code
Place platform code in appropriately named subdirectories. Abstract platform details through hardware abstraction layer functions. Use `#define` directives for platform properties rather than scattered `PLATFORM_*` checks throughout codebase.
