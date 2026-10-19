# responsibilities-wording

Description: Keep each responsibility as a concise ownership phrase rather than a description of
results or invocation mechanics.

Each responsibility may contain at most four words. Use a noun phrase that names the owned work,
not a verb phrase describing an outcome, a condition, or an invocation. Articles and inflected
action words are strong signals that the phrase is describing execution instead of ownership.

Examples:

- Outcome-oriented: `_produces direct parity results_` → `_parity result construction_`.
- Condition-oriented: `_determines whether paths match_` → `_path matching_`.
- Invocation-oriented: `_invokes reference handlers_` → `_reference handler dispatch_`.

The left side describes what happens during execution. The right side names the responsibility
itself, so it remains short, stable, and focused on ownership. Prefer phrases such as
`_user validation_`, `_record lookup_`, `_array type detection_`, and `_file-name suffix_`.

Do not remove meaningful ownership details merely to meet the limit. When the responsibility cannot
be stated honestly in four words without describing a result or invocation, split the owner or
choose a more direct domain phrase.

## Bad


```python
# File: src/parity_result.py
class ParityResult:
    """Responsibilities: _parity construction_, _text access_."""
    def __init__(self, result_text: str) -> None:
        """Responsibilities: _result initialization_."""
        self._result_text: str = result_text

    def text(self) -> str:
        """Responsibilities: _normalizes direct parity results_."""
        normalized_text = ""
        for word in self._result_text.split():
            if normalized_text:
                normalized_text += " "
            normalized_text += word
        return normalized_text

    def text_length(self) -> int:
        """Responsibilities: _text length_."""
        return len(self._result_text)
    def word_count(self) -> int:
        """Responsibilities: _word count_."""
        words = self.text().split()
        return len(words)
    def uppercase_text(self) -> str:
        """Responsibilities: _uppercase text_."""
        text = self.text()
        return text.upper()
# File: cli.py
from src.parity_result import ParityResult
if __name__ == "__main__":
    first_result = ParityResult("ready state")
    second_result = ParityResult("blocked state")
    first_result.text()
    first_result.text_length()
    first_result.word_count()
    first_result.uppercase_text()
    second_result.text()
    second_result.text_length()
    second_result.word_count()
    second_result.uppercase_text()
```

## Good


```python
# File: cli.py
if __name__ == "__main__":
    value: str = "ready"
```
