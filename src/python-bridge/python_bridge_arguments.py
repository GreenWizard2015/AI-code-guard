from __future__ import annotations


class PythonBridgeArguments:
    """Responsibilities: _option recognition_, _bridge mode selection_."""

    def _is_option(self, argument: str) -> bool:
        """Responsibilities: _classification argument supported bridge_."""
        if len(argument) < 3:
            return False
        if argument[:2] != "--":
            return False
        return bool(argument[2:].strip())

    def __init__(self, arguments: list[str]) -> None:
        """Responsibilities: _initialization raw bridge argument_."""
        self._arguments: list[str] = list(arguments)

    def option(self, option: str) -> bool:
        """Responsibilities: _specific option reporting_."""
        for argument in self._arguments[1:]:
            if self._is_option(argument):
                if argument == option:
                    return True
        return False

    def text_mode(self) -> bool:
        """Responsibilities: _reporting text input mode_."""
        return bool(self.option("--text"))

    def batch_mode(self) -> bool:
        """Responsibilities: _reporting batch input mode_."""
        return bool(self.option("--batch"))

    def worker_mode(self) -> bool:
        """Responsibilities: _reporting persistent worker mode_."""
        return bool(self.option("--worker"))
