# `test-production-directory-mix`

Description: Keep tests and production source files in separate directories. A directory that
contains at least one recognized test source file and at least one production source file receives
one directory diagnostic. Files under `tests/` and `__tests__/`, and files with the configured test
filename suffixes, are recognized as tests.

## Bad

```ts
// File: src/orders/order.ts
export class Order {
	private readonly _number: string;
	public constructor(number: string) {
		this._number = number;
	}
	public number(): string {
		return this._number;
	}
}
// File: src/orders/order.test.ts
import { Order } from "src/orders/order";
describe("Order", () => {
	test("returns its number", () => {
		const order = new Order("A-1");
		const number = order.number();
		expect(number).toBe("A-1");
	});
});
```

```python
# File: src/orders/order.py
class Order:
    def __init__(self, number: str) -> None:
        self._number: str = number
    def number(self) -> str:
        return self._number
# File: src/orders/test_order.py
import unittest
from src.orders.order import Order
class TestOrder(unittest.TestCase):
    def test_returns_number(self) -> None:
        order = Order("A-1")
        number = order.number()
        self.assertEqual(number, "A-1")
```

## Good

```ts
// File: src/orders/order.ts
export class Order {
	private readonly _number: string;
	public constructor(number: string) {
		this._number = number;
	}
	public number(): string {
		return this._number;
	}
}
// File: tests/orders/order.test.ts
import { Order } from "src/orders/order";
describe("Order", () => {
	test("returns its number", () => {
		const order = new Order("A-1");
		const number = order.number();
		expect(number).toBe("A-1");
	});
});
```

```python
# File: src/orders/order.py
class Order:
    def __init__(self, number: str) -> None:
        self._number: str = number
    def number(self) -> str:
        return self._number
# File: tests/orders/test_order.py
import unittest
from src.orders.order import Order
class TestOrder(unittest.TestCase):
    def test_returns_number(self) -> None:
        order = Order("A-1")
        number = order.number()
        self.assertEqual(number, "A-1")
```
