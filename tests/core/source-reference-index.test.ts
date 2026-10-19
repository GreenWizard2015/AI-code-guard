import { describe, expect, test } from "@jest/globals";
import { SourceReferenceIndex } from "src/core/source_reference_index";

describe("source reference index", () => {
	test("keeps an unknown key separate from known keys", () => {
		const index = new SourceReferenceIndex<object>();
		const unknown_key = {};
		const known_key = { name: "known-symbol" };
		const unknown_reference = { file: "unknown.ts", line: 12 };
		const known_reference = { file: "known.ts", line: 8 };
		index.add_usage(unknown_key, unknown_reference);
		index.add_implementation(known_key, known_reference);

		expect({
			unknown: index.references_for(unknown_key, "usage"),
			known: index.references_for(known_key, "implementation"),
		}).toEqual({
			unknown: [unknown_reference],
			known: [known_reference],
		});
	});

	test("groups value references without an implementation", () => {
		const index = new SourceReferenceIndex<string>();
		const unknown_key = "shared-value";
		const references = [
			{ file: "first.ts", line: 3 },
			{ file: "second.ts", line: 6 },
			{ file: "third.ts", line: 9 },
		];
		for (const reference of references) {
			index.add_usage(unknown_key, reference);
		}

		expect({
			implementations: index.references_for(unknown_key, "implementation"),
			repeated: index.repeated_usages(3),
		}).toEqual({ implementations: [], repeated: references });
	});

	test("keeps implementation and usage references independent", () => {
		const index = new SourceReferenceIndex<string>();
		index.add_implementation("symbol", { file: "definition.ts", line: 4 });
		index.add_usage("symbol", { file: "consumer.ts", line: 9 });

		expect({
			implementations: index.references_for("symbol", "implementation"),
			usages: index.references_for("symbol", "usage"),
		}).toEqual({
			implementations: [{ file: "definition.ts", line: 4 }],
			usages: [{ file: "consumer.ts", line: 9 }],
		});
	});
});
