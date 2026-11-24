import { TestTargetFileMatch } from "src/linting/orchestration/runtime/test-targets/paths/test_target_file_match";
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
	public matching_target_paths(resolver: TestTargetImportResolverContract): string[] {
		const matching_paths = new Set<string>();
		for (const imported_target of this._imports) {
			for (const declaration_path of resolver.declaration_paths(this._file, [imported_target], this._python)) {
				const test_file = this._test_file_organization.for_file(this._file);
				const match = new TestTargetFileMatch(this._project_root, declaration_path, test_file);
				if (match.matches()) {
					matching_paths.add(declaration_path);
				}
			}
		}
		const ordered_paths = Array.from(matching_paths);
		ordered_paths.sort();
		return ordered_paths;
	}

	/** Responsibilities: _test target match result_. **/
	public matches_target(resolver: TestTargetImportResolverContract): boolean {
		return this.matching_target_paths(resolver).length > 0;
	}
}
