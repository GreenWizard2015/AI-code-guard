from implementation.rules.constants import PYTHON_OPTIONAL_NAME, PYTHON_SEQUENCE_NAME

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
    }
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
    }
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
    }
)
