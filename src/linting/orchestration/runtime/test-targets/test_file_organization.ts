import { TEST_PATH_SUFFIXES } from "src/constants";
import { TEST_SCOPE_DIRECTORIES } from "src/linting/constants";
import { TestFileOrganizationPath } from "src/linting/orchestration/runtime/test-targets/test_file_organization_path";
import type { TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import type {
	TestFileOrganizationContract,
	TestFileOrganizationPathContract,
	TestPathCheckerContract,
} from "src/testing_protocols";

/** Responsibilities: _source directory lookup_, _test path session creation_. **/
export class TestFileOrganization implements TestFileOrganizationContract {
	private readonly _project_root: string;
	private readonly _path_checker: TestPathCheckerContract;
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _test_scope_directories: ReadonlySet<string>;

	/** Responsibilities: _initialization test path validation_. **/
	public constructor(project_root: string, path_checker: TestPathCheckerContract) {
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._test_scope_directories = new Set(Object.values(TEST_SCOPE_DIRECTORIES).flat());
		this._project_root = project_root;
		this._path_checker = path_checker;
	}

	/** Responsibilities: _test file path context_. **/
	public for_file(file: string): TestFileOrganizationPathContract {
		return new TestFileOrganizationPath(
			this._project_root,
			this._path_checker,
			file,
			this._test_path_syntax,
			this._test_scope_directories,
		);
	}
}
