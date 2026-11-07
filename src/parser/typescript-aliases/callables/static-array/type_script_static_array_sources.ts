import type {
	StaticArrayAssignment,
	StaticArraySourceCandidate,
	StaticExpressionArrayContract,
} from "src/analysis_protocols";
import { TypeScriptStaticArrayIndexValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_index_values";
import { TypeScriptStaticArrayValues } from "src/parser/typescript-aliases/callables/static-array/type_script_static_array_values";
import type { TypeScriptStaticArraySourcesContract } from "src/parser/typescript-aliases/protocols";
import type { ExpressionNamesContract } from "src/runtime_protocols";
import type {
	TypeScriptStaticArrayIndexValuesContract,
	TypeScriptStaticArrayValuesContract,
} from "src/typescript_analysis_protocols";
import type { TypeScriptObjectAliasDeclarationIndexContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _array source alias tracking_, _numeric source tracking_. **/
export class TypeScriptStaticArraySources implements TypeScriptStaticArraySourcesContract {
	private readonly _expression_names: ExpressionNamesContract;
	private readonly _array_sources: Map<string, StaticExpressionArrayContract>;
	private readonly _numeric_sources: Map<string, number>;
	private readonly _uncertain_array_sources: Set<string>;
	private readonly _assignment_names: Set<string>;
	private readonly _index_values: TypeScriptStaticArrayIndexValuesContract;
	private readonly _array_values: TypeScriptStaticArrayValuesContract;

	/** Responsibilities: _array source equality_. **/
	private same_values(left: StaticExpressionArrayContract, right: StaticExpressionArrayContract): boolean {
		if (left === right) {
			return true;
		}
		if (left.size() !== right.size()) {
			return false;
		}
		for (let index = 0n; index < left.size(); index += 1n) {
			if (left.at(index).getText() !== right.at(index).getText()) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _array value assignment_. **/
	private append_array_assignment(assignment: StaticArrayAssignment): boolean {
		const { name, values } = assignment;
		if (this._uncertain_array_sources.has(name)) {
			return false;
		}
		const existing = this._array_sources.get(name);
		if (this._assignment_names.has(name)) {
			return this.append_reassignment(assignment);
		}
		this._assignment_names.add(name);
		if (existing !== undefined && this.same_values(existing, values)) {
			return false;
		}
		this._array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _repeated array assignment state_. **/
	private append_reassignment(assignment: StaticArrayAssignment): boolean {
		const { name, values } = assignment;
		const existing = this._array_sources.get(name);
		if (existing === undefined) {
			this._array_sources.set(name, values);
			return true;
		}
		if (this.same_values(existing, values)) {
			return false;
		}
		this._array_sources.delete(name);
		this._uncertain_array_sources.add(name);
		return true;
	}

	/** Responsibilities: _numeric array source registration_. **/
	private append_numeric_source(source: StaticArraySourceCandidate): boolean {
		const { name, current } = source;
		const value = this._index_values.numeric_index(current);
		if (value < 0 || this._numeric_sources.has(name)) {
			return false;
		}
		this._numeric_sources.set(name, value);
		return true;
	}

	/** Responsibilities: _array source registration_. **/
	private append_array_source(source: StaticArraySourceCandidate): boolean {
		const { name, current } = source;
		if (this._array_sources.has(name) || this._uncertain_array_sources.has(name)) {
			return false;
		}
		const values = this._array_values.sequence(current);
		if (values.size() === 0n && !ts.isArrayLiteralExpression(current)) {
			return false;
		}
		this._array_sources.set(name, values);
		return true;
	}

	/** Responsibilities: _numeric assignment state update_. **/
	private append_numeric_assignment(name: string, expression: ts.Expression): boolean {
		const value = this._index_values.numeric_index(expression);
		if (value < 0) {
			return false;
		}
		const existing = this._numeric_sources.get(name);
		if (existing === undefined) {
			this._numeric_sources.set(name, value);
			return true;
		}
		if (existing !== value && existing >= 0) {
			this._numeric_sources.set(name, -1);
			return true;
		}
		return false;
	}

	/** Responsibilities: _array source classification_. **/

	/** Responsibilities: _static array source dependencies_. **/
	public constructor(
		array_sources: Map<string, StaticExpressionArrayContract>,
		numeric_sources: Map<string, number>,
		expression_names: ExpressionNamesContract,
		declaration_index: TypeScriptObjectAliasDeclarationIndexContract,
	) {
		this._uncertain_array_sources = new Set<string>();
		this._assignment_names = new Set<string>();
		this._array_sources = array_sources;
		this._numeric_sources = numeric_sources;
		this._expression_names = expression_names;
		this._index_values = new TypeScriptStaticArrayIndexValues(this._numeric_sources, declaration_index);
		this._array_values = new TypeScriptStaticArrayValues(
			this._array_sources,
			this._numeric_sources,
			expression_names,
			declaration_index,
		);
	}

	/** Responsibilities: _array source declaration collection_. **/
	public append_source(node: ts.VariableDeclaration): boolean {
		if (!ts.isIdentifier(node.name)) {
			return false;
		}
		if (node.initializer === undefined) {
			return false;
		}
		const current = this._expression_names.unwrap_transparent_expression(node.initializer);
		const candidate = { name: node.name.text, current };
		if (this.append_numeric_source(candidate)) {
			return true;
		}
		return this.append_array_source(candidate);
	}
	/** Responsibilities: _array assignment source collection_. **/
	public append_assignment(name: string, expression: ts.Expression): boolean {
		const current = this._expression_names.unwrap_transparent_expression(expression);
		if (this.append_numeric_assignment(name, current)) {
			return true;
		}
		return this.append_array_assignment({ name, values: this._array_values.sequence(current) });
	}

	/** Responsibilities: _array rest source collection_. **/
	public append_rest(source: StaticArrayAssignment): boolean {
		const { name, values } = source;
		if (this._array_sources.has(name)) {
			return false;
		}
		this._array_sources.set(name, values);
		return true;
	}
}
