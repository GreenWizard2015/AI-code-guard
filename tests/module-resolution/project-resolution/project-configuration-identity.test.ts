import { join } from "node:path";
import { describe, expect, test } from "@jest/globals";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptProjectResolution } from "src/module-resolution/project-resolution/type_script_project_resolution";
import ts from "typescript";

describe("TypeScript project configuration identity", () => {
	/** Responsibilities: _source AST construction_. **/
	const create_source_files = (source_io: InMemoryProjectSourceIO, paths: string[]): Map<string, ts.SourceFile> =>
		new Map(
			paths.map((file) => [file, ts.createSourceFile(file, source_io.source_text(file), ts.ScriptTarget.Latest, true)]),
		);

	/** Responsibilities: _compiler module resolution_. **/
	const resolve_compiler_target = (
		root: string,
		source_io: InMemoryProjectSourceIO,
		config_file: string,
		consumer_file: string,
		specifier: string,
	): string => {
		const config = ts.readConfigFile(config_file, (file) => source_io.source_text(file));
		const host: ts.ParseConfigHost = {
			useCaseSensitiveFileNames: true,
			readDirectory: () => [],
			fileExists: (file) => source_io.source_available(file),
			readFile: (file) => source_io.source_text(file),
		};
		const options = ts.parseJsonConfigFileContent(config.config, host, root, undefined, config_file).options;
		const compiler_host: ts.ModuleResolutionHost = {
			fileExists: (file) => source_io.source_available(file),
			readFile: (file) => source_io.source_text(file),
		};
		const resolved = ts.resolveModuleName(specifier, consumer_file, options, compiler_host).resolvedModule;
		if (resolved === undefined) {
			return "";
		}
		return resolved.resolvedFileName;
	};

	test("resolves package import targets from the package manifest despite baseUrl", () => {
		const root = "/p";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "tsconfig.json"), '{"compilerOptions":{"baseUrl":"./src","paths":{"@types/*":["./types/*"]}}}'],
				[join(root, "package.json"), '{"imports":{"#worker":"./lib/worker.ts"}}'],
			]),
		);
		const project_resolution = new TypeScriptProjectResolution(root, source_io);
		const resolution = project_resolution.resolution();

		const resolved_targets = {
			package_target: resolution.non_relative_bases("#worker"),
			compiler_target: resolution.non_relative_bases("@types/task"),
		};
		expect(resolved_targets).toEqual({
			package_target: [join(root, "lib/worker.ts"), join(root, "src/#worker")],
			compiler_target: [join(root, "src/types/task"), join(root, "src/@types/task")],
		});
	});

	test("resolves bare imports from baseUrl ahead of root and src decoys", () => {
		const root = "/virtual/custom-base-url-project";
		const config_file = join(root, "tsconfig.json");
		const consumer_file = join(root, "main.ts");
		const configured_target = join(root, "lib", "worker.ts");
		const root_decoy = join(root, "worker.ts");
		const source_decoy = join(root, "src", "worker.ts");
		const source_texts = new Map([
			[config_file, '{"compilerOptions":{"baseUrl":"./lib"}}'],
			[consumer_file, 'import { run } from "worker"; export const result = run();'],
			[configured_target, "export function run(): string { return 'configured'; }"],
			[root_decoy, "export function run(): string { return 'root decoy'; }"],
			[source_decoy, "export function run(): string { return 'src decoy'; }"],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const compiler_target = resolve_compiler_target(root, source_io, config_file, consumer_file, "worker");
		const source_sources = create_source_files(source_io, [consumer_file, configured_target, root_decoy, source_decoy]);
		const exports_context = new TypeScriptModuleExportsContext(root, source_sources, false, source_io);
		const guard_target = exports_context.module_exports().module_symbol(consumer_file, "worker");

		expect({ compiler_target, guard_target }).toEqual({
			compiler_target: configured_target,
			guard_target: configured_target,
		});
	});

	test("does not select inactive package conditions and honors configured browser conditions", () => {
		const root = "/virtual/package-import-conditions-project";
		const package_manifest = '{"imports":{"#worker":{"browser":"./browser.ts","default":"./server.ts"}}}';
		const server_sources = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "tsconfig.json"), '{"compilerOptions":{"moduleResolution":"Bundler"}}'],
				[join(root, "package.json"), package_manifest],
			]),
		);
		const server_project = new TypeScriptProjectResolution(root, server_sources);
		const server_resolution = server_project.resolution();
		const server_target = server_resolution.non_relative_bases("#worker");
		const browser_sources = new InMemoryProjectSourceIO(
			new Map([
				[
					join(root, "tsconfig.json"),
					'{"compilerOptions":{"moduleResolution":"Bundler","customConditions":["browser"]}}',
				],
				[join(root, "package.json"), package_manifest],
			]),
		);
		const browser_project = new TypeScriptProjectResolution(root, browser_sources);
		const browser_resolution = browser_project.resolution();
		const browser_target = browser_resolution.non_relative_bases("#worker");

		expect({ server_target, browser_target }).toEqual({
			server_target: [join(root, "server.ts"), join(root, "#worker")],
			browser_target: [join(root, "browser.ts"), join(root, "#worker")],
		});
	});

	test("selects package import and require branches independently", () => {
		const root = "/virtual/package-import-mode-project";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "tsconfig.json"), '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}'],
				[
					join(root, "package.json"),
					'{"imports":{"#worker":{"import":"./worker-esm.ts","require":"./worker-cjs.ts","default":"./worker-default.ts"}}}',
				],
			]),
		);
		const project = new TypeScriptProjectResolution(root, source_io);
		const import_resolution = project.resolution("import");
		const require_resolution = project.resolution("require");

		const resolved_targets = {
			import_target: import_resolution.non_relative_bases("#worker"),
			require_target: require_resolution.non_relative_bases("#worker"),
		};
		expect(resolved_targets).toEqual({
			import_target: [join(root, "worker-esm.ts"), join(root, "#worker")],
			require_target: [join(root, "worker-cjs.ts"), join(root, "#worker")],
		});
	});

	test("preserves package import array fallback order", () => {
		const root = "/virtual/package-import-array-fallback-project";
		const source_io = new InMemoryProjectSourceIO(
			new Map([
				[join(root, "tsconfig.json"), '{"compilerOptions":{"moduleResolution":"Bundler"}}'],
				[join(root, "package.json"), '{"imports":{"#worker":["./preferred.ts","./fallback.ts"]}}'],
			]),
		);
		const project = new TypeScriptProjectResolution(root, source_io);
		const resolution = project.resolution();

		expect(resolution.non_relative_bases("#worker")).toEqual([
			join(root, "preferred.ts"),
			join(root, "fallback.ts"),
			join(root, "#worker"),
		]);
	});

	test("tracks every configuration in an extends array", () => {
		const root = "/virtual/typescript-array-extends-project";
		const source_texts = new Map([
			[join(root, "tsconfig.json"), '{"extends":["./base.json"]}'],
			[join(root, "base.json"), '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["first/*"]}}}'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const before = new TypeScriptProjectResolution(root, source_io);
		const identity_before = before.configuration_identity();
		const mapping_before = before.resolution().non_relative_bases("alias/value");
		source_texts.set(join(root, "base.json"), '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}');
		const after = new TypeScriptProjectResolution(root, source_io);
		const changed = {
			identity_changed: after.configuration_identity() !== identity_before,
			mapping_changed: after.resolution().non_relative_bases("alias/value").join() !== mapping_before.join(),
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
		const mapping_before = before.resolution().non_relative_bases("alias/value");
		source_texts.set(inherited_config, '{"compilerOptions":{"baseUrl":".","paths":{"alias/*":["second/*"]}}}');
		const after = new TypeScriptProjectResolution(root, source_io);
		const changed = {
			identity_changed: after.configuration_identity() !== identity_before,
			mapping_changed: after.resolution().non_relative_bases("alias/value").join() !== mapping_before.join(),
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
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const compiler_target = resolve_compiler_target(root, source_io, config_file, consumer_file, "@worker");
		const source_sources = create_source_files(source_io, [consumer_file, inherited_target, root_decoy]);
		const exports_context = new TypeScriptModuleExportsContext(root, source_sources, false, source_io);
		const module_exports = exports_context.module_exports();
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
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const compiler_target = resolve_compiler_target(root, source_io, config_file, consumer_file, "@app/special/task");
		const source_sources = create_source_files(source_io, [consumer_file, broad_target, specific_target]);
		const exports_context = new TypeScriptModuleExportsContext(root, source_sources, false, source_io);
		const module_exports = exports_context.module_exports();
		const guard_target = module_exports.module_symbol(consumer_file, "@app/special/task");

		expect({ compiler_target, guard_target }).toEqual({
			compiler_target: specific_target,
			guard_target: specific_target,
		});
	});
});
