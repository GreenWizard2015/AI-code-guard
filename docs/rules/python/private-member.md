# `private-member`

Description: Access private state through a public operation on its owning class.

## Bad


```python
class AccountState:
    def __init__(self) -> None:
        self._balance: int = 0

account = AccountState()
account._balance
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
