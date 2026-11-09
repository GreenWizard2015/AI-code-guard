import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { RULE_IDS } from "src/linting/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _catch block diagnostics_, _error context preservation_. **/
export class TypeScriptErrorRules implements ASTSourceRuleContract {
	private readonly _error_name_suffix: string;
	private readonly _context_loss_rule: DiagnosticRuleContract;

	/** Responsibilities: _caught name reference lookup_. **/
	private contains_name(expression_node: ts.Node, identifier_name: string): boolean {
		if (ts.isIdentifier(expression_node) && expression_node.text === identifier_name) {
			return true;
		}
		if (ts.isFunctionLike(expression_node)) {
			return false;
		}
		let found = false;
		expression_node.forEachChild((child) => {
			if (!found && this.contains_name(child, identifier_name)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _error throw identity_. **/
	private translation_key(throw_statement: ts.ThrowStatement): string {
		if (!ts.isNewExpression(throw_statement.expression)) {
			return "";
		}
		const expression = throw_statement.expression.expression;
		if (!ts.isIdentifier(expression)) {
			return "";
		}
		if (!expression.text.endsWith(this._error_name_suffix)) {
			return "";
		}
		const args = (throw_statement.expression.arguments ?? []).map((argument) => argument.getText());
		return `${expression.text}(${args.join(",")})`;
	}

	/** Responsibilities: _translation key indexing_. **/
	private append_translation_key(translation_node: ts.Node, keys: Set<string>): boolean {
		if (!ts.isThrowStatement(translation_node)) {
			return false;
		}
		const key = this.translation_key(translation_node);
		if (key.length === 0) {
			return false;
		}
		if (keys.has(key)) {
			return true;
		}
		keys.add(key);
		return false;
	}

	/** Responsibilities: _translation duplicate traversal_. **/
	private has_duplicate_translation(translation_node: ts.Node, keys: Set<string>): boolean {
		if (ts.isCatchClause(translation_node) || ts.isFunctionLike(translation_node)) {
			return false;
		}
		let duplicate = this.append_translation_key(translation_node, keys);
		translation_node.forEachChild((child) => {
			if (this.has_duplicate_translation(child, keys)) {
				duplicate = true;
			}
		});
		return duplicate;
	}

	/** Responsibilities: _caught error context omission_. **/
	private omits_caught_name(throw_statement: ts.ThrowStatement, caught_identifier: string): boolean {
		if (!ts.isNewExpression(throw_statement.expression)) {
			return false;
		}
		const error_type = throw_statement.expression.expression;
		if (!ts.isIdentifier(error_type)) {
			return false;
		}
		if (!error_type.text.endsWith(this._error_name_suffix)) {
			return false;
		}
		return !this.contains_name(throw_statement.expression, caught_identifier);
	}

	/** Responsibilities: _caught context name lookup_. **/
	private caught_context_name(catch_clause: ts.CatchClause): string {
		const variable = catch_clause.variableDeclaration;
		if (variable === undefined || !ts.isIdentifier(variable.name)) {
			return "";
		}
		if (variable.name.text === "_") {
			return "";
		}
		return variable.name.text;
	}

	/** Responsibilities: _context loss node traversal_. **/
	private report_context_loss(
		context_node: ts.Node,
		caught_identifier: string,
		rule_context: RuleContextContract,
	): void {
		if (ts.isFunctionLike(context_node) || ts.isCatchClause(context_node)) {
			return;
		}
		if (ts.isThrowStatement(context_node)) {
			if (this.omits_caught_name(context_node, caught_identifier)) {
				rule_context.for_node(context_node).append_diagnostic_rule(this._context_loss_rule);
			}
		}
		context_node.forEachChild((child) => {
			this.report_context_loss(child, caught_identifier, rule_context);
		});
	}

	/** Responsibilities: _error context loss reporting_. **/
	private append_context_loss(catch_clause: ts.CatchClause, context: RuleContextContract): void {
		const caught_identifier = this.caught_context_name(catch_clause);
		if (caught_identifier.length === 0) {
			return;
		}
		this.report_context_loss(catch_clause.block, caught_identifier, context);
	}

	/** Responsibilities: _error rule initialization_. **/
	public constructor() {
		this._error_name_suffix = "Error";
		this._context_loss_rule = new DiagnosticRule(RULE_IDS.error_context_loss);
	}

	/** Responsibilities: _error rule activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _catch node verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = request;
		if (!ts.isCatchClause(node)) {
			return;
		}
		const stage_timer = context.state().analysis.stage_timer;
		stage_timer.measure(`rule.${RULE_IDS.empty_error_handler}`, () => {
			if (node.block.statements.length === 0) {
				context.for_node(node).append_rule(RULE_IDS.empty_error_handler);
			}
		});
		stage_timer.measure(`rule.${RULE_IDS.error_context_loss}`, () => this.append_context_loss(node, context));
		if (context.state().source.test_file) {
			return;
		}
		stage_timer.measure(`rule.${RULE_IDS.duplicate_error_translation}`, () => {
			if (this.has_duplicate_translation(node.block, new Set<string>())) {
				context.for_node(node).append_rule(RULE_IDS.duplicate_error_translation);
			}
		});
	}
}
