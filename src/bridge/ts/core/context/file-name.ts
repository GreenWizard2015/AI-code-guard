/** Responsibilities: _classification lint paths tests_. **/
export class LintFileName {
	public readonly value: string;
	public readonly is_functions_file: boolean;

	/** Responsibilities: _classification file inside tests_. **/
	private is_tests_directory(): boolean {
		if (this.value.startsWith('tests/')) {
			return true;
		}
		if (this.value.includes('/tests/')) {
			return true;
		}
		return false;
	}

	/** Responsibilities: _file-name suffix classification_. **/
	private is_test_suffix(): boolean {
		if (this.value.endsWith('.test.ts')) {
			return true;
		}
		if (this.value.endsWith('.test.tsx')) {
			return true;
		}
		return this.value.endsWith('_test.py');
	}

	/** Responsibilities: _initialization normalization file path_. **/
	public constructor(file: string) {
		this.value = file.split('\\').join('/');
		this.is_functions_file =
			this.value === 'functions.ts' ||
			this.value === 'functions.tsx' ||
			this.value === 'functions.py';
	}

	/** Responsibilities: _reporting file test file_. **/
	public test(): boolean {
		if (this.is_tests_directory()) {
			return true;
		}
		return this.is_test_suffix();
	}

	/** Responsibilities: _reporting file production source_. **/
	public product(): boolean {
		if (this.is_tests_directory()) {
			return false;
		}
		return !this.is_test_suffix();
	}

	/** Responsibilities: _reporting file Python test_. **/
	public test_py(): boolean {
		if (!this.is_tests_directory()) {
			return false;
		}
		return this.value.endsWith('_test.py');
	}
}
