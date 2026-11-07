import { dirname, resolve as resolve_path } from "node:path";
import { extname } from "node:path";
import { TypeScriptModuleSource } from "src/module-resolution/path-resolution/type_script_module_source";
import type {
	TypeScriptModulePathCatalogContract,
	TypeScriptModuleSourceContract,
} from "src/module-resolution/protocols";
import type { TypeScriptModuleResolutionContract } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import type ts from "typescript";

/** Responsibilities: _module candidate generation_, _source file loading_. **/
export class TypeScriptModulePathCatalog implements TypeScriptModulePathCatalogContract {
	private readonly _project_root: string;
	private readonly _runtime_source_extensions: Map<string, readonly string[]>;
	private readonly _source_extensions: readonly string[];
	private readonly _runtime_extensions: ReadonlySet<string>;
	private readonly _shared_source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly _filesystem_fallback: boolean;
	private readonly _loaded_source_files: Map<string, ts.SourceFile>;
	private readonly _module_sources: Map<string, TypeScriptModuleSourceContract>;
	private readonly _resolution: TypeScriptModuleResolutionContract;
	private readonly _source_io: ProjectSourceIOContract;

	/** Responsibilities: _module candidate path generation_. **/
	private candidates(base: string): string[] {
		const runtime_extension = extname(base);
		const source_extensions = this._runtime_source_extensions.get(runtime_extension);
		if (source_extensions !== undefined) {
			const source_base = base.slice(0, -runtime_extension.length);
			return [
				...source_extensions.map((extension) => `${source_base}${extension}`),
				...source_extensions.map((extension) => resolve_path(source_base, `index${extension}`)),
				base,
			];
		}
		return [
			base,
			...this._source_extensions.map((extension) => `${base}${extension}`),
			...this._source_extensions.map((extension) => resolve_path(base, `index${extension}`)),
		];
	}

	/** Responsibilities: _module candidate availability_. **/
	private candidate_available(candidate: string): boolean {
		if (this._shared_source_files.has(candidate)) {
			return true;
		}
		const runtime_module = this._runtime_extensions.has(extname(candidate));
		if (!this._filesystem_fallback && !runtime_module) {
			return false;
		}
		if (runtime_module) {
			if (this._source_io.source_available(candidate)) {
				return true;
			}
		}
		return this.source(candidate).available();
	}

	/** Responsibilities: _module path catalog initialization_. **/
	public constructor(
		project_root: string,
		shared_source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		resolution: TypeScriptModuleResolutionContract,
		source_io: ProjectSourceIOContract,
	) {
		this._project_root = project_root;
		this._runtime_source_extensions = new Map<string, readonly string[]>([
			[".js", [".ts", ".tsx", ".d.ts"]],
			[".mjs", [".mts", ".d.mts"]],
			[".cjs", [".cts", ".d.cts"]],
		]);
		this._source_extensions = [".ts", ".tsx", ".mts", ".cts"];
		this._runtime_extensions = new Set([".js", ".mjs", ".cjs"]);
		this._shared_source_files = shared_source_files;
		this._filesystem_fallback = filesystem_fallback;
		this._loaded_source_files = new Map<string, ts.SourceFile>();
		this._module_sources = new Map<string, TypeScriptModuleSourceContract>();
		this._resolution = resolution;
		this._source_io = source_io;
	}

	/** Responsibilities: _module source access_. **/
	public source(file: string): TypeScriptModuleSourceContract {
		const cached = this._module_sources.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const source = new TypeScriptModuleSource({
			file,
			runtime_module: this._runtime_extensions.has(extname(file)),
			shared_source_files: this._shared_source_files,
			filesystem_fallback: this._filesystem_fallback,
			loaded_source_files: this._loaded_source_files,
			source_io: this._source_io,
		});
		this._module_sources.set(file, source);
		return source;
	}

	/** Responsibilities: _module candidate resolution_. **/
	public symbol(base: string): string {
		for (const candidate of this.candidates(base)) {
			if (this.candidate_available(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _source policy cache identity_. **/
	public policy_key(): string {
		return this._resolution.policy_key(this._filesystem_fallback);
	}

	/** Responsibilities: _module base path generation_. **/
	public bases(importer_file: string, module_name: string): string[] {
		if (module_name.startsWith(".")) {
			return [resolve_path(dirname(importer_file), module_name)];
		}
		return [...this._resolution.non_relative_bases(module_name), resolve_path(this._project_root, "src", module_name)];
	}
}
