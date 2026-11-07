import { TEST_PATH_SUFFIXES } from "src/constants";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type { TypeScriptModuleExportsContract } from "src/module-resolution/types";
import type { ViolationContract } from "src/reporting_protocols";
import { TypeScriptNodeRuleContext } from "src/rules/typescript/syntax-rules/ast/type_script_node_rule_context";
import type { LintStageTimerContract, TestPathSyntaxContract } from "src/shared_services_protocols";
import { TestPathSyntax } from "src/test_path_syntax";
import { TestPathKind } from "src/types";
import type { RuleContextContract, RuleContextState, RuleNodeDiagnosticContextContract } from "src/types";
import type { TypeScriptRuleContextOptions } from "src/types";
import type { TypeScriptAstTraversalContract } from "src/typescript_runtime_protocols";
import type ts from "typescript";

/** Responsibilities: _TypeScript rule state retention_, _AST rule dispatch_. **/
export class TypeScriptRuleContext implements RuleContextContract {
	private readonly _violations: ViolationContract[];
	private readonly _test_path_syntax: TestPathSyntaxContract;
	private readonly _file: string;
	private readonly _source_file: ts.SourceFile;
	private readonly _normalized_ast: NormalizedAstFile;
	private readonly _test_file: boolean;
	private readonly _path_kinds: ReadonlySet<TestPathKind>;
	private readonly _source_resolver: ReadonlyMap<string, ts.SourceFile>;
	private readonly _module_resolver: TypeScriptModuleExportsContract;
	private readonly _stage_timer: LintStageTimerContract;
	private readonly _traversal: TypeScriptAstTraversalContract;
	private readonly _state_value: RuleContextState;

	/** Responsibilities: _rule state initialization_, _rule appender setup_. **/
	public constructor(
		violations: ViolationContract[],
		file: string,
		source_file: ts.SourceFile,
		options: TypeScriptRuleContextOptions,
	) {
		this._test_path_syntax = new TestPathSyntax(TEST_PATH_SUFFIXES);
		this._violations = violations;
		this._file = file;
		this._source_file = source_file;
		this._normalized_ast = options.normalized_ast;
		this._stage_timer = options.stage_timer;
		this._source_resolver = options.source_resolver;
		this._module_resolver = options.module_exports;
		this._traversal = options.traversal;
		this._path_kinds = this._test_path_syntax.classify(file);
		this._test_file = this._path_kinds.has(TestPathKind.TestFile);
		this._state_value = {
			source: {
				file: this._file,
				source_file: this._source_file,
				normalized_ast: this._normalized_ast,
				test_file: this._test_file,
				path_kinds: this._path_kinds,
			},
			project: { project_names: options.project_names, rule_scope: options.rule_scope },
			analysis: {
				stage_timer: this._stage_timer,
				traversal: this._traversal,
				source_resolver: this._source_resolver,
				module_resolver: this._module_resolver,
				source_index: options.source_index,
			},
		};
	}

	/** Responsibilities: _node-scoped diagnostic creation_. **/
	public for_node(node: ts.Node): RuleNodeDiagnosticContextContract {
		return new TypeScriptNodeRuleContext(node, this._file, this._source_file, this._violations);
	}

	/** Responsibilities: _precomputed violation collection_. **/
	public append_violation(violation: ViolationContract): void {
		this._violations.push(violation);
	}

	/** Responsibilities: _rule context state access_. **/
	public state(): RuleContextState {
		return this._state_value;
	}
}
