import { TYPESCRIPT_TREE_METADATA_FLAGS } from "src/constants";
import {
	TYPESCRIPT_CLASS_METADATA_NODE_KINDS,
	TYPE_SCRIPT_METADATA_NODE_INDEX_CONFIGURATION,
} from "src/model/ast/constants";
import { TypeScriptImportIssues } from "src/model/ast/declarations/type_script_import_issues";
import type {
	AstLiteralConstant,
	AstLiteralReference,
	LineDepth,
	TypeScriptMetadataNodeIndexConfiguration,
} from "src/model/ast/normalized_ast_types";
import { TypeScriptDeclarationMetadata } from "src/model/ast/type_script_declaration_metadata";
import { TypeScriptLiteralMetadata } from "src/model/ast/type_script_literal_metadata";
import type {
	TreeMetadataState,
	TypeScriptMetadataCollectionOptions,
	TypeScriptMetadataSourceLocation,
} from "src/model/types";
import { TypeScriptAstDispatchPhase } from "src/parser/analysis/protocols";
import { TypeScriptAstNodeObserverRegistry } from "src/parser/analysis/type_script_ast_node_observer_registry";
import type { CallableSourceLineResolver } from "src/runtime_types";
import type { LintStageTimerContract } from "src/shared_services_protocols";
import type { TypeScriptTreeMetadata } from "src/source_types";
import type {
	TypeScriptClassMetadataCollection,
	TypeScriptTreeMetadataCollectorContract,
} from "src/typescript_analysis_protocols";
import type { CallableCallReferenceVisitor } from "src/typescript_analysis_types";
import type {
	TypeScriptAstTraversalContract,
	TypeScriptExpressionAliasesContract,
} from "src/typescript_runtime_protocols";
import type { TypeScriptAstTraversalNode } from "src/typescript_runtime_types";
import ts from "typescript";

