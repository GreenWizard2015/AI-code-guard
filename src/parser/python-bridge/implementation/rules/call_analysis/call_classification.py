from __future__ import annotations

import ast
from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.protocols import PythonReferenceAliasesProtocol


class PythonCallClassification:
    """Responsibilities: _call kind classification_."""

    def _test_function_parent(self, parent: ast.AST) -> bool:
        """Responsibilities: _test function classification_."""
        if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
            return parent.name.startswith("test_")
        return False

    def _named_call_kind(self, function: ast.Name) -> str:
        """Responsibilities: _named call classification_."""
        if self.reference_aliases.target_ends_with(function.id, ".__init__"):
            return "python-direct-class-init"
        if self.reference_aliases.target_ends_with(function.id, ".__setattr__"):
            return "python-object-setattr"
        return ""

    def _attribute_call_kind(self, function: ast.Attribute, node: ast.Call) -> str:
        """Responsibilities: _attribute call classification_."""
        if type(function.value) is not ast.Name:
            return ""
        target = function.value
        if target.id == "self":
            if function.attr.startswith("assert"):
                if self.test_function(node):
                    return "assertion-in-test-function"
                return "assertion-outside-test"
        if function.attr == "__setattr__":
            if target.id == "object":
                return "python-object-setattr"
        if function.attr == "__init__":
            return "python-direct-class-init"
        return ""

    def _temporary_target(self, node: ast.AST) -> ast.AST:
        """Responsibilities: _temporary target extraction_."""
        if type(node) is ast.Call:
            if type(node.func) is ast.Attribute:
                return node.func.value
        if type(node) is ast.Attribute:
            return node.value
        return ast.Constant(value=None)

    def __init__(self, aliases: PythonReferenceAliasesProtocol) -> None:
        """Responsibilities: _call classification setup_."""
        self.reference_aliases: PythonReferenceAliasesProtocol = aliases
        self.parents: dict[int, ast.AST] = {}

    def configure(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _call parent indexing_."""
        parents = {
            id(child): node
            for node in node_index.nodes(tree)
            for child in ast.iter_child_nodes(node)
        }
        self.parents.clear()
        self.parents.update(parents)

    def test_function(self, node: ast.AST) -> bool:
        """Responsibilities: _test function nesting_."""
        parent = self.parents.get(id(node))
        while parent is not None:
            if self._test_function_parent(parent):
                return True
            parent = self.parents.get(id(parent))
        return False

    def kind(self, node: ast.AST) -> str:
        """Responsibilities: _special call kind_."""
        if type(node) is not ast.Call:
            return ""
        if type(node.func) is ast.Name:
            return self._named_call_kind(node.func)
        if type(node.func) is not ast.Attribute:
            return ""
        return self._attribute_call_kind(node.func, node)

    def temporary_constructor(self, node: ast.AST) -> bool:
        """Responsibilities: _temporary constructor detection_."""
        target = self._temporary_target(node)
        if type(target) is not ast.Call:
            return False
        if type(target.func) is not ast.Name:
            return False
        return self.reference_aliases.target_starts_upper(target.func.id)
