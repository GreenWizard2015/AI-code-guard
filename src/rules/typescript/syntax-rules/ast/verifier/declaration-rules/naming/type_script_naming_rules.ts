import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { NamingSupport } from "src/rules/naming_support";
import { NamingIndexAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/naming/naming_index_analysis";
import type { NamingCandidates, NamingMatches, NamingScope } from "src/rules/typescript/syntax-rules/types";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _declaration naming diagnostics_, _numeric identifier diagnostics_. **/
export class TypeScriptNamingRules implements ASTSourceRuleContract {
	private readonly _index_analysis: NamingIndexAnalysis;

	/** Responsibilities: _binding pattern identifier extraction_. **/
	private binding_identifiers(name: ts.BindingName): ts.Identifier[] {
		if (ts.isIdentifier(name)) {
			return [name];
		}
		const identifiers: ts.Identifier[] = [];
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				identifiers.push(...this.binding_identifiers(element.name));
			}
		}
		return identifiers;
	}

	/** Responsibilities: _symbol candidate construction_. **/
	private symbol_candidates(name: ts.Node, owner: ts.Node): NamingCandidates {
		const source_file = owner.getSourceFile();
		return {
			symbols: [
				{
					name: name.getText(source_file),
					line: source_file.getLineAndCharacterOfPosition(owner.getStart(source_file)).line,
				},
			],
			declarations: [],
		};
	}

	/** Responsibilities: _named type candidate construction_. **/
	private named_type_candidates(name: ts.Identifier, owner: ts.Node): NamingCandidates {
		const source_file = owner.getSourceFile();
		const line = source_file.getLineAndCharacterOfPosition(owner.getStart(source_file)).line;
		const text = name.getText(source_file);
		return { symbols: [{ name: text, line }], declarations: [{ name: text, line }] };
	}

	/** Responsibilities: _binding declaration candidate construction_. **/
	private binding_candidates(binding_node: ts.Node): NamingCandidates {
		if (!ts.isVariableDeclaration(binding_node)) {
			return { symbols: [], declarations: [] };
		}
		const declaration = binding_node;
		const source_file = declaration.getSourceFile();
		return {
			symbols: this.binding_identifiers(declaration.name).map((identifier) => ({
				name: identifier.text,
				line: source_file.getLineAndCharacterOfPosition(identifier.getStart(source_file)).line,
			})),
			declarations: [],
		};
	}

	/** Responsibilities: _import alias candidate resolution_. **/
	private import_candidates(import_node: ts.Node): NamingCandidates {
		if (ts.isImportSpecifier(import_node)) {
			return this.symbol_candidates(import_node.name, import_node);
		}
		if (ts.isNamespaceImport(import_node)) {
			return this.symbol_candidates(import_node.name, import_node);
		}
		if (!ts.isImportClause(import_node)) {
			return { symbols: [], declarations: [] };
		}
		if (import_node.name === undefined) {
			return { symbols: [], declarations: [] };
		}
		return this.symbol_candidates(import_node.name, import_node);
	}

	/** Responsibilities: _callable declaration candidate resolution_. **/
	private callable_candidates(callable_node: ts.Node): NamingCandidates {
		if (ts.isFunctionDeclaration(callable_node)) {
			if (callable_node.name === undefined) {
				return { symbols: [], declarations: [] };
			}
			return this.symbol_candidates(callable_node.name, callable_node);
		}
		if (ts.isMethodDeclaration(callable_node)) {
			return this.symbol_candidates(callable_node.name, callable_node);
		}
		if (ts.isMethodSignature(callable_node)) {
			return this.symbol_candidates(callable_node.name, callable_node);
		}
		if (ts.isParameter(callable_node)) {
			return this.symbol_candidates(callable_node.name, callable_node);
		}
		return { symbols: [], declarations: [] };
	}

	/** Responsibilities: _property declaration candidate resolution_. **/
	private property_candidates(property_node: ts.Node): NamingCandidates {
		if (ts.isPropertyDeclaration(property_node)) {
			return this.symbol_candidates(property_node.name, property_node);
		}
		if (ts.isPropertySignature(property_node)) {
			return this.symbol_candidates(property_node.name, property_node);
		}
		return { symbols: [], declarations: [] };
	}

	/** Responsibilities: _named type candidate resolution_. **/
	private type_candidates(node: ts.Node): NamingCandidates {
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			if (node.name !== undefined) {
				return this.named_type_candidates(node.name, node);
			}
			return { symbols: [], declarations: [] };
		}
		if (ts.isInterfaceDeclaration(node)) {
			return this.named_type_candidates(node.name, node);
		}
		if (ts.isTypeAliasDeclaration(node)) {
			return this.named_type_candidates(node.name, node);
		}
		if (ts.isEnumDeclaration(node)) {
			return this.named_type_candidates(node.name, node);
		}
		return { symbols: [], declarations: [] };
	}

	/** Responsibilities: _node-kind naming candidate resolution_. **/
	private candidates_for(node: ts.Node): NamingCandidates {
		if (ts.isVariableDeclaration(node)) {
			return this.binding_candidates(node);
		}
		if (ts.isImportClause(node) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
			return this.import_candidates(node);
		}
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
			return this.callable_candidates(node);
		}
		if (ts.isMethodSignature(node) || ts.isParameter(node)) {
			return this.callable_candidates(node);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			return this.property_candidates(node);
		}
		return this.type_candidates(node);
	}

	/** Responsibilities: _naming violation reporting_. **/
	private append_matches(context: RuleContextContract, scope: NamingScope, matches: NamingMatches): void {
		const violations: ViolationContract[] = [];
		const naming = new NamingSupport(
			scope.file,
			matches.symbols,
			scope.classes,
			matches.declarations,
			context.state().analysis.stage_timer,
		);
		if (matches.symbols.length > 0) {
			naming.append_symbol_violations(violations);
			naming.report_symbol_numbers(violations);
		}
		if (matches.declarations.length > 0) {
			naming.append_type_violations(violations);
			naming.report_declaration_numbers(violations);
		}
		for (const violation of violations) {
			context.append_violation(violation);
		}
	}

	/** Responsibilities: _naming index initialization_. **/
	public constructor() {
		this._index_analysis = new NamingIndexAnalysis();
	}

	/** Responsibilities: _naming rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _declaration node naming verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (ts.isSourceFile(request.node)) {
			return;
		}
		const state = request.context.state();
		const source_file = state.source.source_file;
		const index = this._index_analysis.index(source_file, state.source.normalized_ast);
		const candidates = this.candidates_for(request.node);
		const matches = this._index_analysis.index_candidates(candidates, index);
		this.append_matches(request.context, { file: state.source.file, classes: index.classes }, matches);
	}
}
