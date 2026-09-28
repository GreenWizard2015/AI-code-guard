class PythonDynamicImportReference:
    """Responsibilities: _dynamic import reference state_."""

    def __init__(self, kind: str, name: str) -> None:
        """Responsibilities: _dynamic import reference initialization_."""
        self._kind: str = kind
        self._name: str = name

    def kind_value(self) -> str:
        """Responsibilities: _dynamic import kind access_."""
        return self._kind

    def name_value(self) -> str:
        """Responsibilities: _dynamic import name access_."""
        return self._name

    def module_reference(self) -> bool:
        """Responsibilities: _dynamic module reference classification_."""
        return self._kind == "module"

    def function_reference(self) -> bool:
        """Responsibilities: _dynamic function reference classification_."""
        return self._kind == "function"

    def available(self) -> bool:
        """Responsibilities: _dynamic import reference availability_."""
        if self.module_reference():
            return self._name != ""
        if self.function_reference():
            return self._name != ""
        return False
