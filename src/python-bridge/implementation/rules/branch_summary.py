from implementation.rules.protocols import BranchSummaryContract


class BranchSummary(BranchSummaryContract):
    """Responsibilities: _branch chain length_, _uniform branch name tracking_."""

    def __init__(
        self, length: int = 0, first_name: str = "", all_same: bool = True
    ) -> None:
        """Responsibilities: _branch-chain summary initialization_."""
        self._length: int = length
        self._first_name: str = first_name
        self._all_same: bool = all_same

    def length(self) -> int:
        """Responsibilities: _branch-chain length access_."""
        return self._length

    def all_same(self) -> bool:
        """Responsibilities: _branch condition equality access_."""
        return self._all_same

    def prepend(self, name: str) -> BranchSummaryContract:
        """Responsibilities: _immutable branch summary extension_."""
        first_name = self._first_name
        all_same = self._all_same
        if first_name == "":
            first_name = name
        if name != first_name:
            all_same = False
        return BranchSummary(self._length + 1, first_name, all_same)
