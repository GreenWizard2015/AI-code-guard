from __future__ import annotations

import ast
from implementation.rules.constants import PYTHON_TYPE_FACTORY_KIND
from typing import Any

from implementation.protocols import (
    PythonDecoratorRulesContract,
    PythonDuplicateSetupContract,
    PythonTypeFactoryNamesContract,
)
from implementation.rules.type_rules.python_duplicate_setup import PythonDuplicateSetup
from implementation.types import JsonObject


class TypeRules:
    """Responsibilities: _annotation structure analysis_, _type issue collection_."""

    duplicate_setup_rule: PythonDuplicateSetupContract

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
                return [{"line": node.lineno - 1, "kind": PYTHON_TYPE_FACTORY_KIND}]
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
            return [{"line": node.lineno - 1, "kind": PYTHON_TYPE_FACTORY_KIND}]
        return []

    def _generic_annotation_issue(self, annotation: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting nested generic annotation_."""
        if not self._nested_generic(annotation):
            return []
        return [
            {
                "line": annotation.lineno - 1,
                "kind": "inline-generic-type",
            }
        ]

    def _tuple_annotations(self, node: ast.AST) -> list[ast.AST]:
        """Responsibilities: _collection tuple annotations_."""
        annotations: list[ast.AST] = []
        if type(node) is ast.arg:
            if node.annotation is not None:
                annotations.append(node.annotation)
        is_function = type(node) in (ast.FunctionDef, ast.AsyncFunctionDef)
        if is_function:
            if node.returns is not None:
                annotations.append(node.returns)
        is_annotated = type(node) is ast.AnnAssign
        if is_annotated:
            if node.annotation is not None:
                annotations.append(node.annotation)
        return annotations

    def _tuple_type_issue(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _reporting tuple annotations_."""
        annotations = self._tuple_annotations(node)
        for annotation in annotations:
            if self.type_factory_names.tuple_annotation(annotation):
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

    def _function_arguments(self, node: ast.AST) -> list[ast.arg]:
        """Responsibilities: _collection function annotations_."""
        arguments: Any = [
            *node.args.posonlyargs,
            *node.args.args,
            *node.args.kwonlyargs,
        ]
        if node.args.vararg:
            arguments.append(node.args.vararg)
        if node.args.kwarg:
            arguments.append(node.args.kwarg)
        return arguments

    def __init__(
        self,
        tree: ast.AST,
        python_decorator_rules: PythonDecoratorRulesContract,
        type_factory_names: PythonTypeFactoryNamesContract,
    ) -> None:
        """Responsibilities: _configuration Python type loading_."""
        self.tree: ast.AST = tree
        self.type_factory_names: PythonTypeFactoryNamesContract = type_factory_names
        self.python_decorator_rules: PythonDecoratorRulesContract = (
            python_decorator_rules
        )
        self.duplicate_setup_rule: PythonDuplicateSetupContract = PythonDuplicateSetup()

    def collect_type_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _aggregate class assignment annotation_."""
        self.type_factory_names._observe(node)
        self.type_factory_names._observe_tuple(node)
        self.python_decorator_rules.aliases.observe(node)
        issues: Any = self._class_type_issue(node) + self._assignment_type_issue(node)
        issues += self._tuple_type_issue(node)
        issues += self._string_annotation_issue(node)
        issues += self.duplicate_setup_rule.issues(node)
        kinds = self.python_decorator_rules.kinds(node)
        return [{"line": node.lineno - 1, "kind": kind} for kind in kinds] + issues

    def prepare(self) -> None:
        """Responsibilities: _type factory alias preparation_."""
        self.type_factory_names.configure(self.tree)
        self.type_factory_names.configure_tuple(self.tree)

    def collect_generic_types(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection nested generic issues_."""
        if type(node) not in (ast.FunctionDef, ast.AsyncFunctionDef):
            return []
        arguments = self._function_arguments(node)
        issues: list[dict[str, Any]] = []
        for argument in arguments:
            if argument.annotation is not None:
                issues.extend(self._generic_annotation_issue(argument.annotation))
        if node.returns is not None:
            issues.extend(self._generic_annotation_issue(node.returns))
        return issues
