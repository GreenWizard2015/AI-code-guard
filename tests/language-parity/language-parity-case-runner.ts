import { CodingRuleLinter } from "src/linting/orchestration/runtime/coding_rule_linter";
import { SourceText } from "src/source_text";
import { TestFixture } from "tests/core/test-fixture";
import type { DirectCase, ProjectCase } from "tests/language-parity/types";
import { LanguageParityRuleMatcher } from "tests/language-parity/language-parity-rule-matcher";
import { SourceFileAst } from "src/linting/orchestration/runtime/source_file_ast";
import { PythonAstData } from "src/core/python_ast_data";
import { PythonAstBridge } from "src/core/python_ast_bridge";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { LintStageTimer } from "src/lint_stage_timer";

/** Responsibilities: _direct parity cases execution_, _architecture parity cases execution_, _parity cases execution projection_. **/
export class LanguageParityCaseRunner {
	private readonly fixture: TestFixture;
	private readonly matcher: LanguageParityRuleMatcher;
	private readonly python_ast_data: PythonAstData;

	/** Responsibilities: _language parity fixture initialization_. **/
	public constructor() {
		this.fixture = new TestFixture();
		this.matcher = new LanguageParityRuleMatcher();
		this.python_ast_data = new PythonAstData(new PythonAstBridge());
	}

	/** Responsibilities: _direct TypeScript Python comparison_. **/
	public direct_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_ast = new TypeScriptAstFile(`${item.rule_id}.ts`, item.typescript);
			const python_ast = new TypeScriptAstFile(`${item.rule_id}.py`, item.python);
			const typescript_source = new SourceFileAst(
				{ file: `${item.rule_id}.ts`, text: item.typescript },
				typescript_ast.normalized(),
				typescript_ast.source_file,
				new Map(),
				typescript_ast.traversal,
			);
			const python_source = new SourceFileAst(
				{ file: `${item.rule_id}.py`, text: item.python },
				this.python_ast_data.source_ast(item.python),
				python_ast.source_file,
				new Map(),
				python_ast.traversal,
			);
			const typescript_linter = new CodingRuleLinter(process.cwd(), new SourceText());
			const python_linter = new CodingRuleLinter(process.cwd(), new SourceText());
			return this.matcher.pair(
				typescript_linter.lint_typescript(typescript_source, new LintStageTimer()),
				python_linter.lint_python(python_source),
				item.rule_id,
			);
		});
	}

	/** Responsibilities: _architecture fixture results comparison_. **/
	public architecture_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_violations = this.fixture.collect_fixture_violations({ "sample.ts": item.typescript });
			const python_violations = this.fixture.collect_fixture_violations({ "sample.py": item.python });
			return this.matcher.pair(typescript_violations, python_violations, item.rule_id);
		});
	}

	/** Responsibilities: _fixture results comparison projection_. **/
	public project_results(cases: readonly ProjectCase[]): boolean[][] {
		return cases.map((item) => {
			const typescript_violations = this.fixture.collect_fixture_violations(item.typescript);
			const python_violations = this.fixture.collect_fixture_violations(item.python);
			return this.matcher.pair(typescript_violations, python_violations, item.rule_id);
		});
	}
}
