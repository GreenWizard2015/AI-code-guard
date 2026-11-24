import { LintFileName } from "src/core/context/lint_file_name";
import { SourceFileMapCache } from "src/core/project-source/source_file_map_cache";
import { NodeFileIO } from "src/io/node_file_io";
import { LintStageTimer } from "src/lint_stage_timer";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import { ProjectAnalysisIdentity } from "src/project_analysis_identity";
import type { ContextSourceRecordCacheFixtureData } from "tests/bridge/ts/core/types";

/** Responsibilities: _cache source fixture construction_, _project configuration setup_. **/
export class ContextSourceRecordCacheFixture {
	private readonly _map_cache: SourceFileMapCache;

	/** Responsibilities: _source cache setup_. **/
	public constructor() {
		this._map_cache = new SourceFileMapCache();
	}

	/** Responsibilities: _source cache fixture inputs_. **/
	public create(root: string, source_text: string): ContextSourceRecordCacheFixtureData {
		const source_file = `${root}/caller.ts`;
		const files = [source_file];
		const texts = new Map([[source_file, source_text]]);
		const ast_file = new TypeScriptAstFile(source_file, source_text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		const record = {
			absolute_path: source_file,
			relative_path: "caller.ts",
			file_name: new LintFileName("caller.ts"),
			text: source_text,
			normalized_ast: ast_file.normalized(),
			language: "typescript" as const,
			typescript_ast: ast_file,
			source_resolver: this._map_cache.for_map(new Map()),
			traversal,
		};
		const options = {
			repo_root: root,
			project_files: files,
			texts,
			enabled: true,
			analysis_identity: new ProjectAnalysisIdentity(new NodeFileIO(process.cwd())),
		};
		return { options, files, texts, records: [record], timer: new LintStageTimer() };
	}
}
