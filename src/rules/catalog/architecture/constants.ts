export const ARCHITECTURE_RULE_DATA = {
	"python-class-method": {
		message: "avoid class methods",
		hint: "replace the class-level factory or operation with a module-level function. Do not: keep behavior on @classmethod.",
		priority: 2,
	},
	"python-data-class-method": {
		message: "avoid logic methods in Python dataclasses",
		hint: "keep dataclasses as state; allow only special methods and __post_init__. Move logic into a normal class.",
		priority: 6,
	},
	"python-abstract-class": {
		message: "replace Python abstract classes with Protocols or interfaces",
		hint: "use a structural Protocol or interface for the contract and a normal class for behavior. Do not: inherit from ABC or ABCMeta or use abstractmethod in a project class.",
		priority: 7,
	},
	"single-item-array-state": {
		message: "do not use a single-item array as nullable state",
		hint: "return an explicit state class or a named result contract. Do not: return T[] only to represent a missing value and read the result with [0].",
		priority: 6,
	},
	"callable-feature-detection": {
		message: "avoid callable feature detection for project-owned interfaces",
		hint: "call the project-owned interface directly. Do not: probe callable and silently choose a fallback.",
		priority: 4,
	},
	"public-state-exposure": {
		message: "public mutable collection field exposes owned state",
		hint: "make the collection private or protected and expose a read-only view or an owning method. Do not: let callers mutate a class collection directly.",
		priority: 5,
	},
	"python-direct-class-init": {
		message: "avoid direct calls to Class.__init__",
		hint: "use super().__init__ inside the subclass constructor or construct the object normally. Do not: invoke another class constructor through Class.__init__(...).",
		priority: 4,
	},
	"field-in-constructor": {
		message: "initialize object fields in the constructor",
		hint: "Declare the field without constructing its value, then initialize it in the constructor, __init__, or __post_init__. Do not: call an object constructor or factory in a field initializer.",
		priority: 5,
	},
	"mutable-field-assignment": {
		message: "avoid assigning class fields outside constructors",
		hint: "assign instance fields in __init__, __post_init__, or the constructor and keep methods immutable. Do not: mutate self.field from ordinary methods.",
		priority: 5,
	},
	"proxy-callable": {
		message: "avoid proxy methods and forwarding functions",
		hint: "call the dependency directly or move the behavior into the owning class. Do not: keep a method or function that only forwards the same arguments and return value.",
		priority: 4,
	},
	"proxy-lambda": {
		message: "avoid forwarding lambdas",
		hint: "call the owning method directly or pass the owning object through its interface. The rule compares lambda parameters with forwarded call arguments; external API callbacks are outside this rule.",
		priority: 4,
	},
	"stateless-class": {
		message: "class is stateless",
		hint: "Refactor only after identifying what data, dependencies, or lifecycle should become object state. If no meaningful state remains, prefer a module-level function with explicit arguments; keep a class for a protocol/adapter boundary or when it will own state, not as a namespace for stateless helpers.",
		priority: 6,
	},
	"procedural-class-name": {
		message: 'class name describes a job: "{name}"',
		hint: "Make the class represent a domain entity, value, collection, adapter, or protocol; as one option, rename it after that object. If it is truly stateless, move the operation to its owning class or a focused module function. Do not: rename mechanically or add state only to silence this information.",
		priority: 2,
	},
	"unused-callable": {
		message:
			'{kind} "{label}" has insufficient production usage (found {count} other production {file_word}; candidate for removal/refactor)',
		hint: "Review it for deletion or refactoring; test-only references do not count. If it is an external entry point, document the boundary or add an explicit exemption. If you checked the code and this advice is not appropriate for its context, ignore it.",
		priority: 7,
	},
	"unused-class": {
		message: 'class "{name}" has no production usage',
		hint: "Remove the class or add a real production usage. Do not: keep an implementation class only because it is exported or mentioned by tests.",
		priority: 7,
	},
	"unused-public-field": {
		message: 'public field "{name}" has no production usage',
		hint: "Remove the field or expose it through a real production contract. Do not: keep public state without a production consumer.",
		priority: 7,
	},
	"class-method-count-info": {
		message: "class has many {visibility} methods (found {count})",
		hint: "Refactor toward a focused class with a cohesive API. Do not: keep a class as a namespace for unrelated helpers or add private methods only to satisfy the count.",
		priority: 1,
	},
	"class-method-min-count": {
		message: "class has too few {visibility} methods (found {count})",
		hint: "Add meaningful behavior or move the class to a boundary where one method is sufficient. Do not: add placeholder methods only to satisfy the count.",
		priority: 6,
	},
	"class-method-max-count": {
		message: "class has too many {visibility} methods (found {count})",
		hint: "Refactor toward a focused class with a cohesive API. Do not: keep a class as a namespace for unrelated helpers or add private methods only to satisfy the count.",
		priority: 3,
	},
	"class-interface-count": {
		message: "class implements too many interfaces or protocols (found {count})",
		hint: "split the class into focused adapters or collaborators, each implementing a focused set of interfaces or protocols. Do not: keep unrelated contracts on one class.",
		priority: 3,
	},
	"class-max-size": {
		message: "class is too large",
		hint: "extract cohesive behavior into module functions or smaller focused classes/modules. Do not: hide the size behind wrappers.",
		priority: 3,
	},
	"class-min-size": {
		message: "class is too short",
		hint: "move shared behavior into a smaller focused module or add meaningful behavior before keeping a class. Do not: keep a class as a thin wrapper.",
		priority: 7,
	},
	"class-size": {
		message: "class has too many methods (found {count})",
		hint: "move cohesive behavior into module functions or split the class into smaller focused classes/modules. Do not: keep extending the large class.",
		priority: 3,
	},
	"callable-min-size": {
		message: "{callable} is too short",
		hint: "inline a short function or refactor the behavior into a focused function/module. Do not: retain a short indirection or wrapper.",
		priority: 7,
	},
	"callable-max-size": {
		message: "{callable} is too long",
		hint: "extract one cohesive operation into a named helper/module. Do not: split into arbitrary one-line wrappers.",
		priority: 3,
	},
	"callable-nesting-depth": {
		message: "callable control-flow nesting is too deep",
		hint: "Split nested control flow into focused predicates or operations. Do not: hide the nesting in arbitrary wrappers.",
		priority: 3,
	},
	"callable-branch-count": {
		message: "callable contains too many branch points",
		hint: "Split the decision tree into focused predicates or operations. Do not: hide one large branch tree behind arbitrary wrappers.",
		priority: 3,
	},
	"hidden-global-state": {
		message: "module-level mutable collection has multiple production owners",
		hint: "Move mutable state behind one owning class or module boundary. Do not: let several production callables mutate a module-level collection directly.",
		priority: 4,
	},
	"temporal-coupling": {
		message: "field lifecycle depends on another method being called first",
		hint: "Initialize the field in the constructor or declaration, or expose an explicit ready state. Do not: require callers to discover an initialization method order.",
		priority: 4,
	},
	"retry-without-ownership": {
		message: "unbounded retry loop has no attempt owner",
		hint: "Give retries an explicit attempt limit, backoff, and owning operation. Do not: continue forever after a failed operation without a retry policy.",
		priority: 3,
	},
	"incomplete-cache-key": {
		message: "cache lookup and write use different key expressions",
		hint: "Use one named cache-key operation for both lookup and write. Do not: derive different keys for get and set on the same cache in one callable.",
		priority: 4,
	},
	singleton: {
		message: "module-level class instance may be a singleton",
		hint: "Create instances inside an explicit factory or composition root. Do not: keep shared mutable instances at module scope.",
		priority: 6,
	},
	"branch-duplication": {
		message: "repeated comparisons of one variable should use a lookup map",
		hint: "Replace repeated if/elif value checks with a dictionary or a table of handlers.",
		priority: 4,
	},
	"top-level-classes": {
		message: "file contains too many top-level classes",
		hint: "move each additional class into its own focused file. Do not: hide related classes in one large module.",
		priority: 6,
	},
	"class-reference-info": {
		message: 'class "{name}" is referenced from {count} files outside its definition file',
		hint: "Optimize the class hierarchy: keep ownership in one focused class, move shared behavior behind a narrow interface, and reduce cross-file construction dependencies. Do not: add inheritance or aliases only to hide references.",
		priority: 1,
	},
	"class-reference-warning": {
		message: 'class "{name}" is referenced from {count} files outside its definition file',
		hint: "Optimize the class hierarchy: keep ownership in one focused class, move shared behavior behind a narrow interface, and reduce cross-file construction dependencies. Do not: add inheritance or aliases only to hide references.",
		priority: 3,
	},
	"composition-depth": {
		message: "class composition is too deep (found {depth} levels): {chain}",
		hint: "remove pass-through class layers and keep only classes with their own state or lifecycle. Do not: add another wrapper just to forward calls; split a large class into focused modules instead.",
		priority: 3,
	},
	"class-like-prefix": {
		message: 'functions share class-like prefix "{prefix}" ({count} functions)',
		hint: "prefer focused module functions; use a real small class for {class_name} only when the functions share state or lifecycle. Do not: rename the functions, add wrappers, or keep extending the group.",
		priority: 6,
	},
} as const;
