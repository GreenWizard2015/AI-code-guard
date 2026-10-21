import { join } from "node:path";
import { LintFileName } from "src/core/context/lint_file_name";
import { TypeScriptLintSourceRecord } from "src/core/context/type_script_lint_source_record";
import { InMemoryProjectSourceIO } from "src/io/in_memory_project_source_io";
import { TypeScriptAstFile } from "src/model/ast/type_script_ast_file";
import type { LintSourceRecord } from "src/source_types";
import { ViolationValue } from "src/violation_value";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { FileAnalysisCacheWorkspace } from "tests/bridge/ts/runner/orchestration/runtime/file-analysis-cache-workspace";

/** Responsibilities: _cache fixture preparation_, _cache record setup_. **/
export class CacheFixtureBuilder {
	/** Responsibilities: _fixture project writing_. **/
	private write_project(ast_project: AstDiskCacheFixture, file: string, text: string, config_file: string): void {
		ast_project.write(file, text);
		ast_project.write(config_file, '{"compilerOptions":{"baseUrl":"."}}\n');
	}

	/** Responsibilities: _fixture source record_. **/
	private source_record(file: string, text: string): LintSourceRecord {
		const ast_file = new TypeScriptAstFile(file, text);
		return new TypeScriptLintSourceRecord(
			{
				absolute_path: file,
				relative_path: "module.ts",
				file_name: new LintFileName("module.ts"),
				text,
				normalized_ast: ast_file.normalized(),
				source_resolver: new Map(),
			},
			ast_file,
			ast_file.traversal,
		);
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
	public create(): FileAnalysisCacheWorkspace {
		const ast_project = new AstDiskCacheFixture("file-analysis-cache");
		const file = join(ast_project.root, "module.ts");
		const text = "export const value = 1;\n";
		const config_file = join(ast_project.root, "tsconfig.json");
		this.write_project(ast_project, file, text, config_file);
		const source_texts = new Map([
			[file, text],
			[config_file, '{"compilerOptions":{"baseUrl":"."}}\n'],
		]);
		const source_io = new InMemoryProjectSourceIO(source_texts);
		const record = this.source_record(file, text);
		const violation = this.diagnostic();
		return new FileAnalysisCacheWorkspace(
			ast_project.root,
			ast_project.file_io,
			ast_project.identity,
			source_texts,
			source_io,
			record,
			violation,
		);
	}
}
