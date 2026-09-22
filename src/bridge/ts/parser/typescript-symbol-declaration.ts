import ts from 'typescript';
import type { AstVisibility, NamedSymbol, NamedSymbolKind } from 'src/types';
import type { NamedSymbolOptions } from 'src/bridge/ts/parser/types';

/** Responsibilities: _classification TypeScript declarations construction_. **/
export class TypeScriptSymbolDeclaration {
	private readonly default_visibility: AstVisibility = 'public';

	/** Responsibilities: _construction symbols variable declarations_. **/
	private variable_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) {
			return [];
		}
		let kind: NamedSymbolKind = 'variable';
		if (ts.isVariableDeclarationList(node.parent)) {
			if ((node.parent.flags & ts.NodeFlags.Const) !== 0) {
				kind = 'constant';
			}
		}
		let is_module_constant = false;
		if (kind === 'constant') {
			is_module_constant = this.is_module_scope(node);
		}
		return [this.named_symbol(node.name.text, node, kind, source_file, {
			is_module_constant: is_module_constant,
			visibility: this.default_visibility,
			is_module_function: false,
		})];
	}

	/** Responsibilities: _construction symbols named declarations_. **/
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

	/** Responsibilities: _construction symbol top-level function_. **/
	private function_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (!ts.isFunctionDeclaration(node) || !node.name) {
			return [];
		}
		return [this.named_symbol(node.name.text, node, 'function', source_file, {
			is_module_constant: false,
			visibility: this.default_visibility,
			is_module_function: ts.isSourceFile(node.parent),
		})];
	}

	/** Responsibilities: _construction symbol class method_. **/
	private method_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		if (ts.isMethodDeclaration(node) && node.name) {
			return [this.named_symbol(node.name.getText(source_file), node, 'method', source_file, {
				is_module_constant: false,
				visibility: this.declaration_visibility(node),
				is_module_function: false,
			})];
		}
if (ts.isMethodSignature(node) && node.name && ts.isInterfaceDeclaration(node.parent)) {
		return [this.named_symbol(node.name.getText(source_file), node, 'method', source_file, {
			is_module_constant: false,
			visibility: this.default_visibility,
			is_module_function: false,
		})];
		}
		return [];
	}

	/** Responsibilities: _construction symbol class field_. **/
	private member_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
if ((ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) && node.name) {
			return [this.named_symbol(node.name.getText(source_file), node, 'field', source_file, {
				is_module_constant: false,
				visibility: this.default_visibility,
				is_module_function: false,
			})];
		}
		if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
			return [this.named_symbol(node.name.text, node, 'variable', source_file, {
				is_module_constant: false,
				visibility: this.default_visibility,
				is_module_function: false,
			})];
		}
		return [];
	}

	/** Responsibilities: _classification variable declaration module_. **/
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

	/** Responsibilities: _creation normalization symbol metadata_. **/
	private named_symbol(
		name: string,
		node: ts.Node,
		kind: NamedSymbolKind,
		source_file: ts.SourceFile,
		options: NamedSymbolOptions
	): NamedSymbol {
		const symbol_options = this.normalized_options(options);
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		return {
			name,
			line,
			kind,
			is_module_constant: symbol_options.is_module_constant,
			visibility: symbol_options.visibility,
			is_module_function: symbol_options.is_module_function,
		};
	}

	/** Responsibilities: _normalization optional symbol metadata_. **/
	private normalized_options(options: NamedSymbolOptions): NamedSymbolOptions {
		const visibility: AstVisibility = options.visibility;
		return {
			is_module_constant: options.is_module_constant === true,
			visibility,
			is_module_function: options.is_module_function === true,
		};
	}

	/** Responsibilities: _classification method visibility TypeScript_. **/
	private declaration_visibility(node: ts.MethodDeclaration): AstVisibility {
		if (node.name && ts.isPrivateIdentifier(node.name)) {
			return 'private';
		}
		if (ts.canHaveModifiers(node)) {
			const modifiers = ts.getModifiers(node);
			if (modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
				return 'private';
			}
			if (modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
				return 'protected';
			}
		}
		return 'public';
	}

	/** Responsibilities: _classification AST declaration normalization_. **/
	public declaration_symbol(node: ts.Node, source_file: ts.SourceFile): NamedSymbol[] {
		const declaration = this.named_declaration(node, source_file);
		if (declaration.length > 0) {
			return declaration;
		}
		return this.variable_symbol(node, source_file);
	}

	/** Responsibilities: _collection normalization symbols source-file_. **/
	public collect_named_symbols(source_file: ts.SourceFile): NamedSymbol[] {
		const symbols: NamedSymbol[] = [];
		const visit = (node: ts.Node): void => {
			symbols.push(...this.declaration_symbol(node, source_file));
			ts.forEachChild(node, visit);
		};
		visit(source_file);
		return symbols;
	}
}
