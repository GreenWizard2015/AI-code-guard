import { describe, expect, test } from "@jest/globals";
import { TypeScriptReexportGraph } from "src/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport/type_script_reexport_graph";
import { TypeScriptReexportTestFixture } from "tests/linting/orchestration/runtime/global-analysis/unused-symbol-ownership/type_script_reexport_test_fixture";

describe("TypeScript re-export resolution", () => {
	test("indexes local imports once for referenced names", () => {
		const count = 64;
		const importer = "/project/consumer.ts";
		const dependency = "/project/dependency.ts";
		const routes = new Map<string, string>([[`${importer}\u0000./dependency`, dependency]]);
		const fixture = new TypeScriptReexportTestFixture(routes);
		const names = Array.from({ length: count }, (_, index) => `Exported${index}`);
		const sources = fixture.source_records(
			new Map([
				[
					importer,
					names.map((name, index) => `import type { ${name} as local_${index} } from "./dependency";`).join("\n"),
				],
				[dependency, names.map((name) => `export type ${name} = string;`).join("\n")],
			]),
		);
		const definitions = new Map([[dependency, fixture.type_definitions(dependency, names)]]);
		const graph = new TypeScriptReexportGraph(fixture, new Set(sources.keys()), sources, definitions);
		const found = names.map((_name, index) => graph.resolve_import(importer, `local_${index}`).length);
		const missing = names.map((_name, index) => graph.resolve_import(importer, `missing_${index}`).length);
		expect({ found, missing, lookups: fixture.resolved_path_count() }).toEqual({
			found: Array.from({ length: count }, () => 1),
			missing: Array.from({ length: count }, () => 0),
			lookups: count,
		});
	});

	test("traverses one shared re-export for many importers", () => {
		const count = 48;
		const barrel = "/project/barrel.ts";
		const dependency = "/project/dependency.ts";
		const importers = Array.from({ length: count }, (_, index) => `/project/consumer_${index}.ts`);
		const routes = new Map([
			...importers.map((file) => [`${file}\u0000./barrel`, barrel] as const),
			[`${barrel}\u0000./dependency`, dependency] as const,
		]);
		const fixture = new TypeScriptReexportTestFixture(routes);
		const sources = fixture.source_records(
			new Map([
				...importers.map((file) => [file, 'import type { Shape as LocalShape } from "./barrel";'] as const),
				[barrel, 'export * from "./dependency";'],
				[dependency, "export type Shape = { value: string };"],
			]),
		);
		const definitions = new Map([[dependency, fixture.type_definitions(dependency, ["Shape"])]]);
		const graph = new TypeScriptReexportGraph(fixture, new Set(sources.keys()), sources, definitions);
		const results = importers.map((file) => graph.resolve_import(file, "LocalShape").map((item) => item.name));
		expect({ results, lookups: fixture.resolved_path_count() }).toEqual({
			results: Array.from({ length: count }, () => ["Shape"]),
			lookups: count + 1,
		});
	});

	test("invalidates misses when a source is registered", () => {
		const importer = "/project/consumer.ts";
		const dependency = "/project/dependency.ts";
		const routes = new Map<string, string>([[`${importer}\u0000./dependency`, dependency]]);
		const fixture = new TypeScriptReexportTestFixture(routes);
		const sources = fixture.source_records(new Map([[importer, 'import type { Shape } from "./dependency";']]));
		const available = new Set(sources.keys());
		const definitions = new Map([[dependency, fixture.type_definitions(dependency, ["Shape"])]]);
		const graph = new TypeScriptReexportGraph(fixture, available, sources, definitions);
		const before = graph.resolve_import(importer, "Shape");
		sources.set(dependency, fixture.source_record(dependency, "export type Shape = string;"));
		available.add(dependency);
		graph.invalidate();
		const after = graph.resolve_import(importer, "Shape").map((item) => item.name);
		expect({ before, after }).toEqual({ before: [], after: ["Shape"] });
	});
});
