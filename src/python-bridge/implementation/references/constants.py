from implementation.rules.constants import (
    PYTHON_OPTIONAL_NAME,
    PYTHON_SEQUENCE_NAME,
    PYTHON_UNION_NAME,
)

PYTHON_COLLECTION_TYPES: frozenset[str] = frozenset(
    {"Collection", "Iterable", PYTHON_SEQUENCE_NAME}
)
PYTHON_SEQUENCE_TYPES: frozenset[str] = frozenset({"list", "set", "tuple"})
SEQUENCE_ANNOTATIONS: frozenset[str] = PYTHON_COLLECTION_TYPES | PYTHON_SEQUENCE_TYPES
REFERENCE_GENERICS: frozenset[str] = (
    PYTHON_COLLECTION_TYPES
    | frozenset({PYTHON_OPTIONAL_NAME, PYTHON_UNION_NAME})
    | PYTHON_SEQUENCE_TYPES
)
UNKNOWN_OWNER_TYPES: frozenset[str] = frozenset({"Any", "object"})
UNBOUNDED_TYPE_NAMES: frozenset[str] = frozenset(
    {"Any", "any", "object", "Object", "unknown"}
)
PYTHON_ASSERT_RAISES_NAME = "assertRaises"
