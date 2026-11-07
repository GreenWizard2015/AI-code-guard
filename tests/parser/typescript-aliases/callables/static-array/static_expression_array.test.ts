import { describe, expect, test } from "@jest/globals";
import { StaticExpressionArray } from "src/parser/typescript-aliases/callables/static-array/static_expression_array";
import ts from "typescript";

describe("static expression arrays", () => {
	test("preserves logical size and first value across repeated spreads", () => {
		const expression = ts.factory.createStringLiteral("key");
		let values = new StaticExpressionArray([expression], []);
		for (let index = 0; index < 60; index += 1) {
			values = new StaticExpressionArray([], [values, values]);
		}
		expect(values.size()).toBe(1n << 60n);
		expect(values.at(0n)).toBe(expression);
	});

	test("tracks an empty array without inventing elements", () => {
		const values = new StaticExpressionArray([], []);
		expect({ size: values.size(), contains_first: values.contains(0n) }).toEqual({
			size: 0n,
			contains_first: false,
		});
	});
});
