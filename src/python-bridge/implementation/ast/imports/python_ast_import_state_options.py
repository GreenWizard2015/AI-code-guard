from __future__ import annotations

import ast
from collections.abc import Mapping
from typing import cast

from implementation.ast.types import PythonAstImportStateOptionValue
from implementation.protocols import (
    PythonAstNodeIndexContract,
    PythonStructureIssuesContract,
)
from implementation.references.aliases.protocols import (
    PythonContainerAliasesContract,
    PythonReferenceAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_CONTAINER_ALIASES_KEY,
    PYTHON_NODE_INDEX_KEY,
    PYTHON_REFERENCE_ALIASES_KEY,
)


class PythonAstImportStateOptions:
    """Responsibilities: _import state storage_, _dependency resolution_."""

    tree: ast.Module
    node_index: PythonAstNodeIndexContract
    container_aliases: PythonContainerAliasesContract
    reference_aliases: PythonReferenceAliasesContract
    structure_issues: PythonStructureIssuesContract

    def __init__(self, values: Mapping[str, PythonAstImportStateOptionValue]) -> None:
        """Responsibilities: _import state fields_."""
        self.tree: ast.Module = cast(ast.Module, values["tree"])
        self.node_index: PythonAstNodeIndexContract = cast(
            PythonAstNodeIndexContract, values[PYTHON_NODE_INDEX_KEY]
        )
        self.container_aliases: PythonContainerAliasesContract = cast(
            PythonContainerAliasesContract, values[PYTHON_CONTAINER_ALIASES_KEY]
        )
        self.reference_aliases: PythonReferenceAliasesContract = cast(
            PythonReferenceAliasesContract, values[PYTHON_REFERENCE_ALIASES_KEY]
        )
        self.structure_issues: PythonStructureIssuesContract = cast(
            PythonStructureIssuesContract, values["structure_issues"]
        )

    def source_tree(self) -> ast.Module:
        """Responsibilities: _import source tree access_."""
        return self.tree

    def source_node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _import node index access_."""
        return self.node_index

    def source_container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _import container aliases access_."""
        return self.container_aliases

    def source_reference_aliases(self) -> PythonReferenceAliasesContract:
        """Responsibilities: _import reference aliases access_."""
        return self.reference_aliases

    def source_structure_issues(self) -> PythonStructureIssuesContract:
        """Responsibilities: _import structure issues access_."""
        return self.structure_issues
