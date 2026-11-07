import type { TestTargetImport } from "src/model/ast/normalized_ast_types";
import type { TestPathCheckerContract } from "src/testing_protocols";

/** Responsibilities: _test path fixtures_, _import target fixtures_. **/
export class MockTestPathChecker implements TestPathCheckerContract {
	private readonly _directories: ReadonlySet<string>;

	/** Responsibilities: _import path mapping_. **/
	private declaration_path(specifier: string, python: boolean): string {
		if (specifier === "src/scripts/webpage/chatgpt/core/opener") {
			return "scripts/webpage/src/chatgpt/core/opener.ts";
		}
		if (python) {
			return this.python_declaration_path(specifier);
		}
		return this.typescript_declaration_path(specifier);
	}

	/** Responsibilities: _Python import path mapping_. **/
	private python_declaration_path(specifier: string): string {
		if (specifier === "os") {
			return "";
		}
		const module_path = specifier.replaceAll(".", "/");
		const is_entrypoint = module_path === "python_bridge_entrypoint";
		const is_implementation = module_path.startsWith("implementation/");
		if (is_entrypoint || is_implementation) {
			return `src/python-bridge/${module_path}.py`;
		}
		if (module_path.startsWith("performance/")) {
			return `${module_path}.py`;
		}
		return `src/${module_path}.py`;
	}

	/** Responsibilities: _TypeScript import path mapping_. **/
	private typescript_declaration_path(specifier: string): string {
		if (specifier === "@payments/reader") {
			return "src/payments/reader.ts";
		}
		if (specifier === "@payments/service") {
			return "src/payments/service.ts";
		}
		if (specifier === "@payments/reader-domain") {
			return "src/payments/reader/domain.ts";
		}
		if (specifier.startsWith("src/")) {
			return `${specifier}.ts`;
		}
		return "";
	}

	/** Responsibilities: _directory fixture initialization_. **/
	public constructor(...directories: string[]) {
		this._directories = new Set(directories);
	}

	/** Responsibilities: _directory fixture lookup_. **/
	public directory(path: string): boolean {
		return this._directories.has(path);
	}

	/** Responsibilities: _file fixture lookup_. **/
	public file(path: string): boolean {
		return this._directories.has(path);
	}

	/** Responsibilities: _TypeScript import path mapping_. **/
	public path(_file: string, specifier: string): string {
		if (specifier === "src/scripts/webpage/chatgpt/core/opener") {
			return "scripts/webpage/src/chatgpt/core/opener.ts";
		}
		if (specifier === "@payments/reader") {
			return "src/payments/reader.ts";
		}
		return "";
	}

	/** Responsibilities: _import declarations mapping_. **/
	public declaration_paths(_file: string, imports: readonly TestTargetImport[], python: boolean): string[] {
		const paths: string[] = [];
		for (const item of imports) {
			const path = this.declaration_path(item.specifier, python);
			if (path.length > 0) {
				paths.push(path);
			}
		}
		return paths;
	}
}
