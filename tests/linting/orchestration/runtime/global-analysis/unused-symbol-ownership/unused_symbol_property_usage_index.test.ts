import { describe, expect, test } from "@jest/globals";
import { PUBLIC_FIELD_KIND } from "src/constants";
import { SourceReferenceIndex } from "src/core/source_reference_index";
import type { UnusedFieldOwner, UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolPropertyUsageIndex } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/unused_symbol_property_usage_index";

describe("unused symbol property usage index", () => {
	test("checks a shared contract-field bucket once for many same-name class fields", () => {
		const class_count = 96;
		const contract_count = 80;
		let contract_owner_scans = 0;
		const contract_owners: UnusedFieldOwner[] = Array.from({ length: contract_count }, (_, index) => ({
			file: `/project/contract_${index}.ts`,
			owner: `Contract${index}`,
		}));
		const references = new SourceReferenceIndex<string>();
		const property_index = new UnusedSymbolPropertyUsageIndex(references, {
			property_usage_owners: () => [],
			contract_fields: () => {
				contract_owner_scans += 1;
				return contract_owners;
			},
		});
		const class_fields: UnusedSymbolDefinition[] = Array.from({ length: class_count }, (_, index) => ({
			file: `/project/class_${index}.ts`,
			line: 1,
			name: "id",
			kind: PUBLIC_FIELD_KIND,
			owner: `Class${index}`,
			owner_kind: "class",
			contract_names: [],
		}));

		const results = class_fields.map((definition) => property_index.usage_present(definition));

		expect({
			all_unused: results.every((used) => !used),
			contract_owner_scans,
		}).toEqual({
			all_unused: true,
			contract_owner_scans: 1,
		});
	});

	test("keeps a used contract field from producing an unused class-field result", () => {
		const references = new SourceReferenceIndex<string>();
		references.add_usage("field\u0000/project/contract.ts\u0000Contract\u0000id", {
			file: "/project/consumer.ts",
			line: 4,
		});
		const property_index = new UnusedSymbolPropertyUsageIndex(references, {
			property_usage_owners: () => [],
			contract_fields: () => [{ file: "/project/contract.ts", owner: "Contract" }],
		});
		const definition: UnusedSymbolDefinition = {
			file: "/project/implementation.ts",
			line: 2,
			name: "id",
			kind: PUBLIC_FIELD_KIND,
			owner: "Implementation",
			owner_kind: "class",
			contract_names: ["Contract"],
		};

		expect(property_index.usage_present(definition)).toBe(true);
	});
});
