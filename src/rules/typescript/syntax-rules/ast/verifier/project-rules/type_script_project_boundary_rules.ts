import type { ASTSourceRuleContract } from "src/ast_verifier_protocols";
import type { AstClassNode } from "src/model/ast/normalized_ast_types";
import { TypeScriptClassMembers } from "src/parser/analysis/type_script_class_members";
import { TypeScriptProjectBoundaryReporter } from "src/rules/typescript/syntax-rules/ast/verifier/project-rules/type_script_project_boundary_reporter";
import type { RuleContextContract } from "src/types";
import type { TypeScriptClassMembersContract } from "src/typescript_analysis_protocols";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import ts from "typescript";

/** Responsibilities: _callable boundary rules_, _public field boundary rules_. **/
export class TypeScriptProjectBoundaryRules implements ASTSourceRuleContract {
	private readonly _class_members: WeakMap<ts.SourceFile, TypeScriptClassMembersContract>;
	private readonly _reporter: TypeScriptProjectBoundaryReporter;

	/** Responsibilities: _class boundary checks_. **/
	private append_class(class_request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = class_request;
		const {
			source: { source_file, normalized_ast },
		} = context.state();
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		let name = "";
		if (ts.isClassLike(node)) {
			name = node.name?.text ?? "";
		} else if (ts.isInterfaceDeclaration(node)) {
			name = node.name.text;
		}
		this.append_class_candidate(line, name, normalized_ast.source.classes, context);
	}

	/** Responsibilities: _matching class boundary dispatch_. **/
	private append_class_candidate(
		class_source_line: number,
		class_name: string,
		class_summaries: readonly AstClassNode[],
		class_context: RuleContextContract,
	): void {
		for (const candidate of class_summaries) {
			if (candidate.identity.start !== class_source_line) {
				continue;
			}
			if (class_name.length > 0 && candidate.identity.name !== class_name) {
				continue;
			}
			this._reporter.append(class_context, candidate.structure.methods, candidate.field_analysis.fields);
			return;
		}
	}

	/** Responsibilities: _function boundary checks_. **/
	private append_function(function_request: TypeScriptNodeVerificationRequest): void {
		const { node, context } = function_request;
		const {
			source: { source_file, normalized_ast },
		} = context.state();
		const line = source_file.getLineAndCharacterOfPosition(node.getStart(source_file)).line;
		let name = "";
		if (ts.isFunctionDeclaration(node)) {
			name = node.name?.text ?? "";
		} else if (ts.isVariableDeclaration(node)) {
			name = node.name.getText(source_file);
		}
		const callable = normalized_ast.source.functions.find(
			(candidate) => candidate.identity.start === line && candidate.identity.name === name,
		);
		if (callable !== undefined) {
			this._reporter.append(context, [callable], []);
		}
	}

	/** Responsibilities: _type alias field checks_. **/
	private append_type_alias(type_alias_request: TypeScriptNodeVerificationRequest): void {
		if (!ts.isTypeAliasDeclaration(type_alias_request.node)) {
			return;
		}
		const {
			source: { source_file },
		} = type_alias_request.context.state();
		let members = this._class_members.get(source_file);
		if (members === undefined) {
			members = new TypeScriptClassMembers(source_file);
			this._class_members.set(source_file, members);
		}
		this._reporter.append(type_alias_request.context, [], members.type_alias_fields(type_alias_request.node));
	}

	/** Responsibilities: _project boundary cache setup_. **/
	public constructor() {
		this._class_members = new WeakMap();
		this._reporter = new TypeScriptProjectBoundaryReporter();
	}

	/** Responsibilities: _project boundary activation_. **/
	public active_for(source_code: string): boolean {
		return source_code.length > 0;
	}

	/** Responsibilities: _project boundary dispatch_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		if (request.context.state().source.test_file) {
			return;
		}
		const { node } = request;
		if (ts.isClassLike(node) || ts.isInterfaceDeclaration(node)) {
			this.append_class(request);
			return;
		}
		if (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) {
			this.append_function(request);
			return;
		}
		if (ts.isTypeAliasDeclaration(node)) {
			this.append_type_alias(request);
		}
	}
}
