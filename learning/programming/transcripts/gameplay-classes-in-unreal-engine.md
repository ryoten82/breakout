# SOURCE: Gameplay Classes in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-classes-in-unreal-engine
取得方法: WebFetch（全文再現プロンプト・要約ではなく原文忠実モード）
取得日: 2026-07-04

---

## Gameplay Classes

Reference for creating and implementing gameplay classes.

Every gameplay class in Unreal Engine consists of a class header file (`.h`) and a class source file (`.cpp`). The class header contains the declarations of the class and its members, such as variables and functions, while the class source file is where the functionality of the class is defined by implementing the functions that belong to the class.

Classes in Unreal Engine have a standardized naming scheme so that you know instantly what kind of class it is simply by looking at the first letter, or prefix. The prefixes for gameplay classes are:

| Prefix | Meaning |
|--------|---------|
| `A` | Extends from the base class of spawnable gameplay objects. These are Actors, and can be spawned directly into the world. |
| `U` | Extend from the base class of all gameplay objects. These cannot be directly instanced into the world; they must belong to an Actor. These are generally objects like Components. |

### Adding Classes

The C++ Class Wizard sets up the header file and source file you need for your new class, and also updates your game module accordingly. The header file and source file automatically include the class declaration and class constructor, as well as Unreal Engine-specific code like the `UCLASS()` macro.

### Class Headers

Gameplay classes in Unreal Engine generally have separate and unique class header files. These files are usually named to match the class being defined within, minus the `A` or `U` prefix, and using the `.h` file extension. So, the class header file for the `AActor` class is named `Actor.h`. Although Epic code follows these guidelines, no formal relationship between class name and source file name exists in the current engine.

Class header files for gameplay classes use standard C++ syntax in conjunction with specialized macros to simplify the process of declaring classes, variables, and functions.

At the top of each gameplay class header file, the generated header file (created automatically) needs to be included. So, at the top of `ClassName.h`, the following line must appear:

```cpp
#include "ClassName.generated.h"
```

### Class Declaration

The class declaration defines the name of the class, what class it inherits from and, thus, any functions and variables it inherits. The class declaration also defines other engine and editor specific behavior that may be desired via class specifiers and metadata.

The syntax for declaring a class is as follows:

```cpp
UCLASS([specifier, specifier, ...], [meta(key=value, key=value, ...)])
class ClassName : public ParentName
{
    GENERATED_BODY()
}
```

The declaration consists of a standard C++ class declaration for the class. Above the standard declaration, descriptors such as class specifiers and metadata are passed to the `UCLASS` macro. These are used to create the `UClass` for the class being declared, which can be thought of as the engine's specialized representation of the class. Also, the `GENERATED_BODY()` macro must be placed at the very beginning of the class body.

#### Class Specifiers

When declaring classes, **Class Specifiers** can be added to the declaration to control how the class behaves with various aspects of the Engine and Editor.

