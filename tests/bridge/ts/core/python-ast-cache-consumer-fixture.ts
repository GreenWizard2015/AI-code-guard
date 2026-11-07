import { AstModel } from "src/core/ast_model";
import { PythonAstData } from "src/core/python-ast/python_ast_data";
import { LintStageTimer } from "src/lint_stage_timer";
import { AstDiskCacheFixture } from "tests/bridge/ts/core/ast-disk-cache-fixture";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { PythonCacheWorker } from "tests/bridge/ts/core/python-cache-worker";

/** Responsibilities: _cache consumer scenario_, _environment restoration_. **/
export class PythonAstCacheConsumerFixture {
	public readonly _project: AstDiskCacheFixture;
	public readonly _root: string;
	public readonly _file: string;
	public readonly _text: string;
	public readonly _second_worker: PythonCacheWorker;
	public readonly _ast: ReturnType<AstModel["empty_ast_file"]>;

	/** Responsibilities: _cache consumer initialization_. **/
	public constructor() {
		this._project = new AstDiskCacheFixture(new InMemoryFileIO(), "python-ast-cache-consumer");
		this._root = this._project._root;
		this._file = this._project.path("module.py");
		this._text = "def broken(:\n    pass\n";
		this._project.write(this._file, this._text);
		const ast_model = new AstModel("python");
		const empty_ast = ast_model.empty_ast_file();
		this._ast = {
			...empty_ast,
			source: { ...empty_ast.source, parse_issues: [{ line: 0, message: "syntax error" }] },
		};
		this._second_worker = new PythonCacheWorker(this._ast);
	}

	/** Responsibilities: _warm-cache population_. **/
	public warm_cache(): void {
		const worker = new PythonCacheWorker(this._ast);
		const parser = new PythonAstData({
			worker: worker,
			analysis_identity: this._project._identity,
			split_batch_enabled: true,
			file_io: this._project._file_io,
			cache_enabled: true,
		});
		parser.batch_ast({
			texts: [this._text],
			stage_timer: new LintStageTimer(),
			stage_prefix: "python-bridge",
			files: [this._file],
			repo_root: this._root,
		});
	}
}
