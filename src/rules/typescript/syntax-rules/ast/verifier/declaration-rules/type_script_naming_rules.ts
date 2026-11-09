import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { NamingSupport } from "src/rules/naming_support";
import { NamingIndexAnalysis } from "src/rules/typescript/syntax-rules/ast/verifier/declaration-rules/naming_index_analysis";
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

	/** Responsibilities: _declaration candidate resolution_. **/
	private declaration_candidates(node: ts.Node): NamingCandidates {
		const binding = this.binding_candidates(node);
		const imported = this.import_candidates(node);
		const callable = this.callable_candidates(node);
		const property = this.property_candidates(node);
		return {
			symbols: [...binding.symbols, ...imported.symbols, ...callable.symbols, ...property.symbols],
			declarations: [],
		};
	}

	/** Responsibilities: _class type candidate resolution_. **/
	private class_type_candidates(class_node: ts.Node): NamingCandidates {
		if (ts.isClassDeclaration(class_node)) {
			if (class_node.name === undefined) {
				return { symbols: [], declarations: [] };
			}
			return this.named_type_candidates(class_node.name, class_node);
		}
		if (ts.isClassExpression(class_node)) {
			if (class_node.name === undefined) {
				return { symbols: [], declarations: [] };
			}
			return this.named_type_candidates(class_node.name, class_node);
		}
		return { symbols: [], declarations: [] };
	}

	/** Responsibilities: _type declaration naming_. **/
	private type_declaration_candidates(type_node: ts.Node): NamingCandidates {
		if (ts.isInterfaceDeclaration(type_node)) {
			return this.named_type_candidates(type_node.name, type_node);
		}
		if (ts.isTypeAliasDeclaration(type_node)) {
			return this.named_type_candidates(type_node.name, type_node);
		}
		if (ts.isEnumDeclaration(type_node)) {
			return this.named_type_candidates(type_node.name, type_node);
		}
		return { symbols: [], declarations: [] };
	}

	/** Responsibilities: _type declaration candidate resolution_. **/
	private type_candidates(node: ts.Node): NamingCandidates {
		const classes = this.class_type_candidates(node);
		const named_types = this.type_declaration_candidates(node);
		return {
			symbols: [...classes.symbols, ...named_types.symbols],
			declarations: [...classes.declarations, ...named_types.declarations],
		};
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
		const declarations = this.declaration_candidates(request.node);
		const types = this.type_candidates(request.node);
		const candidates: NamingCandidates = {
			symbols: [...declarations.symbols, ...types.symbols],
			declarations: [...declarations.declarations, ...types.declarations],
		};
		const matches = this._index_analysis.index_candidates(candidates, index);
		this.append_matches(request.context, { file: state.source.file, classes: index.classes }, matches);
	}
}
