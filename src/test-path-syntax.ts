import { TEST_FILE_SUFFIXES, TYPESCRIPT_TEST_SUFFIXES, PYTHON_TEST_SUFFIXES } from 'src/constants';

/** Responsibilities: _classification test paths language-specific_. **/
export class TestPathSyntax {
	private readonly test_file_suffixes = TEST_FILE_SUFFIXES;
	private readonly typescript_test_suffixes = TYPESCRIPT_TEST_SUFFIXES;
	private readonly python_test_suffixes = PYTHON_TEST_SUFFIXES;

	/** Responsibilities: _any test directory detection_. **/
	private any_test_directory(normalized: string): boolean {
		if (normalized.startsWith('tests/') || normalized.includes('/tests/')) {
			return true;
		}
		if (normalized.startsWith('__tests__/')) {
			return true;
		}
		return normalized.includes('/__tests__/');
	}

	/** Responsibilities: _root test directory detection_. **/
	private root_test_directory(normalized: string): boolean {
		if (normalized.startsWith('tests/')) {
			return true;
		}
		return normalized.startsWith('__tests__/');
	}

	/** Responsibilities: _Python test filename_. **/
	private standard_python_test(file_name: string): boolean {
		if (file_name.startsWith('test_') && file_name.endsWith('.py')) {
			return true;
		}
		return this.python_test_suffixes.some(suffix => file_name.endsWith(suffix));
	}

	/** Responsibilities: _reporting path belongs test_. **/
	public test_file_name(file: string): boolean {
		const normalized = file.split('\\').join('/');
		const file_name = normalized.slice(normalized.lastIndexOf('/') + 1);
		if (this.test_file_suffixes.some(suffix => normalized.endsWith(suffix))) {
			return true;
		}
		return this.standard_python_test(file_name);
	}

	/** Responsibilities: _reporting path belongs test_. **/
	public test_file(file: string, tests_directory_only = false): boolean {
		const normalized = file.split('\\').join('/');
		if (this.any_test_directory(normalized)) {
			if (tests_directory_only) {
				return this.root_test_directory(normalized);
			}
			return true;
		}
		if (tests_directory_only) {
			return false;
		}
		return this.test_file_name(normalized);
	}

	/** Responsibilities: _TypeScript test paths_. **/
	public test_ts(file: string): boolean {
		const normalized = file.split('\\').join('/');
		if (this.any_test_directory(normalized)) {
			return true;
		}
		return this.typescript_test_suffixes.some(suffix => normalized.endsWith(suffix));
	}

	/** Responsibilities: _Python test paths_. **/
	public test_py(file: string): boolean {
		const normalized = file.split('\\').join('/');
		const separator = normalized.lastIndexOf('/');
		const file_name = normalized.slice(separator + 1);
		return this.standard_python_test(file_name);
	}

}
