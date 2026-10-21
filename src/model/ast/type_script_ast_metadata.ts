import { Syntax } from "src/parser/analysis/syntax";
import { TypeScriptTypeDeclarations } from "src/parser/type_script_type_declarations";
import { TypeScriptTypeMembers } from "src/model/ast/declarations/type_script_type_members";
import { TypeScriptResponsibilityTargets } from "src/model/ast/type_script_responsibility_targets";
import { TypeScriptTreeMetadataCollector } from "src/model/ast/type_script_tree_metadata_collector";
import { TypeScriptExpressionAliases } from "src/typescript-aliases/type_script_expression_aliases";
import ts from "typescript";
import type { SourceLineResolver } from "src/runtime_types";
import type { SyntaxContract, LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptAstMetadataContract, TypeScriptResponsibilityTargetsContract } from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import type { TypeScriptTreeMetadata } from "src/source_types";
import type {
	AstCallableNodeContract,
	AstCallableReference,
	AstClassNodeContract,
	AstParseIssue,
	AstSourceSpan,
	NormalizedAstFileContract,
} from "src/types";
import type {
	TypeScriptDerivedMetadata,
	TypeScriptMetadataSpans,
	TypeScriptNormalizedMetadataOptions,
} from "src/model/types";
import { TYPESCRIPT_LANGUAGE, TYPESCRIPT_METADATA_STAGE_PREFIX } from "src/constants";

/** Responsibilities: _module metadata collection_, _syntax issue reporting_. **/
export class TypeScriptAstMetadata implements TypeScriptAstMetadataContract {
	private readonly source_file: ts.SourceFile;
	private readonly call_reference_collector: TypeScriptCallReferenceCollectorContract;
	private readonly syntax: SyntaxContract;
	private readonly type_declarations: TypeScriptTypeDeclarations;
	private readonly type_members: TypeScriptTypeMembers;
	private readonly responsibility_targets: TypeScriptResponsibilityTargetsContract;
	private readonly stage_timer: LintStageTimerContract;
	private readonly tree_metadata_collector: TypeScriptTreeMetadataCollector;

