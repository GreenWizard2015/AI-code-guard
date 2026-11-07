import { DUNDER_TESTS_DIRECTORY_NAME } from "src/constants";
import { TestTargetImports } from "src/linting/orchestration/runtime/test-targets/test_target_imports";
import { TestTargetSource } from "src/linting/orchestration/runtime/test-targets/test_target_source";
import type { AstPythonImport, TestTargetImport } from "src/model/ast/normalized_ast_types";
import type { LintSourceRecordData } from "src/source_types";
import type {
	TestFileOrganizationContract,
	TestTargetImportResolverContract,
	TestTargetsContract,
} from "src/testing_protocols";
import ts from "typescript";

/** Responsibilities: _test import matching_, _test target validation_. **/
export class TestTargets implements TestTargetsContract {
	private readonly _project_root: string;
	private readonly _test_file_organization: TestFileOrganizationContract;
	private readonly _import_resolver: TestTargetImportResolverContract;

	/** Responsibilities: _test module import detection_. **/
	private test_import(specifier: string): boolean {
		const segments = specifier.replaceAll("\\", "/").split(/[/.]/).filter(Boolean);
		for (const segment of segments) {
			if (segment === "tests" || segment === DUNDER_TESTS_DIRECTORY_NAME) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _production import collection_. **/
	private imports(text: string, python: boolean, python_imports: readonly AstPythonImport[]): TestTargetImport[] {
		const parser = new TestTargetImports();
		let imports = parser.python(python_imports, text);
		if (!python) {
			const source = ts.createSourceFile("test.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
			imports = parser.typescript(source);
		}
		return imports
			.filter((item) => !this.test_import(item.specifier))
			.sort((left, right) => right.usage_count - left.usage_count);
	}

	/** Responsibilities: _production declaration matching_. **/
	/** Responsibilities: _initialization test target roots_. **/
	public constructor(
		project_root: string,
		test_file_organization: TestFileOrganizationContract,
		import_resolver: TestTargetImportResolverContract,
	) {
		this._project_root = project_root;
		this._test_file_organization = test_file_organization;
		this._import_resolver = import_resolver;
	}

	/** Responsibilities: _import target root validation_. **/
	public valid(file: string, text: string, python = false, python_imports: readonly AstPythonImport[] = []): boolean {
		const imports = this.imports(text, python, python_imports);
		if (imports.length === 0) {
			return false;
		}
		const test_source = new TestTargetSource(file, imports, python, this._project_root, this._test_file_organization);
		return test_source.matches_target(this._import_resolver);
	}

	/** Responsibilities: _TypeScript target validation_. **/
	public valid_typescript(file: string, source_file: ts.SourceFile): boolean {
		const import_parser = new TestTargetImports();
		const imports = import_parser.typescript(source_file);
		const production_imports = imports
			.filter((item) => !this.test_import(item.specifier))
			.sort((left, right) => right.usage_count - left.usage_count);
		if (production_imports.length === 0) {
			return false;
		}
		const test_source = new TestTargetSource(
			file,
			production_imports,
			false,
			this._project_root,
			this._test_file_organization,
		);
		return test_source.matches_target(this._import_resolver);
	}

	/** Responsibilities: _source-record target validation_. **/
	public valid_source(source: LintSourceRecordData): boolean {
		if (source.language === "python") {
			const imports = source.normalized_ast.source.python_imports;
			return this.valid(source.relative_path, source.text, true, imports);
		}
		return this.valid_typescript(source.relative_path, source.typescript_ast.source_file_node());
	}
}
