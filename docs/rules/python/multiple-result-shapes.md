# `multiple-result-shapes`

Description: Business logic should consume one normalized response representation.

## Bad


```python
# File: response_content.py
def content_from_response(response: dict[str, str]) -> str:
    structured_content = response.get("structuredContent")
    if structured_content is not None:
        return structured_content
    return response.get("unwrap_tool_result", "")  # <- error
```

The fallback makes business logic depend on two upstream response shapes.

## Good


```python
# File: protocols.py
from typing import Protocol


class ToolResponseContract(Protocol):
    def content_text(self) -> str:
        ...

    def summary(self) -> str:
        ...

    def content_size(self) -> int:
        ...

# File: tool_response.py
from protocols import ToolResponseContract


class ToolResponse(ToolResponseContract):
    """Responsibilities: _normalized response content access_."""

    def __init__(self, content: str) -> None:
        """Responsibilities: _response initialization_."""
        self.content: str = content

    def content_text(self) -> str:
        """Responsibilities: _response content normalization_."""
        normalized = self.content.strip()
        if len(normalized) == 0:
            return "empty"
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
            if character.strip():
                size += 1
        return size

# File: cli.py
from tool_response import ToolResponse


if __name__ == "__main__":
    response = ToolResponse("ready")
    print(response.content_text(), response.summary(), response.content_size())
```

Normalize upstream variants once, then pass one response contract to business logic.
