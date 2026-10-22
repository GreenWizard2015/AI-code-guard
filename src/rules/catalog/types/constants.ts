export const TYPES_RULE_DATA = {
	"explicit-return-type": {
		message: "callable is missing an explicit return type",
		hint: "Add an explicit result annotation to every named function, method, getter, or interface method. Do not: rely on return-type inference at a callable boundary.",
		priority: 5,
	},
	"typescript-overload": {
		message: "avoid TypeScript overload signatures",
		hint: "replace overload signatures with one explicit method or function contract. Do not: hide alternate contracts behind repeated declarations.",
		priority: 6,
	},
	"duplicate-type-shape": {
		message: "duplicate type shape: {names}",
		hint: "Replace duplicate field shapes with one named interface or a shared domain class. Keep separate classes when the types represent different domain entities.",
		priority: 5,
	},
	"python-explicit-parameter-type": {
		message: 'Python parameter "{name}" is missing an explicit type',
		hint: "Add an explicit type annotation to every parameter except self and cls.",
		priority: 5,
	},
	"python-explicit-field-type": {
		message: 'Python field "{name}" is missing an explicit type',
		hint: "Declare every class field with an explicit annotation.",
		priority: 5,
	},
	"python-string-type-annotation": {
		message: "Python type annotation must not be a string",
		hint: "use a direct type annotation such as Model or list[Model]. Do not: put a type expression inside a quoted string.",
		priority: 5,
	},
	"typescript-in-operator": {
		message: "do not use in for non-collection membership checks",
		hint: "Use an explicit property or collection operation. Do not use if (key in value) unless value is a Map, Set, WeakMap, or WeakSet.",
		priority: 2,
	},
	"typescript-static-method": {
		message: "avoid static methods",
		hint: "move the static operation to a module-level function with explicit arguments. Do not: hide dependencies in static state.",
		priority: 2,
	},
	"typescript-static-field": {
		message: "avoid static fields",
		hint: "move the state to an instance field owned by an explicit object, or move a constant to the module level. Do not: hide shared mutable or configuration state on a class.",
		priority: 2,
	},
	"project-type-boundary": {
		message: "use a Protocol or interface for project-typed parameters, results, and fields",
		hint: "replace project implementation classes in every parameter, result, and field with a Protocol, interface, or focused value contract. Do not: expose a project class, including in private members.",
		priority: 5,
	},
	"contract-naming": {
		message: "contract declaration must end with Contract and avoid Prot, Proto, Protocol, or Interface",
		hint: "Use a domain name ending in Contract. Do not: include Prot, Proto, Protocol, or Interface in the name.",
		priority: 5,
	},
	"typescript-prototype-assignment": {
		message: "avoid prototype-based class construction",
		hint: "declare a real class and put methods in its class body. Do not: assign methods through Constructor.prototype.",
		priority: 6,
	},
	"dynamic-type": {
		message: "avoid dynamic class construction with type(...)",
		hint: "declare a real class with explicit methods. Do not: assemble project-owned classes via type(...).",
		priority: 6,
	},
	"python-type-factory": {
		message: "avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)",
		hint: "declare an explicit dataclass or normal class with typed fields. Do not: assemble project-owned types through type factories.",
		priority: 6,
	},
	"large-union": {
		message: "avoid overly broad unions",
		hint: "split a broad union into a focused type or protocol. For T | None, use Optional[T]. Do not: widen one contract with unrelated alternatives.",
		priority: 5,
	},
	"python-optional-union": {
		message: "use Optional[T] instead of T | None",
		hint: "replace T | None with Optional[T]. Do not: spell optional values as a union in annotations.",
		priority: 5,
	},
	"python-conditional-type-alias": {
		message: "do not assign type-shaped values inside conditional branches",
		hint: "define one stable type contract outside the conditional. Do not: assign a type-shaped value inside an if or else branch.",
		priority: 5,
	},
	"nullable-domain-type": {
		message: "replace nullable types with specialized state classes",
		hint: "replace User | null, string | null, User | undefined, or Optional[str] with explicit state classes such as FoundUser, NotFoundUser, or EmptyValue. Do not: encode a state as nullability.",
		priority: 6,
	},
	"typescript-type-guard": {
		message: "avoid TypeScript is type guards",
		hint: "return an explicit result or use a dedicated class/protocol boundary. Do not: narrow project state through a return type of the form value is Type.",
		priority: 5,
	},
	"typescript-union-contract-bypass": {
		message: "do not hide required fields behind a base-or-intersection union",
		hint: "define one explicit contract with all required fields, or use named state classes. Do not: use Base | (Base & { required fields }) to simulate optional metadata.",
		priority: 6,
	},
	"typescript-rest-union-contract": {
		message: "do not use a union type in a rest parameter",
		hint: "replace the rest union with one explicit options object or separate named operations. Do not: encode unrelated call modes in a variadic union.",
		priority: 6,
	},
	"composite-state-type": {
		message: "replace composite union or intersection types with explicit contracts",
		hint: "Declare the required fields on one explicit object contract, or use specialized classes for distinct states. Do not: combine named types with union or intersection operators.",
		priority: 6,
	},
	"typescript-index-signature": {
		message: "index signatures are not allowed",
		hint: "replace the open-ended map with a named interface and explicit methods or a focused domain class. Do not: accept arbitrary string or number keys through an index signature.",
		priority: 5,
	},
	"callback-contract-size": {
		message: 'callback contract "{name}" has too many parameters (found {count})',
		hint: "Replace a callback with more than three parameters with a named interface, protocol, or event object. Do not: keep an unnamed multi-role callback contract.",
		priority: 3,
	},
	"typescript-typeof": {
		message: "avoid repeated typeof checks in business logic",
		hint: "validate the value once at the input boundary. Do not: repeat typeof checks in business logic.",
		priority: 4,
	},
	"typescript-instanceof": {
		message: "avoid repeated instanceof checks in business logic",
		hint: "narrow the value at the boundary. Do not: scatter instanceof checks through business logic.",
		priority: 4,
	},
	"typescript-object-prototype-string": {
		message: "avoid Object.prototype.toString.call",
		hint: "use an explicit type guard or narrow value check. Do not: inspect values through Object.prototype.toString.call.",
		priority: 4,
	},
	"typescript-object-assign": {
		message: "avoid Object.assign",
		hint: "assign owned fields explicitly or use a focused method that owns the state transition. Do not: merge object state through Object.assign.",
		priority: 4,
	},
	"typescript-object-method-call": {
		message: "avoid Object method .call",
		hint: "call the method directly or use an explicit typed helper. Do not: invoke Object methods through .call.",
		priority: 4,
	},
	"empty-contract": {
		message: "avoid empty protocols and interfaces",
		hint: "add the smallest meaningful members to the contract or remove the abstraction. Do not: use an empty Protocol or interface as a naming-only type.",
		priority: 5,
	},
	"inline-generic-type": {
		message: "avoid inline object types in generic arguments",
		hint: "name the nested type as a type alias, interface, or focused protocol before using it as a generic argument. Do not: describe nested generic arguments anonymously inline.",
		priority: 5,
	},
	"nested-generic-type": {
		message: "nested generic type applications must be named",
		hint: "replace nested generic applications such as Promise<Array<Result>> with a named alias, interface, or focused type. Do not: keep multiple generic layers at a type boundary.",
		priority: 5,
	},
	"typescript-logical-assignment": {
		message: "avoid logical assignment operators",
		hint: "use an explicit if condition followed by an assignment so the state transition is visible. Do not: hide initialization or mutation behind ??=, ||=, or &&=.",
		priority: 2,
	},
	"typescript-conditional-block": {
		message: "TypeScript if and else branches must use braces",
		hint: "wrap every TypeScript if and else body in braces. Do not: rely on single-statement conditional bodies.",
		priority: 2,
	},
	"typescript-explicit-visibility": {
		message: "class members must declare visibility explicitly",
		hint: "Add public, protected, or private explicitly to every class field and method. Do not rely on TypeScript default visibility.",
		priority: 5,
	},
	"typescript-mutable-field": {
		message: "TypeScript class fields should be readonly",
		hint: "Prefer readonly for class fields and move intentional changes behind an explicit state transition method. If the field must be mutable, ignore this information.",
		priority: 5,
	},
	"typescript-fake-object": {
		message: "avoid object literals that imitate classes",
		hint: "replace an object with multiple callable fields by a focused class or explicit module functions. Do not: hide stateful or cohesive behavior behind a namespace-shaped object.",
		priority: 6,
	},
	"typescript-object-literal-return": {
		message: "do not return callable object literals as classes or interfaces",
		hint: "return a real class instance or a focused implementation class when the contract has behavior. Do not: satisfy a class or interface with an object literal that contains callable fields.",
		priority: 6,
	},
	"typescript-jest-min-size": {
		message: "Jest suite is too short ({size} lines/SLOC metric)",
		hint: "Keep focused tests in a meaningful suite. Do not: create a describe block for one tiny test.",
		priority: 7,
	},
	"typescript-jest-max-size": {
		message: "Jest suite is too large ({size} lines/SLOC metric)",
		hint: "Split the suite into focused describe blocks. Do not: hide an oversized test suite behind helper wrappers.",
		priority: 3,
	},
	"typescript-jest-describe-count": {
		message: "Jest file must contain exactly one top-level describe (found {count})",
		hint: "Keep exactly one top-level describe in each Jest file. Do not: place multiple suites in one file.",
		priority: 6,
	},
	"typescript-jest-nested-describe": {
		message: "nested Jest describe blocks are not allowed",
		hint: "Keep the single Jest describe flat. Do not: nest another describe inside it.",
		priority: 6,
	},
	"typescript-bare-type-alias": {
		message: "avoid bare type aliases",
		hint: "use the original type directly, or introduce a distinct interface, object shape, or wrapper with its own contract. Do not: rename one project type without adding behavior or structure.",
		priority: 5,
	},
	"typescript-singular-plural-alias": {
		message: "optional singular/plural fields may be aliases",
		hint: "check whether the optional singular and plural fields encode one alias relationship, then resolve the defining type before storing both. Do not: treat duplicate optional representations as independent state.",
		priority: 5,
	},
	"typescript-parameter-property": {
		message: "declare TypeScript constructor fields explicitly",
		hint: "declare a readonly field in the class body and assign it explicitly in the constructor. Do not: combine constructor parameters with field declarations through public, private, protected, or readonly parameter properties.",
		priority: 5,
	},
	"typescript-interface-shape": {
		message: "use an interface instead of a callable-heavy type alias or object shape",
		hint: "Refactor the shape into an interface when the shared contract is mostly behavior, or into a focused wrapper class when it owns state or lifecycle. Do not: keep a namespace-shaped type alias with many callable fields.",
		priority: 5,
	},
	"type-field-count": {
		message: "type has too many fields (found {count})",
		hint: "split the contract into focused named types or compose smaller types. Do not: keep growing one type with unrelated fields.",
		priority: 3,
	},
	"unused-type": {
		message: 'type declaration "{name}" has no production usage',
		hint: "Remove the type or add a real production usage. Do not: preserve an unused type only for tests.",
		priority: 7,
	},
	"typescript-class-callback-fields": {
		message: "class has {count} callback fields with default implementations",
		hint: "Declare callback behavior as methods or move it behind a focused collaborator; do not assign arrow or function callbacks as class-field defaults.",
		priority: 5,
	},
	"typescript-bind": {
		message: "avoid .bind calls",
		hint: "use a lambda that captures the receiver explicitly. Do not: hide callback binding behind method.bind(...).",
		priority: 4,
	},
	"typescript-dynamic-runtime-usage": {
		message: "avoid reflective and dynamic runtime APIs",
		hint: "use an explicit class, interface, typed operation, or Map/Set API. Do not: use Reflect.*, Proxy, computed string access, or object membership with in.",
		priority: 4,
	},
	"naming-type": {
		message: '{label} "{name}" must use PascalCase without underscores',
		hint: "rename {label} declarations to PascalCase without underscores. Do not: use snake_case or a leading underscore for a {label}.",
		priority: 2,
	},
	"typescript-module-constant-case": {
		message: 'module-level constant "{name}" must use UPPER_SNAKE_CASE',
		hint: "rename every module-level const to UPPER_SNAKE_CASE, including exported const declarations. Do not: use a lowercase, camelCase, or mixed-case constant name.",
		priority: 2,
	},
	"typescript-module-variable": {
		message: 'module-level variable "{name}" is not allowed',
		hint: "replace module-level let or var with an immutable UPPER_SNAKE_CASE const, or move the mutable state into an owning class. Do not: keep module-level mutable variables, including exported ones.",
		priority: 2,
	},
	"nested-type": {
		message: "nested type declarations are not allowed ({count})",
		hint: "Move every type alias, interface, or enum to a top-level focused module. Do not: hide type declarations inside namespaces, classes, functions, or blocks.",
		priority: 8,
	},
	"typescript-namespace-file": {
		message: "namespace file must contain one namespace and imports only outside it",
		hint: "Keep exactly one namespace declaration per file; move all other code inside it and leave only imports outside. Do not: place classes, functions, values, or additional namespaces beside it.",
		priority: 7,
	},
	"contract-fields": {
		message: '{kind} "{class_name}" must not declare mutable field "{field_name}"',
		hint: "Keep mutable state behind methods. Immutable TypeScript readonly snapshots are allowed; expose Python values through methods. Do not: expose writable interface or Protocol attributes.",
		priority: 5,
	},
	"type-info": {
		message: "{subject} uses {type} instead of a concrete type",
		hint: "replace generic types with a concrete value contract or a focused protocol. If the type is intentionally generic at a boundary, ignore this information.",
		priority: 5,
	},
	"typescript-unknown-parameter-type": {
		message: 'parameter "{name}" must not use unknown',
		hint: "replace unknown with a concrete domain type or a focused protocol. Do not: accept an unbounded unknown value at a parameter boundary.",
		priority: 5,
	},
	"unbounded-type": {
		message: "unbounded type is not allowed outside method bodies",
		hint: "replace any, unknown, object, or Python Any with a concrete domain type or a focused protocol. Do not: expose an unbounded type in a field, declaration, parameter, or return contract.",
		priority: 5,
	},
	"type-warning": {
		message: "{subject} uses {type} instead of a concrete type",
		hint: "replace generic types with a concrete value contract or a focused protocol. If the type is intentionally generic at a boundary, ignore this information.",
		priority: 5,
	},
	"typescript-dictionary-return": {
		message: "function returns a dictionary type alias",
		hint: "Consider making the returned T type a class with one or more constructors when it owns behavior or lifecycle. If it is only data, keep the dictionary type and ignore this advice.",
		priority: 5,
	},
	"typescript-type-operation": {
		message: 'avoid type operation "{operation}"',
		hint: "declare an explicit named project type with the fields and operations it owns. Do not: hide a project contract behind Pick, Omit, indexed access, keyof, typeof, intersections, or other type transformations. If you checked the code and this advice is not appropriate for its context, ignore it.",
		priority: 5,
	},
	"typescript-inline-object-type": {
		message: "avoid inline object types",
		hint: "name the object shape as a type alias or interface and reuse it. Do not: duplicate anonymous object types inline.",
		priority: 5,
	},
	"typescript-inline-union-type": {
		message: "avoid inline literal union types",
		hint: "name the literal union as a type alias and reuse it at the boundary. Do not: describe a finite value contract anonymously in a parameter or return type.",
		priority: 5,
	},
	"tuple-type": {
		message: "avoid tuple types",
		hint: "replace positional tuple types with a named interface or class whose fields express the contract. Do not: return or pass data through unnamed tuple positions.",
		priority: 5,
	},
	"shared-parameter-type": {
		message: 'multiple {noun} share parameter type "{parameters}" ({support}). Candidates: {candidates}.',
		hint: "Inspect every production use of the shared type before refactoring. When appropriate, create a focused wrapper around the project type as a focused project wrapper, or extend the owning project class/protocol. Do not: hide the contract with type transformations or duplicate it across callables.",
		priority: 5,
	},
	"functions-file-type-declaration": {
		message: "functions file must not declare types",
		hint: "Keep functions.ts and functions.py limited to cohesive callable implementations; move every type description into its owning type module or class. Do not: declare classes, aliases, interfaces, enums, or structural type values here.",
		priority: 7,
	},
	"module-types-separation": {
		message: "module-level types must move to {target} or a focused file",
		hint: "Move module-level types out of ordinary implementation files. Use types.ts or types.py, or a focused file when the types belong together. Do not: keep module-level types beside implementation code.",
		priority: 7,
	},
} as const;
