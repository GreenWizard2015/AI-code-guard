from __future__ import annotations

import ast
from collections.abc import Mapping

from implementation.references.alias_types import ContainerItemMap
from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.references.protocols import (
    PythonContainerAliasContract,
    PythonContainerLookupContract,
)


class PythonContainerAlias(PythonContainerAliasContract):
    """Responsibilities: _container alias value_, _static alias value_."""

    def __init__(self, static_value: str, values: Mapping[str, ast.AST]) -> None:
        """Responsibilities: _container alias snapshot initialization_."""
        self._static_value: str = static_value
        self._values: Mapping[str, ast.AST] = values

    def static_value(self) -> str:
        """Responsibilities: _static alias retrieval_."""
        return self._static_value

    def values(self) -> ContainerItemMap:
        """Responsibilities: _container alias values retrieval_."""
        return dict(self._values)

    def item(self, key: str) -> PythonContainerLookupContract:
        """Responsibilities: _container alias item lookup_."""
        item = self._values.get(key)
        if item is None:
            return PythonContainerLookup(found_value=False, expression=ast.Name(id=key, ctx=ast.Load()))
        return PythonContainerLookup(found_value=True, expression=item)
