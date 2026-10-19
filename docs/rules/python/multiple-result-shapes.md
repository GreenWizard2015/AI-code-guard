# `multiple-result-shapes`

Description: Business logic should not know every upstream response representation.


Python response branching is covered too:

```python
if response.content is not None:
    return response.content
return response
```


Fix: Normalize the upstream response once at the transport boundary.

## Bad


```python
# File: src/protocols.py
from typing import Protocol
class ToolResponseContract(Protocol):
    def content_text(self) -> str: ...
    def summary(self) -> str: ...
    def content_size(self) -> int: ...

# File: src/tool_response.py
from src.protocols import ToolResponseContract
class ToolResponse(ToolResponseContract):
    def __init__(self, response_data: dict[str, str]) -> None:
        self.response_data: dict[str, str] = response_data
    def content_text(self) -> str:
        content = self.response_data["structuredContent"]  # <- error
        normalized = content.strip()
        return normalized.upper()

    def summary(self) -> str:
        content = self.content_text()
        label = "empty" if len(content) == 0 else "content"
        return f"{label}: {content}"

    def content_size(self) -> int:
        size = 0
        for character in self.content_text():
            if character.strip(): size += 1
        return size
# File: cli.py
from src.tool_response import ToolResponse
if __name__ == "__main__":
    response = ToolResponse({"structuredContent": " ready "})
    print(response.content_text(), response.summary(), response.content_size())
```

## Good


```python
# File: src/protocols.py
from typing import Protocol
class ToolResponseContract(Protocol):
    def content_text(self) -> str: ...
    def summary(self) -> str: ...
    def content_size(self) -> int: ...

# File: src/tool_response.py
from src.protocols import ToolResponseContract
class ToolResponse(ToolResponseContract):
    """Responsibilities: _tool response content access_."""
    def __init__(self, content: str) -> None:
        """Responsibilities: _response initialization_."""
        self.content: str = content
    def content_text(self) -> str:
        """Responsibilities: _response content normalization_."""
        normalized = self.content.strip()
        if len(normalized) == 0: return "empty"
        return normalized.upper()

    def summary(self) -> str:
        """Responsibilities: _response summary composition_."""
        content = self.content_text()
        label = "empty" if len(content) == 0 else "content"
        return f"{label}: {content}"

    def content_size(self) -> int:
        """Responsibilities: _response content size calculation_."""
        size = 0
        for character in self.content_text():
            if character.strip(): size += 1
        return size
# File: cli.py
from src.tool_response import ToolResponse
if __name__ == "__main__":
    response = ToolResponse("ready")
    print(response.content_text(), response.summary(), response.content_size())
```
