from __future__ import annotations


import ast

from implementation.ast.protocols import PythonAstNodeIndexProtocol
from implementation.references.aliases.scoped_type_aliases import PythonScopedTypeAliases
from implementation.types import JsonObject


class PythonUnboundedTypeRules:
    """Responsibilities: _identification unbounded annotations reporting_."""

    unbounded_type_names: frozenset[str] = frozenset(
        {"Any", "any", "object", "Object", "unknown"}
    )

    def _is_unbounded_name(self, name: str, context: ast.AST) -> bool:
        """Responsibilities: _unbounded name classification_."""
        resolved = self.type_aliases.resolve(name, context)
        if resolved in self.unbounded_type_names:
            return True
        final_name = resolved.rsplit(".", 1)[-1]
        if final_name in self.unbounded_type_names:
            return True
        return False

    def _is_unbounded_node(self, item: ast.AST, context: ast.AST) -> bool:
        """Responsibilities: _classification annotation node unbounded_."""
        if type(item) is ast.Name:
            return self._is_unbounded_name(item.id, context)
        if type(item) is ast.Attribute:
            return self._is_unbounded_name(ast.unparse(item), context)
        return False

    def _callable_arguments(self, node: ast.AST) -> list[ast.arg]:
        """Responsibilities: _collection annotated arguments callable_."""
        arguments = [*node.args.posonlyargs, *node.args.args, *node.args.kwonlyargs]
        if node.args.vararg is not None:
            arguments.append(node.args.vararg)
        if node.args.kwarg is not None:
            arguments.append(node.args.kwarg)
        return arguments

    def _callable_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting unbounded annotations callable_."""
        annotations = [
            argument.annotation
            for argument in self._callable_arguments(node)
            if argument.annotation is not None
        ]
        if node.returns is not None:
            annotations.append(node.returns)
        return [
            issue
            for annotation in annotations
            for issue in self.annotation_issues(annotation)
        ]

    def _inside_callable(self, node: ast.AST) -> bool:
        """Responsibilities: _classification node nested callable_."""
        pending = list(self.node_index.parents(node))
        visited: set[ast.AST] = set()
        while pending:
            parent = pending.pop()
            if parent in visited:
                continue
            visited.add(parent)
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                return True
            pending.extend(self.node_index.parents(parent))
        return False

    def _type_expression(self, node: ast.AST) -> bool:
        """Responsibilities: _identification assignments define type_."""
        if type(node) in (ast.Name, ast.Attribute, ast.Subscript):
            return True
        if type(node) is not ast.BinOp:
            return False
        return type(node.op) is ast.BitOr

    def _module_annotation_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _report unbounded module-level annotations_."""
        if type(node) is not ast.AnnAssign:
            return []
        if self._inside_callable(node):
            return []
        issues = self.annotation_issues(node.annotation)
        if node.value is not None:
            if self._type_expression(node.value):
                issues.extend(self.annotation_issues(node.value))
        return issues

    def _module_assignment_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting unbounded module-level type-expression_."""
        if type(node) is not ast.Assign:
            return []
        if self._inside_callable(node):
            return []
        if not self._type_expression(node.value):
            return []
        return self.annotation_issues(node.value)

    def __init__(self, tree: ast.AST, node_index: PythonAstNodeIndexProtocol) -> None:
        """Responsibilities: _initialization Python tree reusable_."""
        self.tree: ast.AST = tree
        self.node_index: PythonAstNodeIndexProtocol = node_index
        self.type_aliases: PythonScopedTypeAliases = PythonScopedTypeAliases(tree, node_index)

    def annotation_issues(self, annotation: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting unbounded nodes contained_."""
        return [
            {"line": node.lineno - 1, "kind": "unbounded-type"}
            for node in ast.walk(annotation)
            if self._is_unbounded_node(node, annotation)
        ]

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _collection unbounded annotation issues_."""
        self.type_aliases.collect()
        issues: list[JsonObject] = []
        for node in self.node_index.nodes(self.tree):
            if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
                issues.extend(self._callable_issues(node))
                continue
            issues.extend(self._module_annotation_issues(node))
            issues.extend(self._module_assignment_issues(node))
        return issues
