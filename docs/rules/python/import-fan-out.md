# import-fan-out

Description: Problem: module imports too many distinct modules.

Hint: Split the module by cohesive responsibility or move composition wiring to
a focused assembly module. Do not: bypass the limit by importing individual
objects through aliases.

The rule counts unique module specifiers, not imported names. For example,
`import { A, B } from "./module"` counts as one module.

## Bad


```python
{% const module_names = ["module_01", "module_02", "module_03", "module_04", "module_05", "module_06", "module_07", "module_08", "module_09", "module_10", "module_11", "module_12", "module_13", "module_14", "module_15", "module_16", "module_17", "module_18", "module_19", "module_20", "module_21"] %}
{% for module_name in module_names %}
# File: src/domain/{{module_name}}.py
class ModuleFeature:
    def __init__(self, code: str) -> None:
        self._code: str = code

    def normalized_code(self) -> str:
        return self._code.strip().lower()

    def status_label(self) -> str:
        return f"Loaded {self.normalized_code()}"

    def report(self) -> None:
        print(self.status_label())
{% endfor %}
# File: cli.py
{% for module_name in module_names %}
import src.domain.{{module_name}}  # <- error
{% endfor %}

if __name__ == "__main__":
{% for module_name in module_names %}
    feature_{{module_name}} = src.domain.{{module_name}}.ModuleFeature("{{module_name}}")
    feature_{{module_name}}.report()
{% endfor %}
```

## Good


```python
# File: src/account_workflow.py
class AccountWorkflow:
    def __init__(self, account_name: str) -> None:
        self._account_name: str = account_name

    def normalized_account(self) -> str:
        parts = self._account_name.strip().split()
        normalized_parts: list[str] = []
        for part in parts:
            normalized_parts.append(part.lower())
        return " ".join(normalized_parts)

    def account_state(self) -> str:
        account = self.normalized_account()
        if len(account) == 0:
            return "pending"
        return "ready"

    def account_heading(self) -> str:
        account = self.normalized_account()
        heading = account.title()
        return f"Account {heading}"

    def status_label(self) -> str:
        account_state = self.account_state()
        account_heading = self.account_heading()
        if account_state == "ready":
            return f"Ready: {account_heading}"
        return "Account pending"

    def report(self) -> None:
        status = self.status_label()
        state = self.account_state()
        print(f"{status} | {state}")
# File: cli.py
from src.account_workflow import AccountWorkflow

if __name__ == "__main__":
    workflow = AccountWorkflow("primary")
    workflow.report()
```
