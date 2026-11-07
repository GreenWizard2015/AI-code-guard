# `elif`

Description: See the examples below for the rule behavior.

## Bad

```python
# File: src/branch_report/branch_report.py
class BranchReport:

    def __init__(self) -> None:
        self._messages: list[str] = []
        self._character_total: int = 0

    def _message_for(self, ready: bool, blocked: bool) -> str:
        if ready:
            return "first"
        elif blocked:
            return "second"
        else:
            return "other"

    def record(self, ready: bool, blocked: bool) -> str:
        message = self._message_for(ready, blocked)
        self._messages.append(message)
        self._character_total += len(message)
        return message

    def summary(self) -> str:
        message_total = len(self._messages)
        return f'{message_total} messages, {self._character_total} characters'

    def report(self, ready: bool, blocked: bool) -> None:
        message = self.record(ready, blocked)
        summary = self.summary()
        print(f'{message}: {summary}')
# File: cli.py
from src.branch_report.branch_report import BranchReport

if __name__ == "__main__":
    branch_report = BranchReport()
    branch_report.report(True, False)
```

**Purpose:** Explicit nested branches make each scope visible. Put the second `if` inside `else`.

## Good

```python
# File: src/branch_report/branch_report.py
class BranchReport:
    """Responsibilities: _recording and reporting branch outcomes_."""

    def _message_for(self) -> str:
        """Responsibilities: _selecting the outcome message_."""
        message = "other"
        if self._scenario == "ready":
            message = "first"
        else:
            if self._scenario == "blocked":
                message = "second"
        return message

    def __init__(self, scenario: str) -> None:
        """Responsibilities: _branch scenario initialization_."""
        self._scenario: str = scenario

    def report(self) -> None:
        """Responsibilities: _printing an outcome with its scenario summary_."""
        message = self._message_for()
        summary = self.summary()
        print(f'{message}: {summary}')

    def summary(self) -> str:
        """Responsibilities: _summarizing the selected branch scenario_."""
        scenario = self._scenario
        message = self._message_for()
        return f'scenario={scenario}, message={message}'
# File: cli.py
from src.branch_report.branch_report import BranchReport

if __name__ == "__main__":
    branch_report = BranchReport("ready")
    branch_report.report()
```
