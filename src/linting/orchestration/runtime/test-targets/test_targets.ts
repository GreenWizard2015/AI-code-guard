import { TestTargetImports } from "src/linting/orchestration/runtime/test-targets/test_target_imports";
import { TestTargetRoots } from "src/linting/orchestration/runtime/test-targets/test_target_roots";
import ts from "typescript";
import type {
	TestFileOrganizationContract,
	TestTargetImportResolverContract,
	TestTargetRootsContract,
	TestTargetsContract,
} from "src/protocols";
import { DUNDER_TESTS_DIRECTORY_NAME } from "src/constants";
import type { AstPythonImport } from "src/types";
import type { TestTargetImport } from "src/types";

/** Responsibilities: _test import matching_, _test target validation_. **/
export class TestTargets implements TestTargetsContract {
	private readonly roots: TestTargetRootsContract;
	private readonly import_resolver: TestTargetImportResolverContract;

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
	private matches_target(file: string, imports: readonly TestTargetImport[], python: boolean): boolean {
		for (const imported_target of imports) {
			const declaration_paths = this.import_resolver.declaration_paths(file, [imported_target], python);
			if (declaration_paths.length === 0) {
				continue;
			}
			for (const declaration_path of declaration_paths) {
				if (this.roots.matches_target_path(file, declaration_path)) {
					return true;
				}
			}
			return false;
		}
		return false;
	}

	/** Responsibilities: _initialization test target roots_. **/
	public constructor(
		project_root: string,
		test_file_organization: TestFileOrganizationContract,
		import_resolver: TestTargetImportResolverContract,
	) {
		this.roots = new TestTargetRoots(project_root, test_file_organization, import_resolver);
		this.import_resolver = import_resolver;
	}

	/** Responsibilities: _import target root validation_. **/
	public valid(file: string, text: string, python = false, python_imports: readonly AstPythonImport[] = []): boolean {
		const imports = this.imports(text, python, python_imports);
		if (imports.length === 0) {
			return false;
		}
		return this.matches_target(file, imports, python);
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
		return this.matches_target(file, production_imports, false);
	}
}
