# empty-error-handler

Description: Reports an empty TypeScript `catch` block or a Python `except` block containing
only `pass` or a standalone string. Handle, rethrow, or explicitly transform
the error instead. A handler with real recovery or reporting code is not
reported. Idempotent filesystem operations that suppress only the expected
missing-file or already-exists race are not reported.

## Bad


```python
# File: src/configuration_reporter.py
class ConfigurationReporter:
    """Responsibilities: _configuration status reporting_."""

    def _read_configuration(self) -> str:
        """Responsibilities: _configuration loading_."""
        if not self._encoded_value:
            raise ValueError("Configuration source is unavailable")
        return self._encoded_value

    def __init__(self, encoded_value: str, fallback_value: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._encoded_value: str = encoded_value
        self._fallback_value: str = fallback_value

    def configuration_text(self) -> str:
        """Responsibilities: _configuration loading attempt_."""
        try:
            return self._read_configuration()
        except ValueError:
            pass
        return self._fallback_value

    def normalized_text(self) -> str:
        """Responsibilities: _configuration normalization_."""
        return self.configuration_text().strip()

    def summary(self) -> str:
        """Responsibilities: _configuration summary composition_."""
        configuration = self.normalized_text()
        return f"Loaded {len(configuration)} characters: {configuration}"

    def report(self) -> None:
        """Responsibilities: _status output_."""
        print(self.summary())
# File: cli.py
from src.configuration_reporter import ConfigurationReporter

if __name__ == "__main__":
    reporter = ConfigurationReporter("", "Using built-in defaults")
    reporter.report()
```

## Good


```python
# File: src/configuration_reporter.py
class ConfigurationReporter:
    """Responsibilities: _configuration status reporting_."""

    def _read_configuration(self) -> str:
        """Responsibilities: _configuration reading_."""
        if not self._encoded_value:
            raise ValueError("Configuration source is unavailable")
        return self._encoded_value

    def __init__(self, encoded_value: str, fallback_value: str) -> None:
        """Responsibilities: _reporter initialization_."""
        self._encoded_value: str = encoded_value
        self._fallback_value: str = fallback_value

    def configuration_text(self) -> str:
        """Responsibilities: _configuration recovery_."""
        try:
            return self._read_configuration()
        except ValueError:
            return self._fallback_value

    def normalized_text(self) -> str:
        """Responsibilities: _configuration normalization_."""
        return self.configuration_text().strip()

    def summary(self) -> str:
        """Responsibilities: _configuration summary composition_."""
        configuration = self.normalized_text()
        return f"Loaded {len(configuration)} characters: {configuration}"

    def report(self) -> None:
        """Responsibilities: _status output_."""
        print(self.summary())
# File: cli.py
from src.configuration_reporter import ConfigurationReporter

if __name__ == "__main__":
    reporter = ConfigurationReporter("", "Using built-in defaults")
    reporter.report()
```