	/** Responsibilities: _statement position normalization conversion_. **/
	private statement_span(statement: ts.Statement): AstSourceSpan {
		const start = this.source_file.getLineAndCharacterOfPosition(statement.getStart(this.source_file));
		const end = this.source_file.getLineAndCharacterOfPosition(statement.end);
		return {
			start_line: start.line,
			start_column: start.character,
			end_line: end.line,
			end_column: end.character,
		};
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_constant_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		const collect = (statements: readonly ts.Statement[]): void => {
			for (const statement of statements) {
				if (ts.isVariableStatement(statement)) {
					if ((statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
						spans.push(this.statement_span(statement));
						continue;
					}
				}
				if (!ts.isModuleDeclaration(statement)) {
					continue;
				}
				if (statement.body === undefined) {
					continue;
				}
				if (ts.isModuleBlock(statement.body)) {
					collect(statement.body.statements);
				}
			}
		};
		collect(this.source_file.statements);
		return spans;
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_type_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this.source_file.statements) {
			if (ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}

	/** Responsibilities: _collection source spans module_. **/
	private module_protocol_spans(): AstSourceSpan[] {
		const spans: AstSourceSpan[] = [];
		for (const statement of this.source_file.statements) {
			if (ts.isInterfaceDeclaration(statement)) {
				spans.push(this.statement_span(statement));
			}
		}
		return spans;
	}


	/** Responsibilities: _module metadata spans_. **/
	private metadata_spans(prefix: string): TypeScriptMetadataSpans {
		return {
			module_constant_spans: this.stage_timer.measure(`${prefix}.module-constant-spans`, () =>
				this.module_constant_spans(),
			),
			module_type_spans: this.stage_timer.measure(`${prefix}.module-type-spans`, () => this.module_type_spans()),
			module_protocol_spans: this.stage_timer.measure(`${prefix}.module-protocol-spans`, () =>
				this.module_protocol_spans(),
			),
		};
	}

	/** Responsibilities: _derived TypeScript metadata_. **/
	private derived_metadata(
		prefix: string,
		line_for: SourceLineResolver,
		call_references: AstCallableReference[],
	): TypeScriptDerivedMetadata {
		return {
			parse_issues: this.stage_timer.measure(`${prefix}.syntax`, () => this.collect_syntax_issues(line_for)),
			call_references,
			responsibility_targets: this.stage_timer.measure(`${prefix}.responsibility-targets`, () =>
				this.responsibility_targets.collect(),
			),
			reference_aliases: this.stage_timer.measure(`${prefix}.reference-aliases`, () =>
				this.type_declarations.collect_reference_aliases(this.source_file),
			),
			type_members: this.stage_timer.measure(`${prefix}.type-members`, () =>
				this.type_members.collect_type_members(this.source_file),
			),
		};
	}

	/** Responsibilities: _AST file metadata_. **/
	private file_metadata(options: TypeScriptNormalizedMetadataOptions): NormalizedAstFileContract {
		const { classes, functions, tree, spans, derived } = options;
		return {
			language: TYPESCRIPT_LANGUAGE,
			classes,
			functions,
			parse_issues: derived.parse_issues,
			import_issues: tree.import_issues,
			attribute_accesses: tree.attribute_accesses,
			symbol_references: tree.symbol_references,
			literal_references: tree.literal_references,
			literal_constants: tree.literal_constants,
			...spans,
			call_references: derived.call_references,
			private_accesses: [],
			repeated_branches: [],
			module_instances: [],
			coding_issues: [],
			python_imports: [],
			python_main_guard: false,
			docstring_spans: [],
			python_callable_count: { count: 0, first_line: 0 },
			responsibility_targets: derived.responsibility_targets,
			named_symbols: tree.named_symbols,
			type_declarations: tree.type_declarations,
			reference_aliases: derived.reference_aliases,
			type_members: derived.type_members,
		};
	}

	/** Responsibilities: _AST metadata_. **/
	private normalized_file(
		classes: AstClassNodeContract[],
		functions: AstCallableNodeContract[],
		tree: TypeScriptTreeMetadata,
		line_for: SourceLineResolver,
		call_references: AstCallableReference[],
	): NormalizedAstFileContract {
		const metadata_prefix = TYPESCRIPT_METADATA_STAGE_PREFIX;
		const spans = this.metadata_spans(metadata_prefix);
		const derived = this.derived_metadata(metadata_prefix, line_for, call_references);
		return this.file_metadata({ classes, functions, tree, spans, derived });
	}

	/** Responsibilities: _initialization source text AST_. **/
	public constructor(
		source_file: ts.SourceFile,
		call_reference_collector: TypeScriptCallReferenceCollectorContract,
		stage_timer: LintStageTimerContract,
		traversal: TypeScriptAstTraversalContract,
	) {
		this.syntax = new Syntax();
		this.type_declarations = new TypeScriptTypeDeclarations();
		this.type_members = new TypeScriptTypeMembers();
		this.source_file = source_file;
		this.call_reference_collector = call_reference_collector;
		this.responsibility_targets = new TypeScriptResponsibilityTargets(source_file);
		this.stage_timer = stage_timer;
		this.tree_metadata_collector = new TypeScriptTreeMetadataCollector(
			source_file,
			new TypeScriptExpressionAliases("require"),
			traversal,
		);
	}

	/** Responsibilities: _collection syntax policy issues_. **/
	public collect_syntax_issues(line_for: SourceLineResolver): AstParseIssue[] {
		const diagnostics = this.syntax.syntax_issues(this.source_file);
		if (diagnostics.length === 0) {
			return [];
		}
		return diagnostics.map((diagnostic) => {
			let start = diagnostic.start;
			if (start === undefined) {
				start = 0;
			}
			return {
				line: line_for(start),
				message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
			};
		});
	}

	/** Responsibilities: _combination parsing classes functions_. **/
	public normalized(classes: AstClassNodeContract[], functions: AstCallableNodeContract[]): NormalizedAstFileContract {
		const line_for = (position: number): number => this.source_file.getLineAndCharacterOfPosition(position).line;
		const call_references: AstCallableReference[] = [];
		const tree = this.stage_timer.measure(
			"startup.project-context.source-records.metadata.call-references",
			() =>
				this.stage_timer.measure("startup.project-context.source-records.metadata.tree", () =>
					this.tree_metadata_collector.collect(line_for, (node, owner) =>
						this.call_reference_collector.append_reference(node, call_references, owner),
					),
				),
		);
		return this.normalized_file(classes, functions, tree, line_for, call_references);
	}
}
