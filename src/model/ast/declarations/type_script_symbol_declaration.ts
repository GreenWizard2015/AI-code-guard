import { MODULE_CONSTANT_KIND, MODULE_VARIABLE_KIND, PROTECTED_VISIBILITY } from "src/constants";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";
import type { ModuleSymbolFlags, NamedSymbolOptions } from "src/parser/types";
import type { AstVisibility, NamedSymbol, NamedSymbolKind } from "src/types";
import ts from "typescript";

/** Responsibilities: _symbol declarations_, _declaration metadata_. **/
export class TypeScriptSymbolDeclaration {
	private readonly declaration_kinds: ReadonlySet<ts.SyntaxKind>;
	private readonly default_visibility: AstVisibility = "public";

	/** Responsibilities: _named declaration symbols_. **/
	private named_declaration(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		const function_value = this.function_symbol(node, source_file);
		if (function_value.length > 0) {
			return function_value;
		}
		const method_value = this.method_symbol(node, source_file);
		if (method_value.length > 0) {
			return method_value;
		}
		return this.member_symbol(node, source_file);
	}

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
			if (ts.isFunctionLike(current)) {
				return false;
			}
			if (ts.isClassLike(current)) {
				return false;
			}
			current = current.parent;
		}
		return true;
	}

	/** Responsibilities: _symbol metadata normalization_. **/
	private named_symbol(
		name: string,
		node: ts.Node,
		kind: NamedSymbolKind,
		source_file: ts.SourceFile,
		options: NamedSymbolOptions,
	): NamedSymbol {
		const visibility: AstVisibility = options.visibility;
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		return {
			name,
			line,
			kind,
			is_module_constant: options.is_module_constant === true,
			is_module_variable: options.is_module_variable === true,
			visibility,
			is_module_function: options.is_module_function === true,
		};
	}

	/** Responsibilities: _method visibility_. **/
	private declaration_visibility(node: ts.MethodDeclaration): AstVisibility {
		if (node.name) {
			if (ts.isPrivateIdentifier(node.name)) {
				return "private";
			}
		}
		if (ts.canHaveModifiers(node)) {
			const modifiers = ts.getModifiers(node);
			if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
				return "private";
			}
			if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
				return PROTECTED_VISIBILITY;
			}
		}
		return "public";
	}

	/** Responsibilities: _function symbol construction_. **/
	private function_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (!ts.isFunctionDeclaration(node) || !node.name) {
			return [];
		}
		return [
			this.named_symbol(node.name.text, node, MODULE_FUNCTION_KIND, source_file, {
				is_module_constant: false,
				is_module_variable: false,
				visibility: this.default_visibility,
				is_module_function: ts.isSourceFile(node.parent),
			}),
		];
	}

	/** Responsibilities: _method symbol construction_. **/
	private method_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		let name = "";
		let visibility = this.default_visibility;
		if (ts.isMethodDeclaration(node) && node.name) {
			name = node.name.getText(source_file);
			visibility = this.declaration_visibility(node);
		} else if (ts.isMethodSignature(node) && node.name && ts.isInterfaceDeclaration(node.parent)) {
			name = node.name.getText(source_file);
		} else {
			return [];
		}
		return [
			this.named_symbol(name, node, "method", source_file, {
				is_module_constant: false,
				is_module_variable: false,
				visibility,
				is_module_function: false,
			}),
		];
	}

	/** Responsibilities: _member symbol construction_. **/
	private member_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
			if (node.name) {
				return [
					this.named_symbol(node.name.getText(source_file), node, "field", source_file, {
						is_module_constant: false,
						is_module_variable: false,
						visibility: this.default_visibility,
						is_module_function: false,
					}),
				];
			}
		}
		if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			return [
				this.named_symbol(node.name.text, node, MODULE_VARIABLE_KIND, source_file, {
					is_module_constant: false,
					is_module_variable: false,
					visibility: this.default_visibility,
					is_module_function: false,
				}),
			];
		}
		return [];
	}

	/** Responsibilities: _symbol declaration initialization_. **/
	public constructor() {
		this.declaration_kinds = new Set([
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
	public variable_symbols(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (!ts.isVariableDeclaration(node)) {
			return [];
		}
		let kind: NamedSymbolKind = MODULE_VARIABLE_KIND;
		if (ts.isVariableDeclarationList(node.parent)) {
			if ((node.parent.flags & ts.NodeFlags.Const) !== 0) {
				kind = MODULE_CONSTANT_KIND;
			}
		}
		const is_module_scope = this.is_module_scope(node);
		return this.binding_names(node.name).map((name) =>
			this.named_symbol(name.text, name, kind, source_file, {
				...this.module_flags(kind, is_module_scope),
				visibility: this.default_visibility,
				is_module_function: false,
			}),
		);
	}

	/** Responsibilities: _declaration symbol construction_. **/
	public declaration_symbols(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (!this.declaration_kinds.has(node.kind)) {
			return [];
		}
		const declaration = this.named_declaration(node, source_file);
		if (declaration.length > 0) {
			return declaration;
		}
		return this.variable_symbols(node, source_file);
	}
}
