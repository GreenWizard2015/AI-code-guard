# `class-max-size`

Description: Detect classes too large to keep as one cohesive responsibility.


Fix: Extract cohesive collaborators and move behavior to the class that owns it. Audit callers
before changing the boundary; do not hide size behind wrappers or arbitrary delegation.

Size is the average of class-body lines and executable SLOC; declaration signatures and Python
docstrings are excluded.

## Bad

A catalog class repeats the same short calculation for each of 15 fixed eight-item segments. Every
call receives exactly 120 prices; the constructor and each method stay below the callable limit,
but the class accumulates too much behavior.


```python
# File: src/price_catalog/price_catalog.py
{% const segments = [{"name":"north","start":0},{"name":"south","start":8},{"name":"east","start":16},{"name":"west","start":24},{"name":"central","start":32},{"name":"coastal","start":40},{"name":"rural","start":48},{"name":"island","start":56},{"name":"metro","start":64},{"name":"northern","start":72},{"name":"southern","start":80},{"name":"highland","start":88},{"name":"lowland","start":96},{"name":"valley","start":104},{"name":"frontier","start":112}] %}

class PriceCatalog:  # <- error
{%for segment in segments %}
    def _{{segment.name}}_total(self, prices: list[float]) -> float:
        segment_start = {{segment.start}}
        total = 0.0
        for item_number in range(segment_start, segment_start + 8):
            price = prices[item_number]
            extended_price = price * self.multiplier
            discount = extended_price * 0.05
            discounted_price = extended_price - discount
            tax = discounted_price * 0.08
            price_with_tax = discounted_price + tax
            total += price_with_tax
        return total
{% endfor %}
    def __init__(self, multiplier: float) -> None:
        self.multiplier: float = multiplier
    def total(self, prices: list[float]) -> float:
        first_segments = (
            self._north_total(prices) + self._south_total(prices) + self._east_total(prices)
            + self._west_total(prices) + self._central_total(prices) + self._coastal_total(prices)
            + self.rural_total(prices)
        )
        remaining_segments = (
            self._island_total(prices) + self._metro_total(prices) + self._northern_total(prices)
            + self._southern_total(prices) + self._highland_total(prices) + self._lowland_total(prices)
            + self._valley_total(prices) + self._frontier_total(prices)
        )
        return first_segments + remaining_segments
    def normalized_total(self, prices: list[float]) -> float:
        total = self.total(prices)
        return round(total * 100) / 100

# File: cli.py
from src.price_catalog.price_catalog import PriceCatalog

if __name__ == "__main__":
    catalog = PriceCatalog(1.2)
    prices = [1.0] * 120
    print(catalog.total(prices), catalog.normalized_total(prices))
```

## Good


```python
# File: src/price_catalog/price_catalog.py
class PriceCatalog:
    """Responsibilities: _price aggregation_."""
    def _segment_total(self, prices: list[float], segment_start: int) -> float:
        """Responsibilities: _one segment price calculation_."""
        total = 0.0
        for item_number in range(segment_start, segment_start + 8):
            price = prices[item_number]
            extended_price = price * self.multiplier
            discount = extended_price * 0.05
            discounted_price = extended_price - discount
            tax = discounted_price * 0.08
            price_with_tax = discounted_price + tax
            total += price_with_tax
        return total
    def __init__(self, multiplier: float) -> None:
        """Responsibilities: _price catalog initialization_."""
        self.multiplier: float = multiplier
    def total(self, prices: list[float]) -> float:
        """Responsibilities: _price aggregation_."""
        first_segments = 0.0
        remaining_segments = 0.0
        for segment_number in range(15):
            segment_start = segment_number * 8
            segment_total = self._segment_total(prices, segment_start)
            if segment_number < 7:
                first_segments += segment_total
            else:
                remaining_segments += segment_total
        return first_segments + remaining_segments
    def normalized_total(self, prices: list[float]) -> float:
        """Responsibilities: _price normalization_."""
        total = self.total(prices)
        return round(total * 100) / 100

# File: cli.py
from src.price_catalog.price_catalog import PriceCatalog

if __name__ == "__main__":
    catalog = PriceCatalog(1.2)
    prices = [1.0] * 120
    print(catalog.total(prices), catalog.normalized_total(prices))
```
