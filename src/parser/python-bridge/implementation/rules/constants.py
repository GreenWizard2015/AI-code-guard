import ast

REFLECTION_CALLS: frozenset[str] = frozenset(
    {"isinstance", "getattr", "setattr", "callable"}
)
PRIVATE_ACCESS_CALLS: frozenset[str] = frozenset({"getattr", "setattr", "vars"})
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
TYPE_FACTORIES: frozenset[str] = frozenset(
    {"namedtuple", "NamedTuple", "TypedDict", "NewType"}
)
