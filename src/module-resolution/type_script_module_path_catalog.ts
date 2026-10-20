import { dirname, resolve as resolve_path } from "node:path";
import { extname } from "node:path";
import type { TypeScriptModuleResolutionContract } from "src/module-resolution/types";
import type { ProjectSourceIOContract } from "src/source_protocols";
import ts from "typescript";

/** Responsibilities: _module candidate generation_, _source file loading_. **/
export class TypeScriptModulePathCatalog {
	private readonly project_root: string;
	private readonly shared_source_files: ReadonlyMap<string, ts.SourceFile>;
	private readonly filesystem_fallback: boolean;
	private readonly loaded_source_files: Map<string, ts.SourceFile>;
	private readonly resolution: TypeScriptModuleResolutionContract;
	private readonly source_io: ProjectSourceIOContract;
	private readonly source_extensions = [".ts", ".tsx"];
	private readonly runtime_extensions: ReadonlySet<string>;

	/** Responsibilities: _disk source files_. **/
	private disk_source_file(file: string): ts.SourceFile {
		if (!this.filesystem_fallback) {
			return ts.createSourceFile(file, "", ts.ScriptTarget.Latest, true);
		}
		if (!this.source_io.source_available(file)) {
			return ts.createSourceFile(file, "", ts.ScriptTarget.Latest, true);
		}
		const cached = this.loaded_source_files.get(file);
		if (cached !== undefined) {
			return cached;
		}
		const source_file = ts.createSourceFile(file, this.source_io.source_text(file), ts.ScriptTarget.Latest, true);
		this.loaded_source_files.set(file, source_file);
		return source_file;
	}

	/** Responsibilities: _module candidate path generation_. **/
	private candidates(base: string): string[] {
		let source_base = base;
		if (base.endsWith(".js")) {
			source_base = base.slice(0, -".js".length);
		}
		if (source_base !== base) {
			return [
				...this.source_extensions.map((extension) => `${source_base}${extension}`),
				...this.source_extensions.map((extension) => resolve_path(source_base, `index${extension}`)),
				base,
			];
		}
		return [
			base,
			...this.source_extensions.map((extension) => `${base}${extension}`),
			...this.source_extensions.map((extension) => resolve_path(base, `index${extension}`)),
		];
	}

	/** Responsibilities: _module path catalog initialization_. **/
	public constructor(
		project_root: string,
		shared_source_files: ReadonlyMap<string, ts.SourceFile>,
		filesystem_fallback: boolean,
		resolution: TypeScriptModuleResolutionContract,
		source_io: ProjectSourceIOContract,
	) {
		this.project_root = project_root;
		this.shared_source_files = shared_source_files;
		this.filesystem_fallback = filesystem_fallback;
		this.loaded_source_files = new Map<string, ts.SourceFile>();
		this.resolution = resolution;
		this.source_io = source_io;
		this.runtime_extensions = new Set([".js", ".mjs", ".cjs"]);
	}

	/** Responsibilities: _module candidate resolution_. **/
	public symbol(base: string): string {
		for (const candidate of this.candidates(base)) {
			if (this.shared_source_files.has(candidate)) {
				return candidate;
			}
			if (!this.filesystem_fallback && !this.runtime_extensions.has(extname(candidate))) {
				continue;
			}
			if (this.source_io.source_available(candidate)) {
				return candidate;
			}
		}
		return "";
	}

	/** Responsibilities: _source file availability_. **/
	public source_available(file: string): boolean {
		const shared = this.shared_source_files.get(file);
		if (shared !== undefined) {
			return true;
		}
		if (!this.filesystem_fallback) {
			return false;
		}
		return this.source_io.source_available(file);
	}

	/** Responsibilities: _source files_. **/
	public source_file(file: string): ts.SourceFile {
		const shared = this.shared_source_files.get(file);
		if (shared !== undefined) {
			return shared;
		}
		return this.disk_source_file(file);
	}

	/** Responsibilities: _source policy cache identity_. **/
	public policy_key(): string {
		return this.resolution.policy_key(this.filesystem_fallback);
	}

	/** Responsibilities: _module base path generation_. **/
	public bases(file: string, module_name: string): string[] {
		if (module_name.startsWith(".")) {
			return [resolve_path(dirname(file), module_name)];
		}
		const bases = new Set([
			...this.resolution.mapped_bases(module_name),
			resolve_path(this.project_root, module_name),
			resolve_path(this.project_root, "src", module_name),
		]);
		return [...bases];
	}
}
