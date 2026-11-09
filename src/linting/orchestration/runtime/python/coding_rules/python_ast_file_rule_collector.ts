import { TEST_PATH_SUFFIXES } from "src/constants";
import { MIN_FILE_LINES } from "src/constants";
import { ProjectSourcePython } from "src/core/project-source/project_source_python";
import { DirectoryCommentSegments } from "src/core/support/directory_comment_segments";
import type { LintFileNameContract } from "src/core/support/protocols";
import { RULE_IDS } from "src/linting/constants";
import { Declarations } from "src/linting/orchestration/runtime/python/coding_rules/declarations";
import { PythonArchitectureRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_architecture_rule_collector";
import { PythonMetricRuleCollector } from "src/linting/orchestration/runtime/python/coding_rules/python_metric_rule_collector";
import type { PythonOperationInput, PythonProjectTypeNames, PythonRuleInput } from "src/linting/types";
import type {
	AstCallableNode,
	AstClassNode,
	AstImportIssue,
	AstPythonImport,
	AstSourceSpan,
	NormalizedAstFile,
} from "src/model/ast/normalized_ast_types";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { PythonLintInput } from "src/model_types";
import { Syntax } from "src/parser/analysis/syntax";
import type { ViolationContract } from "src/reporting_protocols";
import { ClassRules } from "src/rules/class_rules";
import { IMPORT_RULE_IDS } from "src/rules/constants";
import { MixCollection } from "src/rules/mix_collection";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { DirectoryCommentSegmentsContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";

/** Responsibilities: _Python file rule collection_, _import declaration checks_. **/
export class PythonAstFileRuleCollector {
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _class_rules: ClassRules;
	private readonly _declarations: Declarations;
	private readonly _ast: NormalizedAstFile;
	private readonly _source_text: string;
	private readonly _file_name: LintFileNameContract;
	private readonly _lines: string[];
	private readonly _project_class_names: ReadonlySet<string>;
	private readonly _project_protocol_names: ReadonlySet<string>;
	private readonly _project_type_names: ReadonlySet<string>;
	private readonly _project_alias_names: ReadonlySet<string>;
	private readonly _production_import_names: ReadonlySet<string>;
	private readonly _class_nodes: readonly AstClassNode[];
	private readonly _module_functions: readonly AstCallableNode[];

	private readonly _violations: ViolationContract[];
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _construction Python operation inputs_. **/
	private operations(): PythonOperationInput {
		const source = this._ast;
		const methods = this._class_nodes.flatMap((node) => node.structure.methods);
		return {
			callables: source.source.functions.concat(methods),
			methods,
			attribute_accesses: source.references.attribute_accesses,
			private_accesses: source.control_flow.private_accesses ?? [],
			repeated_branches: source.control_flow.repeated_branches ?? [],
			functions: source.source.functions,
			parse_issues: source.source.parse_issues,
			named_symbols: source.references.named_symbols,
			symbol_references: source.references.symbol_references,
		};
	}

	/** Responsibilities: _Python rule input assembly_. **/
	private input(): PythonRuleInput {
		const ast = this._ast;
		return {
			violations: this._violations,
			file_name: this._file_name,
			source: {
				text: this._source_text,
				classes: ast.source.classes,
				type_declarations: ast.references.type_declarations,
				functions: ast.source.functions,
				reference_aliases: ast.references.reference_aliases,
				python_imports: this.python_imports(),
			},
			operations: this.operations(),
			project: {
				...this.project_names(),
				suppress_short_class: this.short_class_suppressed(),
				production_import_names: this._production_import_names,
			},
		};
	}

	/** Responsibilities: _Python project rule names_. **/
	private project_names(): PythonProjectTypeNames {
		return {
			classes: this._project_class_names,
			protocols: this._project_protocol_names,
			types: this._project_type_names,
			type_aliases: this._project_alias_names,
		};
	}

	/** Responsibilities: _Python import AST default_. **/
	private python_imports(): AstPythonImport[] {
		const imports = this._ast.source.python_imports;
		if (imports === undefined) {
			return [];
		}
		return imports;
	}

	/** Responsibilities: _classification short-class diagnostics suppressed_. **/
	private short_class_suppressed(): boolean {
		const classes = this._class_nodes.filter(
			(node) => !node.classification.type_contract && !node.classification.protocol,
		);
		const directory_comment_segments = new DirectoryCommentSegments("/*", "*/", "#", "//");
		let docstring_spans = this._ast.module_declarations.docstring_spans;
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
		return directory_comment_segments.count_code_lines(this._lines.join("\n"), true, docstring_spans) < MIN_FILE_LINES;
	}

	/** Responsibilities: _aggregation import declaration violations_. **/
	private append_import_declarations(): void {
		const file = this._file_name.value();
		let python_imports = this._ast.source.python_imports;
		if (python_imports === undefined) {
			python_imports = [];
		}
		this._declarations.append_prefix_violations(this._violations, file, this._ast.source.functions, python_imports);
		this.append_import_issues(file, this._ast.source.import_issues);
	}

	/** Responsibilities: _Python import issue diagnostics_. **/
	private append_import_issues(file: string, issues: readonly AstImportIssue[]): void {
		for (const issue of issues) {
			const rule_id = IMPORT_RULE_IDS[issue.kind];
			if (rule_id === undefined) {
				throw new Error(`Unknown import issue kind "${issue.kind}".`);
			}
			const rule = new DiagnosticRule(rule_id);
			this._violations.push(rule.violation(file, issue.line + 1));
		}
	}

	/** Responsibilities: _mixed module violation collection_. **/
	private append_mixed_violations(): void {
		this._stage_timer.measure("rule.mixed-module.python", () => {
			const mix_collection = new MixCollection(
				this._file_name,
				this._class_nodes,
				this._module_functions,
				new DiagnosticRule(RULE_IDS.mixed_module),
			);
			mix_collection.append_mix_violations(this._violations);
		});
	}

	/** Responsibilities: _aggregation basic class structure_. **/
	private append_class_basics(): void {
		const file = this._file_name.value();
		const ast = this._ast;
		const class_indexes = this._class_nodes
			.filter((node) => !node.classification.type_contract && !node.classification.protocol)
			.map((node) => node.identity.start);
		if (!this._test_path_syntax.classify(file).has(TestPathKind.TestFile)) {
			this._class_rules.append_python_classes({
				violations: this._violations,
				file,
				lines: this._lines,
				parsed_indexes: class_indexes,
				has_module_functions: ast.source.functions.length > 0,
				has_implementation_classes: class_indexes.length > 0,
				type_declarations: ast.references.type_declarations,
			});
		}
		this.append_mixed_violations();
	}

	/** Responsibilities: _contract field diagnostics_. **/
	private contract_field_diagnostics(): void {
		this._stage_timer.measure("rule.public-field-on-contract-implementation.python", () => {
			const rule = new DiagnosticRule("public-field-on-contract-implementation");
			for (const class_node of this._class_nodes) {
				const implements_protocol = class_node.structure.base_class_names.some((name) =>
					this._project_protocol_names.has(name),
				);
				if (!implements_protocol) {
					continue;
				}
				for (const field of class_node.field_analysis.fields) {
					if (field.visibility !== "public") {
						continue;
					}
					this._violations.push(rule.violation(this._file_name.value(), field.line, {}));
				}
			}
		});
	}

	/** Responsibilities: _initialization Python source data_. **/
	public constructor(
		input: PythonLintInput,
		ast: NormalizedAstFile,
		production_import_names: ReadonlySet<string>,
		stage_timer: LintStageTimerContract,
	) {
		this._violations = [];
		this._stage_timer = stage_timer;
		const syntax = new Syntax();
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._class_rules = new ClassRules({
			root: "",
			files: new Set(),
			resolver: new ProjectSourcePython(""),
		});
		this._declarations = new Declarations(new DiagnosticRule("class-like-prefix"));
		this._ast = ast;
		this._source_text = input.text;
		this._file_name = input.file_name;
		this._lines = syntax.split_lines(input.text);
		this._project_class_names = input.python_class_names;
		this._project_protocol_names = input.project_protocol_names;
		this._project_type_names = input.project_type_names;
		this._project_alias_names = input.project_alias_names;
		this._production_import_names = production_import_names;
		this._class_nodes = ast.source.classes;
		this._module_functions = ast.source.functions.filter((node) => !node.identity.nested);
	}

	/** Responsibilities: _aggregation file-level class-level Python_. **/
	public append_basics(): void {
		this.append_class_basics();
		this.contract_field_diagnostics();
		this.append_import_declarations();
	}

	/** Responsibilities: _collection Python violations current_. **/
	public collect_violations(): ViolationContract[] {
		this.append_basics();
		const input = this.input();
		const metric_rules = new PythonMetricRuleCollector(input, this._stage_timer);
		metric_rules.append_metrics();
		metric_rules.append_type_rules();
		const architecture_rules = new PythonArchitectureRuleCollector(input, this._stage_timer);
		architecture_rules.append_architecture_rules();
		architecture_rules.append_syntax_rules();
		return this._violations;
	}
}
