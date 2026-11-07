import ts from "typescript";

/** Responsibilities: _instance declaration names_, _assignment target names_. **/
export class TypeScriptInstanceBindingNames {
	private readonly _names_by_binding: WeakMap<ts.Node, readonly string[]>;
	private readonly _assignment_targets: WeakMap<ts.Node, string>;

	/** Responsibilities: _recursive binding pattern names_. **/
	private append_pattern_names(pattern: ts.BindingName, names: string[]): void {
		if (ts.isIdentifier(pattern)) {
			names.push(pattern.text);
			return;
		}
		for (const element of pattern.elements) {
			if (ts.isBindingElement(element)) {
				this.append_pattern_names(element.name, names);
			}
		}
	}

	/** Responsibilities: _uncached binding declaration names_. **/
	private collect_names(binding: ts.Node): readonly string[] {
		const assignment_target = this.assignment_target(binding);
		if (assignment_target.length > 0) {
			return [assignment_target];
		}
		if (!ts.isVariableDeclaration(binding) && !ts.isParameter(binding)) {
			return [];
		}
		const names: string[] = [];
		this.append_pattern_names(binding.name, names);
		return names;
	}

	/** Responsibilities: _simple assignment target identification_. **/
	private compute_assignment_target(assignment: ts.Node): string {
		if (!ts.isBinaryExpression(assignment)) {
			return "";
		}
		if (!ts.isIdentifier(assignment.left)) {
			return "";
		}
		if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
			return "";
		}
		return assignment.left.text;
	}

	/** Responsibilities: _binding name cache ownership_. **/
	public constructor() {
		this._names_by_binding = new WeakMap<ts.Node, readonly string[]>();
		this._assignment_targets = new WeakMap<ts.Node, string>();
	}

	/** Responsibilities: _binding declaration name collection_. **/
	public names(binding: ts.Node): readonly string[] {
		const cached = this._names_by_binding.get(binding);
		if (cached !== undefined) {
			return cached;
		}
		const names = this.collect_names(binding);
		this._names_by_binding.set(binding, names);
		return names;
	}

	/** Responsibilities: _simple assignment target identification_. **/
	public assignment_target(assignment: ts.Node): string {
		if (this._assignment_targets.has(assignment)) {
			const cached = this._assignment_targets.get(assignment);
			if (cached !== undefined) {
				return cached;
			}
			return "";
		}
		const target = this.compute_assignment_target(assignment);
		this._assignment_targets.set(assignment, target);
		return target;
	}
}
