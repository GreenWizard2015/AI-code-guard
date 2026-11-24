import type { TypeScriptCallbackAliasesContract } from "src/model/protocols";
import type { CallbackKind } from "src/types";
import ts from "typescript";

/** Responsibilities: _callback alias source lookup_, _callback kind resolution_. **/
export class TypeScriptCallbackAliases implements TypeScriptCallbackAliasesContract {
	private readonly _source_file: ts.SourceFile;
	private readonly _alias_name: string;
	private readonly _visited_aliases: Set<string>;

	/** Responsibilities: _array binding initializer lookup_. **/
	private array_pattern_initializers(
		pattern: ts.ArrayBindingPattern,
		initializer: ts.ArrayLiteralExpression,
	): ts.Expression[] {
		const initializers: ts.Expression[] = [];
		for (const [index, element] of pattern.elements.entries()) {
			if (index >= initializer.elements.length) {
				continue;
			}
			const value = initializer.elements[index];
			if (value === undefined) {
				continue;
			}
			if (!ts.isBindingElement(element)) {
				continue;
			}
			initializers.push(...this.binding_initializers(element.name, value));
		}
		return initializers;
	}

	/** Responsibilities: _object binding property lookup_. **/
	private object_values(initializer: ts.ObjectLiteralExpression, property_name: string): ts.Expression[] {
		for (const property of initializer.properties) {
			if (ts.isPropertyAssignment(property) && property.name.getText(this._source_file) === property_name) {
				return [property.initializer];
			}
			if (ts.isShorthandPropertyAssignment(property) && property.name.text === property_name) {
				return [property.name];
			}
		}
		return [];
	}

	/** Responsibilities: _object binding initializer lookup_. **/
	private object_pattern_initializers(
		pattern: ts.ObjectBindingPattern,
		initializer: ts.ObjectLiteralExpression,
	): ts.Expression[] {
		const initializers: ts.Expression[] = [];
		for (const element of pattern.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			let property_name = element.name.getText(this._source_file);
			if (element.propertyName !== undefined) {
				property_name = element.propertyName.getText(this._source_file);
			}
			for (const value of this.object_values(initializer, property_name)) {
				initializers.push(...this.binding_initializers(element.name, value));
			}
		}
		return initializers;
	}

	/** Responsibilities: _binding initializer lookup_. **/
	private binding_initializers(pattern: ts.BindingName, initializer: ts.Expression): ts.Expression[] {
		if (ts.isIdentifier(pattern)) {
			if (pattern.text === this._alias_name) {
				return [initializer];
			}
			return [];
		}
		if (ts.isArrayBindingPattern(pattern) && ts.isArrayLiteralExpression(initializer)) {
			return this.array_pattern_initializers(pattern, initializer);
		}
		if (ts.isObjectBindingPattern(pattern) && ts.isObjectLiteralExpression(initializer)) {
			return this.object_pattern_initializers(pattern, initializer);
		}
		return [];
	}

	/** Responsibilities: _callback initializer classification_. **/
	private initializer_kind(initializer: ts.Expression): CallbackKind {
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			return "inline";
		}
		if (!ts.isIdentifier(initializer)) {
			return "none";
		}
		const aliases = new TypeScriptCallbackAliases(this._source_file, initializer.text, this._visited_aliases);
		return aliases.kind();
	}

	/** Responsibilities: _callback alias initialization_. **/
	public constructor(source_file: ts.SourceFile, alias_name: string, visited_aliases: Set<string>) {
		this._source_file = source_file;
		this._alias_name = alias_name;
		this._visited_aliases = visited_aliases;
	}

	/** Responsibilities: _callback alias initializer collection_. **/
	public initializers(): ts.Expression[] {
		const initializers: ts.Expression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
				initializers.push(...this.binding_initializers(node.name, node.initializer));
			}
			node.forEachChild(visit);
		};
		visit(this._source_file);
		return initializers;
	}

	/** Responsibilities: _callback alias kind resolution_. **/
	public kind(): CallbackKind {
		if (this._visited_aliases.has(this._alias_name)) {
			return "none";
		}
		this._visited_aliases.add(this._alias_name);
		for (const initializer of this.initializers()) {
			const kind = this.initializer_kind(initializer);
			if (kind !== "none") {
				return kind;
			}
		}
		return "none";
	}
}
