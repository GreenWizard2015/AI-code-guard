import { TestTargetDeclarationPath } from "src/linting/orchestration/runtime/test-targets/test_target_declaration_path";
import type { TestFileOrganizationPathContract, TestTargetFileMatchContract } from "src/testing_protocols";

/** Responsibilities: _test file target matching_, _package root comparison_. **/
export class TestTargetFileMatch implements TestTargetFileMatchContract {
	private readonly _package_root: readonly string[];
	private readonly _module_root: readonly string[];
	private readonly _module_paths: readonly (readonly string[])[];

	/** Responsibilities: _nested package target matching_. **/
	private matches_package_root(): boolean {
		for (const module_path of this._module_paths) {
			if (module_path.length < this._package_root.length) {
				continue;
			}
			let matches = true;
			for (let index = 0; index < this._package_root.length; index += 1) {
				if (module_path[index] !== this._package_root[index]) {
					matches = false;
					break;
				}
			}
			if (matches) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _source module target matching_. **/
	private matches_module_root(): boolean {
		for (const module_path of this._module_paths) {
			if (module_path.length < this._module_root.length) {
				continue;
			}
			const suffix_start = module_path.length - this._module_root.length;
			let matches = true;
			for (let index = 0; index < this._module_root.length; index += 1) {
				if (module_path[suffix_start + index] !== this._module_root[index]) {
					matches = false;
					break;
				}
			}
			if (matches && this._module_root.length > 0) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _test target request initialization_. **/
	public constructor(project_root: string, declaration_path: string, test_file: TestFileOrganizationPathContract) {
		const declaration = new TestTargetDeclarationPath(project_root, declaration_path);
		this._package_root = declaration.nested_package_root();
		this._module_root = declaration.source_module_root();
		this._module_paths = test_file.module_paths();
	}

	/** Responsibilities: _test file target decision_. **/
	public matches(): boolean {
		if (this._package_root.length > 0) {
			return this.matches_package_root();
		}
		return this.matches_module_root();
	}
}
