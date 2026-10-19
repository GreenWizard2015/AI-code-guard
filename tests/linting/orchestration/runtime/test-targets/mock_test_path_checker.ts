import type { TestPathCheckerContract } from "src/core/context/protocols";
import type { TestTargetImport } from "src/types";

/** Responsibilities: _test path fixtures_, _import target fixtures_. **/
export class MockTestPathChecker implements TestPathCheckerContract {
	private readonly directories: ReadonlySet<string>;

	/** Responsibilities: _directory fixture initialization_. **/
	public constructor(...directories: string[]) {
		this.directories = new Set(directories);
	}

	/** Responsibilities: _directory fixture lookup_. **/
	public directory(path: string): boolean {
		return this.directories.has(path);
	}

	/** Responsibilities: _file fixture lookup_. **/
	public file(path: string): boolean {
		return this.directories.has(path);
	}

	/** Responsibilities: _TypeScript import path fixtures_. **/
	public path(_file: string, specifier: string): string {
		if (specifier === "@payments/reader") {
			return "src/payments/reader.ts";
		}
		return "";
	}

	/** Responsibilities: _import declaration path fixtures_. **/
	public declaration_paths(_file: string, imports: readonly TestTargetImport[], python: boolean): string[] {
		return imports
			.map((item) => {
				if (python) {
					if (item.specifier === "os") {
						return "";
					}
					const module_path = item.specifier.replaceAll(".", "/");
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
				if (item.specifier === "@payments/reader") {
					return "src/payments/reader.ts";
				}
				if (item.specifier === "@payments/service") {
					return "src/payments/service.ts";
				}
				if (item.specifier === "@payments/reader-domain") {
					return "src/payments/reader/domain.ts";
				}
				if (item.specifier.startsWith("src/")) {
					return `${item.specifier}.ts`;
				}
				return "";
			})
			.filter((path) => path.length > 0);
	}
}
