from __future__ import annotations

from implementation.types import JsonObject


class PythonCallBinding:
    """Responsibilities: _call result binding_, _deferred call state_."""

    _name: str
    _type_name: str
    _is_deferred: bool

    def __init__(self, name: str, type_name: str, is_deferred: bool) -> None:
        """Responsibilities: _call result binding initialization_."""
        self._name = name
        self._type_name = type_name
        self._is_deferred = is_deferred

    def function_use(self, callee_name: str) -> JsonObject:
        """Responsibilities: _function call metadata_."""
        return {
            "assigned_name": self._name,
            "assigned_type_name": self._type_name,
            "callee_name": callee_name,
            "receiver_name": "",
            "receiver_constructor_name": "",
            "deferred": self._is_deferred,
        }

    def method_use(
        self,
        receiver_name: str,
        receiver_constructor_name: str,
    ) -> JsonObject:
        """Responsibilities: _method call metadata_."""
        return {
            "assigned_name": "",
            "assigned_type_name": "",
            "callee_name": "",
            "receiver_name": receiver_name,
            "receiver_constructor_name": receiver_constructor_name,
            "deferred": self._is_deferred,
        }
