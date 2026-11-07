# `class-reference-warning`

Description: Let consumers depend on a narrow contract, not its concrete implementation.

## Bad

```python
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
# File: src/product_catalog/protocols.py
from typing import Protocol
class ProductCatalogContract(Protocol):
    def product_name(self) -> str: ...
# File: src/product_catalog/product_catalog.py
class ProductCatalog:
    def __init__(self, name: str) -> None:
        self._name: str = name.strip()
    def normalized_name(self) -> str:
        return " ".join(self._name.split())
    def product_name(self) -> str:
        normalized_name = self.normalized_name()
        if not normalized_name:
            return "Uncatalogued"
        return normalized_name.upper()
    def report_title(self) -> str:
        product_name = self.product_name()
        normalized_name = self.normalized_name()
        word_count = len(normalized_name.split())
        return f"Catalog: {product_name} ({word_count} words)"
    def report(self, message: str) -> None:
        print(f"{self.report_title()} | {message}")
{%for consumer in consumers %}
# File: src/consumer_{{consumer.file}}.py
from src.product_catalog.product_catalog import ProductCatalog  # <- error
class Consumer{{consumer.name}}:
    def __init__(self, catalog: ProductCatalog, prefix: str, query: str) -> None:
        self._catalog: ProductCatalog = catalog
        self._prefix: str = prefix
        self._query: str = query
    def report_line(self) -> str:
        prefix = " ".join(self._prefix.split())
        return f"{prefix}: {self._catalog.product_name()}"
    def matches_query(self) -> bool:
        normalized_query = " ".join(self._query.split()).lower()
        if not normalized_query:
            return False
        return normalized_query in self.report_line().lower()
    def display_label(self) -> str:
        report_line = self.report_line()
        matches_query = self.matches_query()
        return f"{report_line} {matches_query}"
{% endfor %}
# File: cli.py
from src.product_catalog.product_catalog import ProductCatalog
{%for consumer in consumers %}
from src.consumer_{{consumer.file}} import Consumer{{consumer.name}}
{% endfor %}

if __name__ == "__main__":
    reporter = ProductCatalog("report")
{%for consumer in consumers %}
    consumer_{{consumer.file}} = Consumer{{consumer.name}}(reporter, "prefix-{{consumer.file}}", "query-{{consumer.file}}")
    reporter.report(consumer_{{consumer.file}}.display_label())
{% endfor %}
```

## Good

```python
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"},{"file":"six","name":"Six"},{"file":"seven","name":"Seven"},{"file":"eight","name":"Eight"},{"file":"nine","name":"Nine"},{"file":"ten","name":"Ten"},{"file":"eleven","name":"Eleven"},{"file":"twelve","name":"Twelve"},{"file":"thirteen","name":"Thirteen"},{"file":"fourteen","name":"Fourteen"},{"file":"fifteen","name":"Fifteen"}] %}
# File: src/product_catalog/protocols.py
from typing import Protocol
class ProductCatalogContract(Protocol):
    def product_name(self) -> str: ...
# File: src/product_catalog/product_catalog.py
class ProductCatalog:
    def __init__(self, name: str) -> None:
        self._name: str = name.strip()
    def normalized_name(self) -> str:
        return " ".join(self._name.split())
    def product_name(self) -> str:
        normalized_name = self.normalized_name()
        if not normalized_name:
            return "Uncatalogued"
        return normalized_name.upper()
    def report_title(self) -> str:
        product_name = self.product_name()
        normalized_name = self.normalized_name()
        word_count = len(normalized_name.split())
        return f"Catalog: {product_name} ({word_count} words)"
    def report(self, message: str) -> None:
        print(f"{self.report_title()} | {message}")
{%for consumer in consumers %}
# File: src/consumer_{{consumer.file}}.py
from src.product_catalog.protocols import ProductCatalogContract
class Consumer{{consumer.name}}:
    def __init__(self, catalog: ProductCatalogContract, prefix: str, query: str) -> None:
        self._catalog: ProductCatalogContract = catalog
        self._prefix: str = prefix
        self._query: str = query
    def report_line(self) -> str:
        prefix = " ".join(self._prefix.split())
        return f"{prefix}: {self._catalog.product_name()}"
    def matches_query(self) -> bool:
        normalized_query = " ".join(self._query.split()).lower()
        if not normalized_query:
            return False
        return normalized_query in self.report_line().lower()
    def display_label(self) -> str:
        report_line = self.report_line()
        matches_query = self.matches_query()
        return f"{report_line} {matches_query}"
{% endfor %}
# File: cli.py
from src.product_catalog.product_catalog import ProductCatalog
{%for consumer in consumers %}
from src.consumer_{{consumer.file}} import Consumer{{consumer.name}}
{% endfor %}

if __name__ == "__main__":
    reporter = ProductCatalog("report")
{%for consumer in consumers %}
    consumer_{{consumer.file}} = Consumer{{consumer.name}}(reporter, "prefix-{{consumer.file}}", "query-{{consumer.file}}")
    reporter.report(consumer_{{consumer.file}}.display_label())
{% endfor %}
```
