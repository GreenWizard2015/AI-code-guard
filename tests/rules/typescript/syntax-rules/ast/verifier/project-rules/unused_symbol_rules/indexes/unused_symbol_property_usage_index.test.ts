import { describe, expect, test } from "@jest/globals";
import { PUBLIC_FIELD_KIND } from "src/constants";
import type { UnusedFieldOwner, UnusedSymbolDefinition } from "src/core/types";
import { UnusedSymbolPropertyUsageIndex } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/unused_symbol_rules/indexes/unused_symbol_property_usage_index";
import { UnusedSymbolReferenceIndex } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/unused_symbol_rules/indexes/unused_symbol_reference_index";
import { UnusedSymbolReferenceScenario } from "tests/linting/orchestration/runtime/global-analysis/unused-symbol-reference-scenario";

describe("unused symbol property usage index", () => {
	test("checks a shared contract-field bucket once for many same-name class fields", () => {
		const class_count = 96;
		const contract_count = 80;
		let contract_owner_scans = 0;
		const contract_owners: UnusedFieldOwner[] = Array.from({ length: contract_count }, (_, index) => ({
			file: `/project/contract_${index}.ts`,
			owner: `Contract${index}`,
		}));
		const scenario = new UnusedSymbolReferenceScenario();
		const usage_store = new UnusedSymbolReferenceIndex(scenario.imported_source_scanner(), new Set(), new Map());
		const property_index = new UnusedSymbolPropertyUsageIndex(usage_store, {
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
		const scenario = new UnusedSymbolReferenceScenario();
		const usage_store = new UnusedSymbolReferenceIndex(scenario.imported_source_scanner(), new Set(), new Map());
		usage_store.record_field_usage({
			owner: { file: "/project/contract.ts", owner: "Contract" },
			name: "id",
		});
		const property_index = new UnusedSymbolPropertyUsageIndex(usage_store, {
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

	test("keeps symbol file and name components distinct", () => {
		const separator = "\u0000";
		const scenario = new UnusedSymbolReferenceScenario();
		const usage_store = new UnusedSymbolReferenceIndex(scenario.imported_source_scanner(), new Set(), new Map());
		const first = { file: "/project/a", name: `b${separator}c` };
		const second = { file: `/project/a${separator}b`, name: "c" };
		usage_store.record_symbol_usage(first);

		expect({
			first: usage_store.symbol_usage_present(first),
			second: usage_store.symbol_usage_present(second),
		}).toEqual({ first: true, second: false });
	});

	test("keeps field file, owner, and name components distinct", () => {
		const separator = "\u0000";
		const scenario = new UnusedSymbolReferenceScenario();
		const usage_store = new UnusedSymbolReferenceIndex(scenario.imported_source_scanner(), new Set(), new Map());
		const first = {
			owner: { file: "/project/a", owner: `b${separator}c` },
			name: "d",
		};
		const second = {
			owner: { file: "/project/a", owner: "b" },
			name: `c${separator}d`,
		};
		usage_store.record_field_usage(first);

		expect({ first: usage_store.field_usage_present(first), second: usage_store.field_usage_present(second) }).toEqual({
			first: true,
			second: false,
		});
	});
});
