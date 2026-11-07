import { describe, expect, test } from "@jest/globals";
import { SharedParameterType } from "src/metrics/shared_parameter/shared_parameter_type";

describe("shared parameter type identity", () => {
	test("preserves whitespace inside literals while normalizing type formatting", () => {
		const parameter_type = new SharedParameterType(
			[],
			{ count: () => 0, contains: () => false },
			{ present: () => false },
		);
		const spaced_identity = parameter_type.identity('Map< "a b" , Box< "c d" > >');
		const formatted_identity = parameter_type.identity('Map<"a b",Box<"c d">>');
		const distinct_identity = parameter_type.identity('Map<"ab", Box<"c d">>');
		const spaced = spaced_identity.canonical();
		const formatted = formatted_identity.canonical();
		const distinct = distinct_identity.canonical();

		expect({ spaced, formatted, distinct }).toEqual({
			spaced: 'Map<"a b",Box<"c d">>',
			formatted: 'Map<"a b",Box<"c d">>',
			distinct: 'Map<"ab",Box<"c d">>',
		});
	});

	test("uses one parsed identity for canonical and source-scoped matching", () => {
		const parameter_type = new SharedParameterType(
			[{ name: "BoxAlias", target: "Box" }],
			{ count: () => 0, contains: () => false },
			{ present: () => false },
		);
		const sources = new Map([
			["Box", { file: "models.ts", name: "Box" }],
			["a b", { file: "literal-decoy.ts", name: "Decoy" }],
		]);
		const spaced = parameter_type.identity('Map<BoxAlias< "a b" >>');
		const formatted = parameter_type.identity('Map< BoxAlias <"a b"> >');
		const distinct = parameter_type.identity('Map<BoxAlias<"ab">>');

		expect({
			canonical: spaced.canonical(),
			equivalent_formatting:
				spaced.scoped_key("reference", "value", "service.ts", sources) ===
				formatted.scoped_key("reference", "value", "service.ts", sources),
			different_literal:
				spaced.scoped_key("reference", "value", "service.ts", sources) !==
				distinct.scoped_key("reference", "value", "service.ts", sources),
		}).toEqual({
			canonical: 'Map<Box<"a b">>',
			equivalent_formatting: true,
			different_literal: true,
		});
	});
});
