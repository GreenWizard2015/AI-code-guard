import { TestTargetImports } from 'src/bridge/ts/runner/orchestration/runtime/test-targets/test-target-imports';
import { TestTargetRoots } from 'src/bridge/ts/runner/orchestration/runtime/test-targets/test-target-roots';
import type { TestFileOrganizationProtocol } from 'src/protocols';

/** Responsibilities: _test target validation_. **/
export class TestTargets {
	private readonly roots: TestTargetRoots;

	/** Responsibilities: _test module import detection_. **/
	private test_import(specifier: string): boolean {
		const segments = specifier.replaceAll('\\', '/').split('/').filter(Boolean);
		for (const segment of segments) {
			if (segment === 'tests' || segment === '__tests__') {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _initialization target validation_. **/
	public constructor(test_file_organization: TestFileOrganizationProtocol) {
		this.roots = new TestTargetRoots(test_file_organization);
	}

	/** Responsibilities: _production import collection_. **/
	public imports(text: string, python = false): string[] {
		const imports = new TestTargetImports(text);
		let specifiers: string[];
		if (python) {
			specifiers = imports.python();
		} else {
			specifiers = imports.typescript();
		}
		return specifiers.filter((specifier) => !this.test_import(specifier));
	}

	/** Responsibilities: _import target root validation_. **/
	public valid(file: string, text: string, python = false): boolean {
		const imports = this.imports(text, python);
		if (imports.length === 0) {
			return false;
		}
		return this.roots.matches(file, imports, python);
	}
}
