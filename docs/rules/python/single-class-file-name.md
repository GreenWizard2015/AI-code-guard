# single-class-file-name

Description: Keep a production file containing exactly one implementation class named `MyClass` in the sibling file `my_class.ts` or `my_class.py`. Convert the complete class name to snake_case for both TypeScript and Python. Kebab-case names such as `my-class.ts` are forbidden.

Test files and facade files (`index.ts`, `index.py`, and `__init__.py`) are not renamed by this rule.

## Bad


```python
class RecordIdentifier:
	pass
```

## Good


```python
class RecordIdentifier:
	"""Responsibilities: _record identity_, _prefix normalization_."""

	def __init__(self, value: str) -> None:
		"""Responsibilities: _initial identity_."""
		self._value_text: str = value.strip()

	def value(self) -> str:
		"""Responsibilities: _identity view_."""
		return self.with_prefix("")

	def matches_prefix(self, prefix: str) -> bool:
		"""Responsibilities: _prefix comparison_."""
		return self._value_text.startswith(f"{prefix}:")

	def with_prefix(self, prefix: str) -> str:
		"""Responsibilities: _prefix identity_."""
		if prefix == "":
			return self._value_text
		if self.matches_prefix(prefix):
			return self._value_text
		prefixed = RecordIdentifier(f"{prefix}:{self._value_text}")
		return prefixed.value()
```
