from __future__ import annotations

import ast

from implementation.ast.protocols import PythonAstNodeIndexContract
from implementation.rules.coding_issues.python_patch_alias_index import (
    PythonPatchAliasIndex,
)
from implementation.rules.constants import PYTHON_INIT_METHOD, PYTHON_LINE_KEY
from implementation.types import JsonObject


class PythonRuntimePatching:
    """Responsibilities: _patch call classification_, _callable replacement detection_."""

    _tree: ast.Module
    _node_index: PythonAstNodeIndexContract
    _aliases: PythonPatchAliasIndex

    def _constructor_owner_field(
        self,
        constructor: ast.AST,
        target: ast.Attribute,
        receiver_name: str,
    ) -> bool:
        """Responsibilities: _constructor field ownership_."""
        current = constructor
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                return False
            current = parents[0]
            if type(current) is ast.ClassDef:
                if type(target.value) is not ast.Name or target.value.id != receiver_name:
                    return False
                return target.attr not in self._class_method_names(current)

    def _constructor_assignment(self, constructor: ast.AST, target: ast.Attribute) -> bool:
        """Responsibilities: _constructor callback assignment_."""
        if type(constructor) is not ast.FunctionDef and type(constructor) is not ast.AsyncFunctionDef:
            return False
        if constructor.name != PYTHON_INIT_METHOD:
            return False
        parameters = [*constructor.args.posonlyargs, *constructor.args.args]
        if not parameters:
            return False
        receiver_name = parameters[0].arg
        if type(target.value) is not ast.Name or receiver_name != target.value.id:
            return False
        return self._constructor_owner_field(constructor, target, receiver_name)

    def _constructor_field_initialization(self, assignment: ast.AST, target: ast.AST) -> bool:
        """Responsibilities: _constructor field initialization_."""
        if type(target) is not ast.Attribute:
            return False
        current = assignment
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                return False
            current = parents[0]
            if type(current) is ast.FunctionDef or type(current) is ast.AsyncFunctionDef:
                return self._constructor_assignment(current, target)
            if type(current) is ast.ClassDef:
                return False

    def _class_method_names(self, class_node: ast.ClassDef) -> set[str]:
        """Responsibilities: _class callable name collection_."""
        return {
            member.name
            for member in class_node.body
            if type(member) is ast.FunctionDef or type(member) is ast.AsyncFunctionDef
        }

    def _callable_assignment(
        self,
        assignment_node: ast.AST,
        targets: list[ast.expr],
        value: ast.expr,
    ) -> bool:
        """Responsibilities: _callable target replacement analysis_."""
        if not self._aliases.callable_replacement(value):
            return False
        for target in targets:
            if type(target) is not ast.Attribute:
                continue
            if self._constructor_field_initialization(assignment_node, target):
                continue
            return True
        return False

    def _issue_line(self, issue: JsonObject) -> int:
        """Responsibilities: _diagnostic source ordering_."""
        line = issue.get(PYTHON_LINE_KEY)
        if type(line) is int:
            return line
        return -1

    def __init__(self, tree: ast.Module, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _module patch analysis initialization_."""
        self._tree = tree
        self._node_index = node_index
        self._aliases = PythonPatchAliasIndex()

    def callable_replacement(self, assignment_node: ast.AST) -> bool:
        """Responsibilities: _attribute callable replacement classification_."""
        if type(assignment_node) is ast.Assign:
            return self._callable_assignment(assignment_node, assignment_node.targets, assignment_node.value)
        if type(assignment_node) is not ast.AnnAssign or assignment_node.value is None:
            return False
        return self._callable_assignment(assignment_node, [assignment_node.target], assignment_node.value)

    def issues(self) -> list[JsonObject]:
        """Responsibilities: _patch diagnostics_."""
        self._aliases.collect(self._tree, self._node_index)
        issues: list[JsonObject] = []
        for node in self._node_index.nodes(self._tree):
            patch_call = self._aliases.patch_call(node)
            replacement = self.callable_replacement(node)
            dynamic_replacement = self._aliases.dynamic_replacement(node)
            if patch_call or replacement or dynamic_replacement:
                issues.append({PYTHON_LINE_KEY: node.lineno - 1, "kind": "runtime-patching"})
        return sorted(issues, key=self._issue_line)
