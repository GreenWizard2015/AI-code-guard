import { ClassRules } from 'src/bridge/ts/rules/class-rules';
import { Declarations } from 'src/bridge/ts/runner/orchestration/runtime/python/declarations';
import { DirectoryCommentSegments } from 'src/bridge/ts/core/support/directory-comment-segments';
import { ImportsRules } from 'src/bridge/ts/rules/imports-rules';
import { MixCollection } from 'src/bridge/ts/core/mix-collection';
import { TestPathSyntax } from 'src/test-path-syntax';
import type { Violation } from 'src/protocols';
import { MIN_FILE_LINES } from 'src/constants';
import type {
	PythonOperationInput,
	PythonRuleAppender,
	PythonRuleInput,
} from 'src/runner/types';
import type {
	AstClassNode,
	AstSourceSpan,
	LintFileNameContract,
	NormalizedAstFile,
} from 'src/types';
import type { PythonProjectNames } from 'src/bridge/ts/runner/orchestration/runtime/python/types';







/** Responsibilities: _collection Python file-level import_. **/
export class PythonAstFileRuleCollector {
	private readonly test_path_syntax = new TestPathSyntax();
	private readonly class_rules = new ClassRules();
	private readonly mix_collection = new MixCollection();
	private readonly declarations = new Declarations();
	private readonly imports_rules = new ImportsRules();
	private readonly ast: NormalizedAstFile;
	private readonly file_name: LintFileNameContract;
	private readonly lines: string[];
	private readonly project_class_names: ReadonlySet<string>;
	private readonly project_type_names: ReadonlySet<string>;
	private readonly append: PythonRuleAppender;

	private readonly violations: Violation[] = [];

	/** Responsibilities: _construction Python operation inputs_. **/
	private operations(): PythonOperationInput {
		const source = this.ast;
		const methods = source.classes.flatMap(node => node.methods);
		let private_accesses: { line: number }[] = [];
		if (source.private_accesses !== undefined) {
			private_accesses = source.private_accesses;
		}
		let repeated_branches: { line: number }[] = [];
		if (source.repeated_branches !== undefined) {
			repeated_branches = source.repeated_branches;
		}
		return {
			callables: source.functions.concat(methods),
			attribute_accesses: source.attribute_accesses,
			private_accesses,
			repeated_branches,
			functions: source.functions,
			parse_issues: source.parse_issues,
			named_symbols: source.named_symbols,
		};
	}

	/** Responsibilities: _Python rule input assembly_. **/
	private input(): PythonRuleInput {
		const ast = this.ast;
		const classes = ast.classes.filter(node => !node.type_contract && !node.protocol);
		const suppress_short_class = this.short_class_suppressed(classes);
		let python_imports = ast.python_imports;
		if (python_imports === undefined) {
			python_imports = [];
		}
		return {
			violations: this.violations,
			file_name: this.file_name,
			classes: ast.classes,
			functions: ast.functions,
			project_class_names: this.project_class_names,
			project_type_names: this.project_type_names,
			reference_aliases: ast.reference_aliases,
			python_imports,
			operations: this.operations(),
			suppress_short_class,
		};
	}

	/** Responsibilities: _classification short-class diagnostics suppressed_. **/
	private short_class_suppressed(classes: AstClassNode[]): boolean {
		const directory_comment_segments = new DirectoryCommentSegments();
		let docstring_spans = this.ast.docstring_spans;
		if (docstring_spans === undefined) {
			docstring_spans = [];
		}
		return this.suppress_short_class(directory_comment_segments, classes, docstring_spans);
	}

	/** Responsibilities: _short-class violation suppression_. **/
	private suppress_short_class(
		directory_comment_segments: DirectoryCommentSegments,
		classes: AstClassNode[],
		docstring_spans: AstSourceSpan[]
	): boolean {
		if (classes.length < 2) {
			return false;
		}
		return directory_comment_segments.count_code_lines(this.lines.join('\n'), true, docstring_spans) < MIN_FILE_LINES;
	}

	/** Responsibilities: _aggregation import declaration violations_. **/
	private append_import_declarations(file: string, ast: NormalizedAstFile): void {
		let python_imports = ast.python_imports;
		if (python_imports === undefined) {
			python_imports = [];
		}
		this.declarations.append_prefix_violations(this.violations, file, ast.functions, python_imports);
		this.imports_rules.append_import_violations(this.violations, file, ast.import_issues);
	}

	/** Responsibilities: _aggregation basic class structure_. **/
	private append_class_basics(file: string, lines: string[]): void {
		const ast = this.ast;
		const file_name = this.file_name;
		const class_indexes = ast.classes
			.filter(node => !node.type_contract && !node.protocol)
			.map(node => node.start);
if (!this.test_path_syntax.test_py(file) && class_indexes.length > 0) {
			this.class_rules.append_python_classes(
				this.violations,
				file,
				lines,
				class_indexes,
				ast.functions.length > 0,
			);
		}
		this.mix_collection.append_mix_violations(
			this.violations,
			ast.classes,
			ast.functions,
			file_name
		);
	}

	/** Responsibilities: _initialization Python source data_. **/
	public constructor(
		ast: NormalizedAstFile,
		file_name: LintFileNameContract,
		lines: string[],
		project_names: PythonProjectNames,
		append: PythonRuleAppender
	) {
		this.ast = ast;
		this.file_name = file_name;
		this.lines = lines;
		this.project_class_names = project_names.project_class_names;
		this.project_type_names = project_names.project_type_names;
		this.append = append;
	}

	/** Responsibilities: _aggregation file-level class-level Python_. **/
	public append_basics(): void {
		const file = this.file_name.value;
		const ast = this.ast;
		const lines = this.lines;
		this.append_class_basics(file, lines);
		this.append_import_declarations(file, ast);
	}

	/** Responsibilities: _collection Python violations current_. **/
	public collect_violations(): Violation[] {
		this.append_basics();
		this.append(this.input());
		return this.violations;
	}
}
