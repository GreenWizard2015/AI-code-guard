from __future__ import annotations

import ast
from typing import cast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.protocols import PythonReflectionNamesContract
from implementation.references.protocols import PythonPrivateVarsMappingContract
from implementation.references.protocols import (
    PythonContainerAliasesContract,
    PythonContainerKeysContract,
)
from implementation.types import JsonObject
from implementation.rules.constants import (
    PYTHON_CONTAINER_ALIASES_KEY,
    PYTHON_CONTAINER_KEYS_KEY,
    PYTHON_NODE_INDEX_KEY,
    PYTHON_PRIVATE_VARS_MAPPING_KEY,
    PYTHON_REFLECTION_NAMES_KEY,
    PYTHON_TREE_KEY,
)


class PythonPrivateAccessOptions:
    """Responsibilities: _access option validation_, _configuration data access_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    container_keys: PythonContainerKeysContract
    reflection_names: PythonReflectionNamesContract
    private_vars_mapping: PythonPrivateVarsMappingContract

    def __init__(self, data: JsonObject) -> None:
        """Responsibilities: _initialization private access dependencies_."""
        self.tree: ast.Module = cast(ast.Module, data[PYTHON_TREE_KEY])
        self.node_index: PythonAstNodeIndexContract = cast(
            PythonAstNodeIndexContract, data[PYTHON_NODE_INDEX_KEY]
        )
        self.container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, data[PYTHON_CONTAINER_ALIASES_KEY]
        )
        self.container_keys: PythonContainerKeysContract = cast(
            PythonContainerKeysContract, data[PYTHON_CONTAINER_KEYS_KEY]
        )
        self.reflection_names: PythonReflectionNamesContract = cast(
            PythonReflectionNamesContract, data[PYTHON_REFLECTION_NAMES_KEY]
        )
        self.private_vars_mapping: PythonPrivateVarsMappingContract = cast(
            PythonPrivateVarsMappingContract, data[PYTHON_PRIVATE_VARS_MAPPING_KEY]
        )

    def validate(self) -> None:
        """Responsibilities: _private access dependency validation_."""
        if type(self.tree) is not ast.Module:
            raise TypeError("private access tree must be a module")

    def data(self) -> JsonObject:
        """Responsibilities: _private access dependency export_."""
        return {
            PYTHON_TREE_KEY: self.tree,
            PYTHON_NODE_INDEX_KEY: self.node_index,
            PYTHON_CONTAINER_ALIASES_KEY: self.container_aliases,
            PYTHON_CONTAINER_KEYS_KEY: self.container_keys,
            PYTHON_REFLECTION_NAMES_KEY: self.reflection_names,
            PYTHON_PRIVATE_VARS_MAPPING_KEY: self.private_vars_mapping,
        }
