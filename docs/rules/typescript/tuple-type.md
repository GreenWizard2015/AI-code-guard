# `tuple-type`

Description: Detect TypeScript tuple type contracts, including readonly and labelled tuples.

Tuples expose data through positional indexes. This makes a result harder to understand and
allows callers to depend on ordering instead of a named contract.

## Bad

```ts
// File: src/coordinate_reporter.ts
export class CoordinateReporter {
	private readonly coordinates: readonly [number, number];

	public constructor(coordinates: readonly [number, number]) {
		this.coordinates = coordinates;
	}

	public manhattan_distance(): number {
		const horizontal = this.coordinates[0];
		const vertical = this.coordinates[1];
		return Math.abs(horizontal) + Math.abs(vertical);
	}

	public summary(): string {
		const horizontal = this.coordinates[0];
		const vertical = this.coordinates[1];
		const distance = this.manhattan_distance();
		return `x=${horizontal}, y=${vertical}; distance=${distance}`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { CoordinateReporter } from "src/coordinate_reporter";

(function run(): void {
	const reporter = new CoordinateReporter([10, 20]); // <- error
	reporter.report();
})();
```


## Good

```ts
// File: src/types.ts
export type Coordinates = {
	x: number;
	y: number;
};
// File: src/coordinate_reporter.ts
import type { Coordinates } from "src/types";

export class CoordinateReporter {
	private readonly _coordinates: Coordinates;

	public constructor(coordinates: Coordinates) {
		this._coordinates = coordinates;
	}

	public manhattan_distance(): number {
		const horizontal = this._coordinates.x;
		const vertical = this._coordinates.y;
		return Math.abs(horizontal) + Math.abs(vertical);
	}

	public summary(): string {
		const horizontal = this._coordinates.x;
		const vertical = this._coordinates.y;
		const distance = this.manhattan_distance();
		return `x=${horizontal}, y=${vertical}; distance=${distance}`;
	}

	public report(): void {
		const summary = this.summary();
		console.log(summary);
	}
}
// File: cli.ts
#!/usr/bin/env node
import { CoordinateReporter } from "src/coordinate_reporter";
import type { Coordinates } from "src/types";

(function run(): void {
	const coordinates: Coordinates = { x: 10, y: 20 };
	const reporter = new CoordinateReporter(coordinates);
	reporter.report();
})();
```

