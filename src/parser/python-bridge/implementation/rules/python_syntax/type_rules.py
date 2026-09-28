from __future__ import annotations


from typing import Any
import ast

from implementation.rules.protocols import PythonDecoratorRulesProtocol
from implementation.rules.python_syntax.tuple_type_names import PythonTupleTypeNames
from implementation.rules.python_syntax.type_factory_names import PythonTypeFactoryNames
from implementation.types import JsonObject


class TypeRules:
    """Responsibilities: _classification Python type factories_."""

    def _nested_generic(self, annotation: ast.AST) -> bool:
        """Responsibilities: _nested generic annotations detection_."""
        if type(annotation) is not ast.Subscript:
            return False
        if type(annotation.slice) in (ast.Subscript, ast.List, ast.Dict):
            return True
        return any(
            type(item) in (ast.Subscript, ast.List, ast.Dict)
            for item in ast.iter_child_nodes(annotation.slice)
        )

    def _class_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting classes inheriting type_."""
        if type(node) is not ast.ClassDef:
            return []
        for base in node.bases:
            if self.type_factory_names.matches(base):
                return [{"line": node.lineno - 1, "kind": "python-type-factory"}]
        return []

    def _contains_type_factory(self, value: ast.AST) -> bool:
        """Responsibilities: _nested type-factory detection_."""
        for item in ast.walk(value):
            if type(item) is not ast.Call:
                continue
            if self.type_factory_names.matches(item.func):
                return True
        return False

    def _assignment_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting value factory invocation_."""
        if type(node) not in (ast.Assign, ast.AnnAssign, ast.Return, ast.Expr):
            return []
        value: Any = node.value
        if value is None:
            return []
        if self._contains_type_factory(value):
            return [{"line": node.lineno - 1, "kind": "python-type-factory"}]
        return []

    def _generic_type_issue(self, argument: ast.arg) -> list[JsonObject]:
        """Responsibilities: _reporting nested generic parameter_."""
        if argument.annotation is None:
            return []
        if not self._nested_generic(argument.annotation):
            return []
        return [
            {
                "line": argument.annotation.lineno - 1,
                "kind": "inline-generic-type",
            }
        ]

    def _tuple_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting tuple annotations parameters_."""
        annotations: list[ast.AST] = []
        if type(node) is ast.arg and node.annotation is not None:
            annotations.append(node.annotation)
        is_function = type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
        if is_function and node.returns is not None:
            annotations.append(node.returns)
        is_annotated = type(node) is ast.AnnAssign
        if is_annotated and node.annotation is not None:
            annotations.append(node.annotation)
        for annotation in annotations:
            if self.tuple_type_names.annotation(annotation):
                return [{"line": annotation.lineno - 1, "kind": "tuple-type"}]
        return []

    def _string_annotation_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _report string-based type annotations_."""
        annotation: Any = None
        if type(node) in (ast.arg, ast.AnnAssign):
            annotation = node.annotation
        if type(node) in (ast.FunctionDef, ast.AsyncFunctionDef):
            annotation = node.returns
        if annotation is None:
            return []
        has_string = any(
            type(item) is ast.Constant and type(item.value) is str
            for item in ast.walk(annotation)
        )
        if not has_string:
            return []
        return [
            {"line": annotation.lineno - 1, "kind": "python-string-type-annotation"}
        ]

    def __init__(
        self, tree: ast.AST, decorator_rules: PythonDecoratorRulesProtocol
    ) -> None:
        """Responsibilities: _configuration Python type loading_."""
        self.tree: ast.AST = tree
        self.type_factory_names: PythonTypeFactoryNames = PythonTypeFactoryNames()
        self.tuple_type_names: PythonTupleTypeNames = PythonTupleTypeNames()
        self.decorator_rules: PythonDecoratorRulesProtocol = decorator_rules

    def collect_type_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _aggregate class assignment annotation_."""
        self.type_factory_names.configure(self.tree)
        self.type_factory_names.observe(node)
        self.tuple_type_names.configure(self.tree)
        self.tuple_type_names.observe(node)
        self.decorator_rules.aliases.observe(node)
        issues: Any = self._class_type_issue(node) + self._assignment_type_issue(node)
        issues += self._tuple_type_issue(node)
        issues += self._string_annotation_issue(node)
        kinds = self.decorator_rules.kinds(node)
        return [{"line": node.lineno - 1, "kind": kind} for kind in kinds] + issues

    def collect_generic_types(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection nested generic issues_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        arguments: Any = [
            *node.args.posonlyargs,
            *node.args.args,
            *node.args.kwonlyargs,
        ]
        if node.args.vararg:
            arguments.append(node.args.vararg)
        if node.args.kwarg:
            arguments.append(node.args.kwarg)
        issues: list[dict[str, Any]] = []
        for argument in arguments:
            issue: Any = self._generic_type_issue(argument)
            issues.extend(issue)
        return issues
