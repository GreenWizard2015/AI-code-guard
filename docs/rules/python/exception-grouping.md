# `exception-grouping`

Description: Keep a one-use exception beside the code that handles it.

## Bad

```python
# File: src/network_error.py
class NetworkError(Exception):
    pass
# File: src/network_report.py
from src.network_error import NetworkError

class NetworkReport:
    def __init__(self, network_error: NetworkError) -> None:
        self.__network_error = network_error
        self.__reports_emitted = 0

    def report_network_failure(self) -> None:
        print(f"network failure: {self.__network_error}")
        self.__reports_emitted += 1

    def reported_failure_count(self) -> int:
        return self.__reports_emitted

    def reset_report_count(self) -> None:
        self.__reports_emitted = 0
# File: cli.py
from src.network_error import NetworkError
from src.network_report import NetworkReport

if __name__ == "__main__":
    network_error = NetworkError("offline")
    reporter = NetworkReport(network_error)
    reporter.report_network_failure()
    if reporter.reported_failure_count() > 0:
        reporter.reset_report_count()
```

## Good

```python
# File: src/network_errors.py
class NetworkTimeoutError(Exception):
    pass

class NetworkUnavailableError(Exception):
    pass
# File: src/network_report.py
from src.network_errors import NetworkTimeoutError, NetworkUnavailableError

class NetworkReport:
    def __init__(self) -> None:
        self.__failures: set[Exception] = set()

    def report_network_failures(self) -> None:
        timeout_error = NetworkTimeoutError("timed out")
        unavailable_error = NetworkUnavailableError("offline")
        self.__failures.add(timeout_error)
        self.__failures.add(unavailable_error)
        for failure in (timeout_error, unavailable_error):
            print(f"network failure: {failure}")

    def failure_count(self) -> int:
        return len(self.__failures)

    def reset_failures(self) -> None:
        self.__failures.clear()
# File: cli.py
from src.network_report import NetworkReport

if __name__ == "__main__":
    reporter = NetworkReport()
    reporter.report_network_failures()
    if reporter.failure_count() > 0:
        reporter.reset_failures()
```
