import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { StaticExpressionArray } from "src/static_expression_array";

describe("static expression arrays", () => {
	test("preserves logical size and first value across repeated spreads", () => {
		const expression = ts.factory.createStringLiteral("key");
		let values = new StaticExpressionArray([expression], [], 1n);
		for (let index = 0; index < 60; index += 1) {
			values = new StaticExpressionArray([], [values, values], values.size * 2n);
		}
		expect(values.size).toBe(1n << 60n);
		expect(values.at(0n)).toBe(expression);
	});

	test("tracks an empty array without inventing elements", () => {
		const values = new StaticExpressionArray([], [], 0n);
		expect({ size: values.size, contains_first: values.contains(0n) }).toEqual({
			size: 0n,
			contains_first: false,
		});
	});
});
