# `method-order`

Description: Declare private and protected methods first, the constructor next, and public methods last.

## Bad

```python
# File: src/reader.py
class Reader:
	def read(self) -> str:
		return self._parse()
	def __init__(self) -> None:
		pass
	def _parse(self) -> str:
		return "document"
	def report(self) -> None:
		print(self.read())
# File: cli.py
from src.reader import Reader

if __name__ == "__main__":
	reader = Reader()
	reader.report()
```

## Good

```python
# File: src/domain/document_status.py
class DocumentStatus:
	def _normalized_status(self) -> str:
		trimmed_status = self._raw_status.strip()
		normalized_value = trimmed_status.lower()
		return normalized_value
	def __init__(self, raw_status: str) -> None:
		self._raw_status: str = raw_status
	def normalized(self) -> str:
		status_value = self._normalized_status()
		words = status_value.split()
		return " ".join(words)
	def ready(self) -> bool:
		status_value = self._normalized_status()
		return status_value == "ready"
	def label(self, prefix: str) -> str:
		clean_prefix = prefix.strip()
		status_value = self._normalized_status()
		return f"{clean_prefix}: {status_value}"
	def contains(self, fragment: str) -> bool:
		clean_fragment = fragment.strip().lower()
		status_value = self._normalized_status()
		return clean_fragment in status_value
	def report(self) -> None:
		print(self.label("State"), self.ready())
# File: cli.py
from src.domain.document_status import DocumentStatus
if __name__ == "__main__":
	status = DocumentStatus(" READY ")
	status.normalized()
	status.contains("ead")
	status.report()
```
