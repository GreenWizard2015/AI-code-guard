import { AstModel } from "src/core/ast_model";
import { PythonAstData } from "src/core/python_ast_data";
import { NodeFileIO } from "src/io/node_file_io";
import { ProjectAnalysisIdentity } from "src/core/project-source/project_analysis_identity";
import type {
	PythonAstWorkerContract,
	PythonAstWorkerAsts,
	PythonAstWorkerResponse,
	PythonAstWorkerSources,
} from "src/core/python-ast-worker.mjs";
import type { NormalizedAstFile } from "src/types";
import { LintStageTimer } from "src/lint_stage_timer";
import { describe, expect, test } from "@jest/globals";

/** Responsibilities: _batch worker lifecycle simulation_, _batch error response formatting_. **/
class PythonBatchResponseFixture implements PythonAstWorkerContract {
	private readonly ast_model: AstModel;
	private readonly omitted_name: string;
	private readonly response_batch_id: string;
	private pending_batch_id = "";
	private pending_sources: PythonAstWorkerSources = {};
	private response_count = 0;

	/** Responsibilities: _Python response fixture initialization_. **/
	public constructor(omitted_name: string, response_batch_id = "") {
		this.ast_model = new AstModel();
		this.omitted_name = omitted_name;
		this.response_batch_id = response_batch_id;
	}

	/** Responsibilities: _named AST response creation_. **/
	public batch_result(batch_id: string, sources: PythonAstWorkerSources): PythonAstWorkerResponse {
		let omitted_name = "";
		if (this.response_count === 0) {
			omitted_name = this.omitted_name;
		}
		this.response_count += 1;
		const entries = Object.keys(sources)
			.filter((name) => name !== omitted_name)
			.map((name) => [name, this.ast_model.empty_ast_file("python")] as const);
		const asts: PythonAstWorkerAsts = new Map<string, NormalizedAstFile>(entries);
		let response_batch_id = batch_id;
		if (this.response_batch_id.length > 0) {
			response_batch_id = this.response_batch_id;
		}
		return {
			batchId: response_batch_id,
			asts,
			timings: { ast_parse_ms: 0, ast_build_ms: 0, ast_stages: [] },
		};
	}

	/** Responsibilities: _split batch request fixture_. **/
	public start_batch(batch_id: string, sources: PythonAstWorkerSources): void {
		this.pending_batch_id = batch_id;
		this.pending_sources = sources;
	}

	/** Responsibilities: _split batch response fixture_. **/
	public complete_batch(): PythonAstWorkerResponse {
		return this.batch_result(this.pending_batch_id, this.pending_sources);
	}

	/** Responsibilities: _fixture shutdown_. **/
	public close(): void {}

	/** Responsibilities: _incomplete batch error observation_. **/
	public error_message(parser: PythonAstData, texts: readonly string[]): string {
		try {
			parser.batch_ast({
				texts,
				stage_timer: new LintStageTimer(),
				stage_prefix: "python-bridge",
				files: [],
				repo_root: "",
			});
		} catch (error) {
			return String(error);
		}
		return "";
	}

	/** Responsibilities: _split batch error observation_. **/
	public split_error_message(parser: PythonAstData, texts: readonly string[]): string {
		const batch_id = parser.begin_batch_ast({
			texts,
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});
		try {
			parser.complete_batch_ast(batch_id);
		} catch (error) {
			return String(error);
		}
		return "";
	}
}

describe("Python AST batch response validation", () => {
	test("maps a large named response without scanning earlier entries", () => {
		const texts = Array.from({ length: 1000 }, (_, index) => `class Item${index}:\n    pass\n`);
		const file_io = new NodeFileIO();
		const parser = new PythonAstData({
			worker: new PythonBatchResponseFixture(""),
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: true,
			file_io,
		});

		const parsed = parser.batch_ast({
			texts,
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});

		expect(parsed).toHaveLength(1000);
	});

	test("rejects a response missing one requested name", () => {
		const file_io = new NodeFileIO();
		const complete_parser = new PythonAstData({
			worker: new PythonBatchResponseFixture(""),
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: true,
			file_io,
		});
		const complete = complete_parser.batch_ast({
			texts: ["class First:\n    pass\n", "class Second:\n    pass\n"],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});

		const fixture = new PythonBatchResponseFixture("1");
		const parser = new PythonAstData({
			worker: fixture,
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: true,
			file_io,
		});
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const error_message = fixture.error_message(parser, texts);
		const recovered = parser.batch_ast({
			texts,
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [],
			repo_root: "",
		});
		expect({
			complete_count: complete.length,
			error_message: error_message.includes("Python AST worker returned an incomplete batch."),
			recovered_count: recovered.length,
		}).toEqual({ complete_count: 2, error_message: true, recovered_count: 2 });
	});

	test("rejects a stale single batch identifier", () => {
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const fixture = new PythonBatchResponseFixture("", "stale-single-batch");
		const file_io = new NodeFileIO();
		const single_parser = new PythonAstData({
			worker: fixture,
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: true,
			file_io,
		});
		const error_message = fixture.error_message(single_parser, texts);

		expect(error_message).toBe("Error: Python AST worker returned an unexpected batch id.");
	});

	test("rejects a stale split batch identifier", () => {
		const texts = ["class First:\n    pass\n", "class Second:\n    pass\n"];
		const fixture = new PythonBatchResponseFixture("", "stale-split-batch");
		const file_io = new NodeFileIO();
		const parser = new PythonAstData({
			worker: fixture,
			analysis_identity: new ProjectAnalysisIdentity(file_io),
			split_batch_enabled: true,
			file_io,
		});
		const error_message = fixture.split_error_message(parser, texts);

		expect(error_message).toBe("Error: Python AST worker returned an unexpected batch id.");
	});
});