| Class Specifier | Effect |
|-----------------|--------|
| `Abstract` | Declares the class as an "abstract base class", preventing the user from adding Actors of this class to Levels. Useful for classes which are not meaningful on their own. |
| `AdvancedClassDisplay` | Forces all properties of the class to show only in the advanced sections of details panels. Override with `SimpleDisplay` specifier on individual properties. |
| `AutoCollapseCategories=(Category1, Category2, ...)` | Negates the effects of the **AutoExpandCategories** Specifier on a parent class for listed categories. |
| `AutoExpandCategories=(Category1, Category2, ...)` | Specifies categories that should be automatically expanded in the Unreal Editor Property window. |
| `Blueprintable` | Exposes this class as an acceptable base class for creating Blueprints. Default is `NotBlueprintable`. Inherited by subclasses. |
| `BlueprintType` | Exposes this class as a type for variables in Blueprints. |
| `ClassGroup=GroupName` | Indicates that Unreal Editor's **Actor Browser** should include this class in the specified `GroupName` when **Group View** is enabled. |
| `CollapseCategories` | Indicates properties should not be grouped in categories in Editor Property windows. Propagated to child classes; can be overridden by `DontCollapseCategories`. |
| `Config=ConfigName` | Allows this class to store data in a configuration file (`.ini`). Properties declared with `config` or `globalconfig` specifiers are stored in the named file. Propagated to child classes. |
| `Const` | All properties and functions are `const` and exported as `const`. Inherited by subclasses. |
| `ConversionRoot` | Limits a subclass to only convert to child classes of the first root class going up the hierarchy. |
| `CustomConstructor` | Prevents automatic generation of the constructor declaration. |
| `DefaultToInstanced` | All instances are "instanced". Instanced classes are duplicated upon construction. Inherited by subclasses. |
| `DependsOn=(ClassName1, ClassName2, ...)` | All listed classes are compiled before this class. Multiple dependencies use comma-delimited single line or separate lines. |
| `Deprecated` | Class is deprecated; Objects won't be saved when serializing. Inherited by subclasses. |
| `DontAutoCollapseCategories=(Category, Category, ...)` | Negates `AutoCollapseCategories` for listed categories from parent class. |
| `DontCollapseCategories` | Negates `CollapseCategories` inherited from base class. |
| `EditInlineNew` | Objects can be created from Editor Property window rather than referenced from existing Assets. Propagated to child classes; overrideable with `NotEditInlineNew`. |
| `HideCategories=(Category1, Category2, ...)` | Hides specified categories from the user entirely. Propagated to child classes. |
| `HideDropdown` | Prevents this class from showing in property window combo boxes. |
| `HideFunctions=(Category1, Category2, ...)` or `HideFunctions=FunctionName` | Hides specified functions from user entirely. |
| `Intrinsic` | Indicates the class was declared directly in C++, no boilerplate from **Unreal Header Tool**. Do not use on new classes. |
| `MinimalAPI` | Exports only the class's type information for other modules. Class can be cast to, but functions cannot be called (except inline). Improves compile times. |
| `NoExport` | Declaration shouldn't be included in auto-generated C++ header. Must be defined manually. Only valid for native classes; don't use for new classes. |
| `NonTransient` | Negates `Transient` inherited from base class. |
| `NotBlueprintable` | Not an acceptable base class for creating Blueprints. Default; inherited by subclasses. |
| `NotPlaceable` | Negates `Placeable` inherited from base class. Objects cannot be placed into Levels, UI scenes, or Blueprints in Editor. |
| `PerObjectConfig` | Configuration stored per Object, with sections in `.ini` named `[ObjectName ClassName]`. Propagated to child classes. |
| `Placeable` | Can be created in Editor and placed into level, UI scene, or Blueprint. Propagated to child classes; overrideable with `NotPlaceable`. |
| `ShowCategories=(Category1, Category2, ...)` | Negates `HideCategories` for listed categories from base class. |
| `ShowFunctions=(Category1, Category2, ...)` or `ShowFunctions=FunctionName` | Shows specified functions in property viewer. |
| `Transient` | Objects never saved to disk. Useful for non-persistent native classes like players or windows. Propagated to child classes; overrideable by `NonTransient`. |
| `Within=OuterClassName` | Objects cannot exist outside instance of `OuterClassName` Object. Creating requires `OuterClassName` instance as `Outer` Object. |

### Metadata Specifiers

When declaring classes, interfaces, structs, enums, enum values, functions, or properties, you can add **Metadata Specifiers** to control how they interact with various engine and editor aspects. Each data structure type has its own list of Metadata Specifiers.

**Metadata only exists in the editor; do not write game logic that accesses metadata.**

Classes can use the following Metatag Specifiers:

