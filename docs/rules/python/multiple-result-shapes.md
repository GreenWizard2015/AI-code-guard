# `multiple-result-shapes`

Description: Business logic should consume one normalized response representation.

Fix: Normalize upstream variants once, then pass one response contract to business logic.

## Bad

```python
# File: src/tool_response.py
class ToolResponse:
    def __init__(self, response: dict[str, str]) -> None:
        self._response: dict[str, str] = response

    def content_text(self) -> str:
        structured_content = self._response.get("structuredContent")
        if structured_content is not None:
            return structured_content
        nested_content = self._response.get("result.content")
        if nested_content is not None:
            return nested_content
        return self._response.get("unwrap_tool_result", "")

    def content_size(self) -> int:
        size = 0
        for character in self.content_text():
            if character.strip():
                size += 1
        return size

    def summary(self) -> str:
        content = self.content_text()
        label = "empty" if len(content) == 0 else "content"
        return f"{label} ({self.content_size()}): {content}"

    def report(self) -> None:
        print(self.summary())
# File: cli.py
from src.tool_response import ToolResponse

if __name__ == "__main__":
    responses = [
        {"structuredContent": "ready"},
        {"result.content": "queued"},
        {"unwrap_tool_result": "finished"},
    ]
    for response_data in responses:
        response = ToolResponse(response_data)
        response.report()
```

## Good

```python
# File: src/protocols.py
from typing import Protocol

class ToolResponseContract(Protocol):
    def content_text(self) -> str: ...

    def summary(self) -> str: ...

    def content_size(self) -> int: ...

    def report(self) -> None: ...
# File: src/tool_response.py
from src.protocols import ToolResponseContract

class ToolResponse(ToolResponseContract):
    """Responsibilities: _normalized response content access_."""

    def __init__(self, content: str) -> None:
        self._content: str = content

    def content_text(self) -> str:
        normalized = self._content.strip()
        if len(normalized) == 0:
            return "empty"
        return normalized.upper()

    def summary(self) -> str:
        content = self.content_text()
        label = "empty" if len(content) == 0 else "content"
        return f"{label}: {content}"

    def content_size(self) -> int:
        size = 0
        for character in self.content_text():
            if character.strip():
                size += 1
        return size

    def report(self) -> None:
        print(f"{self.summary()} ({self.content_size()})")
# File: cli.py
from src.tool_response import ToolResponse

if __name__ == "__main__":
    response = ToolResponse("ready")
    response.report()
```
