import { PythonImportFileIndex } from "src/core/project-source/python-imports/python_import_file_index";
import { PythonProjectImportSession } from "src/core/project-source/python-imports/python_project_import_session";
import type { PythonImportFileIndexContract } from "src/python_protocols";
import type { PythonImportSessionCache } from "src/python_types";
import type { ProjectSourcePythonContract, PythonImportSessionContract } from "src/source_protocols";

/** Responsibilities: _Python import snapshot ownership_, _Python import index reuse_. **/
export class ProjectSourcePython implements ProjectSourcePythonContract {
	private readonly _root: string;
	private readonly _file_index: PythonImportFileIndexContract;
	private readonly _sessions: PythonImportSessionCache;

	/** Responsibilities: _Python import resolver initialization_. **/
	public constructor(root: string) {
		this._root = root;
		this._file_index = new PythonImportFileIndex();
		this._sessions = new WeakMap<ReadonlySet<string>, PythonImportSessionContract>();
	}

	/** Responsibilities: _Python import snapshot access_. **/
	public for_files(files: ReadonlySet<string>): PythonImportSessionContract {
		let session = this._sessions.get(files);
		if (session === undefined) {
			session = new PythonProjectImportSession(this._root, files, this._file_index);
			this._sessions.set(files, session);
		}
		return session;
	}
}
