import {
	MODULE_CONSTANT_KIND,
	MODULE_VARIABLE_KIND,
	PROTECTED_VISIBILITY,
	TYPE_FIELD_SYMBOL_KIND,
} from "src/constants";
import type { AstVisibility, NamedSymbol, NamedSymbolKind } from "src/model/ast/normalized_ast_types";
import type { ModuleSymbolFlags, NamedSymbolOptions } from "src/parser/types";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import ts from "typescript";

/** Responsibilities: _symbol declarations_, _declaration metadata_. **/
export class TypeScriptSymbolDeclaration {
	private readonly _source_file: ts.SourceFile;
	private readonly _declaration_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly default_visibility: AstVisibility = "public";

	/** Responsibilities: _module symbol flags_. **/
	private module_flags(kind: NamedSymbolKind, is_module_scope: boolean): ModuleSymbolFlags {
		if (!is_module_scope) {
			return { is_module_constant: false, is_module_variable: false };
		}
		if (kind === MODULE_CONSTANT_KIND) {
			return { is_module_constant: true, is_module_variable: false };
		}
		if (kind === MODULE_VARIABLE_KIND) {
			return { is_module_constant: false, is_module_variable: true };
		}
		return { is_module_constant: false, is_module_variable: false };
	}

	/** Responsibilities: _binding names_. **/
	private binding_names(name: ts.BindingName): ts.Identifier[] {
		if (ts.isIdentifier(name)) {
			return [name];
		}
		const names: ts.Identifier[] = [];
		for (const element of name.elements) {
			if (ts.isBindingElement(element)) {
				names.push(...this.binding_names(element.name));
			}
		}
		return names;
	}

	/** Responsibilities: _module scope classification_. **/
	private is_module_scope(node: ts.VariableDeclaration): boolean {
		let current: ts.Node = node.parent;
		while (!ts.isSourceFile(current)) {
			if (ts.isFunctionLike(current) || ts.isClassLike(current)) {
				return false;
			}
			current = current.parent;
		}
		return true;
	}

	/** Responsibilities: _symbol metadata normalization_. **/
	private named_symbol(name: string, node: ts.Node, kind: NamedSymbolKind, options: NamedSymbolOptions): NamedSymbol {
		const line = this._source_file.getLineAndCharacterOfPosition(node.getStart(this._source_file)).line;
		return {
			name,
			line,
			kind,
			is_module_constant: options.is_module_constant === true,
			is_module_variable: options.is_module_variable === true,
			visibility: options.visibility,
			is_module_function: options.is_module_function === true,
		};
	}

	/** Responsibilities: _method visibility_. **/
	private declaration_visibility(node: ts.MethodDeclaration): AstVisibility {
		if (node.name && ts.isPrivateIdentifier(node.name)) {
			return "private";
		}
		if (!ts.canHaveModifiers(node)) {
			return this.default_visibility;
		}
		const modifiers = ts.getModifiers(node);
		if (modifiers !== undefined) {
			if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
				return "private";
			}
			if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
				return PROTECTED_VISIBILITY;
			}
		}
		return this.default_visibility;
	}

	/** Responsibilities: _function symbol construction_. **/
	private function_symbol(declaration: ts.FunctionDeclaration): NamedSymbol[] {
		if (declaration.name === undefined) {
			return [];
		}
		return [
			this.named_symbol(declaration.name.text, declaration, MODULE_FUNCTION_KIND, {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: ts.isSourceFile(declaration.parent),
			}),
		];
	}

	/** Responsibilities: _method declaration symbol construction_. **/
	private method_declaration_symbol(declaration: ts.MethodDeclaration): NamedSymbol[] {
		const name = declaration.name.getText(this._source_file);
		return [
			this.named_symbol(name, declaration, "method", {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.declaration_visibility(declaration),
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _interface method symbol construction_. **/
	private method_signature_symbol(signature: ts.MethodSignature): NamedSymbol[] {
		if (!ts.isInterfaceDeclaration(signature.parent)) {
			return [];
		}
		return [
			this.named_symbol(signature.name.getText(this._source_file), signature, "method", {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _property declaration symbol construction_. **/
	private property_declaration_symbol(property: ts.PropertyDeclaration): NamedSymbol[] {
		return [
			this.named_symbol(property.name.getText(this._source_file), property, "field", {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _property signature symbol construction_. **/
	private property_signature_symbol(property: ts.PropertySignature): NamedSymbol[] {
		return [
			this.named_symbol(property.name.getText(this._source_file), property, TYPE_FIELD_SYMBOL_KIND, {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _parameter symbol construction_. **/
	private parameter_symbol(parameter: ts.ParameterDeclaration): NamedSymbol[] {
		if (!ts.isIdentifier(parameter.name)) {
			return [];
		}
		return [
			this.named_symbol(parameter.name.text, parameter, MODULE_VARIABLE_KIND, {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _callable symbol selection_. **/
	private callable_symbols(callable_declaration: ts.Node): NamedSymbol[] {
		if (ts.isFunctionDeclaration(callable_declaration)) {
			return this.function_symbol(callable_declaration);
		}
		if (ts.isMethodDeclaration(callable_declaration)) {
			return this.method_declaration_symbol(callable_declaration);
		}
		if (ts.isMethodSignature(callable_declaration)) {
			return this.method_signature_symbol(callable_declaration);
		}
		return [];
	}

	/** Responsibilities: _member symbol selection_. **/
	private member_symbols(member_declaration: ts.Node): NamedSymbol[] {
		if (ts.isPropertyDeclaration(member_declaration)) {
			return this.property_declaration_symbol(member_declaration);
		}
		if (ts.isPropertySignature(member_declaration)) {
			return this.property_signature_symbol(member_declaration);
		}
		if (ts.isParameter(member_declaration)) {
			return this.parameter_symbol(member_declaration);
		}
		return [];
	}

	/** Responsibilities: _symbol declaration initialization_. **/
	public constructor(source_file: ts.SourceFile) {
		this._source_file = source_file;
		this._declaration_kinds = new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.PropertyDeclaration,
			ts.SyntaxKind.PropertySignature,
			ts.SyntaxKind.Parameter,
			ts.SyntaxKind.VariableDeclaration,
		]);
	}

	/** Responsibilities: _variable symbol construction_. **/
	public variable_symbols(node: ts.VariableDeclaration): NamedSymbol[] {
		let kind: NamedSymbolKind = MODULE_VARIABLE_KIND;
		if (ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0) {
			kind = MODULE_CONSTANT_KIND;
		}
		const is_module_scope = this.is_module_scope(node);
		return this.binding_names(node.name).map((name) =>
			this.named_symbol(name.text, name, kind, {
				...this.module_flags(kind, is_module_scope),
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		);
	}

	/** Responsibilities: _declaration symbol construction_. **/
	public declaration_symbols(node: ts.Node): NamedSymbol[] {
		if (!this._declaration_kinds.has(node.kind)) {
			return [];
		}
		if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			return this.callable_symbols(node);
		}
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isParameter(node)) {
			return this.member_symbols(node);
		}
		if (ts.isVariableDeclaration(node)) {
			return this.variable_symbols(node);
		}
		return [];
	}
}
