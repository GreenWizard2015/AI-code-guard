from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.references.protocols import PythonContainerAliasesContract
from implementation.rules.protocols import PythonCodingIssueComponentContextContract, PythonUnionAnnotationRulesContract
from implementation.rules.union.protocols import PythonObservedTypingAliasesContract


class UnionRulesOptions:
    """Responsibilities: _AST analysis inputs_, _union rule dependencies_."""

    _tree: ast.AST
    _node_index: PythonAstNodeIndexContract
    _container_aliases: PythonContainerAliasesContract
    _typing_aliases: PythonObservedTypingAliasesContract
    _annotation_rules: PythonUnionAnnotationRulesContract

    def __init__(
        self,
        context: PythonCodingIssueComponentContextContract,
        typing_aliases: PythonObservedTypingAliasesContract,
        annotation_rules: PythonUnionAnnotationRulesContract,
    ) -> None:
        """Responsibilities: _union analysis input ownership_."""
        self._tree = context.tree()
        self._node_index = context.node_index()
        self._container_aliases = context.aliases().containers.union_container_aliases
        self._typing_aliases = typing_aliases
        self._annotation_rules = annotation_rules

    def tree(self) -> ast.AST:
        """Responsibilities: _union tree access_."""
        return self._tree

    def node_index(self) -> PythonAstNodeIndexContract:
        """Responsibilities: _union index access_."""
        return self._node_index

    def container_aliases(self) -> PythonContainerAliasesContract:
        """Responsibilities: _union alias access_."""
        return self._container_aliases

    def python_typing_aliases(self) -> PythonObservedTypingAliasesContract:
        """Responsibilities: _union typing access_."""
        return self._typing_aliases

    def annotation_rules(self) -> PythonUnionAnnotationRulesContract:
        """Responsibilities: _union annotation access_."""
        return self._annotation_rules
