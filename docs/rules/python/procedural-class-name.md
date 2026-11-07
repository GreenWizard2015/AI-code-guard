# `procedural-class-name`

Description: Warn when a class name describes a job rather than the entity, value, collection, or
technical boundary it represents. This is a naming signal, not proof of a design defect.

### Naming guidance

The rule checks names only; stateful adapters, protocols, mixins, and test types may have technical
names. Prefer “what is it?” over “what does it do?”:

| Job-like name | Consider representing |
| --- | --- |
| `Manager`, `Controller`, `Service` | owned entities and their lifecycle |
| `Handler`, `Processor`, `Dispatcher` | the message, result, or participants |
| `Helper`, `Utils`, `Utility` | focused domain objects that own each operation |
| `Reader`, `Writer`, `Parser`, `Converter` | the file, parsed value, or representation |
| `Validator`, `Resolver`, `Provider`, `Loader` | the validated value, path, token, or configuration |
| `Fetcher`, `Generator`, `Calculator`, `Sorter` | the user, report, price, or sorted value |
| `Encoder`, `Decoder`, `Router`, `Runner`, `Locator` | encoded data, route, execution, or explicit dependencies |
| `Observer`, `Listener`, `Client` | the domain participant or a narrow technical boundary |

Regular plurals are checked (`Helpers`, `Readers`, `Validators`); `-ies` normalizes to `-y`
(`Factories`). `Data`, `Info`, `Object`, `Impl`, `Interface`, and `I...` are weak names; prefer
the actual concept or a distinguishing qualifier such as `SqlUsers` or `CachedUsers`.

These are not blanket bans: a stateful `RemoteClient` or an architectural `Factory` can be valid.
Treat `Builder` as a clue to inspect an oversized constructor. If a class has unrelated operations,
split ownership instead of only renaming it.

### References

- [Seven Virtues of a Good Object](https://www.yegor256.com/2014/11/20/seven-virtues-of-a-good-object.html)
- [OOP Alternative to Utility Classes](https://www.yegor256.com/2014/05/05/oop-alternative-to-utility-classes.html)

## Bad


```python
# File: src/message_processor.py
class MessageProcessor:  # <- error
    """Responsibilities: _message processing_."""

    def __init__(self, source_text: str) -> None:
        """Responsibilities: _processor initialization_."""
        self._source_text: str = source_text

    def process(self) -> str:
        """Responsibilities: _message normalization_."""
        words = self._source_text.strip().split()
        return " ".join(words)

    def report(self) -> None:
        """Responsibilities: _message report output_."""
        print(f"Message: {self.process()}")
# File: cli.py
from src.message_processor import MessageProcessor

if __name__ == "__main__":
    processor = MessageProcessor(" ready state ")
    processor.report()
```

## Good

`Message` represents the same trimmed input as a value and owns operations on that value.


```python
# File: src/message.py
class Message:
    """Responsibilities: _message value_."""

    def __init__(self, content: str) -> None:
        """Responsibilities: _message initialization_."""
        self._text: str = content.strip()

    def empty(self) -> bool:
        """Responsibilities: _empty message classification_."""
        return len(self._text) == 0

    def word_count(self) -> int:
        """Responsibilities: _message word count_."""
        if not self._text:
            return 0
        return len(self._text.split())

    def character_count(self) -> int:
        """Responsibilities: _message character count_."""
        return sum(1 for _ in self._text)

    def contains(self, fragment: str) -> bool:
        """Responsibilities: _message content search_."""
        value = fragment.strip()
        if not value:
            return False
        return value in self._text.split()

    def summary(self) -> str:
        """Responsibilities: _message summary_."""
        word_total = self.word_count()
        character_total = self.character_count()
        empty_state = self.empty()
        hello_match = self.contains("hello")
        return f"{self._text} ({word_total} words, {character_total} characters; empty={empty_state}; hello={hello_match})"

    def report(self) -> None:
        """Responsibilities: _message report output_."""
        print(self.summary())
# File: cli.py
from src.message import Message

if __name__ == "__main__":
    message = Message(" hello world ")
    message.report()
```
