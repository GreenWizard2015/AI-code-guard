import ts from "typescript";
import type { CallbackKind } from "src/types";

/** Responsibilities: _resolution TypeScript callback aliases_. **/
export class TypeScriptCallbackAliases {
	private readonly source_file: ts.SourceFile;

	/** Responsibilities: _collection array binding initializers_. **/
	private array_pattern_initializers(
		pattern: ts.ArrayBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ts.Expression[] {
		if (!ts.isArrayLiteralExpression(initializer)) {
			return [];
		}
		const initializers: ts.Expression[] = [];
		for (const [index, element] of pattern.elements.entries()) {
			if (index >= initializer.elements.length || !ts.isBindingElement(element)) {
				continue;
			}
			initializers.push(...this.binding_initializers(element.name, initializer.elements[index], name));
		}
		return initializers;
	}

	/** Responsibilities: _resolution object binding value_. **/
	private object_values(initializer: ts.Expression, name: string): ts.Expression[] {
		if (!ts.isObjectLiteralExpression(initializer)) {
			return [];
		}
		for (const property of initializer.properties) {
			if (ts.isPropertyAssignment(property) && property.name.getText(this.source_file) === name) {
				return [property.initializer];
			}
			if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
				return [property.name];
			}
		}
		return [];
	}

	/** Responsibilities: _collection object binding initializers_. **/
	private object_pattern_initializers(
		pattern: ts.ObjectBindingPattern,
		initializer: ts.Expression,
		name: string,
	): ts.Expression[] {
		const initializers: ts.Expression[] = [];
		for (const element of pattern.elements) {
			if (!ts.isBindingElement(element)) {
				continue;
			}
			let property_name = element.name.getText(this.source_file);
			if (element.propertyName !== undefined) {
				property_name = element.propertyName.getText(this.source_file);
			}
			for (const value of this.object_values(initializer, property_name)) {
				initializers.push(...this.binding_initializers(element.name, value, name));
			}
		}
		return initializers;
	}

	/** Responsibilities: _collection binding initializers_. **/
	private binding_initializers(pattern: ts.BindingName, initializer: ts.Expression, name: string): ts.Expression[] {
		if (ts.isIdentifier(pattern)) {
			if (pattern.text === name) {
				return [initializer];
			}
			return [];
		}
		if (ts.isArrayBindingPattern(pattern)) {
			return this.array_pattern_initializers(pattern, initializer, name);
		}
		return this.object_pattern_initializers(pattern, initializer, name);
	}

	/** Responsibilities: _classification callback initializer_. **/
	private initializer_kind(initializer: ts.Expression, seen: Set<string>): CallbackKind {
		if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
			return "inline";
		}
		if (ts.isIdentifier(initializer)) {
			return this.alias_kind(initializer.text, seen);
		}
		return "none";
	}

	/** Responsibilities: _resolution callback alias kind_. **/
	private alias_kind(name: string, seen: Set<string>): CallbackKind {
		if (seen.has(name)) {
			return "none";
		}
		seen.add(name);
		for (const initializer of this.initializers(name)) {
			const kind = this.initializer_kind(initializer, seen);
			if (kind !== "none") {
				return kind;
			}
		}
		return "none";
	}

	/** Responsibilities: _initialization source file_. **/
	public constructor(source_file: ts.SourceFile) {
		this.source_file = source_file;
	}

	/** Responsibilities: _collection callback initializers_. **/
	public initializers(name: string): ts.Expression[] {
		const initializers: ts.Expression[] = [];
		const visit = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
				initializers.push(...this.binding_initializers(node.name, node.initializer, name));
			}
			node.forEachChild(visit);
		};
		visit(this.source_file);
		return initializers;
	}

	/** Responsibilities: _classification callback alias_. **/
	public kind(name: string): CallbackKind {
		return this.alias_kind(name, new Set<string>());
	}
}
