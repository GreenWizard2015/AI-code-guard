# Concrete collaborator created per operation

Description: A method chooses a concrete class implementing a project Protocol, constructs it for one operation, and calls it through that Protocol. Create the collaborator at the composition boundary and inject the Protocol instead.

## Bad

```python
# File: src/protocols.py
from typing import Protocol
class StoreContract(Protocol):
	def load(self, key: str) -> str: ...
# File: src/sql_store.py
from src.protocols import StoreContract
class SqlStore(StoreContract):
	def load(self, key: str) -> str: return key
# File: src/loader.py
from src.protocols import StoreContract
from src.sql_store import SqlStore
class Loader:
	def load(self, key: str) -> str:
		store: StoreContract = SqlStore()  # <- error
		return store.load(key)
	def report(self) -> None:
		loaded_value = self.load("status")
		print(f"Loaded {loaded_value}")
# File: src/cli.py
from src.loader import Loader

if __name__ == "__main__":
	loader = Loader()
	loader.report()
```

## Good

```python
# File: src/product_shelf/protocols.py
from typing import Protocol
class ProductCatalogContract(Protocol):
	def product_name(self) -> str: ...
	def contains(self, query: str) -> bool: ...
	def name_count(self) -> int: ...
# File: src/product_catalog/product_catalog.py
class ProductCatalog:
	def __init__(self, names: list[str], fallback: str) -> None:
		self._names: list[str] = names
		self._fallback: str = fallback
	def product_name(self) -> str:
		if not self._names: return self._fallback
		return self._names[0]
	def contains(self, query: str) -> bool:
		for name in self._names:
			if query in name.lower(): return True
		return False
	def name_count(self) -> int:
		count = 0
		for name in self._names:
			if name: count += 1
		return count
# File: src/product_shelf/product_shelf.py
from src.product_shelf.protocols import ProductCatalogContract
class ProductShelf:
	def __init__(self, catalog: ProductCatalogContract, label: str, maximum_label_length: int) -> None:
		self._catalog: ProductCatalogContract = catalog
		self._label: str = label
		self._maximum_label_length: int = maximum_label_length
	def title(self) -> str: return f"{self._label}: {self._catalog.product_name()}"
	def includes(self, query: str) -> bool:
		normalized = query.strip().lower()
		if not normalized: return False
		if self._catalog.contains(normalized): return True
		return normalized in self._catalog.product_name().lower()
	def display_label(self) -> str:
		if len(self._label) <= self._maximum_label_length: return self._label
		return self._label[:self._maximum_label_length]
	def visible_count(self) -> int:
		count = self._catalog.name_count()
		if self.display_label(): count += 1
		return count
	def report(self) -> None:
		title = self.title()
		matches = self.includes("note")
		count = self.visible_count()
		print(f"{title} | matches={matches} | visible={count}")
# File: src/cli.py
from src.product_catalog.product_catalog import ProductCatalog
from src.product_shelf.product_shelf import ProductShelf
if __name__ == "__main__":
	shelf = ProductShelf(ProductCatalog(["Notebook", "Pencil"], "Empty"), "Favorites", 20)
	shelf.report()
```
