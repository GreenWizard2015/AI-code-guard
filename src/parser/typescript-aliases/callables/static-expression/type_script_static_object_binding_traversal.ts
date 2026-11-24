import type { CallableStaticObjectBranchAppender } from "src/runtime_types";
import type { TypeScriptStaticObjectAssignmentClassifierContract } from "src/typescript_analysis_protocols";
import type { TypeScriptStaticObjectArgumentsContract } from "src/typescript_runtime_protocols";
import ts from "typescript";

/** Responsibilities: _binding branch traversal_, _branch operator classification_. **/
export class TypeScriptStaticObjectBindingTraversal {
	private readonly _arguments_source: TypeScriptStaticObjectArgumentsContract;
	private readonly _assignment_classifier: TypeScriptStaticObjectAssignmentClassifierContract;
	private readonly _append_branch: CallableStaticObjectBranchAppender;

	/** Responsibilities: _call argument binding_. **/
	private append_call_argument(argument: ts.Expression): boolean {
		if (ts.isSpreadElement(argument)) {
			return this._arguments_source.append_spread(argument, this._append_branch);
		}
		return this._append_branch(argument);
	}

	/** Responsibilities: _assignment call binding_. **/
	private append_call_binding(current: ts.CallExpression): boolean {
		if (!this._assignment_classifier.object_assign_call(current)) {
			return false;
		}
		let found = false;
		for (const argument of current.arguments) {
			if (this.append_call_argument(argument)) {
				found = true;
			}
		}
		return found;
	}

	/** Responsibilities: _conditional binding branches_. **/
	private append_conditional_binding(current: ts.ConditionalExpression): boolean {
		const true_branch = this._append_branch(current.whenTrue);
		const false_branch = this._append_branch(current.whenFalse);
		if (true_branch) {
			return true;
		}
		return false_branch;
	}

	/** Responsibilities: _binary binding branches_. **/
	private append_binary_binding(current: ts.BinaryExpression): boolean {
		if (!this.branch_operator_supported(current.operatorToken.kind)) {
			return false;
		}
		const left_branch = this._append_branch(current.left);
		const right_branch = this._append_branch(current.right);
		if (left_branch) {
			return true;
		}
		return right_branch;
	}

	/** Responsibilities: _binding branch traversal setup_. **/
	public constructor(
		arguments_source: TypeScriptStaticObjectArgumentsContract,
		assignment_classifier: TypeScriptStaticObjectAssignmentClassifierContract,
		append_branch: CallableStaticObjectBranchAppender,
	) {
		this._arguments_source = arguments_source;
		this._assignment_classifier = assignment_classifier;
		this._append_branch = append_branch;
	}

	/** Responsibilities: _binding branch operator classification_. **/
	public branch_operator_supported(kind: ts.SyntaxKind): boolean {
		if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.BarBarToken) {
			return true;
		}
		if (kind === ts.SyntaxKind.QuestionQuestionToken) {
			return true;
		}
		return kind === ts.SyntaxKind.CommaToken;
	}

	/** Responsibilities: _binding expression traversal_. **/
	public append(expression: ts.Expression): boolean {
		if (ts.isConditionalExpression(expression)) {
			return this.append_conditional_binding(expression);
		}
		if (ts.isBinaryExpression(expression)) {
			return this.append_binary_binding(expression);
		}
		if (ts.isCallExpression(expression)) {
			return this.append_call_binding(expression);
		}
		return false;
	}
}
