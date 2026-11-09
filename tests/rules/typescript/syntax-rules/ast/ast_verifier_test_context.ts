import { resolve } from "node:path";
import type { ASTNodeVerificationContract, ASTVerifierContract } from "src/ast_verifier_protocols";
import { TYPESCRIPT_LANGUAGE } from "src/constants";
import { LintFileName } from "src/core/context/lint_file_name";
import { LintStageTimer } from "src/lint_stage_timer";
import { AstPropertySourceIndexCache } from "src/model/ast/ast_property_source_index_cache";
import type { AstLanguage } from "src/model/ast/normalized_ast_types";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import { ResolvedTypeScriptDeclarationKind } from "src/module-resolution/types";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ProjectNames, ProjectSourceAnalysisOptions } from "src/project_analysis_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptNodeRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_node_rule_context";
import type { TypeScriptBoundaryRuleAppender } from "src/rules/typescript/syntax-rules/types/type_script_boundary_rule_appender";
import type { LintSourceRecordData } from "src/source_types";
import type {
	RuleContextContract,
	RuleContextState,
	RuleNodeDiagnosticContextContract,
	TypeScriptRuleScopeContract,
} from "src/types";
import type { TypeScriptNodeVerificationRequest } from "src/typescript_analysis_types";
import { ASTVerifierTestProjectNames } from "tests/rules/typescript/syntax-rules/ast/ast_verifier_test_project_names";
import ts from "typescript";

/** Responsibilities: _file source selection_, _AST rule execution_, _diagnostic collection_, _node visitation_. **/
export class ASTVerifierTestContext
	implements RuleContextContract, ASTNodeVerificationContract, TypeScriptRuleScopeContract
{
	private readonly _source_file: ts.SourceFile;
	private readonly _source_record: LintSourceRecordData;
	private readonly _state: RuleContextState;
	private readonly _violations: ViolationContract[];
	private readonly _visited_nodes: ts.Node[];

	/** Responsibilities: _AST test context initialization_. **/
	public constructor(source_file: ts.SourceFile, ...provided_project_names: ProjectNames[]) {
		this._violations = [];
		this._visited_nodes = [];
		const ast_file = new TypeScriptAstFile(source_file.fileName, source_file.text);
		const scoped_source_file = ast_file.source_file_node();
		this._source_file = scoped_source_file;
		const traversal = new TypeScriptAstTraversal(scoped_source_file);
		this._source_record = {
			absolute_path: resolve(scoped_source_file.fileName),
			relative_path: scoped_source_file.fileName,
			file_name: new LintFileName(scoped_source_file.fileName),
			text: scoped_source_file.text,
			normalized_ast: ast_file.normalized(),
			language: TYPESCRIPT_LANGUAGE,
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
		const project_name_analysis = new ASTVerifierTestProjectNames(this._source_record);
		const derived_names = project_name_analysis.names();
		const project_names = provided_project_names.at(-1) ?? derived_names;
		const module_resolver: TypeScriptModuleExportsContract = {
			module_symbol: () => "",
			resolve: (reference) => reference,
			symbol_kind: () => ResolvedTypeScriptDeclarationKind.Other,
		};
		this._state = {
			source: {
				file: scoped_source_file.fileName,
				source_file: scoped_source_file,
				normalized_ast: ast_file.normalized(),
				test_file: false,
				path_kinds: new Set(),
			},
			project: {
				project_names,
				rule_scope: this,
			},
			analysis: {
				stage_timer: new LintStageTimer(),
				traversal,
				source_resolver: new Map(),
				module_resolver,
				source_index: new AstPropertySourceIndexCache(),
			},
		};
	}

	/** Responsibilities: _file scope classification_. **/
	public project_scope(): boolean {
		return false;
	}

	/** Responsibilities: _invalid project analysis access_. **/
	public project_analysis(): ProjectSourceAnalysisOptions {
		throw new Error("AST verifier test context has file scope only.");
	}

	/** Responsibilities: _file source selection_. **/
	public source_files(language: AstLanguage): readonly LintSourceRecordData[] {
		if (this._source_record.language !== language) {
			return [];
		}
		return [this._source_record];
	}

	/** Responsibilities: _boundary rule execution_. **/
	public append_calls(appender: TypeScriptBoundaryRuleAppender): void {
		for (const statement of this._source_file.statements) {
			if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
				appender.append(statement.expression, this);
			}
		}
	}

	/** Responsibilities: _whole-file AST verifier execution_. **/
	public append_tree(node_rules: ASTVerifierContract): void {
		node_rules.verify_source_file({
			source_root: this._source_file,
			context: this,
			stage_timer: this._state.analysis.stage_timer,
		});
	}

	/** Responsibilities: _diagnostic identifier access_. **/
	public rule_ids(): readonly string[] {
		return this._violations.map((violation) => violation.rule_id());
	}

	/** Responsibilities: _diagnostic source locations_. **/
	public violations(): readonly ViolationContract[] {
		return this._violations;
	}

	/** Responsibilities: _rule context state access_. **/
	public state(): RuleContextState {
		return this._state;
	}

	/** Responsibilities: _node-scoped test diagnostics_. **/
	public for_node(node: ts.Node): RuleNodeDiagnosticContextContract {
		return new TypeScriptNodeRuleContext(
			node,
			this._source_file.fileName,
			this._source_file,
			this._violations,
			this._state.analysis.stage_timer,
		);
	}

	/** Responsibilities: _precomputed violation collection_. **/
	public append_violation(violation: ViolationContract): void {
		this._violations.push(violation);
	}

	/** Responsibilities: _AST node visitation_. **/
	public append_visited_node(node: ts.Node): void {
		if (ts.isIdentifier(node)) {
			this._visited_nodes.push(node);
		}
	}

	/** Responsibilities: _AST traversal observation_. **/
	public verify(request: TypeScriptNodeVerificationRequest): void {
		this.append_visited_node(request.node);
	}

	/** Responsibilities: _AST visitation records_. **/
	public visited_nodes(): readonly ts.Node[] {
		return this._visited_nodes;
	}
}
