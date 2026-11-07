import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import type { ProjectSourceOptions } from "src/model_types";
import type { ViolationContract } from "src/reporting_protocols";
import { TestFixture } from "tests/core/test-fixture";

/** Responsibilities: _virtual source scanner_, _unused declaration results_. **/
export class UnusedCodeFixture {
	private readonly _fixture: TestFixture;
	private readonly _unused_code: UnusedCode;

	/** Responsibilities: _fixture dependency initialization_. **/
	public constructor() {
		this._fixture = new TestFixture();
		this._unused_code = new UnusedCode();
	}

	/** Responsibilities: _unused-source result collection_. **/
	public collect(files: Record<string, string>, entry_files: readonly string[] = []): ViolationContract[] {
		return this._fixture._project_source.with_in_memory_project(
			files,
			({ root, context, files: paths }) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files,
				};
				const scanner = new ProjectSourceScanner(root, options);
				return this._unused_code.collect_scanner_violations(root, scanner, [...paths]);
			},
			new Map(),
		);
	}
}
