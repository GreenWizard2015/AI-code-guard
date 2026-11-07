from __future__ import annotations

import ast


class PythonExceptionHandlerTranslations:
    """Responsibilities: _handler-local message aliases_, _translation identity_."""

    def _record_message(self, name: str, expression: ast.AST) -> None:
        """Responsibilities: _handler message alias update_."""
        message = self.message_value(expression)
        if message:
            self._aliases.update({name: message})

    def _assignment(self, assignment: ast.AST) -> None:
        """Responsibilities: _handler-local message alias indexing_."""
        if type(assignment) is ast.Assign:
            if len(assignment.targets) != 1:
                return
            if type(assignment.targets[0]) is not ast.Name:
                return
            self._record_message(assignment.targets[0].id, assignment.value)
            return
        if type(assignment) is ast.AnnAssign:
            if assignment.value is None:
                return
            if type(assignment.target) is not ast.Name:
                return
            self._record_message(assignment.target.id, assignment.value)

    def _translation_arguments(self, call: ast.Call) -> list[str]:
        """Responsibilities: _exception argument identity_."""
        arguments: list[str] = []
        for index, argument in enumerate(call.args):
            message = ""
            if index == 0:
                message = self.message_value(argument)
            if message:
                arguments.append(f"literal:{message}")
            else:
                arguments.append(ast.dump(argument, include_attributes=False))
        return arguments

    def _exception_name(self, function: ast.AST) -> str:
        """Responsibilities: _exception class name resolution_."""
        name = ""
        if type(function) is ast.Name:
            name = function.id
        if type(function) is ast.Attribute:
            name = function.attr
        return name

    def _cause(self, statement: ast.Raise) -> str:
        """Responsibilities: _exception cause identity_."""
        if statement.cause is None:
            return ""
        return ast.dump(statement.cause, include_attributes=False)

    def _translation_identity(self, exception: ast.Call, cause: str) -> str:
        """Responsibilities: _translated exception identity construction_."""
        return repr(
            (
                ast.dump(exception.func, include_attributes=False),
                self._translation_arguments(exception),
                [ast.dump(keyword, include_attributes=False) for keyword in exception.keywords],
                cause,
            ),
        )

    def _translation_key(self, statement: ast.AST) -> str:
        """Responsibilities: _error translation key construction_."""
        if type(statement) is not ast.Raise:
            return ""
        if type(statement.exc) is not ast.Call:
            return ""
        name = self._exception_name(statement.exc.func)
        if not name.endswith("Error"):
            return ""
        return self._translation_identity(statement.exc, self._cause(statement))

    def _append_translation(self, current: ast.AST, keys: list[str]) -> None:
        """Responsibilities: _handler translation indexing_."""
        self._assignment(current)
        key = self._translation_key(current)
        if key:
            keys.append(key)

    def __init__(self) -> None:
        """Responsibilities: _handler alias state initialization_."""
        self._aliases: dict[str, str] = {}

    def message_value(self, expression: ast.AST) -> str:
        """Responsibilities: _literal exception message resolution_."""
        if type(expression) is ast.Constant and type(expression.value) is str:
            return expression.value
        if type(expression) is ast.Name:
            return self._aliases.get(expression.id, "")
        return ""

    def translations(self, handler: ast.ExceptHandler) -> list[str]:
        """Responsibilities: _handler translation collection_."""
        keys: list[str] = []
        for current in ast.walk(handler):
            if current is not handler:
                if type(current) in (
                    ast.ExceptHandler,
                    ast.FunctionDef,
                    ast.AsyncFunctionDef,
                    ast.Lambda,
                ):
                    continue
            self._append_translation(current, keys)
        return keys
