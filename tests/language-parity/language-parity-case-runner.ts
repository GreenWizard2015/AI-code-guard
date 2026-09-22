import { CodingRuleLinter } from 'src/bridge/ts/runner/orchestration/runtime/coding-rules';
import { TestFixture } from 'tests/core/test-fixture';
import type { DirectCase, ProjectCase } from 'tests/language-parity/types';
import { LanguageParityRuleMatcher } from 'tests/language-parity/language-parity-rule-matcher';
import { SourceFileAst } from 'src/bridge/ts/runner/orchestration/runtime/source-file-ast';
import { PythonAstData } from 'src/bridge/ts/core/python-ast-parser';
import { TypeScriptAstFile } from 'src/model/typescript-ast';

/** Responsibilities: _direct parity cases execution_, _architecture parity cases execution_, _parity cases execution projection_. **/
export class LanguageParityCaseRunner {
	private readonly fixture = new TestFixture();
	private readonly matcher = new LanguageParityRuleMatcher();
	private readonly python_ast_data = new PythonAstData();

	/** Responsibilities: _direct TypeScript Python comparison_. **/
	public direct_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map(item => {
			const typescript_ast = new TypeScriptAstFile(`${item.rule_id}.ts`, item.typescript);
			const python_ast = new TypeScriptAstFile(`${item.rule_id}.py`, item.python);
			const typescript_linter = new CodingRuleLinter(new SourceFileAst(
				{ file: `${item.rule_id}.ts`, text: item.typescript },
				typescript_ast.normalized(),
				typescript_ast.source_file,
			));
			const python_linter = new CodingRuleLinter(new SourceFileAst(
				{ file: `${item.rule_id}.py`, text: item.python },
				this.python_ast_data.source_ast(item.python),
				python_ast.source_file,
			));
			return this.matcher.pair(typescript_linter.lint(), python_linter.lint(), item.rule_id);
		});
	}

	/** Responsibilities: _architecture fixture results comparison_. **/
	public architecture_results(cases: readonly DirectCase[]): boolean[][] {
		return cases.map(item => {
			const typescript_violations = this.fixture.collect_fixture_violations({ 'sample.ts': item.typescript });
			const python_violations = this.fixture.collect_fixture_violations({ 'sample.py': item.python });
			return this.matcher.pair(typescript_violations, python_violations, item.rule_id);
		});
	}

	/** Responsibilities: _fixture results comparison projection_. **/
	public project_results(cases: readonly ProjectCase[]): boolean[][] {
		return cases.map(item => {
			const typescript_violations = this.fixture.collect_fixture_violations(item.typescript);
			const python_violations = this.fixture.collect_fixture_violations(item.python);
			return this.matcher.pair(typescript_violations, python_violations, item.rule_id);
		});
	}
}
