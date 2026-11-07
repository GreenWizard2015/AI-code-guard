import { TestTargetFileMatch } from "src/linting/orchestration/runtime/test-targets/test_target_file_match";
import type { TestTargetImport } from "src/model/ast/normalized_ast_types";
import type {
	TestFileOrganizationContract,
	TestTargetImportResolverContract,
	TestTargetSourceContract,
} from "src/testing_protocols";

/** Responsibilities: _test import ownership_, _production target matching_. **/
export class TestTargetSource implements TestTargetSourceContract {
	private readonly _file: string;
	private readonly _imports: readonly TestTargetImport[];
	private readonly _python: boolean;
	private readonly _project_root: string;
	private readonly _test_file_organization: TestFileOrganizationContract;

	/** Responsibilities: _production declaration matching_. **/
	private declaration_matches(imported_target: TestTargetImport, resolver: TestTargetImportResolverContract): boolean {
		const declaration_paths = resolver.declaration_paths(this._file, [imported_target], this._python);
		if (declaration_paths.length === 0) {
			return false;
		}
		const test_file = this._test_file_organization.for_file(this._file);
		for (const declaration_path of declaration_paths) {
			const match = new TestTargetFileMatch(this._project_root, declaration_path, test_file);
			if (match.matches()) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _field initialization_. **/
	public constructor(
		file: string,
		imports: readonly TestTargetImport[],
		python: boolean,
		project_root: string,
		test_file_organization: TestFileOrganizationContract,
	) {
		this._file = file;
		this._imports = imports;
		this._python = python;
		this._project_root = project_root;
		this._test_file_organization = test_file_organization;
	}

	/** Responsibilities: _test import resolution_. **/
	public matches_target(resolver: TestTargetImportResolverContract): boolean {
		for (const imported_target of this._imports) {
			if (this.declaration_matches(imported_target, resolver)) {
				return true;
			}
		}
		return false;
	}
}
