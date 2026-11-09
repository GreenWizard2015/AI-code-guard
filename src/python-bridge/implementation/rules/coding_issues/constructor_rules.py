from __future__ import annotations

import ast

from implementation.rules.constants import (
    PYTHON_COMPLEX_CONSTRUCTOR_RULE,
    PYTHON_FIELD_IN_CONSTRUCTOR_RULE,
    PYTHON_INIT_METHOD,
    PYTHON_POST_INIT_METHOD,
    PYTHON_VALIDATION_PREFIXES,
)
from implementation.rules.protocols import PythonConstructorRulesContract
from implementation.types import JsonObject


class ConstructorRules(PythonConstructorRulesContract):
    """Responsibilities: _constructor statement validation_, _field constructor validation_."""

    def _constructor_call_name(self, function: ast.AST) -> str:
        """Responsibilities: _resolution name constructor invocation_."""
        match function:
            case ast.Name(id=name):
                return name
            case ast.Attribute(attr=name):
                return name
            case _:
                return ""

    def _constructor_value_allowed(self, value: ast.AST) -> bool:
        """Responsibilities: _classification constructor assignment value_."""
        match value:
            case ast.Name() | ast.Constant() | ast.Attribute():
                return True
            case ast.Dict() | ast.List() | ast.Set() | ast.Tuple():
                return True
            case ast.Call(func=ast.Attribute(value=ast.Name(id="self"))):
                return False
            case ast.Call(func=function):
                return bool(self._constructor_call_name(function))
            case _:
                return False

    def _is_super_init(self, super_initializer: ast.Expr) -> bool:
        """Responsibilities: _identification direct super initializer_."""
        match super_initializer.value:
            case ast.Call(func=ast.Attribute(attr=method_name, value=target)):
                if method_name != PYTHON_INIT_METHOD:
                    return False
                return self._super_call(target)
            case _:
                return False

    def _super_call(self, target: ast.AST) -> bool:
        """Responsibilities: _classification super invocation target_."""
        match target:
            case ast.Call(func=ast.Name(id="super")):
                return True
            case _:
                return False

    def _is_docstring(self, docstring_candidate: ast.Expr) -> bool:
        """Responsibilities: _identification leading constructor docstring_."""
        match docstring_candidate.value:
            case ast.Constant(value=value):
                return type(value) is str
            case _:
                return False

    def _expression_allowed(self, expression_statement: ast.Expr) -> bool:
        """Responsibilities: _classification allowed expression statements_."""
        match expression_statement.value:
            case ast.Call(func=function):
                call_name = self._constructor_call_name(function)
                return any(call_name.startswith(prefix) for prefix in PYTHON_VALIDATION_PREFIXES)
            case ast.Constant():
                return True
            case _:
                return False

    def _assignment_allowed(self, node: ast.stmt) -> bool:
        """Responsibilities: _constructor assignment validation_."""
        match node:
            case ast.Assign(value=value) | ast.AnnAssign(value=value):
                pass
            case _:
                return False
        if value is None:
            return True
        return self._constructor_value_allowed(value)

    def _conditional_allowed(self, node: ast.If) -> bool:
        """Responsibilities: _conditional constructor validation_."""
        statements = [*node.body, *node.orelse]
        return all(self.statement_allowed(item) for item in statements)

    def _assigned_value(self, item: ast.stmt) -> ast.AST:
        """Responsibilities: _field assignment value_."""
        match item:
            case ast.Assign(value=value):
                return value
            case ast.AnnAssign(value=value) if value is not None:
                return value
            case _:
                return ast.Constant(value=None)

    def _final_annotation(self, item: ast.stmt) -> bool:
        """Responsibilities: _Final class constant identification_."""
        match item:
            case ast.AnnAssign(annotation=ast.Name(id="Final")):
                return True
            case ast.AnnAssign(annotation=ast.Subscript(value=ast.Name(id="Final"))):
                return True
            case ast.AnnAssign(
                annotation=ast.Subscript(value=ast.Attribute(attr="Final")),
            ):
                return True
            case ast.AnnAssign(annotation=ast.Attribute(attr="Final")):
                return True
            case _:
                return False

    def statement_allowed(self, node: ast.stmt) -> bool:
        """Responsibilities: _classification constructor statement satisfies_."""
        match node:
            case ast.Pass() | ast.Raise():
                return True
            case ast.Assign() | ast.AnnAssign():
                return self._assignment_allowed(node)
            case ast.Expr():
                if self._is_super_init(node):
                    return True
                return self._expression_allowed(node)
            case ast.If():
                return self._conditional_allowed(node)
            case _:
                return False

    def collect_constructor_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _collection constructor statements violate_."""
        match node:
            case ast.FunctionDef(name=name, body=callable_body, lineno=line):
                pass
            case ast.AsyncFunctionDef(name=name, body=callable_body, lineno=line):
                pass
            case _:
                return []
        if name not in {PYTHON_INIT_METHOD, PYTHON_POST_INIT_METHOD}:
            return []
        statements: list[ast.stmt] = []
        for item in callable_body:
            match item:
                case ast.Expr() as expression if self._is_docstring(expression):
                    continue
                case _:
                    statements.append(item)
        if all(self.statement_allowed(item) for item in statements):
            return []
        return [{"line": line - 1, "kind": PYTHON_COMPLEX_CONSTRUCTOR_RULE}]

    def field_constructor_issues(self, node: ast.AST) -> list[JsonObject]:
        """Responsibilities: _class field construction violations_."""
        match node:
            case ast.ClassDef(body=class_body):
                pass
            case _:
                return []
        issues: list[JsonObject] = []
        for item in class_body:
            if self._final_annotation(item):
                continue
            value = self._assigned_value(item)
            if type(value) is not ast.Call:
                continue
            if self._constructor_call_name(value.func) == "field":
                continue
            issues.append({"line": item.lineno - 1, "kind": PYTHON_FIELD_IN_CONSTRUCTOR_RULE})
        return issues
