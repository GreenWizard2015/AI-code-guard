from __future__ import annotations

import ast


class PythonSlotExpression:
    """Responsibilities: _slot expression value_, _slot alias context_."""

    def _alias_names(self) -> list[str]:
        """Responsibilities: _slot alias value expansion_."""
        expression = self._expression
        if type(expression) is not ast.Name or expression.id in self._seen:
            return []
        alias = self._bindings.get(expression.id)
        if alias is None:
            return []
        next_seen = self._seen.copy()
        next_seen.add(expression.id)
        nested = PythonSlotExpression(alias, self._bindings, next_seen)
        return nested.names()

    def _container_names(self) -> list[str]:
        """Responsibilities: _slot container value expansion_."""
        expression = self._expression
        if type(expression) is ast.Tuple:
            return self.names_from(expression.elts)
        if type(expression) is ast.List:
            return self.names_from(expression.elts)
        if type(expression) is ast.Set:
            return self.names_from(expression.elts)
        if type(expression) is not ast.Dict:
            return []
        keys = [key for key in expression.keys if key is not None]
        return self.names_from(keys)

    def __init__(
        self,
        expression: ast.expr,
        bindings: dict[str, ast.expr],
        seen: set[str],
    ) -> None:
        """Responsibilities: _slot expression initialization_."""
        self._expression: ast.expr = expression
        self._bindings: dict[str, ast.expr] = bindings
        self._seen: set[str] = seen

    def names(self) -> list[str]:
        """Responsibilities: _slot expression name extraction_."""
        expression = self._expression
        if type(expression) is ast.Constant:
            if type(expression.value) is str:
                return [expression.value]
            return []
        if type(expression) is ast.Name:
            return self._alias_names()
        return self._container_names()

    def names_from(self, expressions: list[ast.expr]) -> list[str]:
        """Responsibilities: _slot name sequence_."""
        names: list[str] = []
        for expression in expressions:
            value = PythonSlotExpression(expression, self._bindings, self._seen)
            names.extend(value.names())
        return names
