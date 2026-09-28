from __future__ import annotations


import ast
from implementation.types import AstParentIndex


class PythonProxyReceiverAliases:
    """Responsibilities: _proxy receiver alias resolution_."""

    def _function_scope(self, node: ast.AST, parents: AstParentIndex) -> ast.AST:
        """Responsibilities: _enclosing callable scope_."""
        current = node
        while True:
            parent_list = parents.get(id(current), [])
            if not parent_list:
                return self.tree
            for parent in parent_list:
                if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                    return parent
                current = parent
                break

    def _assignment_alias(self, node: ast.AST) -> dict[str, str]:
        """Responsibilities: _receiver alias assignment_."""
        if type(node) is not ast.Assign or len(node.targets) != 1:
            return {"target": "", "value": ""}
        target = node.targets[0]
        if type(target) is not ast.Name or type(node.value) is not ast.Name:
            return {"target": "", "value": ""}
        return {"target": target.id, "value": node.value.id}

    def _scope_aliases(
        self,
        scope: ast.AST,
        line: int,
        parents: AstParentIndex,
    ) -> dict[str, str]:
        """Responsibilities: _scoped receiver aliases_."""
        aliases: dict[str, str] = {}
        for node in ast.walk(scope):
            if type(node) is not ast.Assign:
                continue
            if node is scope or node.lineno > line:
                continue
            if self._function_scope(node, parents) is not scope:
                continue
            assignment = self._assignment_alias(node)
            target = assignment["target"]
            value = assignment["value"]
            if target:
                aliases[target] = value
        return aliases

    def _resolve(self, name: str, aliases: dict[str, str]) -> str:
        """Responsibilities: _receiver alias chains_."""
        resolved = name
        seen: set[str] = set()
        while resolved in aliases and resolved not in seen:
            seen.add(resolved)
            resolved = aliases[resolved]
        return resolved

    def __init__(self, tree: ast.AST) -> None:
        """Responsibilities: _initialization receiver aliases_."""
        self.tree: ast.AST = tree

    def configure(self) -> AstParentIndex:
        """Responsibilities: _receiver parent indexing_."""
        parents: AstParentIndex = {}
        for parent in ast.walk(self.tree):
            for child in ast.iter_child_nodes(parent):
                parents.setdefault(id(child), []).append(parent)
        return parents

    def valid(self, node: ast.AST, name: str) -> bool:
        """Responsibilities: _valid receiver classification_."""
        return self.owner(node, name) in {"self", "cls"}

    def lambda_receiver(self, node: ast.AST) -> bool:
        """Responsibilities: _lambda receiver validation_."""
        if type(node) is not ast.Lambda or type(node.body) is not ast.Call:
            return False
        function = node.body.func
        if type(function) is not ast.Attribute or type(function.value) is not ast.Name:
            return False
        return self.valid(node, function.value.id)

    def owner(self, node: ast.AST, name: str) -> str:
        """Responsibilities: _receiver owner resolution_."""
        parents = self.configure()
        scope = self._function_scope(node, parents)
        return self._resolve(name, self._scope_aliases(scope, node.lineno, parents))
