import ast

PYTHON_ISINSTANCE_FUNCTION = "isinstance"
PYTHON_CALLABLE_FUNCTION = "callable"
CALLABLE_FEATURE_DETECTION_RULE = "callable-feature-detection"
PYTHON_ATTRIBUTE_REFLECTION_CALLS: frozenset[str] = frozenset({"getattr", "setattr"})
REFLECTION_CALLS: frozenset[str] = (
    frozenset({PYTHON_ISINSTANCE_FUNCTION, PYTHON_CALLABLE_FUNCTION})
    | PYTHON_ATTRIBUTE_REFLECTION_CALLS
)
PYTHON_DYNAMIC_IMPORT_FUNCTION = "__import__"
PYTHON_IMPORT_MODULE_FUNCTION = "import_module"
PYTHON_GETATTR_FUNCTION = "getattr"
PYTHON_FUNCTION_KIND = "function"
PYTHON_VARIABLE_KIND = "variable"
PYTHON_CONSTANT_KIND = "constant"
PYTHON_MODULE_KIND = "module"
PYTHON_IMPORTLIB_MODULE = "importlib"
PYTHON_BUILTINS_MODULE = "builtins"
PYTHON_MAIN_NAME = "__name__"
PYTHON_MAIN_VALUE = "__main__"
PYTHON_TYPE_ALIAS_NAME = "TypeAlias"
PYTHON_TYPE_ALIAS_FACTORY_NAME = "TypeAliasType"
PYTHON_TYPING_MODULE = "typing"
PYTHON_TYPING_EXTENSIONS_MODULE = "typing_extensions"
PYTHON_COLLECTIONS_MODULE = "collections"
PYTHON_PROTOCOL_NAME = "Protocol"
PYTHON_DATACLASS_DECORATOR = "dataclass"
PYTHON_OPTIONAL_NAME = "Optional"
PYTHON_UNION_NAME = "Union"
PYTHON_NULLABLE_DOMAIN_RULE = "nullable-domain-type"
PYTHON_COMPOSITE_STATE_RULE = "composite-state-type"
PYTHON_OPTIONAL_UNION_RULE = "python-optional-union"
PYTHON_LARGE_UNION_RULE = "large-union"
PRIVATE_ACCESS_CALLS: frozenset[str] = PYTHON_ATTRIBUTE_REFLECTION_CALLS | frozenset(
    {"vars"}
)
ALL_REFLECTION_CALLS: frozenset[str] = REFLECTION_CALLS | PRIVATE_ACCESS_CALLS
SPECIAL_NAMES: frozenset[str] = frozenset({"structuredContent", "unwrap_tool_result"})
SYS_PATH_MUTATING: frozenset[str] = frozenset(
    {
        "append",
        "clear",
        "extend",
        "insert",
        "pop",
        "remove",
        "reverse",
        "sort",
    }
)
IMPORT_SCOPE_TYPES: frozenset[type[ast.AST]] = frozenset(
    {
        ast.FunctionDef,
        ast.AsyncFunctionDef,
        ast.Lambda,
        ast.ClassDef,
    }
)
PYTHON_TYPING_TYPE_FACTORIES: frozenset[str] = frozenset(
    {"NamedTuple", "TypedDict", "NewType"}
)
PYTHON_COLLECTION_TYPE_FACTORIES: frozenset[str] = frozenset({"namedtuple"})
TYPE_FACTORIES: frozenset[str] = (
    PYTHON_TYPING_TYPE_FACTORIES | PYTHON_COLLECTION_TYPE_FACTORIES
)
MAX_CALLABLE_BRANCHES = 10
PYTHON_NODE_INDEX_KEY = "node_index"
PYTHON_TREE_KEY = "tree"
PYTHON_CONTAINER_ALIASES_KEY = "container_aliases"
PYTHON_CONTAINER_KEYS_KEY = "container_keys"
PYTHON_REFLECTION_NAMES_KEY = "reflection_names"
PYTHON_PRIVATE_VARS_MAPPING_KEY = "private_vars_mapping"
PYTHON_REFERENCE_ALIASES_KEY = "reference_aliases"
PYTHON_STATIC_METHOD_DECORATOR = "staticmethod"
PYTHON_CLASS_METHOD_DECORATOR = "classmethod"
PYTHON_PROPERTY_DECORATOR = "property"
PYTHON_CACHED_PROPERTY_DECORATOR = "cached_property"
PYTHON_PROPERTY_SETTER_DECORATOR = "setter"
PYTHON_GETATTRIBUTE_METHOD = "__getattribute__"
PYTHON_SETATTR_METHOD = "__setattr__"
PYTHON_DICT_ATTRIBUTE = "__dict__"
PYTHON_SELF_NAME = "self"
PYTHON_CLASS_NAME = "cls"
PYTHON_EXCEPTION_NAME = "Exception"
PYTHON_BASE_EXCEPTION_NAME = "BaseException"
PYTHON_SEQUENCE_NAME = "Sequence"
PYTHON_CLASSVAR_NAME = "ClassVar"
PYTHON_RETURN_TYPE_KEY = "return_type"
PYTHON_STATEMENTS_KEY = "statements"
PYTHON_VALUE_NAME_KEY = "value_name"
PYTHON_PARSE_ISSUES_KEY = "parse_issues"
PYTHON_OPERATOR_PRECEDENCE_STAGE = "rule.operator-precedence"
PYTHON_POSITIONAL_ARGUMENTS_KEY = "positional"
PYTHON_KEYWORD_ONLY_ARGUMENTS_KEY = "keyword_only"
PYTHON_DATETIME_MODULE = "datetime"
PYTHON_NOW_ATTRIBUTE = "now"
PYTHON_TODAY_ATTRIBUTE = "today"
PYTHON_TERNARY_KIND = "ternary-expression"
PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND = "mixed-boolean-precedence"
PYTHON_MULTI_EXCEPT_KIND = "python-multi-except"
PYTHON_TYPE_FACTORY_KIND = "python-type-factory"
PYTHON_NODE_RULE_ANALYSIS_STAGE = "node-rule-analysis"
PYTHON_REFERENCE_COLLECTION_STAGE = "reference-data"
PYTHON_INIT_METHOD = "__init__"
PYTHON_POST_INIT_METHOD = "__post_init__"
PYTHON_CALL_METHOD = "__call__"
PYTHON_ASSERTION_OUTSIDE_TEST_RULE = "assertion-outside-test"
PYTHON_ASSERTION_IN_TEST_RULE = "assertion-in-test-function"
PYTHON_DIRECT_CLASS_INIT_RULE = "python-direct-class-init"
PYTHON_OBJECT_SETATTR_RULE = "python-object-setattr"
PYTHON_CALL_METHOD_RULE = "python-call-method"
PYTHON_TEST_ASSERTION_RULE = "python-test-assert-statement"
PYTHON_TEMPORARY_RESULT_RULE = "temporary-result-access"
PYTHON_FIELD_READ_EFFECT = "read"
PYTHON_FIELD_WRITE_EFFECT = "write"
PYTHON_FIELD_READ_EFFECTS: frozenset[str] = frozenset({PYTHON_FIELD_READ_EFFECT})
PYTHON_FIELD_WRITE_EFFECTS: frozenset[str] = frozenset({PYTHON_FIELD_WRITE_EFFECT})
PYTHON_FIELD_READ_WRITE_EFFECTS: frozenset[str] = frozenset(
    {PYTHON_FIELD_READ_EFFECT, PYTHON_FIELD_WRITE_EFFECT}
)
PYTHON_STATIC_METHOD_RULE = "python-static-method"
PYTHON_CLASS_METHOD_RULE = "python-class-method"
PYTHON_PROPERTY_SETTER_RULE = "python-property-setter"
CALLABLE_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.FunctionDef: (0, 1, 2, 7, 11, 16),
    ast.AsyncFunctionDef: (0, 1, 2, 7, 11, 16),
    ast.ClassDef: (1, 6, 20),
    ast.arg: (1, 16),
}
STATEMENT_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.Assign: (1, 6, 15, 16),
    ast.AnnAssign: (1, 6, 15, 16),
    ast.Return: (6,),
    ast.Expr: (1, 6),
    ast.AugAssign: (15,),
    ast.Try: (3,),
    ast.TryStar: (3,),
    ast.Call: (4, 10),
    ast.Name: (5,),
    ast.Attribute: (5, 10),
    ast.Subscript: (5, 10, 18),
    ast.Raise: (6, 9),
    ast.IfExp: (12,),
    ast.BoolOp: (12,),
    ast.If: (6, 12, 13, 16),
    ast.For: (6,),
    ast.AsyncFor: (6,),
    ast.While: (6,),
    ast.Assert: (6, 8),
    ast.NamedExpr: (14,),
    ast.Compare: (17,),
    ast.With: (6, 19),
    ast.AsyncWith: (6, 19),
}
STAGE_TYPES = {**CALLABLE_STAGE_TYPES, **STATEMENT_STAGE_TYPES}
PYTHON_PRECEDENCE_NODE_TYPES: frozenset[type[ast.AST]] = frozenset(
    {ast.BoolOp, ast.BinOp, ast.Compare, ast.UnaryOp}
)
