# `class-reference-info`

Description: Keep class construction ownership focused and reduce unnecessary cross-file references.

## Bad

```python
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
# File: src/product_catalog/product_catalog.py
class ProductCatalog:
    def __init__(self, name: str) -> None:
        self.name: str = name

    def product_name(self) -> str:
        return self.name.strip().upper()
{%for consumer in consumers %}
# File: src/consumer_{{consumer.file}}.py
from src.product_catalog.product_catalog import ProductCatalog  # <- error
class Consumer{{consumer.name}}:
    def __init__(self, catalog: ProductCatalog, prefix: str) -> None:
        self.catalog: ProductCatalog = catalog
        self.prefix: str = prefix
    def display_label(self) -> str:
        normalized_prefix = self.prefix.strip()
        product_name = self.catalog.product_name()
        if not normalized_prefix:
            return product_name
        return f"{normalized_prefix}: {product_name}"
    def matches_query(self, query: str) -> bool:
        normalized_query = query.strip().lower()
        if not normalized_query:
            return False
        normalized_product_name = self.catalog.product_name().lower()
        normalized_label = self.display_label().lower()
        return normalized_query in normalized_product_name or normalized_query in normalized_label
{% endfor %}
# File: src/cli.py
from src.product_catalog.product_catalog import ProductCatalog
{%for consumer in consumers %}
from src.consumer_{{consumer.file}} import Consumer{{consumer.name}}
{% endfor %}
if __name__ == "__main__":
    catalog = ProductCatalog("Notebook")
{%for consumer in consumers %}
    consumer_{{consumer.file}} = Consumer{{consumer.name}}(catalog, "{{consumer.file}}: ")
    print(consumer_{{consumer.file}}.display_label(), consumer_{{consumer.file}}.matches_query("note"))
{% endfor %}
```

## Good

```python
{% const consumers = [{"file":"one","name":"One"},{"file":"two","name":"Two"},{"file":"three","name":"Three"},{"file":"four","name":"Four"},{"file":"five","name":"Five"}] %}
# File: src/product_catalog/protocols.py
from typing import Protocol

class ProductCatalogContract(Protocol):
    def product_name(self) -> str: ...
# File: src/product_catalog/product_catalog.py
from src.product_catalog.protocols import ProductCatalogContract
class ProductCatalog(ProductCatalogContract):
    """Responsibilities: _product catalog ownership_."""
    def __init__(self, name: str) -> None:
        self.name: str = name

    def product_name(self) -> str:
        return self.name.strip().upper()
{%for consumer in consumers %}
# File: src/consumer_{{consumer.file}}.py
from src.product_catalog.protocols import ProductCatalogContract
class Consumer{{consumer.name}}:
    """Responsibilities: _product presentation_."""
    def __init__(self, catalog: ProductCatalogContract, prefix: str) -> None:
        self.catalog: ProductCatalogContract = catalog
        self.prefix: str = prefix

    def display_label(self) -> str:
        normalized_prefix = self.prefix.strip()
        product_name = self.catalog.product_name()
        if not normalized_prefix:
            return product_name
        return f"{normalized_prefix}: {product_name}"
    def matches_query(self, query: str) -> bool:
        normalized_query = query.strip().lower()
        if not normalized_query:
            return False
        normalized_product_name = self.catalog.product_name().lower()
        normalized_label = self.display_label().lower()
        return normalized_query in normalized_product_name or normalized_query in normalized_label
{% endfor %}
# File: src/cli.py
from src.product_catalog.product_catalog import ProductCatalog
{%for consumer in consumers %}
from src.consumer_{{consumer.file}} import Consumer{{consumer.name}}
{% endfor %}
if __name__ == "__main__":
    catalog = ProductCatalog("Notebook")
{%for consumer in consumers %}
    consumer_{{consumer.file}} = Consumer{{consumer.name}}(catalog, "{{consumer.file}}: ")
    print(consumer_{{consumer.file}}.display_label(), consumer_{{consumer.file}}.matches_query("note"))
{% endfor %}
```
