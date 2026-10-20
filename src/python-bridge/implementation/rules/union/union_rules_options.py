from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.protocols import (
    PythonTypingAliasesContract,
    PythonUnionAnnotationRulesContract,
)
from implementation.references.protocols import PythonContainerAliasesContract


class UnionRulesOptions:
    """Responsibilities: _AST analysis inputs_, _union rule dependencies_."""

    tree_value: ast.AST
    node_index_value: PythonAstNodeIndexContract
    container_aliases_value: PythonContainerAliasesContract
    typing_aliases_value: PythonTypingAliasesContract
    annotation_rules_value: PythonUnionAnnotationRulesContract

    def tree(self) -> ast.AST:
        """Responsibilities: _union tree access_."""
        return self.tree_value

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _union index access_."""
        return self.node_index_value

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _union alias access_."""
        return self.container_aliases_value

    def python_typing_aliases(self) -> PythonTypingAliasesContract:
        """Responsibilities: _union typing access_."""
        return self.typing_aliases_value

    def annotation_rules(self) -> PythonUnionAnnotationRulesContract:
        """Responsibilities: _union annotation access_."""
        return self.annotation_rules_value
