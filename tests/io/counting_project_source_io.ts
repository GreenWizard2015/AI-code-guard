import type { ProjectSourceIOContract } from "src/source_protocols";

/** Responsibilities: _source inventory call counts_, _source content call counts_. **/
export class CountingProjectSourceIO implements ProjectSourceIOContract {
	private readonly _source: ProjectSourceIOContract;
	private _source_path_calls = 0;
	private _source_text_calls = 0;

	/** Responsibilities: _source IO instrumentation initialization_. **/
	public constructor(source: ProjectSourceIOContract) {
		this._source = source;
	}

	/** Responsibilities: _source path inventory_. **/
	public source_paths(root: string, ignored_directories: ReadonlySet<string>): readonly string[] {
		this._source_path_calls += 1;
		return this._source.source_paths(root, ignored_directories);
	}

	/** Responsibilities: _source content access_. **/
	public source_text(file: string): string {
		this._source_text_calls += 1;
		return this._source.source_text(file);
	}

	/** Responsibilities: _source availability access_. **/
	public source_available(file: string): boolean {
		return this._source.source_available(file);
	}

	/** Responsibilities: _source inventory call count_. **/
	public source_path_calls(): number {
		return this._source_path_calls;
	}

	/** Responsibilities: _source content call count_. **/
	public source_text_calls(): number {
		return this._source_text_calls;
	}
}
