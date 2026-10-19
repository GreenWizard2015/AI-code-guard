import type { ProjectSourceIOContract } from "src/protocols";

/** Responsibilities: _controlled source discovery failure_, _in-memory source access_. **/
export class TaskReviewFailingSourceIO implements ProjectSourceIOContract {
	private readonly failure: Error;

	/** Responsibilities: _source failure initialization_. **/
	public constructor(failure: Error) {
		this.failure = failure;
	}

	/** Responsibilities: _source membership_. **/
	public source_available(_file: string): boolean {
		return false;
	}

	/** Responsibilities: _source discovery failure_. **/
	public source_paths(_root: string, _ignored_directories: ReadonlySet<string>): readonly string[] {
		throw this.failure;
	}

	/** Responsibilities: _source text access_. **/
	public source_text(_file: string): string {
		return "";
	}
}
