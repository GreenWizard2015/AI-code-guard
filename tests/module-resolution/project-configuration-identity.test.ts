import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { TypeScriptProjectResolution } from "src/module-resolution/type_script_project_resolution";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExports } from "src/module-resolution/type_script_module_exports";
import ts from "typescript";

/** Responsibilities: _in-memory configuration sources_, _compiler resolution comparison_. **/
class ProjectConfigurationScenario {
	private readonly root: string;
	public readonly source_io: InMemoryProjectSourceIO;

	/** Responsibilities: _project fixture initialization_. **/
	public constructor(root: string, source_texts: Map<string, string>) {
		this.root = root;
		this.source_io = new InMemoryProjectSourceIO(source_texts);
	}

	/** Responsibilities: _source AST construction_. **/
	public source_files(paths: string[]): Map<string, ts.SourceFile> {
		return new Map(
			paths.map((file) => [
				file,
				ts.createSourceFile(file, this.source_io.source_text(file), ts.ScriptTarget.Latest, true),
			]),
		);
	}

	/** Responsibilities: _compiler module resolution_. **/
	public compiler_target(config_file: string, consumer_file: string, specifier: string): string {
		const config = ts.readConfigFile(config_file, (file) => this.source_io.source_text(file));
		const host: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: true,
			readDirectory: () => [],
			fileExists: (file) => this.source_io.source_available(file),
			readFile: (file) => this.source_io.source_text(file),
		};
		const options = ts.parseJsonConfigFileContent(config.config, host, this.root, undefined, config_file).options;
		const compiler_host: ts.ModuleResolutionHost = {
			fileExists: (file) => this.source_io.source_available(file),
			readFile: (file) => this.source_io.source_text(file),
		};
		const resolved = ts.resolveModuleName(specifier, consumer_file, options, compiler_host).resolvedModule;
		if (resolved === undefined) {
			return "";
		}
		return resolved.resolvedFileName;
	}
}

describe("TypeScript project configuration identity", () => {
	test("tracks every configuration in an extends array", () => {
		const root = "/virtual/typescript-array-extends-project";
		const source_texts = new Map([
			[join(root, "tsconfig.json"), '{"extends":["./base.json"]}'],
			[join(root, "base.json"), '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["first/*"]}}}'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const before = new TypeScriptProjectResolution(root, source_io);
		const identity_before = before.configuration_identity();
		const mapping_before = before.resolution().mapped_bases("alias/value");
		source_texts.set(join(root, "base.json"), '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}');
		const after = new TypeScriptProjectResolution(root, source_io);
		const changed = {
			identity_changed: after.configuration_identity() !== identity_before,
			mapping_changed: after.resolution().mapped_bases("alias/value").join() !== mapping_before.join(),
		};

		expect(changed).toEqual({ identity_changed: true, mapping_changed: true });
	});

	test("tracks package-resolved inherited configurations", () => {
		const root = "/virtual/typescript-package-extends-project";
		const inherited_config = join(root, "node_modules/base-config/tsconfig.json");
		const source_texts = new Map([
			[join(root, "tsconfig.json"), '{"extends":"base-config"}'],
			[inherited_config, '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["first/*"]}}}'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const before = new TypeScriptProjectResolution(root, source_io);
		const identity_before = before.configuration_identity();
		const mapping_before = before.resolution().mapped_bases("alias/value");
		source_texts.set(inherited_config, '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}');
		const after = new TypeScriptProjectResolution(root, source_io);
		const changed = {
			identity_changed: after.configuration_identity() !== identity_before,
			mapping_changed: after.resolution().mapped_bases("alias/value").join() !== mapping_before.join(),
		};

		expect(changed).toEqual({ identity_changed: true, mapping_changed: true });
	});

	test("resolves inherited paths relative to the config that declared them", () => {
		const root = "/virtual/inherited-path-origin-project";
		const config_file = join(root, "tsconfig.json");
		const inherited_file = join(root, "config", "base.json");
		const consumer_file = join(root, "main.ts");
		const inherited_target = join(root, "config", "worker.ts");
		const root_decoy = join(root, "worker.ts");
		const source_texts = new Map([
			[config_file, '{"extends":"./config/base.json"}'],
			[inherited_file, '{"compilerOptions":{"paths":{"@worker":["./worker.ts"]}}}'],
			[consumer_file, 'import { run } from "@worker"; export const result = run();'],
			[inherited_target, "export function run(): string { return 'actual'; }"],
			[root_decoy, "export function run(): string { return 'decoy'; }"],
		]);
		const scenario = new ProjectConfigurationScenario(root, source_texts);
		const compiler_target = scenario.compiler_target(config_file, consumer_file, "@worker");
		const source_files = scenario.source_files([consumer_file, inherited_target, root_decoy]);
		const module_exports = new TypeScriptModuleExports(root, source_files, false, scenario.source_io);
		const guard_target = module_exports.module_symbol(consumer_file, "@worker");

		expect({ compiler_target, guard_target }).toEqual({
			compiler_target: inherited_target,
			guard_target: inherited_target,
		});
	});

	test("selects only the compiler-matching longest path mapping", () => {
		const root = "/virtual/overlapping-path-mapping-project";
		const config_file = join(root, "tsconfig.json");
		const consumer_file = join(root, "main.ts");
		const broad_target = join(root, "general", "special", "task.ts");
		const specific_target = join(root, "special", "task.ts");
		const source_texts = new Map([
			[
				config_file,
				'{"compilerOptions":{"baseUrl":".","paths":{"@app/*":["general/*"],"@app/special/*":["special/*"]}}}',
			],
			[consumer_file, 'import { run } from "@app/special/task"; export const result = run();'],
			[broad_target, "export function run(): string { return 'broad'; }"],
			[specific_target, "export function run(): string { return 'specific'; }"],
		]);
		const scenario = new ProjectConfigurationScenario(root, source_texts);
		const compiler_target = scenario.compiler_target(config_file, consumer_file, "@app/special/task");
		const source_files = scenario.source_files([consumer_file, broad_target, specific_target]);
		const module_exports = new TypeScriptModuleExports(root, source_files, false, scenario.source_io);
		const guard_target = module_exports.module_symbol(consumer_file, "@app/special/task");

		expect({ compiler_target, guard_target }).toEqual({
			compiler_target: specific_target,
			guard_target: specific_target,
		});
	});
});
