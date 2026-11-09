import ast

IMPORT_OBSERVER_NODE_TYPES = (ast.Import, ast.ImportFrom, ast.Assign, ast.AnnAssign)
SYS_PATH_MUTATION_NODE_TYPES = (
    ast.Call,
    ast.Assign,
    ast.Delete,
    ast.AnnAssign,
    ast.AugAssign,
)

PYTHON_ISINSTANCE_FUNCTION = "isinstance"
PROTOCOL_DOWNCAST_TIMING = "rule.protocol-downcast-to-implementation"
PROTOCOL_DOWNCAST_PREPARE_TIMING = f"{PROTOCOL_DOWNCAST_TIMING}.prepare"
PYTHON_KNOWN_PREDICATE_NAMES: frozenset[str] = frozenset(
    {
        "type",
        "len",
        "bool",
        PYTHON_ISINSTANCE_FUNCTION,
        "issubclass",
        "all",
        "any",
    },
)
PYTHON_CALLABLE_FUNCTION = "callable"
CALLABLE_FEATURE_DETECTION_RULE = "callable-feature-detection"
SYS_PATH_INSTANCE_OWNER = "instance"
PYTHON_ATTRIBUTE_REFLECTION_CALLS: frozenset[str] = frozenset({"getattr", "setattr"})
REFLECTION_CALLS: frozenset[str] = (
    frozenset({PYTHON_ISINSTANCE_FUNCTION, PYTHON_CALLABLE_FUNCTION}) | PYTHON_ATTRIBUTE_REFLECTION_CALLS
)
PYTHON_DYNAMIC_IMPORT_FUNCTION = "__import__"
PYTHON_IMPORT_MODULE_FUNCTION = "import_module"
PYTHON_GETATTR_FUNCTION = "getattr"
PYTHON_FUNCTION_KIND = "function"
PYTHON_VARIABLE_KIND = "variable"
PYTHON_CONSTANT_KIND = "constant"
PYTHON_TYPE_ALIAS_DECLARATION_KIND = "type_alias"
PYTHON_PROTOCOL_DECLARATION_KIND = "protocol"
PYTHON_OTHER_DECLARATION_KIND = "other"
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
PYTHON_SETDEFAULT_METHOD = "setdefault"
PYTHON_COLLECTION_MUTATION_METHODS: frozenset[str] = frozenset(
    {
        "add",
        "append",
        "clear",
        "discard",
        "extend",
        "insert",
        "pop",
        "remove",
        PYTHON_SETDEFAULT_METHOD,
        "update",
    },
)
PYTHON_PROTOCOL_NAME = "Protocol"
PYTHON_LITERAL_NAME = "Literal"
PYTHON_MODULE_NAME_ABSENT = "absent"
PYTHON_MODULE_NAME_BOUND = "bound"
PYTHON_MODULE_NAME_REASSIGNED = "reassigned"
PYTHON_NAME_BINDING_MODULE_SCOPE = "module"
PYTHON_NAME_BINDING_CLASS_SCOPE = "class"
PYTHON_NAME_BINDING_CALLABLE_SCOPE = "callable"
PYTHON_CONDITIONAL_EXECUTION_KIND = "conditional-execution"
PYTHON_DATACLASS_DECORATOR = "dataclass"
PYTHON_OPTIONAL_NAME = "Optional"
PYTHON_UNION_NAME = "Union"
PYTHON_NULLABLE_DOMAIN_RULE = "nullable-domain-type"
PYTHON_COMPOSITE_STATE_RULE = "composite-state-type"
PYTHON_OPTIONAL_UNION_RULE = "python-optional-union"
PYTHON_LARGE_UNION_RULE = "large-union"
PYTHON_TEMPORAL_COUPLING_RULE_ID = "temporal-coupling"
PYTHON_TUPLE_TYPE_RULE = "tuple-type"
PYTHON_VALIDATION_PREFIXES: frozenset[str] = frozenset(
    {"validate_", "check_", "positive_"},
)
PRIVATE_ACCESS_CALLS: frozenset[str] = PYTHON_ATTRIBUTE_REFLECTION_CALLS | frozenset(
    {"vars"},
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
    },
)
PYTHON_TYPING_TYPE_FACTORIES: frozenset[str] = frozenset(
    {"NamedTuple", "TypedDict", "NewType"},
)
PYTHON_COLLECTION_TYPE_FACTORIES: frozenset[str] = frozenset({"namedtuple"})
TYPE_FACTORIES: frozenset[str] = PYTHON_TYPING_TYPE_FACTORIES | PYTHON_COLLECTION_TYPE_FACTORIES
MAX_CALLABLE_BRANCHES = 10
PYTHON_REFERENCE_ALIASES_KEY = "reference_aliases"
PYTHON_STATIC_METHOD_DECORATOR = "staticmethod"
PYTHON_CLASS_METHOD_DECORATOR = "classmethod"
PYTHON_PROPERTY_DECORATOR = "property"
PYTHON_CACHED_PROPERTY_DECORATOR = "cached_property"
PYTHON_PROXY_PROPERTY_DECORATORS = frozenset(
    {PYTHON_PROPERTY_DECORATOR, PYTHON_CACHED_PROPERTY_DECORATOR},
)
PYTHON_PROPERTY_SETTER_DECORATOR = "setter"
PYTHON_PROPERTY_DELETER_DECORATOR = "deleter"
PYTHON_GETATTRIBUTE_METHOD = "__getattribute__"
PYTHON_SETATTR_METHOD = "__setattr__"
PYTHON_MOCK_MODULE = "unittest.mock"
PYTHON_UNITTEST_MODULE = "unittest"
PYTHON_SHORT_MOCK_MODULE = "mock"
PYTHON_QUALIFIED_NAME_SEPARATOR = "."
PYTHON_LINE_KEY = "line"
PYTHON_MOCK_MODULES: frozenset[str] = frozenset({PYTHON_MOCK_MODULE, PYTHON_SHORT_MOCK_MODULE})
PYTHON_MOCK_IMPORTS: frozenset[str] = frozenset({"patch", "Mock", "MagicMock", "AsyncMock", "create_autospec"})
PYTHON_MOCK_FACTORIES: frozenset[str] = frozenset(
    {
        "unittest.mock.Mock",
        "unittest.mock.MagicMock",
        "unittest.mock.AsyncMock",
        "unittest.mock.create_autospec",
        "mock.Mock",
        "mock.MagicMock",
        "mock.AsyncMock",
        "mock.create_autospec",
        "mocker.Mock",
        "mocker.MagicMock",
        "mocker.AsyncMock",
        "mocker.create_autospec",
    },
)
PYTHON_PATCH_API_NAMES: frozenset[str] = frozenset(
    {
        "unittest.mock.patch",
        "mock.patch",
        "monkeypatch.setattr",
        "monkeypatch.delattr",
        "monkeypatch.setitem",
        "monkeypatch.delitem",
        "monkeypatch.setenv",
        "monkeypatch.delenv",
        "mocker.patch",
        "mocker.spy",
        "mocker.stub",
    },
)
PYTHON_PATCH_API_PREFIXES: frozenset[str] = frozenset(
    {
        "unittest.mock.patch.",
        "mock.patch.",
        "mocker.patch.",
    },
)
PYTHON_BUILTINS_SETATTR = "builtins.setattr"
PYTHON_SETATTR = "setattr"
PYTHON_OBJECT_SETATTR = "object.__setattr__"
PYTHON_DICT_ATTRIBUTE = "__dict__"
PYTHON_SLOTS_ATTRIBUTE = "__slots__"
PYTHON_WEAKREF_ATTRIBUTE = "__weakref__"
PYTHON_SELF_NAME = "self"
PYTHON_CLASS_NAME = "cls"
PYTHON_EXCEPTION_NAME = "Exception"
PYTHON_BASE_EXCEPTION_NAME = "BaseException"
PYTHON_SEQUENCE_NAME = "Sequence"
PYTHON_CLASSVAR_NAME = "ClassVar"
PYTHON_RETURN_TYPE_KEY = "return_type"
PYTHON_STATEMENTS_KEY = "statements"
PYTHON_MODULE_NESTED_STATEMENT_TYPES: frozenset[type[ast.AST]] = frozenset(
    {
        ast.If,
        ast.For,
        ast.AsyncFor,
        ast.While,
        ast.With,
        ast.AsyncWith,
        ast.Try,
        ast.TryStar,
        ast.Match,
    },
)
PYTHON_VALUE_NAME_KEY = "value_name"
PYTHON_PARSE_ISSUES_KEY = "parse_issues"
PYTHON_OPERATOR_PRECEDENCE_STAGE = "rule.operator-precedence"
PYTHON_DATETIME_MODULE = "datetime"
PYTHON_NOW_ATTRIBUTE = "now"
PYTHON_TODAY_ATTRIBUTE = "today"
PYTHON_TERNARY_KIND = "ternary-expression"
PYTHON_MIXED_BOOLEAN_PRECEDENCE_KIND = "mixed-boolean-precedence"
PYTHON_LOGICAL_CHAIN_SIZE_KIND = "logical-chain-size"
PYTHON_LOGICAL_CHAIN_MAX_CHARS = 100
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
PYTHON_SINGLE_ITEM_ARRAY_STATE_RULE = "single-item-array-state"
PYTHON_COMPLEX_CONSTRUCTOR_RULE = "complex-constructor"
PYTHON_FIELD_IN_CONSTRUCTOR_RULE = "field-in-constructor"
PYTHON_INLINE_GENERIC_TYPE_RULE = "inline-generic-type"
PYTHON_MULTIPLE_RESULT_SHAPES_RULE = "multiple-result-shapes"
PYTHON_EXCEPTION_RAISING_RULE = "exception-raising"
PYTHON_BROAD_EXCEPT_RULE = "broad-except"
PYTHON_TEST_SUBTEST_RULE = "python-test-subtest"
PYTHON_UNNECESSARY_UNDEFINED_CHECK_RULE = "unnecessary-undefined-check"
PYTHON_FIELD_READ_EFFECT = "read"
PYTHON_FIELD_WRITE_EFFECT = "write"
PYTHON_FIELD_READ_EFFECTS: frozenset[str] = frozenset({PYTHON_FIELD_READ_EFFECT})
PYTHON_FIELD_WRITE_EFFECTS: frozenset[str] = frozenset({PYTHON_FIELD_WRITE_EFFECT})
PYTHON_FIELD_READ_WRITE_EFFECTS: frozenset[str] = frozenset(
    {PYTHON_FIELD_READ_EFFECT, PYTHON_FIELD_WRITE_EFFECT},
)
PYTHON_STATIC_METHOD_RULE = "python-static-method"
PYTHON_CLASS_METHOD_RULE = "python-class-method"
PYTHON_PROPERTY_SETTER_RULE = "python-property-setter"
PYTHON_OBJECT_FIELD_WRITE_RULE = "object-field-write"
PYTHON_PROPERTY_RULE = "python-property"
PYTHON_ELIF_RULE = "python-elif"
PYTHON_ASSIGNMENT_EXPRESSION_RULE = "python-assignment-expression"
PYTHON_CONDITIONAL_TYPE_ALIAS_RULE = "python-conditional-type-alias"
CALLABLE_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.FunctionDef: (0, 1, 2, 7, 4, 13, 14),
    ast.AsyncFunctionDef: (0, 1, 2, 7, 4, 13, 14),
    ast.ClassDef: (1, 6, 18),
    ast.arg: (1, 13, 14),
}
STATEMENT_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.Assign: (1, 6, 12, 13, 14, 16),
    ast.AnnAssign: (1, 6, 12, 13, 14, 16),
    ast.Return: (6,),
    ast.Expr: (1, 6),
    ast.AugAssign: (12,),
    ast.Try: (3,),
    ast.TryStar: (3,),
    ast.Call: (4, 5),
    ast.Name: (5,),
    ast.Attribute: (4, 5),
    ast.Subscript: (4, 5, 16),
    ast.Raise: (6, 8),
    ast.IfExp: (9,),
    ast.BoolOp: (9,),
    ast.If: (6, 9, 10, 13, 14),
    ast.For: (6,),
    ast.AsyncFor: (6,),
    ast.While: (6,),
    ast.Assert: (6, 4),
    ast.NamedExpr: (11,),
    ast.Compare: (15,),
    ast.With: (6, 17),
    ast.AsyncWith: (6, 17),
}
STAGE_TYPES = {**CALLABLE_STAGE_TYPES, **STATEMENT_STAGE_TYPES}
PYTHON_PRECEDENCE_NODE_TYPES: frozenset[type[ast.AST]] = frozenset(
    {ast.BoolOp, ast.BinOp, ast.Compare, ast.UnaryOp},
)
