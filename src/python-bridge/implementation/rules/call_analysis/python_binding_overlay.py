import ast
from collections.abc import Iterator, Mapping, MutableMapping


class PythonBindingOverlay(MutableMapping[str, ast.AST]):
    """Responsibilities: _test-local binding values_, _module binding shadowing_."""

    def __init__(self, base: Mapping[str, ast.AST]) -> None:
        """Responsibilities: _binding overlay initialization_."""
        self.base: Mapping[str, ast.AST] = base
        self.values: dict[str, ast.AST] = {}
        self.removed: set[str] = set()

    def __getitem__(self, name: str) -> ast.AST:
        """Responsibilities: _test-local binding lookup_."""
        if name in self.values:
            return self.values[name]
        if name in self.removed:
            raise KeyError(name)
        return self.base[name]

    def __setitem__(self, name: str, value: ast.AST) -> None:
        """Responsibilities: _test-local binding replacement_."""
        self.removed.discard(name)
        self.values[name] = value

    def __delitem__(self, name: str) -> None:
        """Responsibilities: _test-local binding shadow_."""
        existed_locally = name in self.values
        self.values.pop(name, None)
        if name not in self.base and not existed_locally:
            raise KeyError(name)
        if name in self.base:
            self.removed.add(name)

    def __iter__(self) -> Iterator[str]:
        """Responsibilities: _visible binding iteration_."""
        return iter((self.base.keys() - self.removed) | self.values.keys())

    def __len__(self) -> int:
        """Responsibilities: _visible binding count_."""
        return len((self.base.keys() - self.removed) | self.values.keys())
