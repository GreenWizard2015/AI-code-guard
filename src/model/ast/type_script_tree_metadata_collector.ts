import ts from "typescript";
import { TypeScriptImportIssues } from "src/model/ast/declarations/type_script_import_issues";
import { TypeScriptImportSymbolDeclaration } from "src/model/ast/declarations/type_script_import_symbol_declaration";
import { TypeScriptSymbolDeclaration } from "src/model/ast/declarations/type_script_symbol_declaration";
import { TypeScriptTypeDeclarations } from "src/parser/type_script_type_declarations";
import { TypeScriptLiteralMetadata } from "src/model/ast/type_script_literal_metadata";
import type {
	SourceLineResolver,
	TypeScriptExpressionAliasesContract,
	TypeScriptAstTraversalContract,
	TypeScriptTreeMetadataCollectorContract,
	TypeScriptMetadataNodeVisitor,
} from "src/protocols";
import type {
	AstLiteralConstant,
	AstLiteralReference,
	TypeScriptTreeMetadata,
} from "src/types";
import type { TreeMetadataState, TypeScriptMetadataNodeOptions } from "src/model/types";

/** Responsibilities: _TypeScript tree metadata traversal_, _AST metadata assembly_. **/
export class TypeScriptTreeMetadataCollector implements TypeScriptTreeMetadataCollectorContract {
	private readonly source_file: ts.SourceFile;
	private readonly import_issues: TypeScriptImportIssues;
	private readonly import_declaration: TypeScriptImportSymbolDeclaration;
	private readonly symbol_declaration: TypeScriptSymbolDeclaration;
	private readonly type_declarations: TypeScriptTypeDeclarations;
	private readonly literal_metadata: TypeScriptLiteralMetadata;
	private readonly import_symbol_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly named_symbol_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly import_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly type_declaration_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly traversal: TypeScriptAstTraversalContract;

	/** Responsibilities: _optional declaration name lookup_. **/
	private optional_name(parent: ts.NamedDeclaration): ts.Node {
		if (parent.name !== undefined) {
			return parent.name;
		}
		return parent;
	}

