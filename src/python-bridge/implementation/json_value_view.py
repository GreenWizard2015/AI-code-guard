from __future__ import annotations

from implementation.types import JsonObject, JsonValue, JsonValueList


class JsonValueView:
    """Responsibilities: _JSON value shape_, _typed JSON access_, _input normalization_."""

    _value: JsonValue

    def _normalize_array(self, value: JsonValueList) -> JsonValueList:
        """Responsibilities: _JSON array normalization_."""
        self._value = value
        normalized_values: JsonValueList = []
        for item in self.array():
            normalized_values.append(self._normalize(item))
        return normalized_values

    def _normalize_object(self, value: JsonObject) -> JsonObject:
        """Responsibilities: _JSON object normalization_."""
        self._value = value
        normalized_object: JsonObject = {}
        for key, item in self.object().items():
            normalized_object[key] = self._normalize(item)
        return normalized_object

    def _normalize_scalar(self, scalar: JsonValue) -> JsonValue:
        """Responsibilities: _JSON scalar validation_."""
        if scalar is None or type(scalar) is float:
            return scalar
        if type(scalar) is str:
            self._value = scalar
            return self.text()
        if type(scalar) is int:
            self._value = scalar
            return self.integer()
        if type(scalar) is bool:
            self._value = scalar
            return self.boolean()
        raise ValueError("Decoded value is outside the JSON scalar domain.")

    def _normalize(self, candidate: JsonValue) -> JsonValue:
        """Responsibilities: _JSON value validation_."""
        if type(candidate) is list:
            return self._normalize_array(candidate)
        if type(candidate) is dict:
            return self._normalize_object(candidate)
        return self._normalize_scalar(candidate)

    def __init__(self) -> None:
        """Responsibilities: _empty JSON view initialization_."""
        self._value = None

    def read(self, raw_value: JsonValue) -> None:
        """Responsibilities: _JSON value loading_."""
        self._value = self._normalize(raw_value)

    def object(self) -> JsonObject:
        """Responsibilities: _JSON object shape access_."""
        if type(self._value) is not dict:
            raise ValueError("Expected a JSON object.")
        return self._value

    def array(self) -> JsonValueList:
        """Responsibilities: _JSON array shape access_."""
        if type(self._value) is not list:
            raise ValueError("Expected a JSON array.")
        return self._value

    def text(self) -> str:
        """Responsibilities: _JSON string access_."""
        if type(self._value) is not str:
            raise ValueError("Expected JSON text.")
        return self._value

    def integer(self) -> int:
        """Responsibilities: _JSON integer access_."""
        if type(self._value) is not int:
            raise ValueError("Expected a JSON integer.")
        return self._value

    def boolean(self) -> bool:
        """Responsibilities: _JSON boolean access_."""
        if type(self._value) is not bool:
            raise ValueError("Expected a JSON boolean.")
        return self._value
