import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { PYTHON_EXTERNAL_MODULES } from "src/constants";
import { PYTHON_AST_STAGE_PREFIX } from "src/core/constants";
import type { TestFileOrganizationContract, TestTargetImportResolverContract, TestTargetRootsContract } from "src/testing_protocols";

/** Responsibilities: _source root matching_, _module path resolution_. **/
export class TestTargetRoots implements TestTargetRootsContract {
	private readonly test_file_organization: TestFileOrganizationContract;
	private readonly import_resolver: TestTargetImportResolverContract;
	private readonly project_root: string;

	/** Responsibilities: _TypeScript import path_. **/
	private typescript_import_path(file: string, specifier: string): string {
		if (specifier.startsWith("src/")) {
			return specifier;
		}
		if (!specifier.startsWith(".")) {
			return "";
		}
		return normalize(join(dirname(file), specifier));
	}

	/** Responsibilities: _Python relative import path_. **/
	private python_relative_path(file: string, specifier: string): string {
		let dots = 0;
		for (const character of specifier) {
			if (character !== ".") {
				break;
			}
			dots += 1;
		}
		const module_name = specifier.slice(dots).replaceAll(".", "/");
		let directory = dirname(file);
		for (let index = 1; index < dots; index += 1) {
			directory = dirname(directory);
		}
		return normalize(join(directory, module_name));
	}

	/** Responsibilities: _Python import path_. **/
	private python_import_path(file: string, specifier: string): string {
		if (specifier.startsWith(".")) {
			return this.python_relative_path(file, specifier);
		}
		const root = specifier.split(".", 1).join("");
		if (root.length === 0) {
			return "";
		}
		if (PYTHON_EXTERNAL_MODULES.has(root)) {
			return "";
		}
		if (this.test_file_organization.source_directory(["tools", root])) {
			return join("tools", root);
		}
		if (this.test_file_organization.source_directory([root])) {
			return join("src", specifier.replaceAll(".", "/"));
		}
		return join("src", PYTHON_AST_STAGE_PREFIX, specifier.replaceAll(".", "/"));
	}

	/** Responsibilities: _import source path_. **/
	private source_path(file: string, specifier: string, python: boolean): string {
		const resolved = this.import_resolver.path(file, specifier);
		if (resolved.length > 0) {
			return resolved;
		}
		if (python) {
			return this.python_import_path(file, specifier);
		}
		return this.typescript_import_path(file, specifier);
	}

	/** Responsibilities: _source module root_. **/
	private source_module_root(file: string): string[] {
		let project_relative_file = file;
		if (isAbsolute(file)) {
			project_relative_file = relative(this.project_root, file);
		}
		const source_segments = this.source_segments(project_relative_file);
		const module_name = this.module_stem(project_relative_file);
		if (module_name.length === 0 || source_segments.length === 0) {
			return [];
		}
		if (source_segments.length === 1) {
			return [module_name];
		}
		source_segments.pop();
		return source_segments;
	}

	/** Responsibilities: _source file module stem_. **/
	private module_stem(file: string): string {
		const segments = file.replaceAll("\\", "/").split("/").filter(Boolean);
		const last_segment = segments.at(-1);
		if (last_segment === undefined) {
			return "";
		}
		return last_segment.replace(/\.(?:[cm]?[jt]sx?|py)$/, "");
	}

	/** Responsibilities: _source path segments_. **/
	private source_segments(file: string): string[] {
		const segments = file.replaceAll("\\", "/").split("/").filter(Boolean);
		const source_index = segments.indexOf("src");
		if (source_index >= 0) {
			return segments.slice(source_index + 1);
		}
		const tools_index = segments.indexOf("tools");
		if (tools_index >= 0) {
			return segments.slice(tools_index);
		}
		return segments;
	}

	/** Responsibilities: _matching source root prefix_. **/
	private matches_module_path(root: string[], module_path: string[]): boolean {
		if (module_path.length < root.length) {
			return false;
		}
		const suffix_start = module_path.length - root.length;
		for (let index = 0; index < root.length; index += 1) {
			if (module_path[suffix_start + index] !== root[index]) {
				return false;
			}
		}
		return root.length > 0;
	}

	/** Responsibilities: _common prefix length_. **/
	private common_length(shared: string[], path: string[]): number {
		let length = Math.min(shared.length, path.length);
		while (length > 0 && shared.slice(0, length).join("/") !== path.slice(0, length).join("/")) {
			length -= 1;
		}
		return length;
	}

	/** Responsibilities: _shared target prefix_. **/
	private shared_prefix(paths: string[][]): string[] {
		const shared: string[] = [];
		for (const path of paths) {
			if (shared.length === 0) {
				shared.push(...path);
				continue;
			}
			shared.splice(this.common_length(shared, path));
		}
		return shared;
	}

	/** Responsibilities: _initialization target root checker_. **/
	public constructor(
		project_root: string,
		test_file_organization: TestFileOrganizationContract,
		import_resolver: TestTargetImportResolverContract,
	) {
		this.project_root = project_root;
		this.test_file_organization = test_file_organization;
		this.import_resolver = import_resolver;
	}

	/** Responsibilities: _target common root_. **/
	public common_root(file: string, imports: string[], python: boolean, module_path: string[]): string[] {
		const paths = imports
			.map((specifier) => this.source_path(file, specifier, python))
			.map((path) => this.source_module_root(path))
			.filter((path) => this.matches_module_path(path, module_path))
			.filter((path) => path.length > 0);
		return this.shared_prefix(paths);
	}

	/** Responsibilities: _test root matching_. **/
	public matches(file: string, imports: string[], python: boolean): boolean {
		for (const module_path of this.test_file_organization.module_paths(file)) {
			const common = this.common_root(file, imports, python, module_path);
			if (common.length === 0) {
				continue;
			}
			return true;
		}
		return false;
	}

	/** Responsibilities: _test target path comparison_. **/
	public matches_target_path(file: string, declaration_path: string): boolean {
		const selected_target = this.source_module_root(declaration_path);
		if (selected_target.length === 0) {
			return false;
		}
		for (const module_path of this.test_file_organization.module_paths(file)) {
			if (this.matches_module_path(selected_target, module_path)) {
				return true;
			}
		}
		return false;
	}
}
