import type {
	BindingPropertyNameResolverContract,
	ResolvedStaticBindingQuery,
} from "src/parser/typescript-aliases/protocols";
import ts from "typescript";

/** Responsibilities: _object binding property selection_, _spread expression collection_. **/
export class TypeScriptObjectBindingElementAliases {
	private readonly _binding: ts.BindingElement;
	private readonly _parent_binding: ts.ObjectBindingPattern;
	private readonly _property_names: BindingPropertyNameResolverContract;

	/** Responsibilities: _object binding selection setup_. **/
	public constructor(
		binding: ts.BindingElement,
		parent_binding: ts.ObjectBindingPattern,
		property_names: BindingPropertyNameResolverContract,
	) {
		this._binding = binding;
		this._parent_binding = parent_binding;
		this._property_names = property_names;
	}

	/** Responsibilities: _object binding property selection_. **/
	public properties(initializer: ts.ObjectLiteralExpression): ts.ObjectLiteralElementLike[] {
		if (this._binding.dotDotDotToken) {
			return [];
		}
		const name = this._property_names.property_name(this._binding);
		if (name.length === 0) {
			return [];
		}
		return initializer.properties.filter((property) => {
			if (ts.isSpreadAssignment(property)) {
				return true;
			}
			if (ts.isPropertyAssignment(property)) {
				return this._property_names.property_name(property.name) === name;
			}
			return ts.isShorthandPropertyAssignment(property) && property.name.text === name;
		});
	}

	/** Responsibilities: _matched object property values_. **/
	public property_values(property: ts.ObjectLiteralElementLike): ts.Expression[] {
		const name = this._property_names.property_name(this._binding);
		if (ts.isPropertyAssignment(property) && this._property_names.property_name(property.name) === name) {
			return [property.initializer];
		}
		if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
			return [property.name];
		}
		return [];
	}

	/** Responsibilities: _object binding alias targets_. **/
	public targets(initializer: ts.ObjectLiteralExpression): ResolvedStaticBindingQuery[] {
		const targets: ResolvedStaticBindingQuery[] = [];
		for (const property of this.properties(initializer)) {
			if (ts.isSpreadAssignment(property)) {
				targets.push({ binding: this._parent_binding, current: property.expression });
				continue;
			}
			for (const child of this.property_values(property)) {
				targets.push({ binding: this._binding.name, current: child });
			}
		}
		return targets;
	}
}
