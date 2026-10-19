from implementation.protocols import PythonAsyncNameOverlayContract


class PythonAsyncNameOverlay(PythonAsyncNameOverlayContract):
    """Responsibilities: _async-name shadowing_, _test-local async aliases_."""

    def __init__(self, base: set[str], excluded: set[str]) -> None:
        """Responsibilities: _async-name overlay state_."""
        self.base: set[str] = base
        self.added: set[str] = set()
        self.removed: set[str] = set(excluded)

    def contains(self, name: str) -> bool:
        """Responsibilities: _visible async-name lookup_."""
        if name in self.added:
            return True
        return name in self.base and name not in self.removed

    def add(self, name: str) -> None:
        """Responsibilities: _test-local async alias addition_."""
        self.removed.discard(name)
        self.added.add(name)

    def discard(self, name: str) -> None:
        """Responsibilities: _test-local async alias removal_."""
        self.added.discard(name)
        if name in self.base:
            self.removed.add(name)
