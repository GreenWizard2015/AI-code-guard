SEQUENCE_ANNOTATIONS: frozenset[str] = frozenset(
    {
        "Collection",
        "Iterable",
        "Sequence",
        "list",
        "set",
        "tuple",
    }
)
REFERENCE_GENERICS: frozenset[str] = frozenset(
    {
        "Collection",
        "Iterable",
        "Optional",
        "Sequence",
        "Union",
        "list",
        "set",
        "tuple",
    }
)
UNKNOWN_OWNER_TYPES: frozenset[str] = frozenset({"Any", "object"})
