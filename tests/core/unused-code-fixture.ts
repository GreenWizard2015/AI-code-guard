import { ProjectSourceScanner } from "src/core/project-source/project_source_scanner";
import { UnusedCode } from "src/core/project-source/unused_code";
import type { ViolationContract } from "src/reporting_protocols";
import type { ProjectSourceOptions } from "src/model/types/types";
import { TestFixture } from "tests/core/test-fixture";

/** Responsibilities: _virtual source scanner_, _unused declaration results_. **/
export class UnusedCodeFixture {
	private readonly fixture: TestFixture;
	private readonly unused_code: UnusedCode;

	/** Responsibilities: _fixture dependency initialization_. **/
	public constructor() {
		this.fixture = new TestFixture();
		this.unused_code = new UnusedCode();
	}

	/** Responsibilities: _unused-source result collection_. **/
	public collect(files: Record<string, string>, entry_files: readonly string[] = []): ViolationContract[] {
		return this.fixture.project_source.with_in_memory_project(
			files,
			(root, context, paths) => {
				const options: ProjectSourceOptions = {
					context_state: { available: true, value: context },
					entry_files,
				};
				const scanner = new ProjectSourceScanner(root, options);
				return this.unused_code.collect_scanner_violations(root, scanner, [...paths]);
			},
			new Map(),
		);
	}
}
