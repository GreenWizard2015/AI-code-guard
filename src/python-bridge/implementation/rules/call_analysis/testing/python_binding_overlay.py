import ast
from collections.abc import Iterator, Mapping, MutableMapping


class PythonBindingOverlay(MutableMapping[str, ast.AST]):
    """Responsibilities: _test-local binding values_, _module binding shadowing_."""

    def __init__(self, base: Mapping[str, ast.AST]) -> None:
        """Responsibilities: _binding overlay initialization_."""
        self._base: Mapping[str, ast.AST] = base
        self._overrides: dict[str, ast.AST] = {}
        self._removed: set[str] = set()

    def __getitem__(self, name: str) -> ast.AST:
        """Responsibilities: _test-local binding lookup_."""
        if name in self._overrides:
            return self._overrides[name]
        if name in self._removed:
            raise KeyError(name)
        return self._base[name]

    def __setitem__(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _test-local binding replacement_."""
        self._removed.discard(name)
        self._overrides.update({name: value})

    def __delitem__(self, name: str) -> None:
        """Responsibilities: _test-local binding shadow_."""
        existed_locally = name in self._overrides
        self._overrides.pop(name, None)
        if name not in self._base and not existed_locally:
            raise KeyError(name)
        if name in self._base:
            self._removed.add(name)

    def __iter__(self) -> Iterator[str]:
        """Responsibilities: _visible binding iteration_."""
        return iter((self._base.keys() - self._removed) | self._overrides.keys())

    def __len__(self) -> int:
        """Responsibilities: _visible binding count_."""
        return len((self._base.keys() - self._removed) | self._overrides.keys())
