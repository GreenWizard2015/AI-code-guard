import { LintFileName } from "src/core/context/lint_file_name";
import { NodeFileIO } from "src/io/node_file_io";
import { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type { ContextSourceRecordCacheFixtureData } from "tests/bridge/ts/core/types";

/** Responsibilities: _cache source fixture construction_, _project configuration setup_. **/
export class ContextSourceRecordCacheFixture {
	/** Responsibilities: _source cache fixture inputs_. **/
	public create(root: string, source_text: string): ContextSourceRecordCacheFixtureData {
		const source_file = `${root}/caller.ts`;
		const files = [source_file];
		const texts = new Map([[source_file, source_text]]);
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const record = new TypeScriptLintSourceRecord(
			{
				absolute_path: source_file,
				relative_path: "caller.ts",
				file_name: new LintFileName("caller.ts"),
				text: source_text,
				normalized_ast: ast_file.normalized(),
				source_resolver: new Map(),
			},
			ast_file,
			ast_file.traversal,
		);
		const options = {
			repo_root: root,
			project_files: files,
			texts,
			enabled: true,
			analysis_identity: new ProjectAnalysisIdentity(new NodeFileIO()),
		};
		return { options, files, texts, records: [record], timer: new LintStageTimer() };
	}
}
