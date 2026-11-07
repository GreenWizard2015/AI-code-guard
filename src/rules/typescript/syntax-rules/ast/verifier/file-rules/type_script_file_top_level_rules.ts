import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { ERROR_GROUPING_RULE_ID, TOP_LEVEL_CLASSES_RULE_ID } from "src/constants";
import { DiagnosticRule } from "src/model/diagnostic_rule";
import type { DiagnosticRuleContract } from "src/model/protocols";
import type {
	ExceptionClassSummary,
	ImplementationClassSummary,
	TopLevelRuleInput,
} from "src/rules/typescript/syntax-rules/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _top-level error class grouping_, _implementation class count_. **/
export class TypeScriptFileTopLevelRules implements ASTSourceRuleContract {
	private readonly _error_grouping_rule: DiagnosticRuleContract;
	private readonly _class_count_rule: DiagnosticRuleContract;
	private readonly _class_scope_kinds: ReadonlySet<ts.SyntaxKind>;

	/** Responsibilities: _module function declarations_. **/
	private has_module_function(statements: readonly ts.Statement[]): boolean {
		for (const statement of statements) {
			if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
				return true;
			}
			if (ts.isVariableStatement(statement) && this.has_function_value(statement)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _top-level function-valued bindings_. **/
	private has_function_value(statement: ts.VariableStatement): boolean {
		return statement.declarationList.declarations.some((declaration) => {
			const initializer = declaration.initializer;
			if (initializer === undefined) {
				return false;
			}
			return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
		});
	}

	/** Responsibilities: _class nesting boundaries_. **/
	private nested_class_scope(scope_candidate: ts.Node): boolean {
		if (ts.isClassLike(scope_candidate) || ts.isFunctionLike(scope_candidate)) {
			return true;
		}
		return this._class_scope_kinds.has(scope_candidate.kind);
	}

	/** Responsibilities: _top-level class traversal_. **/
	private append_top_class(
		candidate_node: ts.Node,
		inside_nested_scope: boolean,
		collected_classes: ts.ClassLikeDeclaration[],
	): void {
		if (!inside_nested_scope && ts.isClassLike(candidate_node)) {
			collected_classes.push(candidate_node);
		}
		const child_nested = inside_nested_scope || this.nested_class_scope(candidate_node);
		ts.forEachChild(candidate_node, (child) => {
			this.append_top_class(child, child_nested, collected_classes);
		});
	}

	/** Responsibilities: _top-level class inventory_. **/
	private top_level_classes(source_file: ts.SourceFile): ts.ClassLikeDeclaration[] {
		const classes: ts.ClassLikeDeclaration[] = [];
		this.append_top_class(source_file, false, classes);
		return classes;
	}

	/** Responsibilities: _error base classification_. **/
	private error_base_expression(base_expression: ts.Expression): boolean {
		if (ts.isIdentifier(base_expression)) {
			return base_expression.text === "Error";
		}
		if (ts.isPropertyAccessExpression(base_expression)) {
			return base_expression.name.text === "Error";
		}
		return false;
	}

	/** Responsibilities: _error extension classification_. **/
	private extends_error(candidate_clause: ts.HeritageClause): boolean {
		if (candidate_clause.token !== ts.SyntaxKind.ExtendsKeyword) {
			return false;
		}
		return candidate_clause.types.some((base) => this.error_base_expression(base.expression));
	}

	/** Responsibilities: _built-in error inheritance_. **/
	private exception_class(class_candidate: ts.ClassLikeDeclaration): boolean {
		const clauses = class_candidate.heritageClauses;
		if (clauses === undefined) {
			return false;
		}
		return clauses.some((candidate_clause) => this.extends_error(candidate_clause));
	}

	/** Responsibilities: _exception class count summary_. **/
	private summarize_exception_classes(exception_candidates: readonly ts.ClassLikeDeclaration[]): ExceptionClassSummary {
		let count = 0;
		let line = 0;
		for (const class_candidate of exception_candidates) {
			if (!this.exception_class(class_candidate)) {
				continue;
			}
			count += 1;
			if (count === 1) {
				const declaration_source = class_candidate.getSourceFile();
				line = declaration_source.getLineAndCharacterOfPosition(class_candidate.getStart()).line + 1;
			}
		}
		return { count, line };
	}

	/** Responsibilities: _implementation class count summary_. **/
	private summarize_implementation_classes(
		implementation_candidates: readonly ts.ClassLikeDeclaration[],
	): ImplementationClassSummary {
		let count = 0;
		let second_class_line = 0;
		for (const class_candidate of implementation_candidates) {
			if (this.exception_class(class_candidate)) {
				continue;
			}
			count += 1;
			if (count === 2) {
				const declaration_source = class_candidate.getSourceFile();
				second_class_line = declaration_source.getLineAndCharacterOfPosition(class_candidate.getStart()).line + 1;
			}
		}
		return { count, second_class_line };
	}

	/** Responsibilities: _error class grouping policy_. **/
	private append_error_grouping(grouping_input: TopLevelRuleInput): void {
		const { context, module_functions_present, exception_summary } = grouping_input;
		if (module_functions_present || exception_summary.count !== 1) {
			return;
		}
		const file = context.state().source.file;
		context.append_violation(this._error_grouping_rule.violation(file, exception_summary.line, {}));
	}

	/** Responsibilities: _implementation class count policy_. **/
	private append_class_count(count_input: TopLevelRuleInput): void {
		const { context, implementation_summary } = count_input;
		if (implementation_summary.count <= 1) {
			return;
		}
		const file = context.state().source.file;
		context.append_violation(
			this._class_count_rule.violation(file, implementation_summary.second_class_line, {
				count: String(implementation_summary.count),
			}),
		);
	}

	/** Responsibilities: _top-level rule initialization_. **/
	public constructor() {
		this._error_grouping_rule = new DiagnosticRule(ERROR_GROUPING_RULE_ID);
		this._class_count_rule = new DiagnosticRule(TOP_LEVEL_CLASSES_RULE_ID);
		this._class_scope_kinds = new Set([
			ts.SyntaxKind.Block,
			ts.SyntaxKind.ObjectLiteralExpression,
			ts.SyntaxKind.ArrayLiteralExpression,
			ts.SyntaxKind.PropertyAssignment,
			ts.SyntaxKind.ConditionalExpression,
			ts.SyntaxKind.CaseBlock,
		]);
	}

	/** Responsibilities: _top-level source eligibility_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _top-level class policies_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		const { context } = request;
		const source_file = context.state().source.source_file;
		const classes = this.top_level_classes(source_file);
		const input: TopLevelRuleInput = {
			context,
			module_functions_present: this.has_module_function(source_file.statements),
			exception_summary: this.summarize_exception_classes(classes),
			implementation_summary: this.summarize_implementation_classes(classes),
		};
		this.append_error_grouping(input);
		this.append_class_count(input);
	}
}
