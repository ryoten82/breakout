# SOURCE: Delegates and Lambda Functions in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/delegates-and-lambda-functions-in-unreal-engine
取得方法: WebFetch（全文再現プロンプト）
取得日: 2026-07-04

---

## Delegates

"Data types that reference and execute member functions on C++ Objects"

Delegates enable calling member functions on C++ objects in a generic, type-safe manner. They can be dynamically bound to member functions of arbitrary objects and invoked later, even when the caller doesn't know the object's type. The engine supports three delegate types:

- Single
- Multicast
- Dynamic (UObject, serializable)

## Declaring Delegates

Delegate declarations use macros based on the function signature. Supported features include:

- Functions returning values
- Functions declared as `const`
- Up to four payload variables
- Up to eight function parameters

Basic macro patterns include `DECLARE_DELEGATE`, `DECLARE_DELEGATE_OneParam`, and variants with return values like `DECLARE_DELEGATE_RetVal`.

Delegate function declarations can exist at global scope, within namespaces, or inside class declarations, but not within function bodies.

## Binding Delegates

The binding system offers several methods:

- **Bind**: Binds to an existing delegate object
- **BindStatic**: Binds raw C++ pointer global functions
- **BindRaw**: Binds raw C++ pointer delegates
- **BindLambda**: Binds functors/lambda functions
- **BindSP**: Binds shared pointer-based member functions
- **BindUObject**: Binds UObject member functions
- **UnBind**: Unbinds the delegate

Delegates to UObjects and shared pointers maintain weak references, enabling safe execution checks via `IsBound()` or `ExecuteIfBound()`.

## Payload Data

Arbitrary variables can be passed during binding and will be forwarded to bound functions upon invocation. Example: "MyDelegate.BindRaw( &MyFunction, true, 20 );" passes a bool and int32.

## Executing Delegates

The `Execute()` function calls the bound function. Safety checks include:

- **Execute**: Executes without checking bindings
- **ExecuteIfBound**: Checks binding before execution
- **IsBound**: Verifies binding status
