from __future__ import annotations

import ast
from typing import cast

from implementation.rules.constants import PYTHON_OBJECT_FIELD_WRITE_RULE
from implementation.types import JsonObject, PythonASTLocatedNode


class PythonFieldMutationCollector:
    """Responsibilities: _field mutation collection_, _assignment target classification_."""

    def _raw_targets(self, statement: ast.AST) -> list[ast.AST]:
        """Responsibilities: _assignment target extraction_."""
        if type(statement) is ast.Assign:
            return list(statement.targets)
        if type(statement) is ast.AnnAssign or type(statement) is ast.AugAssign:
            return [statement.target]
        if type(statement) is ast.For or type(statement) is ast.AsyncFor:
            return [statement.target]
        if type(statement) is ast.With or type(statement) is ast.AsyncWith:
            return [item.optional_vars for item in statement.items if item.optional_vars is not None]
        if type(statement) is ast.comprehension:
            return [statement.target]
        return []

    def _flatten_targets(self, pending_targets: list[ast.AST]) -> list[ast.AST]:
        """Responsibilities: _nested target expansion_."""
        targets: list[ast.AST] = []
        while pending_targets:
            target = pending_targets.pop()
            if type(target) is ast.Tuple or type(target) is ast.List:
                pending_targets.extend(target.elts)
            else:
                if type(target) is ast.Starred:
                    pending_targets.append(target.value)
                else:
                    targets.append(target)
        return targets

    def _invalid_store_target(self, store_target: ast.AST) -> bool:
        """Responsibilities: _invalid field target classification_."""
        if type(store_target) is not ast.Attribute or type(store_target.ctx) is not ast.Store:
            return False
        current: ast.AST = store_target
        root_field = ""
        while type(current) is ast.Attribute:
            root_field = current.attr
            current = current.value
        if type(current) is not ast.Name:
            return True
        if current.id != "self":
            return True
        return not root_field.startswith(self._private_prefix)

    def __init__(self, private_prefix: str = "_") -> None:
        """Responsibilities: _private state prefix configuration_."""
        self._private_prefix: str = private_prefix

    def assignment_targets(self, statement_node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _assignment target collection_."""
        raw_targets = self._raw_targets(statement_node)
        if not raw_targets:
            return []
        return self._flatten_targets(raw_targets)

    def collect_mutations(self, mutation_node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _field mutation records_."""
        targets = self.assignment_targets(mutation_node)
        invalid_targets = [target for target in targets if self._invalid_store_target(target)]
        if not invalid_targets:
            return []
        return [
            {
                "line": cast(PythonASTLocatedNode, invalid_targets[0]).lineno - 1,
                "kind": PYTHON_OBJECT_FIELD_WRITE_RULE,
            },
        ]
