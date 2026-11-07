import ts from "typescript";

import { TYPESCRIPT_CACHE_OWNER, TYPESCRIPT_METADATA_STAGE_PREFIX } from "src/constants";
import type {
	AstCallableNode,
	AstCallableReference,
	AstClassNode,
	AstImportIssue,
	AstParseIssue,
	AstResponsibilityTarget,
	NormalizedAstFile,
	NormalizedAstModuleDeclarations,
	NormalizedAstSource,
	NormalizedAstSymbolReferences,
} from "src/model/ast/normalized_ast_types";
import { TypeScriptAstDeclarationMetadata } from "src/model/ast/type_script_ast_declaration_metadata";
import { TypeScriptResponsibilityTargets } from "src/model/ast/type_script_responsibility_targets";
import { TypeScriptTreeMetadataCollector } from "src/model/ast/type_script_tree_metadata_collector";
import type { TypeScriptCallReferenceCollectorContract } from "src/model/protocols";
import type {
	TypeScriptDerivedMetadata,
	TypeScriptMetadataSpans,
	TypeScriptNormalizedFileParts,
} from "src/model/types";
import { Syntax } from "src/parser/analysis/syntax";
import { TypeScriptTypeDeclarations } from "src/parser/type_script_type_declarations";
import { TypeScriptExpressionAliases } from "src/parser/typescript-aliases/type_script_expression_aliases";
import type { CallableSourceLineResolver } from "src/runtime_types";
import type { LintStageTimerContract, SyntaxContract } from "src/shared_services_protocols";
import type { TypeScriptTreeMetadata } from "src/source_types";
import type {
	TypeScriptAstMetadataContract,
	TypeScriptAstMetadataOptions,
	TypeScriptClassMetadataCollection,
	TypeScriptClassNodesContract,
	TypeScriptResponsibilityTargetsContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";

/** Responsibilities: _AST metadata assembly_, _syntax issue collection_. **/
export class TypeScriptAstMetadata implements TypeScriptAstMetadataContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _declaration_index: TypeScriptObjectAliasDeclarationIndexContract;
	private readonly _call_reference_collector: TypeScriptCallReferenceCollectorContract;
	private readonly _syntax: SyntaxContract;
	private readonly _type_declarations: TypeScriptTypeDeclarations;
	private readonly _declaration_metadata: TypeScriptAstDeclarationMetadata;
	private readonly _responsibility_targets: TypeScriptResponsibilityTargetsContract;
	private readonly _class_nodes: TypeScriptClassNodesContract;
	private readonly _stage_timer: LintStageTimerContract;

	/** Responsibilities: _derived metadata assembly_. **/
	private derived_metadata(
		prefix: string,
		derived_line: CallableSourceLineResolver,
		call_references: AstCallableReference[],
	): TypeScriptDerivedMetadata {
		return {
			parse_issues: this._stage_timer.measure(`${prefix}.syntax`, () => this.collect_syntax_issues(derived_line)),
			call_references,
			responsibility_targets: this._stage_timer.measure(`${prefix}.responsibility-targets`, () =>
				this._responsibility_targets.collect(),
			),
			reference_aliases: this._stage_timer.measure(`${prefix}.reference-aliases`, () =>
				this._type_declarations.collect_reference_aliases(),
			),
			type_members: this._stage_timer.measure(`${prefix}.type-members`, () =>
				this._declaration_metadata.collect_type_members(),
			),
		};
	}

	/** Responsibilities: _source model assembly_. **/
	private source_section(
		class_nodes: AstClassNode[],
		callable_nodes: AstCallableNode[],
		parse_issues: AstParseIssue[],
		import_issues: AstImportIssue[],
	): NormalizedAstSource {
		return {
			language: TYPESCRIPT_CACHE_OWNER,
			classes: class_nodes,
			functions: callable_nodes,
			parse_issues,
			import_issues,
			coding_issues: [],
			python_imports: [],
		};
	}

	/** Responsibilities: _symbol reference model_. **/
	private reference_section(
		tree: TypeScriptTreeMetadata,
		derived: TypeScriptDerivedMetadata,
	): NormalizedAstSymbolReferences {
		return {
			attribute_accesses: tree.attribute_accesses,
			named_symbols: tree.named_symbols,
			type_declarations: tree.type_declarations,
			reference_aliases: derived.reference_aliases,
			symbol_references: tree.symbol_references,
			literal_references: tree.literal_references,
			literal_constants: tree.literal_constants,
			call_references: derived.call_references,
			type_members: derived.type_members,
		};
	}

	/** Responsibilities: _module declaration model_. **/
	private declaration_section(
		spans: TypeScriptMetadataSpans,
		responsibility_targets: AstResponsibilityTarget[],
	): NormalizedAstModuleDeclarations {
		return {
			...spans,
			python_exports: [],
			python_callable_count: { count: 0, first_line: 0 },
			python_main_guard: false,
			docstring_spans: [],
			responsibility_targets,
		};
	}

	/** Responsibilities: _AST normalization_. **/
	private normalized_sections(parts: TypeScriptNormalizedFileParts): NormalizedAstFile {
		const { tree, derived } = parts;
		return {
			source: this.source_section(parts.classes, parts.functions, derived.parse_issues, tree.import_issues),
			references: this.reference_section(tree, derived),
			control_flow: { private_accesses: [], repeated_branches: [], module_instances: [] },
			module_declarations: this.declaration_section(parts.spans, derived.responsibility_targets),
		};
	}

	/** Responsibilities: _AST file metadata assembly_. **/
	private normalized_file(
		class_metadata: TypeScriptClassMetadataCollection,
		functions: AstCallableNode[],
		tree: TypeScriptTreeMetadata,
		metadata_line: CallableSourceLineResolver,
		call_references: AstCallableReference[],
	): NormalizedAstFile {
		const metadata_prefix = TYPESCRIPT_METADATA_STAGE_PREFIX;
		const spans = this._declaration_metadata.metadata_spans(metadata_prefix);
		const derived = this.derived_metadata(metadata_prefix, metadata_line, call_references);
		const parts: TypeScriptNormalizedFileParts = {
			classes: class_metadata.nodes,
			functions,
			tree,
			derived,
			spans,
		};
		return this.normalized_sections(parts);
	}

	/** Responsibilities: _timed tree metadata collection_. **/
	private collect_tree_metadata(
		class_metadata: TypeScriptClassMetadataCollection,
		line_for: CallableSourceLineResolver,
	): TypeScriptTreeMetadata {
		const tree_metadata_collector = new TypeScriptTreeMetadataCollector(
			this._source_file,
			new TypeScriptExpressionAliases("require", this._declaration_index),
			this._traversal,
		);
		return this._stage_timer.measure(
			"startup.project-context.source-records.record-construction.metadata.call-references",
			() =>
				this._stage_timer.measure(
					"startup.project-context.source-records.record-construction.metadata.source-node-dispatch",
					() =>
						tree_metadata_collector.collect(
							line_for,
							(node, owner) => this._call_reference_collector.append_reference(node, owner),
							class_metadata,
							this._stage_timer,
						),
				),
		);
	}

	/** Responsibilities: _metadata dependency setup_. **/
	public constructor(options: TypeScriptAstMetadataOptions) {
		const { source_file, call_reference_collector, stage_timer, traversal, declaration_index, class_nodes } = options;
		this._syntax = new Syntax();
		this._type_declarations = new TypeScriptTypeDeclarations(source_file);
		this._source_file = source_file;
		this._traversal = traversal;
		this._declaration_index = declaration_index;
		this._declaration_metadata = new TypeScriptAstDeclarationMetadata({ source_file, stage_timer });
		this._call_reference_collector = call_reference_collector;
		this._responsibility_targets = new TypeScriptResponsibilityTargets(source_file);
		this._stage_timer = stage_timer;
		this._class_nodes = class_nodes;
	}

	/** Responsibilities: _syntax diagnostic mapping_. **/
	public collect_syntax_issues(line_for: CallableSourceLineResolver): AstParseIssue[] {
		const diagnostics = this._syntax.syntax_issues(this._source_file);
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

	/** Responsibilities: _AST file normalization_. **/
	public normalized(classes: AstClassNode[], functions: AstCallableNode[]): NormalizedAstFile {
		const line_for = (position: number): number => this._source_file.getLineAndCharacterOfPosition(position).line;
		const class_metadata: TypeScriptClassMetadataCollection = {
			nodes: classes,
			node_factory: this._class_nodes,
		};
		const tree = this.collect_tree_metadata(class_metadata, line_for);
		class_metadata.nodes.sort((left, right) => left.identity.start - right.identity.start);
		return this.normalized_file(class_metadata, functions, tree, line_for, this._call_reference_collector.references());
	}
}
