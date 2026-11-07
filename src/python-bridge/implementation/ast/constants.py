import ast

from implementation.rules.constants import (
    PYTHON_OPTIONAL_NAME,
    PYTHON_PARSE_ISSUES_KEY,
    PYTHON_PROTOCOL_DECLARATION_KIND,
    PYTHON_REFERENCE_ALIASES_KEY,
    PYTHON_RETURN_TYPE_KEY,
    PYTHON_SEQUENCE_NAME,
    PYTHON_STATEMENTS_KEY,
)

AST_IDENTITY_KEY = "identity"
AST_METRICS_KEY = "metrics"
AST_SIGNATURE_KEY = "signature"
AST_TEST_BEHAVIOR_KEY = "test_behavior"
AST_DECLARATION_KEY = "declaration"
AST_STRUCTURE_KEY = "structure"
AST_CLASSIFICATION_KEY = "classification"
AST_FIELD_ANALYSIS_KEY = "field_analysis"
AST_SOURCE_KEY = "source"
AST_REFERENCES_KEY = "references"
AST_CONTROL_FLOW_KEY = "control_flow"
AST_MODULE_DECLARATIONS_KEY = "module_declarations"
AST_CLASSES_KEY = "classes"
FUNCTIONS_KEY = "functions"
AST_METHODS_KEY = "methods"
CLASS_BASE_CLASS_NAMES_KEY = "base_class_names"
AST_FIELD_RECORDS_REQUIRED = "AST field {field!r} must contain records"
AST_FIELD_OBJECT_RECORD_REQUIRED = "AST field {field!r} contains a non-object record"

AST_NAMED_RANGE_FIELDS = frozenset({"name", "start", "end"})
AST_LINE_COUNT_FIELDS = frozenset({"lines", "sloc"})
AST_SCOPE_NODE_TYPES = frozenset({ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef})
AST_CONTROL_FLOW_NODE_TYPES = frozenset(
    {ast.If, ast.For, ast.AsyncFor, ast.While, ast.Try, ast.With, ast.AsyncWith, ast.Match},
)

CALLABLE_IDENTITY_FIELDS = AST_NAMED_RANGE_FIELDS.union(
    {"owner", "nested", "visibility"},
)
CALLABLE_METRIC_FIELDS = AST_LINE_COUNT_FIELDS.union(
    {"argument_count", "characters", "control_flow_depth"},
)
CALLABLE_SIGNATURE_FIELDS = frozenset(
    {
        PYTHON_STATEMENTS_KEY,
        "parameter_types",
        PYTHON_RETURN_TYPE_KEY,
        "argument_uses",
        "typed_arguments",
        "untyped_parameters",
    },
)
CALLABLE_TEST_BEHAVIOR_FIELDS = frozenset(
    {
        "exception_only",
        "has_unittest_assertion",
        "unittest_assertion_alias",
        "unittest_exception_only",
        "test_exception_bypass",
        "unittest_ending_valid",
        "unittest_assertion_count",
    },
)
CALLABLE_DECLARATION_FIELDS = frozenset({"decorators", "is_accessor", "has_self"})
CALLABLE_GROUPED_FIELDS = CALLABLE_IDENTITY_FIELDS.union(
    CALLABLE_METRIC_FIELDS,
    CALLABLE_SIGNATURE_FIELDS,
    CALLABLE_TEST_BEHAVIOR_FIELDS,
    CALLABLE_DECLARATION_FIELDS,
)

CLASS_IDENTITY_FIELDS = AST_NAMED_RANGE_FIELDS.union(AST_LINE_COUNT_FIELDS)
CLASS_STRUCTURE_FIELDS = frozenset(
    {"methods", "interfaces", CLASS_BASE_CLASS_NAMES_KEY, "dependencies"},
)
CLASSIFICATION_FIELDS = frozenset(
    {
        "extends_external_class",
        "is_data_class",
        "type_contract",
        PYTHON_PROTOCOL_DECLARATION_KIND,
    },
)
CLASS_FIELD_ANALYSIS_FIELDS = frozenset(
    {"callback_fields", "inline_callback_fields", "fields", "untyped_fields"},
)
CLASS_GROUPED_FIELDS = CLASS_IDENTITY_FIELDS.union(
    CLASS_STRUCTURE_FIELDS,
    CLASSIFICATION_FIELDS,
    CLASS_FIELD_ANALYSIS_FIELDS,
)
AST_SOURCE_FIELDS = frozenset(
    {
        "language",
        AST_CLASSES_KEY,
        FUNCTIONS_KEY,
        PYTHON_PARSE_ISSUES_KEY,
        "import_issues",
        "coding_issues",
        "python_imports",
    },
)
AST_REFERENCE_FIELDS = frozenset(
    {
        "attribute_accesses",
        "named_symbols",
        "type_declarations",
        PYTHON_REFERENCE_ALIASES_KEY,
        "symbol_references",
        "literal_references",
        "literal_constants",
        "call_references",
        "type_members",
    },
)
AST_CONTROL_FLOW_FIELDS = frozenset(
    {"private_accesses", "repeated_branches", "module_instances"},
)
AST_MODULE_DECLARATION_FIELDS = frozenset(
    {
        "module_constant_spans",
        "module_type_spans",
        "module_protocol_spans",
        "python_exports",
        "python_callable_count",
        "python_main_guard",
        "docstring_spans",
        "responsibility_targets",
    },
)
AST_GROUPED_FIELDS = AST_SOURCE_FIELDS.union(
    AST_REFERENCE_FIELDS,
    AST_CONTROL_FLOW_FIELDS,
    AST_MODULE_DECLARATION_FIELDS,
)

BUILTIN_TYPES: frozenset[str] = frozenset(
    {
        "Any",
        "JSON",
        "bool",
        "bytes",
        "dict",
        "float",
        "int",
        "list",
        "object",
        "set",
        "str",
        "tuple",
    },
)
STRUCTURAL_TYPE_NAMES: frozenset[str] = frozenset(
    {
        "Any",
        "Callable",
        "Literal",
        "Mapping",
        PYTHON_OPTIONAL_NAME,
        PYTHON_SEQUENCE_NAME,
        "Union",
        "dict",
        "list",
        "set",
        "tuple",
    },
)
CLASS_BUILTIN_TYPES: frozenset[str] = frozenset(
    {
        "Any",
        "bool",
        "bytes",
        "dict",
        "float",
        "int",
        "list",
        "object",
        "set",
        "str",
        "tuple",
    },
)
