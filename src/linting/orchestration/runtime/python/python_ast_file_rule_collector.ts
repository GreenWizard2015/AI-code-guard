import { ClassRules } from "src/rules/class_rules";
import { Declarations } from "src/linting/orchestration/runtime/python/declarations";
import { DirectoryCommentSegments } from "src/core/support/source-analysis/directory_comment_segments";
import { ImportsRules } from "src/rules/imports_rules";
import { MixCollection } from "src/rules/mix_collection";
import { TestPathSyntax } from "src/test_path_syntax";
import { Syntax } from "src/parser/analysis/syntax";
import type { DirectoryCommentSegmentsContract } from "src/shared_services_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { MIN_FILE_LINES } from "src/constants";
import type { PythonOperationInput, PythonRuleInput } from "src/linting/types";
import type { LintFileNameContract } from "src/source_types";
import type { AstClassNode, AstSourceSpan, NormalizedAstFile } from "src/types";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { PythonRuleCollector } from "src/linting/orchestration/runtime/python/python_rule_collector";
import type { PythonLintInput } from "src/model/types/types";

/** Responsibilities: _Python file rule collection_, _import declaration checks_. **/
export class PythonAstFileRuleCollector {
	private readonly test_path_syntax: TestPathSyntax;
	private readonly class_rules: ClassRules;
	private readonly mix_collection: MixCollection;
	private readonly declarations: Declarations;
	private readonly imports_rules: ImportsRules;
	private readonly ast: NormalizedAstFile;
	private readonly file_name: LintFileNameContract;
	private readonly lines: string[];
	private readonly project_class_names: ReadonlySet<string>;
	private readonly project_protocol_names: ReadonlySet<string>;
	private readonly project_type_names: ReadonlySet<string>;
	private readonly production_import_names: ReadonlySet<string>;

	private readonly violations: ViolationContract[] = [];

	/** Responsibilities: _construction Python operation inputs_. **/
	private operations(): PythonOperationInput {
		const source = this.ast;
		const methods = source.classes.flatMap((node) => node.methods);
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
			symbol_references: source.symbol_references,
		};
	}

	/** Responsibilities: _Python rule input assembly_. **/
	private input(): PythonRuleInput {
		const ast = this.ast;
		const classes = ast.classes.filter((node) => !node.type_contract && !node.protocol);
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
			project_protocol_names: this.project_protocol_names,
			project_type_names: this.project_type_names,
			reference_aliases: ast.reference_aliases,
			python_imports,
			production_import_names: this.production_import_names,
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
		directory_comment_segments: DirectoryCommentSegmentsContract,
		classes: AstClassNode[],
		docstring_spans: AstSourceSpan[],
	): boolean {
		if (classes.length < 2) {
			return false;
		}
		return directory_comment_segments.count_code_lines(this.lines.join("\n"), true, docstring_spans) < MIN_FILE_LINES;
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
		const module_functions = ast.functions.filter((node) => !node.nested);
		const class_indexes = ast.classes.filter((node) => !node.type_contract && !node.protocol).map((node) => node.start);
		if (!this.test_path_syntax.test_file(file)) {
			this.class_rules.append_python_classes({
				violations: this.violations,
				file,
				lines,
				parsed_indexes: class_indexes,
				has_module_functions: ast.functions.length > 0,
				has_implementation_classes: class_indexes.length > 0,
				type_declarations: ast.type_declarations,
			});
		}
		this.mix_collection.append_mix_violations(this.violations, ast.classes, module_functions, file_name);
	}

	/** Responsibilities: _initialization Python source data_. **/
	public constructor(input: PythonLintInput, ast: NormalizedAstFile, production_import_names: ReadonlySet<string>) {
		const syntax = new Syntax();
		this.test_path_syntax = new TestPathSyntax();
		this.class_rules = new ClassRules({
			root: "",
			files: new Set(),
			resolver: new ProjectSourcePython(),
		});
		this.mix_collection = new MixCollection();
		this.declarations = new Declarations();
		this.imports_rules = new ImportsRules();
		this.ast = ast;
		this.file_name = input.file_name;
		this.lines = syntax.split_lines(input.text);
		this.project_class_names = input.python_class_names;
		this.project_protocol_names = input.project_protocol_names;
		this.project_type_names = input.project_type_names;
		this.production_import_names = production_import_names;
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
	public collect_violations(): ViolationContract[] {
		this.append_basics();
		const rule_collector = new PythonRuleCollector(this.input());
		rule_collector.append_metrics();
		rule_collector.append_architecture();
		return this.violations;
	}
}
