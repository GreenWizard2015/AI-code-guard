# `callable-feature-detection`

Description: Do not use `callable(...)` as a fallback for project-owned interfaces. Check only
calls inside conditional control flow; ordinary callable values at external boundaries are not
the target.

## Bad

```python
# File: src/protocols.py
from typing import Callable, Protocol

class TaskRunnerContract(Protocol):
    run: Callable[[], str]

    def fallback(self) -> str:
        raise NotImplementedError

    def task_label(self) -> str:
        raise NotImplementedError
# File: src/index_task.py
from src.protocols import TaskRunnerContract

class IndexTask(TaskRunnerContract):
    def __init__(self, task_name: str) -> None:
        self._task_name: str = task_name

    def run(self) -> str:
        return f"{self._task_name} completed"

    def fallback(self) -> str:
        return f"{self._task_name} deferred"

    def task_label(self) -> str:
        return self._task_name.strip().upper()
# File: src/task_execution.py
from src.protocols import TaskRunnerContract

class TaskExecution:
    def __init__(self, client: TaskRunnerContract) -> None:
        self._client: TaskRunnerContract = client

    def resolve(self) -> str:
        if self._client.task_label() == "LEGACY_CALLABLE":
            if callable(self._client.run):
                return self._client.run()
            return self._client.fallback()
        return self._client.run()

    def report(self) -> None:
        task = self._client.task_label()
        result = self.resolve()
        print(f"{task}: {result}")
# File: cli.py
from src.task_execution import TaskExecution
from src.index_task import IndexTask

if __name__ == "__main__":
    task = IndexTask("indexing")
    execution = TaskExecution(task)
    execution.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class TaskRunnerContract(Protocol):
    def run(self) -> str:
        raise NotImplementedError

    def fallback(self) -> str:
        raise NotImplementedError

    def task_label(self) -> str:
        raise NotImplementedError
# File: src/index_task.py
from src.protocols import TaskRunnerContract

class IndexTask(TaskRunnerContract):
    def __init__(self, task_name: str) -> None:
        self._task_name: str = task_name

    def run(self) -> str:
        return f"{self._task_name} completed"

    def fallback(self) -> str:
        return f"{self._task_name} deferred"

    def task_label(self) -> str:
        return self._task_name.strip().upper()
# File: src/task_execution.py
from src.protocols import TaskRunnerContract

class TaskExecution:
    def __init__(self, client: TaskRunnerContract) -> None:
        self._client: TaskRunnerContract = client

    def resolve(self) -> str:
        result = self._client.run()
        if len(result) == 0:
            return self._client.fallback()
        return result

    def task_summary(self) -> str:
        task = self._client.task_label()
        result = self.resolve()
        return f"{task}: {result}"

    def report(self) -> None:
        summary = self.task_summary()
        print(summary)
# File: cli.py
from src.task_execution import TaskExecution
from src.index_task import IndexTask

if __name__ == "__main__":
    task = IndexTask("indexing")
    execution = TaskExecution(task)
    execution.report()
```
