from __future__ import annotations

import ast

from implementation.references.aliases.python_container_lookup import (
    PythonContainerLookup,
)
from implementation.references.protocols import PythonContainerLookupContract


class PythonDynamicTypeStatementValues:
    """Responsibilities: _statement values_, _dynamic type values_."""

    _statement: ast.AST

    def _control_value(self) -> PythonContainerLookupContract:
        """Responsibilities: _control expression selection_."""
        match self._statement:
            case ast.If(test=test) | ast.While(test=test) | ast.Assert(test=test):
                return PythonContainerLookup(found_value=True, expression=test)
            case ast.For(iter=iterable) | ast.AsyncFor(iter=iterable):
                return PythonContainerLookup(found_value=True, expression=iterable)
            case _:
                return PythonContainerLookup(found_value=False, expression=ast.Constant(value=None))

    def _class_values(self, definition: ast.ClassDef) -> list[ast.expr]:
        """Responsibilities: _class base values_, _class keyword values_."""
        values: list[ast.expr] = list(definition.bases)
        values.extend(keyword.value for keyword in definition.keywords)
        return values

    def _statement_value_expression(self) -> list[ast.expr]:
        """Responsibilities: _statement value expression selection_."""
        value = self.statement_value()
        if value.found():
            expression = value.expression_node()
            match expression:
                case ast.expr():
                    return [expression]
            return []
        return []

    def __init__(self, statement: ast.AST) -> None:
        """Responsibilities: _statement context ownership_."""
        self._statement = statement

    def statement_value(self) -> PythonContainerLookupContract:
        """Responsibilities: _primary statement value_."""
        match self._statement:
            case ast.Expr(value=value) | ast.Assign(value=value):
                return PythonContainerLookup(found_value=True, expression=value)
            case ast.AnnAssign(value=value) if value is not None:
                return PythonContainerLookup(found_value=True, expression=value)
            case ast.With(items=[ast.withitem(context_expr=value), *_]):
                return PythonContainerLookup(found_value=True, expression=value)
            case ast.AsyncWith(items=[ast.withitem(context_expr=value), *_]):
                return PythonContainerLookup(found_value=True, expression=value)
            case _:
                return self._control_value()

    def issue_values(self) -> list[ast.expr]:
        """Responsibilities: _dynamic type issue values_."""
        match self._statement:
            case ast.With(items=items) | ast.AsyncWith(items=items):
                return [item.context_expr for item in items]
            case ast.ClassDef() as definition:
                return self._class_values(definition)
            case ast.Return(value=value) if value is not None:
                return [value]
            case ast.Raise(exc=exception) if exception is not None:
                return [exception]
            case _:
                return self._statement_value_expression()
