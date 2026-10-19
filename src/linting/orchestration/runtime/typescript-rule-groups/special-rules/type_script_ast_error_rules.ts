import { DiagnosticRule } from "src/model/diagnostic_rule";
import { RULES_BY_ID } from "src/model/constants";
import { RULE_IDS } from "src/constants";
import ts from "typescript";
import type { ViolationContract } from "src/protocols";
import type { TypeScriptAstErrorRulesContract } from "src/linting/orchestration/runtime/typescript-rule-groups/types";
import type { TypeScriptScannerRuleContextContract } from "src/model/types/types";

/** Responsibilities: _caught error analysis_, _error context diagnostics_. **/
export class TypeScriptAstErrorRules implements TypeScriptAstErrorRulesContract {
	private readonly context: TypeScriptScannerRuleContextContract;

	/** Responsibilities: _caught error lookup_. **/
	private contains_caught_error(node: ts.Node, name: string): boolean {
		if (!ts.isIdentifier(node)) {
			return false;
		}
		return node.text === name;
	}

	/** Responsibilities: _error constructor recognition_. **/
	private is_error_constructor(expression: ts.NewExpression): boolean {
		if (!ts.isIdentifier(expression.expression)) {
			return false;
		}
		return expression.expression.text.endsWith("Error");
	}

	/** Responsibilities: _nested error-context lookup_. **/
	private contains_error(node: ts.Node, name: string): boolean {
		if (this.contains_caught_error(node, name)) {
			return true;
		}
		if (ts.isFunctionLike(node)) {
			return false;
		}
		let found = false;
		node.forEachChild((child) => {
			if (!found && this.contains_error(child, name)) {
				found = true;
			}
		});
		return found;
	}

	/** Responsibilities: _error throw validation_. **/
	private append_error_throw(
		violations: ViolationContract[],
		source_file: ts.SourceFile,
		name: string,
		statement: ts.Statement,
	): void {
		if (!ts.isThrowStatement(statement)) {
			return;
		}
		if (!ts.isNewExpression(statement.expression)) {
			return;
		}
		if (!this.is_error_constructor(statement.expression)) {
			return;
		}
		if (this.contains_error(statement.expression, name)) {
			return;
		}
		const rule = new DiagnosticRule("error-context-loss");
		const line = source_file.getLineAndCharacterOfPosition(statement.getStart(source_file)).line + 1;
		violations.push(rule.violation(this.context.file_name.value, line));
	}

	/** Responsibilities: _catch variable name_. **/
	private catch_variable_name(node: ts.CatchClause): string {
		const variable = node.variableDeclaration;
		if (variable === undefined) {
			return "";
		}
		if (!ts.isIdentifier(variable.name)) {
			return "";
		}
		if (variable.name.text === "_") {
			return "";
		}
		return variable.name.text;
	}

	/** Responsibilities: _single catch error-context_. **/
	private append_catch_context(
		violations: ViolationContract[],
		source_file: ts.SourceFile,
		node: ts.CatchClause,
	): void {
		const name = this.catch_variable_name(node);
		if (name.length === 0) {
			return;
		}
		const visit = (child: ts.Node): void => {
			if (ts.isFunctionLike(child) || ts.isCatchClause(child)) {
				return;
			}
			if (ts.isThrowStatement(child)) {
				this.append_error_throw(violations, source_file, name, child);
			}
			child.forEachChild(visit);
		};
		visit(node.block);
	}

	/** Responsibilities: _duplicate error translation key_. **/
	private error_translation_key(node: ts.Node, source_file: ts.SourceFile): string {
		if (!ts.isThrowStatement(node) || !ts.isNewExpression(node.expression)) {
			return "";
		}
		const expression = node.expression.expression;
		if (!ts.isIdentifier(expression) || !expression.text.endsWith("Error")) {
			return "";
		}
		let arguments_text: string[] = [];
		if (node.expression.arguments !== undefined) {
			arguments_text = node.expression.arguments.map((argument) => argument.getText(source_file));
		}
		return `${expression.text}(${arguments_text.join(",")})`;
	}

	/** Responsibilities: _duplicate error translation detection_. **/
	private duplicate_errors(node: ts.CatchClause, source_file: ts.SourceFile): boolean {
		const keys = new Set<string>();
		let duplicate = false;
		const visit = (current: ts.Node): void => {
			if (current !== node && (ts.isCatchClause(current) || ts.isFunctionLike(current))) {
				return;
			}
			const key = this.error_translation_key(current, source_file);
			if (key.length > 0) {
				if (keys.has(key)) {
					duplicate = true;
				} else {
					keys.add(key);
				}
			}
			current.forEachChild(visit);
		};
		visit(node.block);
		return duplicate;
	}

	/** Responsibilities: _error rule context initialization_. **/
	public constructor(context: TypeScriptScannerRuleContextContract) {
		this.context = context;
	}

	/** Responsibilities: _empty catch diagnostics_. **/
	public append_empty_catches(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const rule = new DiagnosticRule("empty-error-handler");
		const visit = (node: ts.Node): void => {
			if (ts.isCatchClause(node)) {
				if (node.block.statements.length === 0) {
					const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
					violations.push(rule.violation(this.context.file_name.value, line));
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _error context diagnostics_. **/
	public append_error_context(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const visit = (node: ts.Node): void => {
			if (ts.isCatchClause(node)) {
				this.append_catch_context(violations, source_file, node);
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _duplicate error translation diagnostics_. **/
	public append_duplicate_errors(violations: ViolationContract[]): void {
		if (this.context.file_name.test()) {
			return;
		}
		const source_file = this.context.ast_file.source_file_node();
		const rule = RULES_BY_ID.get(RULE_IDS.duplicate_error_translation);
		if (rule === undefined) {
			return;
		}
		const visit = (node: ts.Node): void => {
			if (ts.isCatchClause(node)) {
				if (!this.duplicate_errors(node, source_file)) {
					node.forEachChild(visit);
					return;
				}
				const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
				violations.push(rule.violation(this.context.file_name.value, line, {}));
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}

	/** Responsibilities: _shared TypeScript error-rule traversal_. **/
	public append_error_rules(violations: ViolationContract[]): void {
		const source_file = this.context.ast_file.source_file_node();
		const duplicate_rule = RULES_BY_ID.get(RULE_IDS.duplicate_error_translation);
		const visit = (node: ts.Node): void => {
			if (ts.isCatchClause(node)) {
				this.append_catch_context(violations, source_file, node);
				if (!this.context.file_name.test()) {
					if (duplicate_rule !== undefined) {
						if (this.duplicate_errors(node, source_file)) {
							const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line + 1;
							violations.push(duplicate_rule.violation(this.context.file_name.value, line, {}));
						}
					}
				}
			}
			node.forEachChild(visit);
		};
		visit(source_file);
	}
}
