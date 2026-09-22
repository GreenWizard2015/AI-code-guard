export const RULE_DATA = {
	'responsibilities': {
		message: 'violates the Responsibilities contract: {issue}',
		hint: 'Write an honest "Responsibilities: _A_, _B_." line in the docstring, with paired underscores around each responsibility.',
		priority: 5,
	},
	'responsibilities-min-count': {
		message: 'has too few responsibilities',
		hint: 'Expand the owner contract when the work belongs there, or split the owner or method when it does not.',
		priority: 5,
	},
	'responsibilities-max-count': {
		message: 'has too many responsibilities',
		hint: 'Split the owner or method when the responsibilities cannot be named as one focused contract.',
		priority: 5,
	},
	'responsibilities-wording': {
		message: 'violates responsibility wording',
		hint: 'Use a concise noun phrase naming the owned work. Do not: describe results or invocation mechanics.',
		priority: 0,
	},
	'assertion-outside-test': {
		message: 'test assertions must stay inside test cases',
		hint: 'in test files, keep expect inside test("name", () => {}) in TypeScript and assert or unittest self.assert* inside def test_* in Python. Production files are outside this rule.',
		priority: 6,
	},
	'test-file-location': {
		message: 'test file must be inside a tests directory',
		hint: 'move the test file below a path containing /tests/. Do not: keep a test-suffixed file beside production modules.',
		priority: 7,
	},
	'explicit-return-type': {
		message: 'callable is missing an explicit return type',
		hint: 'Add an explicit result annotation to every named function, method, getter, or interface method. Do not: rely on return-type inference at a callable boundary.',
		priority: 5,
	},
	'typescript-overload': {
		message: 'avoid TypeScript overload signatures',
		hint: 'replace overload signatures with one explicit method or function contract. Do not: hide alternate contracts behind repeated declarations.',
		priority: 6,
	},
	'logical-chain-size': {
		message: 'logical expression is too complex',
		hint: 'extract the condition into a named boolean variable or predicate method. Do not: keep a long logical chain inline.',
		priority: 2,
	},
	'mixed-boolean-precedence': {
		message: 'mixed boolean operators require grouping',
		hint: 'split the boolean expression or add parentheses around each precedence boundary. Do not: mix &&, ||, or ! inline when the grouping is not explicit.',
		priority: 2,
	},
	'mixed-arithmetic-precedence': {
		message: 'mixed arithmetic operators require grouping',
		hint: 'split the arithmetic expression or add parentheses around each precedence boundary. Do not: mix +, -, *, or / inline when the grouping is not explicit.',
		priority: 2,
	},
	'typescript-type-assertion': {
		message: 'do not use TypeScript type assertions',
		hint: 'narrow with an AST/type predicate, validate at the boundary, or change the contract so the type is known. Do not: silence the compiler with as Type or <Type>value.',
		priority: 5,
	},
	'duplicate-type-shape': {
		message: 'duplicate type shape: {names}',
		hint: 'Replace duplicate field shapes with one named interface or a shared domain class. Keep separate classes when the types represent different domain entities.',
		priority: 5,
	},
	'python-test-shape': {
		message: 'python tests must be class methods',
		hint: 'move the test into a Test* class and keep it as a method. Do not: define top-level pytest test functions.',
		priority: 6,
	},
	'python-test-class-inheritance': {
		message: 'Python test class must inherit from unittest.TestCase',
		hint: 'make every Python test class inherit from exactly one fully qualified unittest.TestCase. Do not: use pytest, project helpers, multiple bases, or no base class.',
		priority: 6,
	},
	'python-test-framework-consistency': {
		message: 'use unittest in every Python test file',
		hint: 'import unittest and use unittest.TestCase for Python tests. Do not: use pytest as the test framework.',
		priority: 6,
	},
	'python-test-assert': {
		message: 'Python unittest test must contain a direct self.assert* assertion',
		hint: 'Add self.assert* directly to the unittest test method body. Do not: hide it in a helper, condition, or nested function.',
		priority: 6,
	},
	'python-test-assert-ending': {
		message: 'Python unittest assertions must be the final consecutive statements',
		hint: 'Move every self.assert* call to the end of the unittest test method and keep assertions together at test level. Do not: put assertions inside conditions or execute code after the final assertion.',
		priority: 6,
	},
	'python-explicit-parameter-type': {
		message: 'Python parameter "{name}" is missing an explicit type',
		hint: 'Add an explicit type annotation to every parameter except self and cls.',
		priority: 5,
	},
	'python-explicit-field-type': {
		message: 'Python field "{name}" is missing an explicit type',
		hint: 'Declare every class field with an explicit annotation.',
		priority: 5,
	},
	'python-string-type-annotation': {
		message: 'Python type annotation must not be a string',
		hint: 'use a direct type annotation such as Model or list[Model]. Do not: put a type expression inside a quoted string.',
		priority: 5,
	},
	'typescript-in-operator': {
		message: 'do not use in for non-collection membership checks',
		hint: 'Use an explicit property or collection operation. Do not use if (key in value) unless value is a Map, Set, WeakMap, or WeakSet.',
		priority: 2,
	},
	'method-get-name': {
		message: 'public result method "{name}" uses get*',
		hint: 'Name the returned value instead of exposing getter-style storage access.',
		priority: 2,
	},
	'method-find-fetch-lookup-name': {
		message: 'public result method "{name}" exposes its lookup mechanism',
		hint: 'Name the returned domain result; keep search, cache, and remote retrieval details private.',
		priority: 2,
	},
	'method-load-read-open-name': {
		message: 'public result method "{name}" exposes its loading mechanism',
		hint: 'Name the returned value instead of exposing whether it is loaded, read, or opened.',
		priority: 2,
	},
	'method-calculate-compute-name': {
		message: 'public result method "{name}" exposes its calculation mechanism',
		hint: 'Name the returned result, such as price, total, hash, or distance.',
		priority: 2,
	},
	'method-create-build-generate-name': {
		message: 'public result method "{name}" exposes its construction mechanism',
		hint: 'Name the returned value; use a concrete command only when the method changes the outside world.',
		priority: 2,
	},
	'method-parse-convert-transform-name': {
		message: 'public result method "{name}" exposes its transformation mechanism',
		hint: 'Name the returned representation or value object instead of the conversion procedure.',
		priority: 2,
	},
	'method-set-name': {
		message: 'public method uses a storage-shaped setter name',
		hint: 'Review whether a domain transition name such as approve, assign_owner, or rename is clearer than set_.',
		priority: 2,
	},
	'method-process-name': {
		message: 'public command "{name}" uses process*',
		hint: 'Replace process* with the concrete domain action, or split the method if it performs several actions.',
		priority: 2,
	},
	'method-handle-name': {
		message: 'public command "{name}" uses handle*',
		hint: 'Replace handle* with the concrete domain action; framework callback boundaries may keep it.',
		priority: 2,
	},
	'method-execute-perform-do-name': {
		message: 'public command "{name}" uses a technical command verb',
		hint: 'Replace execute*, perform*, or do* with the concrete domain action.',
		priority: 2,
	},
	'method-and-name': {
		message: 'public method "{name}" contains And and may have two responsibilities',
		hint: 'Split the independent contracts unless the combined operation must be atomic.',
		priority: 2,
	},
	'method-long-name': {
		message: 'public method "{name}" has an excessive compound name',
		hint: 'Review the class boundary and split responsibilities before shortening the name mechanically.',
		priority: 2,
	},
	'boolean-is-name': {
		message: 'boolean method "{name}" uses an is* name',
		hint: 'Prefer the adjective when it reads naturally, such as empty, readable, or negative.',
		priority: 2,
	},
	'boolean-exists-name': {
		message: 'boolean method "{name}" uses exists()',
		hint: 'Prefer a property-shaped name such as present() when it expresses the contract naturally.',
		priority: 2,
	},
	'boolean-equals-name': {
		message: 'boolean method "{name}" uses equals()',
		hint: 'Prefer a property-shaped comparison such as equal_to when the language protocol permits it.',
		priority: 2,
	},
	'boolean-has-can-name': {
		message: 'boolean method "{name}" uses has* or can*',
		hint: 'Prefer a natural property such as accessible, present, writable, or readable when appropriate.',
		priority: 2,
	},
	'boolean-query-name': {
		message: 'boolean method "{name}" does not read as a predicate',
		hint: 'Review whether the boolean name reads naturally as a property; do not invent an awkward adjective.',
		priority: 2,
	},
	'python-test-assert-statement': {
		message: 'Python tests must not use bare assert statements',
		hint: 'Use unittest self.assert* methods so the test has an explicit assertion contract. Do not: use Python assert statements in tests.',
		priority: 6,
	},
	'python-test-subtest': {
		message: 'Python tests must not use self.subTest',
		hint: 'use parameterized.expand(...) for parameterized cases. Do not: group cases with with self.subTest(...).',
		priority: 6,
	},
	'test-assertion-grouping': {
		message: 'group 3 or more test assertions in one object literal',
		hint: 'Combine related actual and expected values into object literals and compare them with one assertion. Do not: repeat separate assertions for one result shape.',
		priority: 2,
	},
	'test-too-many-assertions': {
		message: 'test has too many assertions and is too complex',
		hint: 'Split the test into smaller atomic tests with one focused behavior each. Do not: keep unrelated assertions in one test.',
		priority: 3,
	},
	'typescript-static-method': {
		message: 'avoid static methods',
		hint: 'move the static operation to a module-level function with explicit arguments. Do not: hide dependencies in static state.',
		priority: 2,
	},
	'typescript-static-field': {
		message: 'avoid static fields',
		hint: 'move the state to an instance field owned by an explicit object, or move a constant to the module level. Do not: hide shared mutable or configuration state on a class.',
		priority: 2,
	},
	'python-static-method': {
		message: 'avoid static methods',
		hint: 'replace the static helper with a module-level function with explicit arguments. Do not: keep a stateless @staticmethod.',
		priority: 2,
	},
	'python-class-method': {
		message: 'avoid class methods',
		hint: 'replace the class-level factory or operation with a module-level function. Do not: keep behavior on @classmethod.',
		priority: 2,
	},
	'python-property-setter': {
		message: 'avoid Python property setters',
		hint: 'keep objects immutable and return a new value or use an explicit state transition method. Do not: mutate instance state through @property.setter.',
		priority: 5,
	},
	'python-property': {
		message: 'avoid Python @property getters',
		hint: 'Replace @property with an explicit method that names the operation. Do not: hide behavior behind implicit property access.',
		priority: 5,
	},
	'typescript-prototype-assignment': {
		message: 'avoid prototype-based class construction',
		hint: 'declare a real class and put methods in its class body. Do not: assign methods through Constructor.prototype.',
		priority: 6,
	},
	'dynamic-type': {
		message: 'avoid dynamic class construction with type(...)',
		hint: 'declare a real class with explicit methods. Do not: assemble project-owned classes via type(...).',
		priority: 6,
	},
	'python-type-factory': {
		message: 'avoid dynamic type factories (namedtuple, NamedTuple, TypedDict, NewType)',
		hint: 'declare an explicit dataclass or normal class with typed fields. Do not: assemble project-owned types through type factories.',
		priority: 6,
	},
	'large-union': {
		message: 'avoid overly broad unions',
		hint: 'split a broad union into a focused type or protocol. For T | None, use Optional[T]. Do not: widen one contract with unrelated alternatives.',
		priority: 5,
	},
	'python-optional-union': {
		message: 'use Optional[T] instead of T | None',
		hint: 'replace T | None with Optional[T]. Do not: spell optional values as a union in annotations.',
		priority: 5,
	},
	'python-conditional-type-alias': {
		message: 'do not assign type-shaped values inside conditional branches',
		hint: 'define one stable type contract outside the conditional. Do not: assign a type-shaped value inside an if or else branch.',
		priority: 5,
	},
	'nullable-domain-type': {
		message: 'replace nullable types with specialized state classes',
		hint: 'replace User | null, string | null, User | undefined, or Optional[str] with explicit state classes such as FoundUser, NotFoundUser, or EmptyValue. Do not: encode a state as nullability.',
		priority: 6,
	},
	'unnecessary-undefined-check': {
		message: 'condition checks a required field for undefined',
		hint: 'remove the impossible undefined check or correct the field type.',
		priority: 5,
	},
	'typescript-type-guard': {
		message: 'avoid TypeScript is type guards',
		hint: 'return an explicit result or use a dedicated class/protocol boundary. Do not: narrow project state through a return type of the form value is Type.',
		priority: 5,
	},
	'single-item-array-state': {
		message: 'do not use a single-item array as nullable state',
		hint: 'return an explicit state class or a named result contract. Do not: return T[] only to represent a missing value and read the result with [0].',
		priority: 6,
	},
	'typescript-union-contract-bypass': {
		message: 'do not hide required fields behind a base-or-intersection union',
		hint: 'define one explicit contract with all required fields, or use named state classes. Do not: use Base | (Base & { required fields }) to simulate optional metadata.',
		priority: 6,
	},
	'typescript-rest-union-contract': {
		message: 'do not use a union type in a rest parameter',
		hint: 'replace the rest union with one explicit options object or separate named operations. Do not: encode unrelated call modes in a variadic union.',
		priority: 6,
	},
	'composite-state-type': {
		message: 'replace composite union types with an interface and specialized classes',
		hint: 'define one interface for the shared contract and real specialized classes for each state or value representation. Do not: use a union, intersection, or primitive union at a domain boundary.',
		priority: 6,
	},
	'typescript-index-signature': {
		message: 'index signatures are not allowed',
		hint: 'replace the open-ended map with a named interface and explicit methods or a focused domain class. Do not: accept arbitrary string or number keys through an index signature.',
		priority: 5,
	},
	'broad-except': {
		message: 'avoid broad try/catch or try/except blocks',
		hint: 'catch only the expected exception at the I/O, process, network, or JSON boundary. Do not: wrap business logic in a broad catch/except.',
		priority: 4,
	},
	'python-multi-except': {
		message: 'catch one exception type per except handler',
		hint: 'handle one exception type per handler and prefer one general boundary handler with minimal conditions. Do not: group unrelated exception types in one except tuple.',
		priority: 4,
	},
	'typescript-typeof': {
		message: 'avoid repeated typeof checks in business logic',
		hint: 'validate the value once at the input boundary. Do not: repeat typeof checks in business logic.',
		priority: 4,
	},
	'python-isinstance': {
		message: 'avoid repeated isinstance checks in business logic',
		hint: 'validate the value once at the input boundary. Do not: branch repeatedly on isinstance in business logic.',
		priority: 4,
	},
	'typescript-instanceof': {
		message: 'avoid repeated instanceof checks in business logic',
		hint: 'narrow the value at the boundary. Do not: scatter instanceof checks through business logic.',
		priority: 4,
	},
	getattr: {
		message: 'avoid getattr for normal control flow',
		hint: 'use an explicit attribute or a typed helper. Do not: use getattr as normal control flow or feature detection.',
		priority: 4,
	},
	setattr: {
		message: 'avoid setattr for normal control flow',
		hint: 'assign through an explicit attribute or setter. Do not: use setattr to bypass the object contract.',
		priority: 4,
	},
	'python-object-setattr': {
		message: 'avoid direct object.__setattr__ calls',
		hint: 'assign through an explicit attribute or a dedicated setter. Do not: bypass the object contract with object.__setattr__.',
		priority: 4,
	},
	'python-callable': {
		message: 'avoid callable feature detection for project-owned interfaces',
		hint: 'call the project-owned interface directly. Do not: probe callable and silently choose a fallback.',
		priority: 4,
	},
	'multiple-result-shapes': {
		message: 'avoid inferring tool results from multiple shapes',
		hint: 'normalize the upstream response at one boundary and read content afterward. Do not: support multiple result shapes in business logic.',
		priority: 6,
	},
	'typescript-object-prototype-string': {
		message: 'avoid Object.prototype.toString.call',
		hint: 'use an explicit type guard or narrow value check. Do not: inspect values through Object.prototype.toString.call.',
		priority: 4,
	},
	'typescript-object-assign': {
		message: 'avoid Object.assign',
		hint: 'assign owned fields explicitly or use a focused method that owns the state transition. Do not: merge object state through Object.assign.',
		priority: 4,
	},
	'typescript-object-method-call': {
		message: 'avoid Object method .call',
		hint: 'call the method directly or use an explicit typed helper. Do not: invoke Object methods through .call.',
		priority: 4,
	},
	'empty-contract': {
		message: 'avoid empty protocols and interfaces',
		hint: 'add the smallest meaningful members to the contract or remove the abstraction. Do not: use an empty Protocol or interface as a naming-only type.',
		priority: 5,
	},
	'inline-generic-type': {
		message: 'avoid inline object types in generic arguments',
		hint: 'name the nested type as a type alias, interface, or focused protocol before using it as a generic argument. Do not: describe nested generic arguments anonymously inline.',
		priority: 5,
	},
	'ternary-expression': {
		message: 'avoid ternary expressions',
		hint: 'replace ternary expressions with explicit if/else branches so each state transition is visible. Do not: hide control flow in a conditional expression.',
		priority: 2,
	},
	'conditional-execution': {
		message: 'avoid conditional execution operators',
		hint: 'replace calls guarded by &&, ||, ??, and, or with an explicit if branch. Do not: execute project behavior through short-circuit operators.',
		priority: 2,
	},
	'typescript-logical-assignment': {
		message: 'avoid logical assignment operators',
		hint: 'use an explicit if condition followed by an assignment so the state transition is visible. Do not: hide initialization or mutation behind ??=, ||=, or &&=.',
		priority: 2,
	},
	switch: {
		message: 'avoid switch statements',
		hint: 'use a dictionary or table keyed by the discriminant and dispatch through an explicit entry. Do not: spread branch ownership across switch cases.',
		priority: 2,
	},
	'typescript-conditional-block': {
		message: 'TypeScript if and else branches must use braces',
		hint: 'wrap every TypeScript if and else body in braces. Do not: rely on single-statement conditional bodies.',
		priority: 2,
	},
	'python-elif': {
		message: 'avoid Python elif branches',
		hint: 'replace elif with an explicit nested if in the else block. Do not: hide a second branch in elif.',
		priority: 2,
	},
	'python-walrus': {
		message: 'avoid Python assignment expressions',
		hint: 'assign the value in a separate statement before the condition or expression. Do not: hide state mutation inside :=.',
		priority: 2,
	},
	'complex-default-parameter': {
		message: 'avoid complex default parameter values',
		hint: 'default dependencies and mutable values to null or None, then create or validate them explicitly inside the constructor or caller. Do not: allocate objects, call factories, or use mutable containers in a parameter default.',
		priority: 2,
	},
	'exception-raising': {
		message: 'tests must not raise or throw exceptions',
		hint: 'Return an explicit result or handle failure without an exception. Do not: use raise or throw in tests.',
		priority: 6,
	},
	'typescript-console-mock-in-test': {
		message: 'do not mock console in tests',
		hint: 'assert the returned value or collected diagnostics directly. Do not: mock console methods to verify behavior.',
		priority: 6,
	},
	'typescript-console-in-test': {
		message: 'do not use console in tests',
		hint: 'assert the returned value or collected diagnostics directly. Do not: call console methods from a Jest test.',
		priority: 6,
	},
	'temporary-instance-method-call': {
		message: 'avoid calling methods on temporary instances',
		hint: 'create the helper or dependency in the constructor and keep it in object state. Do not: hide lifecycle and repeated allocation in new T().method(...).',
		priority: 4,
	},
	'python-direct-class-init': {
		message: 'avoid direct calls to Class.__init__',
		hint: 'use super().__init__ inside the subclass constructor or construct the object normally. Do not: invoke another class constructor through Class.__init__(...).',
		priority: 4,
	},
	'python-call-method': {
		message: 'avoid __call__ methods',
		hint: 'expose an explicit method with a descriptive name. Do not: make project objects callable through __call__.',
		priority: 4,
	},
	'complex-constructor': {
		message: 'keep constructors limited to setup and validation',
		hint: 'keep __init__, __post_init__, and constructor bodies limited to parameter validation, field assignment, dependency creation, and super initialization. Move document building, I/O, and business logic into an explicit method or factory. Do not: call project behavior from a constructor.',
		priority: 5,
	},
	'mutable-field-assignment': {
		message: 'avoid assigning class fields outside constructors',
		hint: 'assign instance fields in __init__, __post_init__, or the constructor and keep methods immutable. Do not: mutate self.field from ordinary methods.',
		priority: 5,
	},
	'typescript-explicit-visibility': {
		message: 'class members must declare visibility explicitly',
		hint: 'Add public, protected, or private explicitly to every class field and method. Do not rely on TypeScript default visibility.',
		priority: 5,
	},
	'typescript-mutable-field': {
		message: 'TypeScript class fields should be readonly',
		hint: 'Prefer readonly for class fields and move intentional changes behind an explicit state transition method. If the field must be mutable, ignore this information.',
		priority: 5,
	},
	'proxy-callable': {
		message: 'avoid proxy methods and forwarding functions',
		hint: 'call the dependency directly or move the behavior into the owning class. Do not: keep a method or function that only forwards the same arguments and return value.',
		priority: 4,
	},
	'proxy-lambda': {
		message: 'avoid forwarding lambdas',
		hint: 'call the owning method directly or pass the owning object through its interface. The rule compares lambda parameters with forwarded call arguments; external API callbacks are outside this rule.',
		priority: 4,
	},
	'typescript-fake-object': {
		message: 'avoid object literals that imitate classes',
		hint: 'replace an object with multiple callable fields by a focused class or explicit module functions. Do not: hide stateful or cohesive behavior behind a namespace-shaped object.',
		priority: 6,
	},
	'typescript-object-literal-return': {
		message: 'do not return callable object literals as classes or interfaces',
		hint: 'return a real class instance or a focused implementation class when the contract has behavior. Do not: satisfy a class or interface with an object literal that contains callable fields.',
		priority: 6,
	},
	'typescript-jest-min-count': {
		message: 'Jest suite has too few tests (found {count})',
		hint: 'Add another focused test or remove the unnecessary suite wrapper. Do not: create a describe block for one tiny test.',
		priority: 6,
	},
	'typescript-jest-max-count': {
		message: 'Jest suite has too many tests (found {count})',
		hint: 'Split the suite by cohesive behavior. Do not: keep unrelated tests in one describe block.',
		priority: 3,
	},
	'typescript-jest-min-size': {
		message: 'Jest suite is too short ({size} lines/SLOC metric)',
		hint: 'Keep focused tests in a meaningful suite. Do not: create a describe block for one tiny test.',
		priority: 7,
	},
	'typescript-jest-max-size': {
		message: 'Jest suite is too large ({size} lines/SLOC metric)',
		hint: 'Split the suite into focused describe blocks. Do not: hide an oversized test suite behind helper wrappers.',
		priority: 3,
	},
	'typescript-jest-describe-count': {
		message: 'Jest file must contain exactly one top-level describe (found {count})',
		hint: 'Keep exactly one top-level describe in each Jest file. Do not: place multiple suites in one file.',
		priority: 6,
	},
	'typescript-jest-nested-describe': {
		message: 'nested Jest describe blocks are not allowed',
		hint: 'Keep the single Jest describe flat. Do not: nest another describe inside it.',
		priority: 6,
	},
	'typescript-jest-test-ending': {
		message: 'Jest test must end with an expect assertion',
		hint: 'Finish every Jest test callback with an expect assertion. Do not: leave cleanup, logging, or other statements after the final assertion.',
		priority: 6,
	},
	'typescript-jest-test-lambda': { message: 'Jest test must use an arrow-function callback', hint: 'Write each Jest test as test("...", () => {}). Do not: pass a function declaration or function expression as the test callback.', priority: 6 },
	'typescript-jest-test-expect': { message: 'Jest test must contain a direct expect assertion', hint: 'Add an expect assertion directly to the Jest test callback. Do not: hide it in a helper callback, condition, or nested function.', priority: 6 },
	'typescript-jest-type-only-test': { message: 'Jest test checks only type or object shape', hint: 'Assert the actual returned value or observable behavior. Do not: check only types, fields, methods, or object shape.', priority: 6 },
	'test-exception-only': {
		message: 'test checks only that an exception is raised',
		hint: 'Assert the returned value or observable behavior. If there is no direct result, test the next public boundary, such as the server response instead of the request handler. Do not: test only that an internal call throws.',
		priority: 6,
	},
	'bare-type-alias': {
		message: 'avoid bare type aliases',
		hint: 'use the original type directly, or introduce a distinct interface, object shape, or wrapper with its own contract. Do not: rename one project type without adding behavior or structure.',
		priority: 5,
	},
	'singular-plural-alias': {
		message: 'optional singular/plural fields may be aliases',
		hint: 'check whether the optional singular and plural fields encode one alias relationship, then resolve the defining type before storing both. Do not: treat duplicate optional representations as independent state.',
		priority: 5,
	},
	'typescript-parameter-property': {
		message: 'declare TypeScript constructor fields explicitly',
		hint: 'declare a readonly field in the class body and assign it explicitly in the constructor. Do not: combine constructor parameters with field declarations through public, private, protected, or readonly parameter properties.',
		priority: 5,
	},
	'typescript-interface-shape': {
		message: 'use an interface instead of a callable-heavy type alias or object shape',
		hint: 'Refactor the shape into an interface when the shared contract is mostly behavior, or into a focused wrapper class when it owns state or lifecycle. Do not: keep a namespace-shaped type alias with many callable fields.',
		priority: 5,
	},
	'type-field-count': {
		message: 'type has too many fields (found {count})',
		hint: 'split the contract into focused named types or compose smaller types. Do not: keep growing one type with unrelated fields.',
		priority: 3,
	},
	'local-inheritance': {
		message: 'class inherits from local class "{base_name}"',
		hint: 'Prefer composition and dependency injection over inheritance. When a shared contract is required, prefer implementing an interface or protocol; inherit only from external framework types or when substitutability is essential. Move shared project behavior behind a port.',
		priority: 6,
	},
	mixin: {
		message: 'class uses mixin pattern "{name}"',
		hint: 'Replace mixins with explicit composition and dependency injection. Move shared behavior into a focused collaborator or implement a narrow interface/protocol; do not use inheritance to assemble behavior.',
		priority: 6,
	},
	'mixed-module': {
		message: 'avoid mixing classes and functions in the same file',
		hint: 'put the class and free functions in separate focused modules. Do not: mix two ownership models in one file.',
		priority: 6,
	},
	'stateless-class': {
		message: 'class is stateless',
		hint: 'Refactor only after identifying what data, dependencies, or lifecycle should become object state. If no meaningful state remains, prefer a module-level function with explicit arguments; keep a class for a protocol/adapter boundary or when it will own state, not as a namespace for stateless helpers.',
		priority: 6,
	},
	'procedural-class-name': {
		message: 'class name describes a job: "{name}"',
		hint: 'Make the class represent a domain entity, value, collection, adapter, or protocol; as one option, rename it after that object. If it is truly stateless, move the operation to its owning class or a focused module function. Do not: rename mechanically or add state only to silence this information.',
		priority: 2,
	},
	'unused-callable': {
		message:
			'{kind} "{label}" has insufficient production usage (found {count} other production {file_word}; candidate for removal/refactor)',
		hint: 'Review it for deletion or refactoring; test-only references do not count. If it is an external entry point, document the boundary or add an explicit exemption. If you checked the code and this advice is not appropriate for its context, ignore it.',
		priority: 7,
	},
	'class-callback-fields': {
		message: 'class has {count} callback fields with default implementations',
		hint: 'Declare callback behavior as methods or move it behind a focused collaborator; do not assign arrow or function callbacks as class-field defaults.',
		priority: 5,
	},
	'class-method-count-info': {
		message: 'class has many {visibility} methods (found {count})',
		hint: 'Refactor toward a focused class with a cohesive API. Do not: keep a class as a namespace for unrelated helpers or add private methods only to satisfy the count.',
		priority: 1,
	},
	'class-method-min-count': {
		message: 'class has too few {visibility} methods (found {count})',
		hint: 'Add meaningful behavior or move the class to a boundary where one method is sufficient. Do not: add placeholder methods only to satisfy the count.',
		priority: 6,
	},
	'class-method-max-count': {
		message: 'class has too many {visibility} methods (found {count})',
		hint: 'Refactor toward a focused class with a cohesive API. Do not: keep a class as a namespace for unrelated helpers or add private methods only to satisfy the count.',
		priority: 3,
	},
	'class-interface-count': {
		message: 'class implements too many interfaces or protocols (found {count})',
		hint: 'split the class into focused adapters or collaborators, each implementing a focused set of interfaces or protocols. Do not: keep unrelated contracts on one class.',
		priority: 3,
	},
	'attribute-depth': {
		message: 'attribute access is too deep (found {depth} levels)',
		hint: 'refactor the object graph or introduce a named boundary with its own contract. Do not: silence the warning by assigning each chain segment to temporary local variables.',
		priority: 2,
	},
	'class-max-size': {
		message: 'class is too large',
		hint: 'extract cohesive behavior into module functions or smaller focused classes/modules. Do not: hide the size behind wrappers.',
		priority: 3,
	},
	'class-min-size': {
		message: 'class is too short',
		hint: 'move shared behavior into a smaller focused module or add meaningful behavior before keeping a class. Do not: keep a class as a thin wrapper.',
		priority: 7,
	},
	'class-size': {
		message: 'class has too many methods (found {count})',
		hint: 'move cohesive behavior into module functions or split the class into smaller focused classes/modules. Do not: keep extending the large class.',
		priority: 3,
	},
	'callable-min-size': {
		message: '{callable} is too short',
		hint: 'inline a short function or refactor the behavior into a focused function/module. Do not: retain a short indirection or wrapper.',
		priority: 7,
	},
	'callable-max-size': {
		message: '{callable} is too long',
		hint: 'extract one cohesive operation into a named helper/module. Do not: split into arbitrary one-line wrappers.',
		priority: 3,
	},
	'test-max-size': {
		message: 'test is too long',
		hint: 'split the test into smaller tests that each verify one behavior. Do not: bypass the limit with nested callbacks, compressed expressions, or arbitrary wrappers.',
		priority: 3,
	},
	'test-min-size': {
		message: 'test is too short',
		hint: 'add the missing behavior assertion or combine the test with a meaningful scenario. Do not: add padding only to satisfy the size limit.',
		priority: 7,
	},
	'argument-count': {
		message: '{callable} has too many arguments (found {count})',
		hint: 'introduce a named options object and validate it at the boundary. Do not: add another positional argument.',
		priority: 3,
	},
	'missing-import': {
		message: 'Relative import cannot be resolved: {specifier}',
		hint: 'restore the module or update the import to its current owner.',
		priority: 4,
	},
	'unused-file': {
		message: 'Source file is not imported by any project source file',
		hint: 'remove the unused file or add a real production/test import that uses it.',
		priority: 7,
	},
	'parse-error': {
		message: '{language} parse error: {message}',
		hint: 'correct the syntax before applying structural lint rules. Do not: rely on regex recovery for malformed code.',
		priority: 7,
	},
	reexports: {
		message: 'avoid re-exporting imported symbols: {reason}',
		hint: 'import from the defining module and use its real API at the call site. Do not: create a compatibility, barrel, or alias wrapper that only re-exports imports.',
		priority: 2,
	},
	singleton: {
		message: 'module-level class instance may be a singleton',
		hint: 'Create instances inside an explicit factory or composition root. Do not: keep shared mutable instances at module scope.',
		priority: 6,
	},
	'branch-duplication': {
		message: 'repeated comparisons of one variable should use a lookup map',
		hint: 'Replace repeated if/elif value checks with a dictionary or a table of handlers.',
		priority: 4,
	},
	'typescript-bind': {
		message: 'avoid .bind calls',
		hint: 'use a lambda that captures the receiver explicitly. Do not: hide callback binding behind method.bind(...).',
		priority: 4,
	},
	'dynamic-import': {
		message: 'avoid dynamic imports',
		hint: 'use a module-level static import. Do not: load project modules with import(), require(), importlib.import_module(), or __import__().',
		priority: 4,
	},
	'typescript-dynamic-runtime-usage': {
		message: 'avoid reflective and dynamic runtime APIs',
		hint: 'use an explicit class, interface, typed operation, or Map/Set API. Do not: use Reflect.*, Proxy, computed string access, or object membership with in.',
		priority: 4,
	},
	'nested-import': {
		message: 'avoid nested imports',
		hint: 'move the import to module scope and inject dependencies explicitly when needed. Do not: import inside functions, methods, classes, or conditional blocks.',
		priority: 4,
	},
	'relative-import': {
		message: 'avoid relative imports',
		hint: 'First configure the project import base at {project root} or {project root}/src, then replace relative imports with absolute module names. Do not: import project modules through ./, ../, or Python relative-import dots.',
		priority: 4,
	},
	'late-import': {
		message: 'imports must be at the beginning of the file',
		hint: 'move every static import to the module header, after the optional module docstring and future imports. Do not: place imports after executable statements or declarations.',
		priority: 4,
	},
	'python-sys-path-mutation': {
		message: 'avoid sys.path mutations',
		hint: 'configure the project import path through the test runner or package environment. Do not: assign to sys.path or mutate it through list methods or indexed writes.',
		priority: 4,
	},
	naming: {
		message:
			'{kind} "{name}" must use snake_case and has too many words (found {word_count})',
		hint: 'rename the symbol to concise snake_case. Do not: hide a long name behind an alias.',
		priority: 2,
	},
	'naming-type': {
		message: '{label} "{name}" must use PascalCase without underscores',
		hint: 'rename {label} declarations to PascalCase without underscores. Do not: use snake_case or a leading underscore for a {label}.',
		priority: 2,
	},
	'naming-private': {
		message: '{label} "{name}" must not use a leading underscore',
		hint: 'use a normal snake_case name for module-level functions and public methods; use explicit private/protected visibility for class methods instead.',
		priority: 2,
	},
	'exception-grouping': {
		message: 'exception class should be colocated with its caller',
		hint: 'Move a one-use Error class into the caller module, or group related exception classes in one focused module. Do not: keep a one-use exception in an isolated file.',
		priority: 7,
	},
	'top-level-classes': {
		message: 'file contains too many top-level classes',
		hint: 'move each additional class into its own focused file. Do not: hide related classes in one large module.',
		priority: 6,
	},
	'nested-class': {
		message: 'nested classes are not allowed ({count})',
		hint: 'Move each nested class to a focused top-level module or replace it with composition. Do not: hide a class inside another class or function.',
		priority: 6,
	},
	'contract-fields': {
		message: '{kind} "{class_name}" must not declare field "{field_name}"',
		hint: 'expose behavior through methods and keep data in an implementing class. Do not: add state fields to an interface or Protocol.',
		priority: 5,
	},
	'type-info': {
		message: '{subject} uses {type} instead of a concrete type',
		hint: 'replace generic types with a concrete value contract or a focused protocol. If the type is intentionally generic at a boundary, ignore this information.',
		priority: 5,
	},
	'typescript-unknown-parameter-type': {
		message: 'parameter "{name}" must not use unknown',
		hint: 'replace unknown with a concrete domain type or a focused protocol. Do not: accept an unbounded unknown value at a parameter boundary.',
		priority: 5,
	},
	'unbounded-type': {
		message: 'unbounded type is not allowed outside method bodies',
		hint: 'replace any, unknown, object, or Python Any with a concrete domain type or a focused protocol. Do not: expose an unbounded type in a field, declaration, parameter, or return contract.',
		priority: 5,
	},
	'type-warning': {
		message: '{subject} uses {type} instead of a concrete type',
		hint: 'replace generic types with a concrete value contract or a focused protocol. If the type is intentionally generic at a boundary, ignore this information.',
		priority: 5,
	},
	'class-reference-info': {
		message: 'class "{name}" is referenced from {count} files outside its definition file',
		hint: 'Optimize the class hierarchy: keep ownership in one focused class, move shared behavior behind a narrow interface, and reduce cross-file construction dependencies. Do not: add inheritance or aliases only to hide references.',
		priority: 1,
	},
	'class-reference-warning': {
		message: 'class "{name}" is referenced from {count} files outside its definition file',
		hint: 'Optimize the class hierarchy: keep ownership in one focused class, move shared behavior behind a narrow interface, and reduce cross-file construction dependencies. Do not: add inheritance or aliases only to hide references.',
		priority: 3,
	},
	'class-field-import': {
		message: 'class field {field} references imported function {name}',
		hint: 'wrap the dependency in an instance method or inject it through the constructor. Do not: alias a function from another file as a class attribute.',
		priority: 5,
	},
	'pointless-assignment': {
		message: 'avoid pointless temporary assignments',
		hint: 'inline the expression instead of splitting a straight-line result into temporary variables. Do not: add names that are never reused for a real branch or side effect.',
		priority: 4,
	},
	'composition-depth': {
		message: 'class composition is too deep (found {depth} levels): {chain}',
		hint: 'remove pass-through class layers and keep only classes with their own state or lifecycle. Do not: add another wrapper just to forward calls; split a large class into focused modules instead.',
		priority: 3,
	},
	'class-like-prefix': {
		message: 'functions share class-like prefix "{prefix}" ({count} functions)',
		hint: 'prefer focused module functions; use a real small class for {class_name} only when the functions share state or lifecycle. Do not: rename the functions, add wrappers, or keep extending the group.',
		priority: 6,
	},
	'typescript-dictionary-return': {
		message: 'function returns a dictionary type alias',
		hint: 'Consider making the returned T type a class with one or more constructors when it owns behavior or lifecycle. If it is only data, keep the dictionary type and ignore this advice.',
		priority: 5,
	},
	'typescript-type-operation': {
		message: 'avoid type operation "{operation}"',
		hint: 'declare an explicit named project type with the fields and operations it owns. Do not: hide a project contract behind Pick, Omit, indexed access, keyof, typeof, intersections, or other type transformations. If you checked the code and this advice is not appropriate for its context, ignore it.',
		priority: 5,
	},
	'method-order-public': {
		message: 'public method {name} must be declared after private/protected methods',
		hint: 'move public methods to the end of the class. Keep private and protected implementation methods before the public API.',
		priority: 2,
	},
	'method-order-constructor-after': {
		message: 'constructor must be declared after private/protected methods',
		hint: 'place the constructor after private and protected methods, but before the public API.',
		priority: 2,
	},
	'method-order-constructor-before': {
		message: 'constructor must be declared before public methods',
		hint: 'place the constructor before public methods and after private and protected methods.',
		priority: 2,
	},
	'module-placement': {
		message:
			'{target} is imported from {importers}; {placement_message}. Suggested location(s): {suggestions}. {guidance}',
		hint: 'Move {target} to one of these locations: {suggestions}. Importers: {importers}. Apply this to the module, its exported types, and its functions together.',
		priority: 7,
	},
	'private-member': {
		message: 'private class members must not be accessed from outside their class',
		hint: 'Use a public method or property that expresses the required operation instead of reaching into private state.',
		priority: 4,
	},
	'directory-min-size': {
		message: 'directory contains too few files (found {count})',
		hint: 'move the module to its parent directory or merge it with a focused sibling. Do not: add placeholder files just to satisfy the directory structure.',
		priority: 7,
	},
	'directory-max-size': {
		message: 'directory contains too many files (found {count})',
		hint: 'split the directory by domain ownership or move one cohesive group into a child directory. Do not: add placeholder files or hide the size behind wrappers.',
		priority: 3,
	},
	'directory-class-min-size': {
		message: 'directory contains too few classes (found {count})',
		hint: 'move the module to its parent directory or group related classes in one focused sibling. Do not: add placeholder classes or files.',
		priority: 7,
	},
	'directory-class-max-size': {
		message: 'directory contains too many classes (found {count})',
		hint: 'hide implementation details one level below or move one cohesive group to a focused parent or child directory. Do not: add placeholder classes or files.',
		priority: 3,
	},
	'facade-file-content': {
		message: 'facade file must contain only re-exports',
		hint: 'keep index.ts, index.py, and __init__.py files limited to imports and re-exports. Move functions, classes, types, and values into implementation modules. Do not: put behavior or declarations in a facade file.',
		priority: 6,
	},
	'protocol-grouping': {
		message: 'small file contains a protocol contract',
		hint: 'Consider grouping related protocol contracts in one focused module when the file is small. Do not merge unrelated protocols or add padding only to satisfy the file-size rule.',
		priority: 7,
	},
	'typescript-inline-object-type': {
		message: 'avoid inline object types',
		hint: 'name the object shape as a type alias or interface and reuse it. Do not: duplicate anonymous object types inline.',
		priority: 5,
	},
	'typescript-inline-union-type': {
		message: 'avoid inline literal union types',
		hint: 'name the literal union as a type alias and reuse it at the boundary. Do not: describe a finite value contract anonymously in a parameter or return type.',
		priority: 5,
	},
	'tuple-type': {
		message: 'avoid tuple types',
		hint: 'replace positional tuple types with a named interface or class whose fields express the contract. Do not: return or pass data through unnamed tuple positions.',
		priority: 5,
	},
	'file-min-size': {
		message: 'file is too short',
		hint: 'keep the file focused enough to justify its existence, or merge it into a nearby module. Do not: leave a thin file wrapper just to split the code.',
		priority: 7,
	},
	'file-max-size': {
		message: 'file is too large (found {count} raw lines)',
		hint: 'split the file by ownership into focused modules. Do not: hide file size behind wrappers or generated-looking padding.',
		priority: 3,
	},
	'function-placement': {
		message: 'module-level functions must be declared in the project-root functions file',
		hint: 'FIRST move all functions to {project root}/functions.{ext}, then fix other problems.',
		priority: 7,
	},
	'shared-parameter-type': {
		message:
			'multiple {noun} share parameter type "{parameters}" ({support}). Candidates: {candidates}.',
		hint: 'Inspect every production use of the shared type before refactoring. When appropriate, create a focused wrapper around the project type as a focused project wrapper, or extend the owning project class/protocol. Do not: hide the contract with type transformations or duplicate it across callables.',
		priority: 5,
	},
	'shared-parameter-combination': {
		message:
			'multiple {noun} share parameter combination "{parameters}" ({support}). Candidates: {candidates}.',
		hint: 'Create a named wrapper/options object for the parameter combination and update all callers. Do not: repeat the same positional contract.',
		priority: 5,
	},
	'file-function-count-info': {
		message: 'file has many functions (found {count})',
		hint: 'Refactor related state and behavior into a focused class or module. Do not: add temporary wrappers only to hide the function count.',
		priority: 1,
	},
	'file-function-count-warning': {
		message: 'file has too many functions (found {count})',
		hint: 'Refactor related state and behavior into a focused class or module. Do not: add temporary wrappers only to hide the function count.',
		priority: 3,
	},
	'module-constants-separation': {
		message: 'module-level constants must move to {target} or a focused file',
		hint: 'Move module-level constants out of ordinary implementation files. Use constants.ts or constants.py, or a focused file when the constants belong together. Do not: keep module-level constants beside implementation code.',
		priority: 7,
	},
	'module-types-separation': {
		message: 'module-level types must move to {target} or a focused file',
		hint: 'Move module-level types out of ordinary implementation files. Use types.ts or types.py, or a focused file when the types belong together. Do not: keep module-level types beside implementation code.',
		priority: 7,
	},
	'module-protocols-separation': {
		message: 'module-level protocols must move to {target} or a focused file',
		hint: 'Move module-level protocols out of ordinary implementation files. Use protocols.ts or protocols.py, or a focused file when the protocols belong together. Do not: keep module-level protocols beside implementation code.',
		priority: 7,
	},
	'constants-file-content': {
		message: 'constants file must contain only constants (found {kind})',
		hint: 'Keep constants.{ext} limited to constant values. Do not: declare functions, types, or classes in the constants file.',
		priority: 6,
	},
} as const;
