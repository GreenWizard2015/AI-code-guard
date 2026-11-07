# `multi-except`

Description: One handler for unrelated failures obscures recovery behavior.

```python
try:
    read_data()
except (TimeoutError, ValueError):
    recover()
```

Fix: Use one exception type per handler and keep a general boundary handler minimal.

## Bad

```python
# File: src/data_reader.py
class ConfigurationEntry:
    def __init__(self, payload: str) -> None:
        self._payload: str = payload

    def entry(self) -> str:
        try:
            return self._payload.strip()
        except (TimeoutError, ValueError):  # <- error
            return "unavailable"

    def entry_label(self) -> str:
        return f"Entry: {self.entry()}"

    def report(self) -> None:
        label = self.entry_label()
        print(label)
# File: cli.py
from src.data_reader import ConfigurationEntry

if __name__ == "__main__":
    entry = ConfigurationEntry("  ready  ")
    entry.report()
```

## Good

```python
# File: src/configuration_entry.py
class ConfigurationEntry:
    def __init__(self, payload: str) -> None:
        self._payload: str = payload

    def normalized_payload(self) -> str:
        try:
            return self._payload.strip()
        except TimeoutError:
            return "unavailable after timeout"
        except ValueError:
            return "unavailable because input is invalid"

    def payload_length(self) -> int:
        return len(self._payload.strip())

    def report(self) -> None:
        payload = self.normalized_payload()
        length = self.payload_length()
        print(f"Entry: {payload} ({length} characters)")
# File: cli.py
from src.configuration_entry import ConfigurationEntry

if __name__ == "__main__":
    entry = ConfigurationEntry("  ready  ")
    entry.report()
```
