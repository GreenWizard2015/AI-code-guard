from __future__ import annotations


from typing import Any
import ast

from implementation.rules.constants import TYPE_FACTORIES
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

    def _base_name(self, base: ast.AST) -> str:
        """Responsibilities: _extraction base class name_."""
        if type(base) is ast.Name:
            return base.id
        return base.attr

    def _class_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting classes inheriting type_."""
        if type(node) is not ast.ClassDef:
            return []
        names: Any = {
            self._base_name(base)
            for base in node.bases
            if type(base) in (ast.Name, ast.Attribute)
        }
        if names & self.type_factories:
            return [{"line": node.lineno - 1, "kind": "python-type-factory"}]
        return []

    def _assignment_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting assignments invocation type_."""
        if type(node) not in (ast.Assign, ast.AnnAssign):
            return []
        value: Any = node.value
        if type(value) is not ast.Call:
            return []
        function: Any = value.func
        if type(function) is ast.Name:
            if function.id in self.type_factories:
                return [{"line": node.lineno - 1, "kind": "python-type-factory"}]
        if type(function) is ast.Attribute:
            if function.attr in self.type_factories:
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

    def _tuple_annotation(self, annotation: ast.AST) -> bool:
        """Responsibilities: _identification tuple annotations builtin_."""
        if type(annotation) is not ast.Subscript:
            return False
        if type(annotation.value) is ast.Name:
            return annotation.value.id == "tuple"
        if type(annotation.value) is ast.Attribute:
            return annotation.value.attr == "Tuple"
        return False

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
            if self._tuple_annotation(annotation):
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

    def _decorator_rule_kinds(self, node: ast.AST) -> list[str]:
        """Responsibilities: _collection diagnostic kinds represented_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        kinds: list[str] = []
        for decorator in node.decorator_list:
            kinds.extend(self._decorator_kinds(decorator))
        return kinds

    def _decorator_kinds(self, decorator: ast.AST) -> list[str]:
        """Responsibilities: _classification static class property_."""
        if type(decorator) is ast.Name:
            if decorator.id == "staticmethod":
                return ["python-static-method"]
            if decorator.id == "classmethod":
                return ["python-class-method"]
        if type(decorator) is ast.Attribute and decorator.attr == "setter":
            return ["python-property-setter"]
        return []

    def __init__(self) -> None:
        """Responsibilities: _configuration Python type loading_."""
        self.type_factories: Any = TYPE_FACTORIES

    def collect_type_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _aggregate class assignment annotation_."""
        issues: Any = self._class_type_issue(node) + self._assignment_type_issue(node)
        issues += self._tuple_type_issue(node)
        issues += self._string_annotation_issue(node)
        kinds = self._decorator_rule_kinds(node)
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
