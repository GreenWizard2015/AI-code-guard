import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import { TEST_PATH_SUFFIXES } from "src/constants";
import { LintFileName } from "src/core/context/lint_file_name";
import type { RuleContract } from "src/reporting_protocols";
import type { ViolationContract } from "src/reporting_protocols";
import { MixCollection } from "src/rules/mix_collection";
import type { RuleContextContract } from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _mixed module classification_, _mixed module diagnostics_. **/
export class TypeScriptMixedModuleRule implements ASTSourceRuleContract {
	private readonly _mixed_module_rule: RuleContract;

	/** Responsibilities: _module-level declaration classification_. **/
	private module_entity(statement: ts.Statement): boolean {
		switch (statement.kind) {
			case ts.SyntaxKind.ClassDeclaration:
			case ts.SyntaxKind.FunctionDeclaration:
			case ts.SyntaxKind.VariableStatement:
			case ts.SyntaxKind.TypeAliasDeclaration:
			case ts.SyntaxKind.InterfaceDeclaration:
			case ts.SyntaxKind.EnumDeclaration:
			case ts.SyntaxKind.ModuleDeclaration:
				return true;
			default:
				return false;
		}
	}

	/** Responsibilities: _test-module entity diagnostic_. **/
	private append_test_entity(test_context: RuleContextContract, test_file: string, test_source: ts.SourceFile): void {
		const statement = test_source.statements.find((candidate) => this.module_entity(candidate));
		if (statement === undefined) {
			return;
		}
		const line = test_source.getLineAndCharacterOfPosition(statement.getStart(test_source)).line + 1;
		test_context.append_violation(this._mixed_module_rule.violation(test_file, line, {}));
	}

	/** Responsibilities: _implementation class-function mix diagnostics_. **/
	private append_implementation_mix(implementation_context: RuleContextContract, implementation_file: string): void {
		const normalized_ast = implementation_context.state().source.normalized_ast;
		const violations: ViolationContract[] = [];
		const mixed_module_collection = new MixCollection(
			new LintFileName(implementation_file),
			normalized_ast.source.classes,
			normalized_ast.source.functions,
			this._mixed_module_rule,
		);
		mixed_module_collection.append_mix_violations(violations);
		for (const violation of violations) {
			implementation_context.append_violation(violation);
		}
	}

	/** Responsibilities: _mixed module rule dependency_. **/
	public constructor(mixed_module_rule: RuleContract) {
		this._mixed_module_rule = mixed_module_rule;
	}

	/** Responsibilities: _source activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _mixed module verification_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isSourceFile(request.node)) {
			return;
		}
		const file = request.context.state().source.file;
		if (TEST_PATH_SUFFIXES.typescript.some((suffix) => file.endsWith(suffix))) {
			this.append_test_entity(request.context, file, request.node);
			return;
		}
		this.append_implementation_mix(request.context, file);
	}
}
