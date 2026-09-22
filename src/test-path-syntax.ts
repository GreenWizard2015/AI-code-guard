import { TEST_FILE_SUFFIXES, TYPESCRIPT_TEST_SUFFIXES, PYTHON_TEST_SUFFIXES } from 'src/constants';

/** Responsibilities: _classification test paths language-specific_. **/
export class TestPathSyntax {
	private readonly test_file_suffixes = TEST_FILE_SUFFIXES;
	private readonly typescript_test_suffixes = TYPESCRIPT_TEST_SUFFIXES;
	private readonly python_test_suffixes = PYTHON_TEST_SUFFIXES;

	/** Responsibilities: _classification character terminates class_. **/
	private header_end(character: string): boolean {
		if (character === ':' || character === '(') {
			return true;
		}
		return character === ' ' || character === '\t';
	}

	/** Responsibilities: _calculation indentation width source_. **/
	public indentation(line: string): number {
		let index = 0;
		while (index < line.length) {
			if (line[index] !== ' ' && line[index] !== '\t') {
				break;
			}
			index += 1;
		}
		return index;
	}

	/** Responsibilities: _reporting path belongs test_. **/
	public test_file(file: string, tests_directory_only = false): boolean {
		const normalized = file.split('\\').join('/');
		if (normalized.startsWith('tests/') || normalized.includes('/tests/')) {
			return true;
		}
		if (tests_directory_only) {
			return false;
		}
		return this.test_file_suffixes.some(suffix => normalized.endsWith(suffix));
	}

	/** Responsibilities: _reporting path TypeScript test_. **/
	public test_ts(file: string): boolean {
		const normalized = file.split('\\').join('/');
		if (normalized.startsWith('tests/') || normalized.includes('/tests/')) {
			return true;
		}
		return this.typescript_test_suffixes.some(suffix => normalized.endsWith(suffix));
	}

	/** Responsibilities: _reporting path Python test_. **/
	public test_py(file: string): boolean {
		const normalized = file.split('\\').join('/');
		const separator = normalized.lastIndexOf('/');
		const file_name = normalized.slice(separator + 1);
		if (normalized.startsWith('tests/')) {
			if (file_name.startsWith('test_')) {
				return true;
			}
			if (file_name.endsWith('_test.py')) {
				return true;
			}
			return file_name.endsWith('.test.py');
		}
		if (normalized.includes('/tests/')) {
			return this.python_test_suffixes.some(suffix => normalized.endsWith(suffix));
		}
		return normalized.endsWith('.test.py');
	}

	/** Responsibilities: _reporting source line starts_. **/
	public class_header(line: string): boolean {
		const code = line.slice(this.indentation(line));
		if (!code.startsWith('class ')) {
			return false;
		}
		const name = code.slice(6);
		const end = [...name].findIndex(character => this.header_end(character));
		let class_name = name;
		if (end >= 0) {
			class_name = name.slice(0, end);
		}
		return class_name.length > 0;
	}

}
