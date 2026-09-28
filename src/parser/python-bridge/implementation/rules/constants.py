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
CALLABLE_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.FunctionDef: (0, 1, 2, 8, 12, 17),
    ast.AsyncFunctionDef: (0, 1, 2, 8, 12, 17),
    ast.ClassDef: (1,),
    ast.arg: (1, 17),
}
STATEMENT_STAGE_TYPES: dict[type[ast.AST], tuple[int, ...]] = {
    ast.Assign: (1, 6, 16, 17),
    ast.AnnAssign: (1, 6, 16, 17),
    ast.Return: (6,),
    ast.Expr: (1,),
    ast.AugAssign: (16,),
    ast.Try: (3,),
    ast.TryStar: (3,),
    ast.Call: (4, 11),
    ast.Name: (5,),
    ast.Attribute: (5, 11),
    ast.Subscript: (5, 19),
    ast.Match: (7,),
    ast.Assert: (9,),
    ast.Raise: (6, 10),
    ast.IfExp: (13,),
    ast.BoolOp: (13,),
    ast.If: (13, 14, 17),
    ast.NamedExpr: (15,),
    ast.Compare: (18,),
    ast.With: (20,),
    ast.AsyncWith: (20,),
}
STAGE_TYPES = {**CALLABLE_STAGE_TYPES, **STATEMENT_STAGE_TYPES}
