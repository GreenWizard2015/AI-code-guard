from __future__ import annotations

from implementation.protocols import PythonFiniteVariantContract


class PythonFiniteVariant(PythonFiniteVariantContract):
    """Responsibilities: _variant definition_, _member access_, _discriminator access_."""

    def __init__(self, declared: bool, members: set[str], discriminant: str) -> None:
        """Responsibilities: _finite variant snapshot initialization_."""
        self._declared: bool = declared
        self._members: set[str] = set(members)
        self._discriminant: str = discriminant

    def supports(self) -> bool:
        """Responsibilities: _finite variant availability_."""
        return self._declared

    def members(self) -> set[str]:
        """Responsibilities: _finite variant member retrieval_."""
        return set(self._members)

    def discriminant(self) -> str:
        """Responsibilities: _finite variant discriminator retrieval_."""
        return self._discriminant

    def member_present(self, member: str) -> bool:
        """Responsibilities: _finite variant membership check_."""
        return member in self._members

    def member_count(self) -> int:
        """Responsibilities: _finite variant size_."""
        return len(self._members)
