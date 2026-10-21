import { AstModel } from "src/core/ast_model";
import { PythonAstData } from "src/core/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { PythonCacheWorker } from "tests/bridge/ts/core/python-cache-worker";

/** Responsibilities: _cache consumer scenario_, _environment restoration_. **/
export class PythonAstCacheConsumerFixture {
	public readonly project: AstDiskCacheFixture;
	public readonly root: string;
	public readonly file: string;
	public readonly text: string;
	public readonly second_worker: PythonCacheWorker;
	public readonly ast: ReturnType<AstModel["empty_ast_file"]>;
	private readonly previous_environment: NodeJS.ProcessEnv;

	/** Responsibilities: _cache consumer initialization_. **/
	public constructor() {
		this.previous_environment = { ...process.env };
		this.project = new AstDiskCacheFixture("python-ast-cache-consumer");
		this.root = this.project.root;
		this.file = this.project.path("module.py");
		this.text = "def broken(:\n    pass\n";
		this.project.write(this.file, this.text);
		process.env.NODE_ENV = "production";
		const ast_model = new AstModel();
		this.ast = {
			...ast_model.empty_ast_file("python"),
			parse_issues: [{ line: 0, message: "syntax error" }],
		};
		this.second_worker = new PythonCacheWorker(this.ast);
	}

	/** Responsibilities: _warm-cache population_. **/
	public warm_cache(): void {
		const worker = new PythonCacheWorker(this.ast);
		const parser = new PythonAstData({
			worker,
			analysis_identity: this.project.identity,
			split_batch_enabled: true,
			file_io: this.project.file_io,
		});
		parser.batch_ast({
			texts: [this.text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [this.file],
			repo_root: this.root,
		});
	}

	/** Responsibilities: _environment restoration_. **/
	public restore_environment(): void {
		process.env = this.previous_environment;
	}
}
