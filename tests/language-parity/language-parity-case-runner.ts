import { resolve } from "node:path";
import { PYTHON_LANGUAGE, TYPESCRIPT_LANGUAGE } from "src/constants";
import { LintFileName } from "src/core/context/lint_file_name";
import { PythonAstBridge } from "src/core/python-ast/python_ast_bridge";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { SourceText } from "src/io/source_text";
import { LintStageTimer } from "src/lint_stage_timer";
import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { TypeScriptSourceRuleRuntime } from "src/linting/orchestration/runtime/typescript/type_script_source_rule_runtime";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptModuleExportsContext } from "src/module-resolution/exports/type_script_module_exports_context";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { ViolationContract } from "src/reporting_protocols";
import type { LintSourceRecordData } from "src/source_types";
import { EMPTY_PROJECT_NAMES } from "tests/core/constants";
import { TestFixture } from "tests/core/test-fixture";
import type { DirectCase, LanguageParityCaseRunnerContract, ProjectCase } from "tests/language-parity/protocols";

/** Responsibilities: _direct parity cases execution_, _architecture parity cases execution_, _parity cases execution projection_. **/
export class LanguageParityCaseRunner implements LanguageParityCaseRunnerContract {
	private readonly _fixture: TestFixture;
	private readonly _python_ast_data: PythonAstData;

	/** Responsibilities: _rule presence check_. **/
	private has_rule(violations: readonly ViolationContract[], rule_id: string): boolean {
		for (const violation of violations) {
			if (violation.rule_id() === rule_id) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _cross-language rule comparison_. **/
	private pair(
		typescript_violations: readonly ViolationContract[],
		python_violations: readonly ViolationContract[],
		rule_id: string,
	): boolean[] {
		return [this.has_rule(typescript_violations, rule_id), this.has_rule(python_violations, rule_id)];
	}

	/** Responsibilities: _project fixture source materialization_. **/
	private project_files(sources: ReadonlyMap<string, string>): Record<string, string> {
		return Object.fromEntries(sources);
	}

	/** Responsibilities: _single-source rule scope_. **/
	private file_scope(source_ast: SourceFileAst, typescript_ast: TypeScriptAstFile): TypeScriptSourceRuleRuntime {
		const source = source_ast.snapshot();
		let source_language = TYPESCRIPT_LANGUAGE;
		if (source_ast.python()) {
			source_language = PYTHON_LANGUAGE;
		}
		const record: LintSourceRecordData = {
			absolute_path: resolve(source.file),
			relative_path: source.file,
			file_name: new LintFileName(source.file),
			text: source.text,
			normalized_ast: source.normalized_ast,
			language: source_language,
			typescript_ast,
			source_resolver: source.source_resolver,
			traversal: source.traversal,
		};
		const module_exports_context = new TypeScriptModuleExportsContext(
			process.cwd(),
			record.source_resolver,
			false,
			new InMemoryProjectSourceIO(new Map()),
		);
		const module_exports = module_exports_context.module_exports();
		return new TypeScriptSourceRuleRuntime(record, EMPTY_PROJECT_NAMES, module_exports);
	}

	/** Responsibilities: _language parity fixture initialization_. **/
	public constructor() {
		this._fixture = new TestFixture();
		const python_ast_bridge = new PythonAstBridge();
		const python_ast_options = python_ast_bridge.options();
		this._python_ast_data = new PythonAstData(python_ast_options);
	}

	/** Responsibilities: _direct TypeScript Python comparison_. **/
	public direct_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_ast = new TypeScriptAstFile(`${item.rule_id}.ts`, item.typescript);
			const python_ast = new TypeScriptAstFile(`${item.rule_id}.py`, item.python);
			const typescript_source = new SourceFileAst(
				{ file: `${item.rule_id}.ts`, text: item.typescript },
				typescript_ast.normalized(),
				typescript_ast.source_file_node(),
				new Map(),
				new TypeScriptAstTraversal(typescript_ast.source_file_node()),
			);
			const python_source = new SourceFileAst(
				{ file: `${item.rule_id}.py`, text: item.python },
				this._python_ast_data.source_ast(item.python),
				python_ast.source_file_node(),
				new Map(),
				new TypeScriptAstTraversal(python_ast.source_file_node()),
			);
			const typescript_linter = new CodingRuleLinter(
				this.file_scope(typescript_source, typescript_ast),
				process.cwd(),
				new SourceText(),
				EMPTY_PROJECT_NAMES,
			);
			const python_linter = new CodingRuleLinter(
				this.file_scope(python_source, python_ast),
				process.cwd(),
				new SourceText(),
				EMPTY_PROJECT_NAMES,
			);
			return this.pair(
				typescript_linter.lint_typescript(typescript_source, new LintStageTimer()),
				python_linter.lint_python(python_source),
				item.rule_id,
			);
		});
	}

	/** Responsibilities: _architecture fixture results comparison_. **/
	public architecture_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_violations = this._fixture.collect_fixture_violations({ "sample.ts": item.typescript });
			const python_violations = this._fixture.collect_fixture_violations({ "sample.py": item.python });
			return this.pair(typescript_violations, python_violations, item.rule_id);
		});
	}

	/** Responsibilities: _fixture results comparison projection_. **/
	public project_results(cases: readonly ProjectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_files = this.project_files(item.typescript);
			const python_files = this.project_files(item.python);
			const typescript_violations = this._fixture.collect_fixture_violations(typescript_files);
			const python_violations = this._fixture.collect_fixture_violations(python_files);
			return this.pair(typescript_violations, python_violations, item.rule_id);
		});
	}
}
