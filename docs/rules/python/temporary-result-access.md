# `temporary-result-access`

Description: Assign copied lists and dictionaries created with unpacking before
accessing their members. Named field and method access on ordinary function
results is allowed.

## Bad


```python
# File: src/rule_summary_types.py
RuleOptions = dict[str, str]
# File: src/rule_summary.py
from src.rule_summary_types import RuleOptions

class RuleSummary:
    def __init__(self, rule_ids: list[str], rule_options: RuleOptions) -> None:
        self._rule_ids: list[str] = rule_ids
        self._rule_options: dict[str, str] = rule_options
        self._report_count_value: int = 0

    def report(self) -> None:
        print([*self._rule_ids][0], {**self._rule_options}["mode"])
        self._report_count_value += 1

    def report_count(self) -> int:
        return self._report_count_value

    def clear(self) -> None:
        self._rule_ids.clear()
        self._rule_options.clear()
        self._report_count_value = 0

# File: cli.py
from src.rule_summary import RuleSummary

if __name__ == "__main__":
    summary = RuleSummary(["temporary-result-access"], {"mode": "strict"})
    if summary.report_count() == 0:
        summary.report()
    summary.clear()
```

**Fix:** Assign constructed objects, indexed call results, and unpacked copies
to named variables before using them. Ordinary list and dictionary literals are
permitted.

## Good


```python
# File: src/rule_summary_types.py
RuleIds = tuple[str, ...]
RuleOptions = dict[str, str]
# File: src/rule_summary.py
from src.rule_summary_types import RuleIds, RuleOptions

class RuleSummary:
    def __init__(self, rule_ids: RuleIds, rule_options: RuleOptions) -> None:
        self._rule_ids: RuleIds = tuple(rule_ids)
        self._rule_options: RuleOptions = dict(rule_options)

    def first_rule_id(self) -> str:
        copied_rule_ids = [*self._rule_ids]
        return copied_rule_ids[0]

    def mode_value(self) -> str:
        option_snapshot = {**self._rule_options}
        return option_snapshot["mode"]

    def rule_count(self) -> int:
        copied_rule_ids = [*self._rule_ids]
        return len(copied_rule_ids)

    def report(self) -> None:
        print(f"{self.first_rule_id()} {self.mode_value()} ({self.rule_count()})")

# File: cli.py
from src.rule_summary import RuleSummary

if __name__ == "__main__":
    summary = RuleSummary(("temporary-result-access",), {"mode": "strict"})
    summary.report()
```
