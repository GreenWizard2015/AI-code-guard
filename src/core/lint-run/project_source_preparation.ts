import { PythonSourceFiles } from "src/core/context/python_source_files";
import { TypeScriptSourceFiles } from "src/core/context/type_script_source_files";
import { PYTHON_AST_STAGE_PREFIX } from "src/core/python-ast/constants";
import type {
	ProjectSourcePreparationContract,
	ProjectSourcePreparationOptions,
	PythonSourceBatchPreparation,
} from "src/core/types";
import type { NormalizedAstFile } from "src/model/ast/normalized_ast_types";
import type ts from "typescript";

/** Responsibilities: _TypeScript source parsing_, _Python source AST preparation_. **/
export class ProjectSourcePreparation implements ProjectSourcePreparationContract {
	private readonly _options: ProjectSourcePreparationOptions;

	/** Responsibilities: _source preparation setup_. **/
	public constructor(options: ProjectSourcePreparationOptions) {
		this._options = options;
	}

	/** Responsibilities: _TypeScript project source parsing_. **/
	public typescript_source_files(): Map<string, ts.SourceFile> {
		const { files, texts, stage_timer } = this._options;
		return stage_timer.measure("startup.project-context.typescript-source-files", () => {
			const source_files = new TypeScriptSourceFiles(files, texts);
			return source_files.source_files();
		});
	}

	/** Responsibilities: _Python source batch setup_. **/
	public begin_python_ast(): PythonSourceBatchPreparation {
		let source_root = this._options.repo_root;
		if (this._options.virtual_project) {
			source_root = "";
		}
		const source_files = new PythonSourceFiles(
			this._options.files,
			this._options.texts,
			this._options.python_ast_parser,
			source_root,
		);
		const batch = this._options.stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () =>
			source_files.begin_source_ast(this._options.stage_timer, PYTHON_AST_STAGE_PREFIX),
		);
		return { source_files, batch };
	}

	/** Responsibilities: _Python source AST completion_. **/
	public complete_python_ast(preparation: PythonSourceBatchPreparation): ReadonlyMap<string, NormalizedAstFile> {
		if (preparation.batch.batch_id.length > 0) {
			return this._options.stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () =>
				preparation.source_files.complete_source_ast(preparation.batch),
			);
		}
		return this._options.stage_timer.measure(PYTHON_AST_STAGE_PREFIX, () =>
			preparation.source_files.source_ast(this._options.stage_timer, PYTHON_AST_STAGE_PREFIX),
		);
	}
}