	/** Responsibilities: _top declaration name lookup_. **/
	private top_name(parent: ts.Node): ts.Node {
		if (ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent)) {
			return parent.name;
		}
		if (ts.isImportClause(parent)) {
			return this.optional_name(parent);
		}
		if (ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent)) {
			return this.optional_name(parent);
		}
		if (ts.isInterfaceDeclaration(parent)) {
			return parent.name;
		}
		if (ts.isTypeAliasDeclaration(parent) || ts.isEnumDeclaration(parent)) {
			return parent.name;
		}
		return parent;
	}

	/** Responsibilities: _member name lookup_. **/
	private member_name(parent: ts.Node): ts.Node {
		if (ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent)) {
			return parent.name;
		}
		if (ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) {
			return parent.name;
		}
		if (ts.isParameter(parent) || ts.isTypeParameterDeclaration(parent)) {
			return parent.name;
		}
		if (ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) || ts.isPropertyAssignment(parent)) {
			return parent.name;
		}
		return parent;
	}

	/** Responsibilities: _declaration name lookup_. **/
	private declaration_name_node(parent: ts.Node): ts.Node {
		const top_level = this.top_name(parent);
		if (top_level !== parent) {
			return top_level;
		}
		return this.member_name(parent);
	}

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

	/** Responsibilities: _named symbol metadata dispatch_. **/
	private append_named_symbols(node: ts.Node, state: TreeMetadataState): void {
		if (this.import_symbol_kinds.has(node.kind)) {
			if (this.import_declaration.supported(node)) {
				state.named_symbols.push(...this.import_declaration.symbol(node, this.source_file));
			}
			return;
		}
		if (this.named_symbol_kinds.has(node.kind)) {
			state.named_symbols.push(...this.symbol_declaration.declaration_symbols(node, this.source_file));
		}
	}

	/** Responsibilities: _node metadata_. **/
	private append_node_metadata(node: ts.Node, line_for: SourceLineResolver, state: TreeMetadataState): void {
		this.append_named_symbols(node, state);
		if (this.import_kinds.has(node.kind)) {
			state.import_issues.push(...this.import_issues.node_import_issues(node, this.source_file, line_for));
		}
		if (this.type_declaration_kinds.has(node.kind)) {
			state.type_declarations.push(...this.type_declarations.declaration_for(node, this.source_file));
		}
	}

	/** Responsibilities: _deep attribute access metadata_. **/
	private append_attribute_access(node: ts.Node, line_for: SourceLineResolver, state: TreeMetadataState): void {
		if (!ts.isPropertyAccessExpression(node)) {
			return;
		}
		if (ts.isPropertyAccessExpression(node.parent)) {
			return;
		}
		const depth = this.attribute_access_depth(node);
		if (depth <= 4) {
			return;
		}
		state.attribute_accesses.push({ line: line_for(node.getStart(this.source_file)), depth });
	}

	/** Responsibilities: _symbol reference metadata_. **/
	private append_symbol_reference(node: ts.Node, line_for: SourceLineResolver, state: TreeMetadataState): void {
		if (!ts.isIdentifier(node)) {
			return;
		}
		if (this.declaration_name_node(node.parent) === node) {
			return;
		}
		state.symbol_references.push({ name: node.text, line: line_for(node.getStart(this.source_file)) });
	}

	/** Responsibilities: _metadata node collection_. **/
	private append_node(node: ts.Node, line_for: SourceLineResolver, state: TreeMetadataState): void {
		this.append_node_metadata(node, line_for, state);
		this.append_attribute_access(node, line_for, state);
		this.append_symbol_reference(node, line_for, state);
	}

	/** Responsibilities: _metadata node collection_. **/
	private append_metadata_node(
		options: TypeScriptMetadataNodeOptions,
	): void {
		const { node, line_for, owner, state, literal_references, literal_constants, on_node } = options;
		this.append_node(node, line_for, state);
		on_node(node, owner);
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			this.literal_metadata.append(node, line_for, literal_references, literal_constants);
		}
	}

	/** Responsibilities: _metadata state initialization_. **/
	private metadata_state(line_for: SourceLineResolver): TreeMetadataState {
		return {
			attribute_accesses: [],
			named_symbols: [],
			symbol_references: [],
			type_declarations: [],
			import_issues: this.import_issues.late_import_issues(this.source_file, line_for),
		};
	}

	/** Responsibilities: _tree metadata result assembly_. **/
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

	/** Responsibilities: _tree metadata collector initialization_. **/
	public constructor(
		source_file: ts.SourceFile,
		require_aliases: TypeScriptExpressionAliasesContract,
		traversal: TypeScriptAstTraversalContract,
	) {
		this.source_file = source_file;
		this.traversal = traversal;
		this.import_issues = new TypeScriptImportIssues(require_aliases);
		this.import_declaration = new TypeScriptImportSymbolDeclaration();
		this.symbol_declaration = new TypeScriptSymbolDeclaration();
		this.type_declarations = new TypeScriptTypeDeclarations();
		this.literal_metadata = new TypeScriptLiteralMetadata(source_file, traversal);
		this.import_symbol_kinds = new Set([
			ts.SyntaxKind.ImportSpecifier,
			ts.SyntaxKind.NamespaceImport,
			ts.SyntaxKind.ImportClause,
		]);
		this.named_symbol_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.PropertySignature,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.VariableDeclaration,
		]);
		this.import_kinds = new Set([
			ts.SyntaxKind.ImportDeclaration,
			ts.SyntaxKind.ImportEqualsDeclaration,
			ts.SyntaxKind.ImportType,
			ts.SyntaxKind.CallExpression,
		]);
		this.type_declaration_kinds = new Set([
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.ClassExpression,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
		]);
	}

	/** Responsibilities: _tree metadata collection_. **/
	public collect(line_for: SourceLineResolver, on_node: TypeScriptMetadataNodeVisitor): TypeScriptTreeMetadata {
		const state = this.metadata_state(line_for);
		const literal_references: AstLiteralReference[] = [];
		const literal_constants: AstLiteralConstant[] = [];
		this.traversal.visit((node, _, owner) => {
			this.append_metadata_node({
				node,
				line_for,
				owner,
				state,
				literal_references,
				literal_constants,
				on_node,
			});
		});
		return this.metadata_result(state, literal_references, literal_constants);
	}

}
