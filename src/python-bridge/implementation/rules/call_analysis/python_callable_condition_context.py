from __future__ import annotations

import ast


class PythonCallableConditionContext:
    """Responsibilities: _callable condition scope_, _test function context_."""

    def _condition_expressions(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _condition expression selection_."""
        if type(node) in (ast.If, ast.While, ast.IfExp, ast.Assert):
            return [node.test]
        if type(node) is ast.match_case:
            if node.guard is not None:
                return [node.guard]
        if type(node) is ast.comprehension:
            return list(node.ifs)
        return []

    def _contains_read_name(self, node: ast.AST, name: str) -> bool:
        """Responsibilities: _conditional alias name lookup_."""
        if type(node) is ast.Name:
            return node.id == name and type(node.ctx) is ast.Load
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
            return False
        return any(
            self._contains_read_name(child, name)
            for child in ast.iter_child_nodes(node)
        )

    def _condition_variable(self, node: ast.AST) -> str:
        """Responsibilities: _condition assignment target_."""
        if type(node) is ast.Assign:
            if len(node.targets) == 1 and type(node.targets[0]) is ast.Name:
                return node.targets[0].id
        if type(node) is ast.AnnAssign and type(node.target) is ast.Name:
            return node.target.id
        return ""

    def _target_contains_name(self, target: ast.AST, name: str) -> bool:
        """Responsibilities: _assignment target name lookup_."""
        if type(target) is ast.Name:
            return target.id == name
        if type(target) in (ast.Tuple, ast.List):
            return any(self._target_contains_name(item, name) for item in target.elts)
        return False

    def _writes_name(self, node: ast.AST, name: str) -> bool:
        """Responsibilities: _conditional alias reassignment detection_."""
        targets: list[ast.AST] = []
        if type(node) is ast.Assign:
            targets = node.targets
        if type(node) in (
            ast.AnnAssign,
            ast.AugAssign,
            ast.NamedExpr,
            ast.For,
            ast.AsyncFor,
        ):
            targets = [node.target]
        return any(self._target_contains_name(target, name) for target in targets)

    def _assignment_precedes(self, first: ast.AST, second: ast.AST) -> bool:
        """Responsibilities: _same-scope statement order_."""
        if first.lineno < second.lineno:
            return True
        if first.lineno > second.lineno:
            return False
        return first.col_offset < second.col_offset

    def _alias_reassigned_between(
        self, name: str, source: ast.AST, condition: ast.AST
    ) -> bool:
        """Responsibilities: _stale boolean alias rejection_."""
        scope = self.scopes.get(source)
        for node in self.nodes:
            if node is source:
                continue
            if self.scopes.get(node) != scope:
                continue
            if not self._writes_name(node, name):
                continue
            if not self._assignment_precedes(source, node):
                continue
            if self._assignment_precedes(node, condition):
                return True
        return False

    def _condition_name_reference(self, node: ast.AST, name: str) -> bool:
        """Responsibilities: _condition name reference_."""
        for expression in self._condition_expressions(node):
            if self._contains_read_name(expression, name):
                return True
        return False

    def _live_condition_alias(self, assignment: ast.AST, name: str) -> bool:
        """Responsibilities: _live callable condition alias_."""
        scope = self.scopes.get(assignment)
        for node in self.nodes:
            if self.scopes.get(node) != scope:
                continue
            if not self._condition_name_reference(node, name):
                continue
            if not self._assignment_precedes(assignment, node):
                continue
            if not self._alias_reassigned_between(name, assignment, node):
                return True
        return False

    def _parent_chain(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _AST parent chain construction_."""
        parents: list[ast.AST] = []
        current = node
        while True:
            parent = self.parents.get(id(current))
            if parent is None:
                return parents
            parents.append(parent)
            current = parent

    def _callable_assignment_parent(self, parent: ast.AST) -> bool:
        """Responsibilities: _callable assignment scope_."""
        if type(parent) not in (ast.Assign, ast.AnnAssign):
            return False
        name = self._condition_variable(parent)
        if not name:
            return False
        return self._live_condition_alias(parent, name)

    def _condition_parent(self, parent: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _callable condition parent matching_."""
        if type(parent) in (ast.If, ast.While, ast.IfExp, ast.Assert):
            if parent.test is target:
                return True
        if type(parent) is ast.match_case:
            if parent.guard is target:
                return True
        if type(parent) is ast.comprehension:
            if any(condition is target for condition in parent.ifs):
                return True
        return self._callable_assignment_parent(parent)

    def __init__(
        self,
        nodes: list[ast.AST],
        scopes: dict[ast.AST, str],
        parents: dict[int, ast.AST],
    ) -> None:
        """Responsibilities: _source scope index ownership_."""
        self.nodes: list[ast.AST] = nodes
        self.scopes: dict[ast.AST, str] = scopes
        self.parents: dict[int, ast.AST] = parents

    def contains_callable_condition(self, node: ast.Call) -> bool:
        """Responsibilities: _callable condition detection_."""
        target: ast.AST = node
        for parent in self._parent_chain(node):
            if self._condition_parent(parent, target):
                return True
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                return False
            target = parent
        return False

    def test_function(self, node: ast.AST) -> bool:
        """Responsibilities: _test function nesting_."""
        for parent in self._parent_chain(node):
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda):
                if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                    return parent.name.startswith("test_")
                return False
        return False