/** Responsibilities: _TypeScript tree metadata traversal_, _AST metadata assembly_. **/
export class TypeScriptTreeMetadataCollector implements TypeScriptTreeMetadataCollectorContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _declaration_metadata: TypeScriptDeclarationMetadata;
	private readonly _import_issues: TypeScriptImportIssues;
	private readonly _literal_metadata: TypeScriptLiteralMetadata;
	private readonly _metadata_node_index: TypeScriptMetadataNodeIndexConfiguration;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _empty_location: TypeScriptMetadataSourceLocation;

	/** Responsibilities: _deep attribute access depth_. **/
	private attribute_access_depth(node: ts.PropertyAccessExpression): number {
		let depth = 2;
		let expression = node.expression;
		while (ts.isPropertyAccessExpression(expression)) {
			depth += 1;
			expression = expression.expression;
		}
		return depth;
	}

	/** Responsibilities: _deep attribute access metadata_. **/
	private append_attribute_access(
		property_node: ts.Node,
		access_location: TypeScriptMetadataSourceLocation,
		accesses: LineDepth[],
	): void {
		if (!ts.isPropertyAccessExpression(property_node)) {
			return;
		}
		if (ts.isPropertyAccessExpression(property_node.parent)) {
			return;
		}
		const depth = this.attribute_access_depth(property_node);
		if (depth > 4) {
			accesses.push({ line: access_location.line, depth });
		}
	}

	/** Responsibilities: _node metadata extraction_. **/
	private append_metadata_node(node: ts.Node, flags: number, options: TypeScriptMetadataCollectionOptions): void {
		let requires_line = (flags & TYPESCRIPT_TREE_METADATA_FLAGS.source_line) !== 0;
		const is_identifier = (flags & TYPESCRIPT_TREE_METADATA_FLAGS.identifier) !== 0;
		if (!requires_line && is_identifier) {
			requires_line = this._declaration_metadata.requires_identifier_line(node);
		}
		let node_location = this._empty_location;
		if (requires_line) {
			node_location = { line: options.line_for(node.getStart(this._source_file)) };
		}
		this._declaration_metadata.append_node_metadata(node, flags, node_location.line, options.state);
		this.append_attribute_access(node, node_location, options.state.attribute_accesses);
		this._literal_metadata.append_node(node, node_location.line, options.literal_references, options.literal_constants);
	}

	/** Responsibilities: _tree metadata state_. **/
	private metadata_state(): TreeMetadataState {
		return {
			attribute_accesses: [],
			named_symbols: [],
			symbol_references: [],
			type_declarations: [],
			import_issues: [],
		};
	}

	/** Responsibilities: _tree metadata assembly_. **/
	private metadata_result(
		state: TreeMetadataState,
		literal_references: AstLiteralReference[],
		literal_constants: AstLiteralConstant[],
	): TypeScriptTreeMetadata {
		return {
			attribute_accesses: state.attribute_accesses,
			symbol_references: state.symbol_references,
			literal_references,
			literal_constants,
			import_issues: state.import_issues,
			named_symbols: state.named_symbols,
			type_declarations: state.type_declarations,
		};
	}

	/** Responsibilities: _metadata flag traversal_. **/
	private append_flagged_node(
		traversal_node: TypeScriptAstTraversalNode,
		on_reference: CallableCallReferenceVisitor,
		options: TypeScriptMetadataCollectionOptions,
	): void {
		const { node, owner } = traversal_node;
		const flags = this._metadata_node_index.flags_by_kind.get(node.kind) ?? 0;
		if (flags !== 0) {
			const metadata_flags = flags & ~TYPESCRIPT_TREE_METADATA_FLAGS.call_reference;
			if (metadata_flags !== 0) {
				this.append_metadata_node(node, metadata_flags, options);
			}
			if ((flags & TYPESCRIPT_TREE_METADATA_FLAGS.call_reference) !== 0) {
				on_reference(node, owner);
			}
		}
	}

	/** Responsibilities: _tree metadata ownership_. **/
	public constructor(
		source_file: ts.SourceFile,
		require_aliases: TypeScriptExpressionAliasesContract,
		traversal: TypeScriptAstTraversalContract,
	) {
		this._source_file = source_file;
		this._traversal = traversal;
		this._import_issues = new TypeScriptImportIssues(require_aliases);
		this._declaration_metadata = new TypeScriptDeclarationMetadata(source_file, this._import_issues);
		this._literal_metadata = new TypeScriptLiteralMetadata(source_file);
		this._metadata_node_index = TYPE_SCRIPT_METADATA_NODE_INDEX_CONFIGURATION;
		this._empty_location = { line: 0 };
	}

	/** Responsibilities: _AST metadata collection_. **/
	public collect(
		line_for: CallableSourceLineResolver,
		on_reference: CallableCallReferenceVisitor,
		class_metadata: TypeScriptClassMetadataCollection,
		stage_timer: LintStageTimerContract,
	): TypeScriptTreeMetadata {
		const state = this.metadata_state();
		state.import_issues.push(...this._import_issues.late_import_issues(this._source_file, line_for));
		const literal_references: AstLiteralReference[] = [];
		const literal_constants: AstLiteralConstant[] = [];
		const options = { state, literal_references, literal_constants, line_for };
		const dispatcher = new TypeScriptAstNodeObserverRegistry<void>();
		dispatcher.register(TypeScriptAstDispatchPhase.SourceMetadata, this._metadata_node_index.node_kinds, (node) =>
			this.append_flagged_node(node, on_reference, options),
		);
		dispatcher.register(TypeScriptAstDispatchPhase.SourceMetadata, TYPESCRIPT_CLASS_METADATA_NODE_KINDS, ({ node }) =>
			stage_timer.measure("startup.project-context.source-records.record-construction.classes", () =>
				class_metadata.node_factory.append_node(node, class_metadata.nodes),
			),
		);
		dispatcher.dispatch(TypeScriptAstDispatchPhase.SourceMetadata, this._traversal, this._source_file, undefined);
		return this.metadata_result(state, literal_references, literal_constants);
	}
}
