from __future__ import annotations
from typing import Any


class PythonBridgeArguments:
    """Responsibilities: _bridge option parsing_."""

    def _is_option(self, argument: str) -> bool:
        """Responsibilities: _classification argument supported bridge_."""
        if len(argument) < 3:
            return False
        if argument[:2] != "--":
            return False
        return bool(argument[2:].strip())

    def _option_names(self) -> list[str]:
        """Responsibilities: _output configuration bridge option_."""
        options: Any = []
        for argument in self.arguments[1:]:
            if self._is_option(argument):
                options.append(argument)
        return options

    def __init__(self, arguments: list[str]) -> None:
        """Responsibilities: _initialization raw bridge argument_."""
        self.arguments: Any = arguments

    def option(self, option: str) -> bool:
        """Responsibilities: _specific option reporting_."""
        for name in self._option_names():
            if name == option:
                return True
        return False

    def text_mode(self) -> bool:
        """Responsibilities: _reporting text input mode_."""
        if self.option("--text"):
            return True
        return False

    def batch_mode(self) -> bool:
        """Responsibilities: _reporting batch input mode_."""
        if self.option("--batch"):
            return True
        return False

    def worker_mode(self) -> bool:
        """Responsibilities: _reporting persistent worker mode_."""
        if self.option("--worker"):
            return True
        return False
