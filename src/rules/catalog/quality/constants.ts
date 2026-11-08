export const QUALITY_RULE_DATA = {
	"python-all-list-assignment": {
		message: "Python __all__ must be assigned a literal list of strings",
		hint: "Assign __all__ once from a list containing only string literals. Do not: build or mutate the export list with annotations, concatenation, aliases, or collection methods.",
		priority: 3,
	},
	responsibilities: {
		message: "violates the Responsibilities contract: {issue}",
		hint: "Use one Responsibilities line and name each object. Do not: repeat the line or use a bare action.",
		priority: 5,
	},
	"responsibilities-min-count": {
		message: "has too few responsibilities",
		hint: "Expand the owner contract when the work belongs there, or split the owner or method when it does not.",
		priority: 5,
	},
	"responsibilities-max-count": {
		message: "has too many responsibilities",
		hint: "Split the owner or method when the responsibilities cannot be named as one focused contract.",
		priority: 5,
	},
	"responsibilities-wording": {
		message: "violates responsibility wording",
		hint: "Use a concise noun phrase naming the owned work. Do not: describe results or invocation mechanics.",
		priority: 0,
	},
	"non-english-source-text": {
		message: "contains non-English text in source code",
		hint: "Keep production comments and literals in English. In tests, keep comments English; test literals may use any language.",
		priority: 0,
	},
	"logical-chain-size": {
		message: "logical expression is too complex",
		hint: "extract the condition into a named boolean variable or predicate method. Do not: keep a long logical chain inline.",
		priority: 2,
	},
	"mixed-boolean-precedence": {
		message: "mixed boolean operators require grouping",
		hint: "split the boolean expression or add parentheses around each precedence boundary. Do not: mix &&, ||, or ! inline when the grouping is not explicit.",
		priority: 2,
	},
	"mixed-arithmetic-precedence": {
		message: "mixed arithmetic operators require grouping",
		hint: "split the arithmetic expression or add parentheses around each precedence boundary. Do not: mix +, -, *, or / inline when the grouping is not explicit.",
		priority: 2,
	},
	"python-static-method": {
		message: "avoid static methods",
		hint: "replace the static helper with a module-level function with explicit arguments. Do not: keep a stateless @staticmethod.",
		priority: 2,
	},
	"python-property-setter": {
		message: "avoid Python property setters",
		hint: "keep objects immutable and return a new value or use an explicit state transition method. Do not: mutate instance state through @property.setter.",
		priority: 5,
	},
	"python-property": {
		message: "avoid Python @property getters",
		hint: "Replace @property with an explicit method that names the operation. Do not: hide behavior behind implicit property access.",
		priority: 5,
	},
	"typescript-getter": {
		message: "avoid TypeScript get accessors",
		hint: "Replace get accessors with explicit methods that name the operation. Do not: hide behavior behind implicit property access.",
		priority: 5,
	},
	"typescript-setter": {
		message: "avoid TypeScript set accessors",
		hint: "Replace set accessors with explicit state-transition methods. Do not: mutate state through property assignment.",
		priority: 5,
	},
	"unnecessary-undefined-check": {
		message: "condition checks a required field for undefined",
		hint: "remove the impossible undefined check or correct the field type.",
		priority: 5,
	},
	"typescript-literal-object-access": {
		message: "object access uses a string literal key",
		hint: "use direct member access or store a dynamic key in a variable before indexing. Do not: repeat member names as string literals in bracket access.",
		priority: 4,
	},
	"broad-except": {
		message: "avoid broad try/catch or try/except blocks",
		hint: "catch only the expected exception at the I/O, process, network, or JSON boundary. Do not: wrap business logic in a broad catch/except.",
		priority: 4,
	},
	"empty-error-handler": {
		message: "error handler is empty",
		hint: "Handle the error, rethrow it, or document an explicit suppression contract. Do not: leave catch or except with only an empty statement.",
		priority: 2,
	},
	"error-context-loss": {
		message: "caught error context is discarded",
		hint: "Preserve the caught error, its message, or a cause when translating it. Do not: throw a new *Error without the original error context, or suppress Python context with raise ... from None.",
		priority: 4,
	},
	"boolean-flag-parameter": {
		message: 'callable "{name}" has too many boolean flag parameters (found {count})',
		hint: "Replace multiple boolean flags with a named options or state object. Do not: combine independent modes into positional booleans.",
		priority: 4,
	},
	"python-multi-except": {
		message: "catch one exception type per except handler",
		hint: "handle one exception type per handler and prefer one general boundary handler with minimal conditions. Do not: group unrelated exception types in one except tuple.",
		priority: 4,
	},
	"python-isinstance": {
		message: "avoid repeated isinstance checks in business logic",
		hint: "validate the value once at the input boundary. Do not: branch repeatedly on isinstance in business logic.",
		priority: 4,
	},
	getattr: {
		message: "avoid getattr for normal control flow",
		hint: "use an explicit attribute or a typed helper. Do not: use getattr as normal control flow or feature detection.",
		priority: 4,
	},
	setattr: {
		message: "avoid setattr for normal control flow",
		hint: "assign through an explicit attribute or setter. Do not: use setattr to bypass the object contract.",
		priority: 4,
	},
	"python-object-setattr": {
		message: "avoid direct object.__setattr__ calls",
		hint: "assign through an explicit attribute or a dedicated setter. Do not: bypass the object contract with object.__setattr__.",
		priority: 4,
	},
	"multiple-result-shapes": {
		message: "avoid inferring tool results from multiple shapes",
		hint: "normalize the upstream response at one boundary and read content afterward. Do not: support multiple result shapes in business logic.",
		priority: 6,
	},
	"repeated-literal": {
		message: "non-trivial string literal is repeated without a constant",
		hint: "define a named constant for the repeated value and use it at every occurrence. Do not: repeat the same non-trivial value in production code.",
		priority: 0,
	},
	"literal-constant-reuse": {
		message: 'non-trivial string literal must use existing constant "{constant}"',
		hint: 'replace the literal with the existing constant "{constant}". Do not: duplicate a value already represented by a named constant.',
		priority: 0,
	},
	"ternary-expression": {
		message: "avoid ternary expressions",
		hint: "replace ternary expressions with explicit if/else branches so each state transition is visible. Do not: hide control flow in a conditional expression.",
		priority: 2,
	},
	"conditional-execution": {
		message: "avoid conditionally executing non-boolean calls",
		hint: "use an explicit if branch for calls guarded by &&, ||, ??, and, or, or ?. Do not: hide conditional non-boolean calls in expressions.",
		priority: 2,
	},
	"early-return": {
		message: "prefer an early return before the alternate branch",
		hint: "replace if return ... else return ... with if return ... followed by return ...; remove the unnecessary else branch.",
		priority: 2,
	},
	"python-elif": {
		message: "avoid Python elif branches",
		hint: "replace elif with an explicit nested if in the else block. Do not: hide a second branch in elif.",
		priority: 2,
	},
	"python-assignment-expression": {
		message: "avoid Python assignment expressions",
		hint: "assign the value in a separate statement before using it in an expression. Do not: use the := operator.",
		priority: 2,
	},
	"complex-default-parameter": {
		message: "avoid complex default parameter values",
		hint: "default dependencies and mutable values to null or None, then create or validate them explicitly inside the constructor or caller. Do not: allocate objects, call factories, or use mutable containers in a parameter default.",
		priority: 2,
	},
	"typescript-module-namespace-dependency": {
		message: "module namespace is passed as a constructor dependency",
		hint: "Keep module APIs inside their platform adapter and pass a narrow project-owned contract between classes. Do not: inject an imported module namespace into a constructor.",
		priority: 4,
	},
	"exception-raising": {
		message: "tests must not raise or throw exceptions",
		hint: "Return an explicit result or handle failure without an exception. Do not: use raise or throw in tests.",
		priority: 6,
	},
	"temporary-result-access": {
		message: "avoid direct access through temporary results or spread copies",
		hint: "name copied arrays or dictionaries before accessing them. Do not: access a spread copy before assigning it.",
		priority: 4,
	},
	"python-call-method": {
		message: "avoid __call__ methods",
		hint: "expose an explicit method with a descriptive name. Do not: make project objects callable through __call__.",
		priority: 4,
	},
	"complex-constructor": {
		message: "keep constructors limited to setup and validation",
		hint: "keep __init__, __post_init__, and constructor bodies limited to parameter validation, field assignment, dependency creation, and super initialization. Move document building, I/O, and business logic into an explicit method or factory. Do not: call project behavior from a constructor.",
		priority: 5,
	},
	"local-inheritance": {
		message: 'declaration inherits from non-contract base "{base_name}"',
		hint: "Classes may inherit only project contracts; protocols and interfaces may inherit only other protocols and interfaces. Compose implementation objects. External framework bases at integration boundaries remain outside this local rule.",
		priority: 6,
	},
	"unused-constant": {
		message: 'module constant "{name}" has no production usage',
		hint: "Remove the constant or add a real production usage. Do not: keep dead configuration or vocabulary in the module.",
		priority: 7,
	},
	"attribute-depth": {
		message: "attribute access is too deep (found {depth} levels)",
		hint: "refactor the object graph or introduce a named boundary with its own contract. Do not: silence the warning by assigning each chain segment to temporary local variables.",
		priority: 2,
	},
	"duplicate-error-translation": {
		message: "catch handler translates the same error more than once",
		hint: "Combine the branches or preserve distinct error context. Do not: construct the same translated error repeatedly in one catch or except handler.",
		priority: 4,
	},
	"pointless-boolean-operation": {
		message: "boolean identity check only returns",
		hint: "Return the boolean expression directly or use a named predicate. Do not: branch on a boolean identity comparison only to return.",
		priority: 3,
	},
	"argument-count": {
		message: "{callable} has too many arguments (found {count})",
		hint: "introduce a named options object and validate it at the boundary. Do not: add another positional argument.",
		priority: 3,
	},
	"parse-error": {
		message: "{language} parse error: {message}",
		hint: "correct the syntax before applying structural lint rules. Do not: rely on regex recovery for malformed code.",
		priority: 7,
	},
	"python-sys-path-mutation": {
		message: "avoid sys.path mutations",
		hint: "configure the project import path through the test runner or package environment. Do not: assign to sys.path or mutate it through list methods or indexed writes.",
		priority: 4,
	},
	"numeric-name": {
		message: "symbol names must not contain numbers",
		hint: "replace numeric suffixes and embedded numbers with descriptive words. Do not: keep distinctions such as item1, item2, or version2 in symbol names.",
		priority: 2,
	},
	"numeric-file-name": {
		message: "file names must not contain numbers",
		hint: "replace numbers in file names with descriptive words. Powers of two from 16 onward are allowed. Do not: use other numeric suffixes or embedded numbers.",
		priority: 2,
	},
	"exception-grouping": {
		message: "exception class should be colocated with its caller",
		hint: "Move a one-use Error class into the caller module, or group related exception classes in one focused module. Do not: keep a one-use exception in an isolated file.",
		priority: 7,
	},
	"pointless-assignment": {
		message: "avoid pointless temporary assignments",
		hint: "inline the expression instead of splitting a straight-line result into temporary variables. Do not: add names that are never reused for a real branch or side effect.",
		priority: 4,
	},
	"constructor-dependency-count": {
		message: "class has too many project constructor dependencies (found {count})",
		hint: "Split the class or introduce a focused collaborator that owns a cohesive dependency group. Do not: count collections, built-ins, or external library objects as project dependencies.",
		priority: 5,
	},
	"method-order": {
		message: "class member is declared out of order",
		hint: "place private and protected methods first, the constructor next, and public methods last.",
		priority: 2,
	},
	"private-member": {
		message: "private class members must not be accessed from outside their class",
		hint: "Use a public method or property that expresses the required operation instead of reaching into private state.",
		priority: 4,
	},
	"shared-parameter": {
		message: 'multiple {noun} share parameter set "{parameters}" ({support}). Candidates: {candidates}.',
		hint: "Compare each name:type pair across all candidates, ignoring parameter order. When the repeated set represents one domain concept, name that contract and update its callers. Do not: combine unrelated parameters just to silence this diagnostic.",
		priority: 5,
	},
} as const;
