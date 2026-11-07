import ts from "typescript";

/** Responsibilities: _assignment target index_, _private field targets_, _class field mutation rules_. **/
export class TypeScriptFieldWriteTargetIndex {
	private readonly _targets_by_expression: WeakMap<ts.Expression, readonly ts.PropertyAccessExpression[]>;

	/** Responsibilities: _array assignment target indexing_. **/
	private array_targets(array_target: ts.ArrayLiteralExpression): ts.PropertyAccessExpression[] {
		return array_target.elements.flatMap((element) => {
			if (ts.isSpreadElement(element)) {
				return this.targets(element.expression);
			}
			return this.targets(element);
		});
	}

	/** Responsibilities: _object literal target resolution_. **/
	private literal_targets(object_target: ts.ObjectLiteralExpression): ts.PropertyAccessExpression[] {
		return object_target.properties.flatMap((property) => {
			if (ts.isPropertyAssignment(property)) {
				return this.targets(property.initializer);
			}
			if (ts.isSpreadAssignment(property)) {
				return this.targets(property.expression);
			}
			return [];
		});
	}

	/** Responsibilities: _for-in field mutation rules_. **/
	private for_in_violation(for_in_candidate: ts.Node): boolean {
		if (!ts.isForInStatement(for_in_candidate)) {
			return false;
		}
		if (ts.isVariableDeclarationList(for_in_candidate.initializer)) {
			return false;
		}
		return this.invalid_field_target(for_in_candidate.initializer);
	}

	/** Responsibilities: _for-of field mutation rules_. **/
	private for_of_violation(for_of_candidate: ts.Node): boolean {
		if (!ts.isForOfStatement(for_of_candidate)) {
			return false;
		}
		if (ts.isVariableDeclarationList(for_of_candidate.initializer)) {
			return false;
		}
		return this.invalid_field_target(for_of_candidate.initializer);
	}

	/** Responsibilities: _loop field mutation rules_. **/
	private loop_write_violation(loop_candidate: ts.Node): boolean {
		if (this.for_in_violation(loop_candidate)) {
			return true;
		}
		return this.for_of_violation(loop_candidate);
	}

	/** Responsibilities: _assignment field mutation rules_. **/
	private assignment_write_violation(assignment_candidate: ts.Node): boolean {
		if (!ts.isBinaryExpression(assignment_candidate)) {
			return false;
		}
		const operator = assignment_candidate.operatorToken.kind;
		if (operator < ts.SyntaxKind.FirstAssignment) {
			return false;
		}
		if (operator > ts.SyntaxKind.LastAssignment) {
			return false;
		}
		return this.invalid_field_target(assignment_candidate.left);
	}

	/** Responsibilities: _prefix update mutation rules_. **/
	private prefix_update_violation(prefix_candidate: ts.Node): boolean {
		if (!ts.isPrefixUnaryExpression(prefix_candidate)) {
			return false;
		}
		if (prefix_candidate.operator === ts.SyntaxKind.PlusPlusToken) {
			return this.invalid_field_target(prefix_candidate.operand);
		}
		if (prefix_candidate.operator === ts.SyntaxKind.MinusMinusToken) {
			return this.invalid_field_target(prefix_candidate.operand);
		}
		return false;
	}

	/** Responsibilities: _postfix update mutation rules_. **/
	private postfix_update_violation(postfix_candidate: ts.Node): boolean {
		if (!ts.isPostfixUnaryExpression(postfix_candidate)) {
			return false;
		}
		if (postfix_candidate.operator === ts.SyntaxKind.PlusPlusToken) {
			return this.invalid_field_target(postfix_candidate.operand);
		}
		if (postfix_candidate.operator === ts.SyntaxKind.MinusMinusToken) {
			return this.invalid_field_target(postfix_candidate.operand);
		}
		return false;
	}

	/** Responsibilities: _assignment target index setup_. **/
	public constructor() {
		this._targets_by_expression = new WeakMap();
	}

	/** Responsibilities: _assignment expression target lookup_. **/
	public targets(target: ts.Expression): readonly ts.PropertyAccessExpression[] {
		const cached = this._targets_by_expression.get(target);
		if (cached !== undefined) {
			return cached;
		}
		let targets: ts.PropertyAccessExpression[] = [];
		if (ts.isPropertyAccessExpression(target)) {
			targets = [target];
		} else if (ts.isArrayLiteralExpression(target)) {
			targets = this.array_targets(target);
		} else if (ts.isObjectLiteralExpression(target)) {
			targets = this.literal_targets(target);
		}
		this._targets_by_expression.set(target, targets);
		return targets;
	}

	/** Responsibilities: _private field target policy_. **/
	public private_field_target(target: ts.PropertyAccessExpression): boolean {
		let current: ts.Expression = target;
		let root_field = "";
		while (ts.isPropertyAccessExpression(current)) {
			root_field = current.name.text;
			current = current.expression;
		}
		return current.kind === ts.SyntaxKind.ThisKeyword && root_field.startsWith("_");
	}

	/** Responsibilities: _field mutation target constraints_. **/
	public invalid_field_target(target: ts.Expression): boolean {
		return this.targets(target).some((candidate) => !this.private_field_target(candidate));
	}

	/** Responsibilities: _class field mutation constraints_. **/
	public field_write_violation(write_candidate: ts.Node): boolean {
		if (this.loop_write_violation(write_candidate)) {
			return true;
		}
		if (this.assignment_write_violation(write_candidate)) {
			return true;
		}
		if (this.prefix_update_violation(write_candidate)) {
			return true;
		}
		return this.postfix_update_violation(write_candidate);
	}
}