| Class Meta Tag | Effect |
|----------------|--------|
| `BlueprintSpawnableComponent` | Component Class can be spawned by a Blueprint. |
| `BlueprintThreadSafe` | Only valid on Blueprint function libraries. Marks functions as callable on non-game threads in animation Blueprints. |
| `ChildCannotTick` | For Actor and Component classes. If native class cannot tick, Blueprint-generated subclasses cannot tick, even if `bCanBlueprintsTickByDefault` is true. |
| `ChildCanTick` | For Actor and Component classes. If native class cannot tick, Blueprint-generated subclasses can override `bCanEverTick` flag, even if `bCanBlueprintsTickByDefault` is false. |
| `DeprecatedNode` | For behavior tree nodes; indicates class is deprecated and displays warning when compiled. |
| `DeprecationMessage="Message Text"` | Deprecated classes include this text with standard deprecation warning during Blueprint Script compilation. |
| `DisplayName="Blueprint Node Name"` | Blueprint Script node name replaced with provided value instead of code-generated name. |
| `DontUseGenericSpawnObject` | Do not spawn Object using Generic Create Object node in Blueprint Scripts; applies to Blueprint-type classes neither Actors nor Actor Components. |
| `ExposedAsyncProxy` | Expose proxy Object in Async Task nodes. |
| `IgnoreCategoryKeywordsInSubclasses` | Makes first subclass ignore all inherited `ShowCategories` and `HideCategories` Specifiers. |
| `IsBlueprintBase="true/false"` | States if class is acceptable base for creating Blueprints, similar to `Blueprintable` or `NotBlueprintable` Specifiers. |
| `KismetHideOverrides="Event1, Event2, .."` | List of Blueprint events not allowed to be overridden. |
| `ProhibitedInterfaces="Interface1, Interface2, .."` | Lists Interfaces incompatible with the class. |
| `RestrictedToClasses="Class1, Class2, .."` | Blueprint function library classes restrict usage to named classes. |
| `ShortToolTip="Short tooltip"` | Short tooltip for contexts where full tooltip might overwhelm, like Parent Class Picker dialog. |
| `ShowWorldContextPin` | Blueprint nodes in graphs owned by class must show World context pins, even if normally hidden, because Objects cannot be World context. |
| `UsesHierarchy` | Indicates class uses hierarchical data. Instantiates hierarchical editing features in Details panels. |
| `ToolTip="Hand-written tooltip"` | Overrides automatically generated tooltip from code comments. |
| `ScriptName="DisplayName"` | Name for class, property, or function when exporting to scripting language. Include deprecated names as additional semi-colon-separated entries. |

### Class Implementation

All gameplay classes must use the `GENERATED_BODY` macro for proper implementation in the class header (`.h`) file defining the class and its variables and functions. A best practice is naming class source and header files to match the class being implemented, minus the `A` or `U` prefix. So, the source file for the `AActor` class is named `Actor.cpp`, and its header file is named `Actor.h`. The "Add C++ Class" menu option handles this automatically.

The source file (`.cpp`) must include the header file (`.h`) containing the C++ class declaration.

```cpp
#include "EnginePrivate.h"
```

#### Class Constructor

`UObjects` use **Constructors** to set default values for properties and variables, performing other necessary initialization. The class constructor is generally in the class implementation file, e.g., the `AActor::AActor` constructor is in `Actor.cpp`.

Constructors can be placed inline in class header files. However, if the header contains the constructor, the UClass must be declared with the `CustomConstructor` specifier, preventing automatic code generator creation.

##### Constructor Format

The most basic UObject constructor form:

```cpp
UMyObject::UMyObject()
{
    // Initialize Class Default Object properties here.
}
```

This initializes the Class Default Object (CDO), the master copy on which future class instances base. A secondary constructor supports property-altering structure:

```cpp
UMyObject::UMyObject(const FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer)
{
    // Initialize CDO properties here.
}
```

Although neither constructor performs initialization, the engine initializes all fields to zero, NULL, or default constructor values. Initialization code in the constructor applies to the CDO, copied to new instances created properly within the engine, as with `CreateNewObject` or `SpawnActor`.

The `FObjectInitializer` parameter, despite being const-marked, configures via built-in mutable functions to override properties and subobjects.

```cpp
AUDKEmitterPool::AUDKEmitterPool(const FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer.DoNotCreateDefaultSubobject(TEXT("SomeComponent")).DoNotCreateDefaultSubobject(TEXT("SomeOtherComponent")))
{
    // Initialize CDO properties here.
}
```

```cpp
AUTDemoHUD::AUTDemoHUD()
{
    // Initialize CDO properties here.
    SomeProperty = 26;
}
```

