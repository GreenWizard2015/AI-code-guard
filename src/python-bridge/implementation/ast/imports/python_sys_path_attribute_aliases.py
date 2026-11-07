from __future__ import annotations

import ast

from implementation.ast.protocols import (
    PythonAstNodeIndexContract,
    PythonSysPathAttributeAliasesContract,
)
from implementation.rules.constants import (
    PYTHON_FUNCTION_KIND,
    PYTHON_STATIC_METHOD_DECORATOR,
    SYS_PATH_INSTANCE_OWNER,
)


class PythonSysPathAttributeAliases(PythonSysPathAttributeAliasesContract):
    """Responsibilities: _instance path alias ownership_, _attribute path keys_."""

    def _has_static_decorator(self, decorators: list[ast.expr]) -> bool:
        """Responsibilities: _static method decorator classification_."""
        for decorator in decorators:
            if type(decorator) is ast.Name:
                if decorator.id == PYTHON_STATIC_METHOD_DECORATOR:
                    return True
            if type(decorator) is ast.Attribute:
                if decorator.attr == PYTHON_STATIC_METHOD_DECORATOR:
                    return True
        return False

    def _static_method(self, function_scope: ast.AST) -> bool:
        """Responsibilities: _static method detection_."""
        if type(function_scope) is ast.FunctionDef:
            decorators = function_scope.decorator_list
        else:
            if type(function_scope) is not ast.AsyncFunctionDef:
                return False
            decorators = function_scope.decorator_list
        return self._has_static_decorator(decorators)

    def _append_scope_owner(
        self,
        scopes: dict[str, ast.AST],
        parent: ast.AST,
        lexical_origin: ast.AST,
    ) -> None:
        """Responsibilities: _lexical owner accumulation_."""
        scopes["root"] = parent
        if scopes[PYTHON_FUNCTION_KIND] is lexical_origin:
            if type(parent) in (ast.FunctionDef, ast.AsyncFunctionDef):
                scopes[PYTHON_FUNCTION_KIND] = parent
        if scopes["class"] is lexical_origin and type(parent) is ast.ClassDef:
            scopes["class"] = parent

    def _scope_owners(self, scope_origin: ast.AST) -> dict[str, ast.AST]:
        """Responsibilities: _attribute alias lexical scopes_."""
        scopes = {
            PYTHON_FUNCTION_KIND: scope_origin,
            "class": scope_origin,
            "root": scope_origin,
        }
        current = scope_origin
        while True:
            parents = self._node_index.parents(current)
            if not parents:
                break
            parent = parents[0]
            self._append_scope_owner(scopes, parent, scope_origin)
            current = parent
        return scopes

    def _receiver_name(self, function_scope: ast.AST, class_scope: ast.AST) -> str:
        """Responsibilities: _instance receiver alias normalization_."""
        if type(class_scope) is not ast.ClassDef:
            return ""
        if type(function_scope) is ast.FunctionDef:
            arguments = function_scope.args
        else:
            if type(function_scope) is not ast.AsyncFunctionDef:
                return ""
            arguments = function_scope.args
        if self._static_method(function_scope):
            return ""
        receiver_arguments = [*arguments.posonlyargs, *arguments.args]
        if not receiver_arguments:
            return ""
        return receiver_arguments[0].arg

    def _owner_key(self, owner: ast.AST, instance_receiver: str) -> str:
        """Responsibilities: _attribute owner identity normalization_."""
        if type(owner) is ast.Name:
            if instance_receiver:
                if owner.id == instance_receiver:
                    return SYS_PATH_INSTANCE_OWNER
            return f"name:{owner.id}"
        if type(owner) is ast.Attribute:
            return f"{self._owner_key(owner.value, instance_receiver)}.{owner.attr}"
        return ast.dump(owner, include_attributes=False)

    def _instance_scope(
        self,
        scopes: dict[str, ast.AST],
        attribute_target: ast.Attribute,
        receiver_argument: str,
    ) -> ast.AST:
        """Responsibilities: _instance alias scope_."""
        scope = scopes[PYTHON_FUNCTION_KIND]
        if not receiver_argument:
            return scope
        if not self._is_receiver(attribute_target.value, receiver_argument):
            return scope
        return scopes["class"]

    def _is_receiver(self, owner: ast.AST, method_receiver: str) -> bool:
        """Responsibilities: _instance receiver identity_."""
        if type(owner) is not ast.Name:
            return False
        return owner.id == method_receiver

    def _attribute_path_key(
        self,
        attribute_target: ast.Attribute,
        alias_context: ast.AST,
    ) -> str:
        """Responsibilities: _instance path field identity_."""
        scopes = self._scope_owners(alias_context)
        function_scope = scopes[PYTHON_FUNCTION_KIND]
        class_scope = scopes["class"]
        receiver_name = self._receiver_name(function_scope, class_scope)
        scope = self._instance_scope(scopes, attribute_target, receiver_name)
        if function_scope is alias_context:
            scope = scopes["root"]
        owner_key = self._owner_key(attribute_target.value, receiver_name)
        return f"{id(scope)}:{owner_key}:{attribute_target.attr}"

    def __init__(self, node_index: PythonAstNodeIndexContract) -> None:
        """Responsibilities: _attribute alias index setup_."""
        self._node_index: PythonAstNodeIndexContract = node_index
        self._keys: set[str] = set()

    def clear(self) -> None:
        """Responsibilities: _attribute alias index reset_."""
        self._keys.clear()

    def key_count(self) -> int:
        """Responsibilities: _attribute alias index size_."""
        return len(self._keys)

    def record(
        self,
        assigned_attribute: ast.Attribute,
        assignment_context: ast.AST,
    ) -> None:
        """Responsibilities: _attribute path alias indexing_."""
        self._keys.add(self._attribute_path_key(assigned_attribute, assignment_context))

    def contains(self, queried_attribute: ast.Attribute) -> bool:
        """Responsibilities: _attribute path alias lookup_."""
        key = self._attribute_path_key(queried_attribute, queried_attribute)
        return key in self._keys
