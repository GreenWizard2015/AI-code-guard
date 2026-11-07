import { join } from "node:path";
import { LintFileName } from "src/core/context/lint_file_name";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import { ViolationValue } from "src/model/violation_value";
import { TypeScriptAstTraversal } from "src/parser/analysis/type_script_ast_traversal";
import type { LintSourceRecordData } from "src/source_types";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { FileAnalysisCacheWorkspace } from "tests/bridge/ts/runner/orchestration/runtime/file-analysis-cache-workspace";

/** Responsibilities: _cache fixture preparation_, _cache record setup_. **/
export class CacheFixtureBuilder {
	/** Responsibilities: _fixture project writing_. **/
	private write_project(ast_project: AstDiskCacheFixture, file: string, text: string, config_file: string): void {
		ast_project.write(file, text);
		ast_project.write(config_file, '{"compilerOptions":{"baseUrl":"."}}\n');
	}

	/** Responsibilities: _fixture diagnostic_. **/
	private diagnostic(): ViolationValue {
		return new ViolationValue({
			file: "module.ts",
			line: 1,
			message: "message",
			hint: "hint",
			rule_id: "rule",
			priority: 1,
		});
	}

	/** Responsibilities: _cache fixture construction_. **/
	public create(file_io: InMemoryFileIO): FileAnalysisCacheWorkspace {
		const ast_project = new AstDiskCacheFixture(file_io, "file-analysis-cache");
		const file = join(ast_project._root, "module.ts");
		const text = "export const value = 1;\n";
		const config_file = join(ast_project._root, "tsconfig.json");
		this.write_project(ast_project, file, text, config_file);
		const source_texts = new Map([
			[file, text],
			[config_file, '{"compilerOptions":{"baseUrl":"."}}\n'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const record = this.source_record(file, text);
		const violation = this.diagnostic();
		return new FileAnalysisCacheWorkspace(
			ast_project._root,
			ast_project._file_io,
			ast_project._identity,
			source_texts,
			source_io,
			record,
			violation,
		);
	}

	/** Responsibilities: _fixture source record_. **/
	public source_record(file: string, text: string): LintSourceRecordData {
		const ast_file = new TypeScriptAstFile(file, text);
		const traversal = new TypeScriptAstTraversal(ast_file.source_file_node());
		return {
			absolute_path: file,
			relative_path: "module.ts",
			file_name: new LintFileName("module.ts"),
			text,
			normalized_ast: ast_file.normalized(),
			language: "typescript",
			typescript_ast: ast_file,
			source_resolver: new Map(),
			traversal,
		};
	}
}
