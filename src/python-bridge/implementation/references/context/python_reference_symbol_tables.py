from __future__ import annotations

from collections.abc import Mapping


class PythonReferenceSymbolTables:
    """Responsibilities: _reference alias tables_, _reference owner tables_."""

    _aliases: dict[str, str]
    _instances: dict[str, str]
    _properties: dict[str, str]
    _collection_elements: dict[str, str]

    def __init__(
        self,
        aliases: Mapping[str, str],
        instances: Mapping[str, str],
        properties: Mapping[str, str],
        collection_elements: Mapping[str, str],
    ) -> None:
        """Responsibilities: _reference symbol table snapshots_."""
        self._aliases: dict[str, str] = dict(aliases)
        self._instances: dict[str, str] = dict(instances)
        self._properties: dict[str, str] = dict(properties)
        self._collection_elements: dict[str, str] = dict(collection_elements)

    def alias_table(self) -> Mapping[str, str]:
        """Responsibilities: _reference alias lookup table_."""
        return self._aliases

    def instance_types(self) -> Mapping[str, str]:
        """Responsibilities: _reference instance owner table_."""
        return self._instances

    def property_types(self) -> Mapping[str, str]:
        """Responsibilities: _reference property owner table_."""
        return self._properties

    def collection_types(self) -> Mapping[str, str]:
        """Responsibilities: _reference element owner table_."""
        return self._collection_elements
