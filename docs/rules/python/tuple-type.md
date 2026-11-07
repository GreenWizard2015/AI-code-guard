# `tuple-type`

Description: Detect TypeScript tuple type contracts, including readonly and labelled tuples.

Tuples expose data through positional indexes. This makes a result harder to understand and
allows callers to depend on ordering instead of a named contract.

## Bad


```python
# File: src/coordinate_reporter.py
class CoordinateReporter:
    _coordinates: tuple[int, int]  # <- error

    def __init__(self) -> None:
        self._coordinates = (10, 20)

    def manhattan_distance(self) -> int:
        horizontal = self._coordinates[0]
        vertical = self._coordinates[1]
        return abs(horizontal) + abs(vertical)

    def summary(self) -> str:
        horizontal = self._coordinates[0]
        vertical = self._coordinates[1]
        distance = self.manhattan_distance()
        return f"x={horizontal}, y={vertical}; distance={distance}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.coordinate_reporter import CoordinateReporter

if __name__ == "__main__":
    reporter = CoordinateReporter()
    reporter.report()
```

## Good


```python
# File: src/coordinates.py
class Coordinates:
    def __init__(self) -> None:
        self._x_coordinate: int = 10
        self._y_coordinate: int = 20

    def coordinate_label(self) -> str:
        horizontal = self._x_coordinate
        vertical = self._y_coordinate
        return f"x={horizontal}, y={vertical}"

    def summary(self) -> str:
        label = self.coordinate_label()
        distance = abs(self._x_coordinate) + abs(self._y_coordinate)
        return f"{label}; distance={distance}"

    def report(self) -> None:
        summary = self.summary()
        print(summary)
# File: cli.py
from src.coordinates import Coordinates

if __name__ == "__main__":
    coordinates = Coordinates()
    coordinates.report()
```