##### Constructor Statics and Helpers

Setting values for complex data types, especially class references, names, and asset references, requires defining and instantiating a **ConstructorStatics** struct in the constructor holding needed property values. This `ConstructorStatics` struct creates only the first constructor run; subsequent runs copy a pointer, making it extremely fast.

**ContructorHelpers** is a special namespace in `ObjectBase.h` containing helper templates for common constructor actions.

###### Asset References

Ideally, asset references don't exist in classes. Hardcoded references are brittle; the preferred method uses Blueprints for configuring asset properties. However, hardcoded references remain fully supported.

`ConstructorHelpers::FObjectFinder` finds specified `UObject` reference using `StaticLoadObject`. Generally references assets in content packages. Reports failure if not found.

```cpp
ATimelineTestActor::ATimelineTestActor()
{
    // Structure to hold one-time initialization
    struct FConstructorStatics
    {
        ConstructorHelpers::FObjectFinder<UStaticMesh> Object0;
        FConstructorStatics()
        : Object0(TEXT("StaticMesh'/Game/UT3/Pickups/Pickups/Health_Large/Mesh/S_Pickups_Base_Health_Large.S_Pickups_Base_Health_Large'"))
        {
        }
    };
    static FConstructorStatics ConstructorStatics;

    // Property initialization

    StaticMesh = ConstructorStatics.Object0.Object;
}
```

###### Class References

`ConstructorHelpers::FClassFinder` finds specified `UClass` reference and reports failure if not found.

```cpp
APylon::APylon(const class FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer)
{
    // Structure to hold one-time initialization
    static FClassFinder<UNavigationMeshBase> ClassFinder(TEXT("class'Engine.NavigationMeshBase'"));
    if (ClassFinder.Succeeded())
    {
        NavMeshClass = ClassFinder.Class;
    }
    else
    {
        NavMeshClass = nullptr;
    }
}
```

In many cases, you can use `USomeClass::StaticClass()` and skip ClassFinder complexity:

```cpp
NavMeshClass = UNavigationMeshBase::StaticClass();
```

For cross-module references, ClassFinder method is probably better.

###### Components and Sub-Objects

Creating component subobjects and attaching to the actor's hierarchy also happens in the constructor. When spawning an actor, its components clone from the CDO. To ensure components always create, destroy, and properly garbage-collect, every component pointer created in the constructor should store in an UPROPERTY of the owning class.

```cpp
UCLASS()
class AWindPointSource : public AActor
{
    GENERATED_BODY()
    public:

    UPROPERTY()
    UWindPointSourceComponent* WindPointSource;

    UPROPERTY()
    UDrawSphereComponent* DisplaySphere;
};

AWindPointSource::AWindPointSource()
{
    // Create a new component and give it a name.
    WindPointSource = CreateDefaultSubobject<UWindPointSourceComponent>(TEXT("WindPointSourceComponent0"));

    // Set our new component as the RootComponent of this actor, or attach it to the root if one already exists.
    if (RootComponent == nullptr)
    {
        RootComponent = WindPointSource;
    }
    else
    {
        WindPointSource->AttachTo(RootComponent);
    }

    // Create a second component. This will be attached to the component we just created.
    DisplaySphere = CreateDefaultSubobject<UDrawSphereComponent>(TEXT("DrawSphereComponent0"));
    DisplaySphere->AttachTo(RootComponent);

    // Set some properties on the new component.
    DisplaySphere->ShapeColor.R = 173;
    DisplaySphere->ShapeColor.G = 239;
    DisplaySphere->ShapeColor.B = 231;
    DisplaySphere->ShapeColor.A = 255;
    DisplaySphere->AlwaysLoadOnClient = false;
    DisplaySphere->AlwaysLoadOnServer = false;
    DisplaySphere->bAbsoluteScale = true;
}
```

Modifying a component from the parent class generally isn't necessary. However, all attached components list, including parent class components, is available by calling `GetAttachParent`, `GetParentComponents`, `GetNumChildrenComponents`, `GetChildrenComponents`, and `GetChildComponent` on any `USceneComponent`, including the root component.
