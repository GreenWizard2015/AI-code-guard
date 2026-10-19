import { join, resolve } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _report publication adapter_, _failure simulation_. **/
export class ReportPublicationFailureIO extends InMemoryFileIO {
	private readonly failing_report: string;
	private fail_report_write = false;

	/** Responsibilities: _publication failure state_. **/
	public constructor(root: string) {
		super();
		this.failing_report = join(root, ".ai-code-guard", "report.md");
	}

	/** Responsibilities: _report failure configuration_. **/
	public fail_next_report_write(): void {
		this.fail_report_write = true;
	}

	/** Responsibilities: _failure interception_. **/
	public override write_text(file: string, text: string): void {
		if (this.fail_report_write) {
			if (resolve(file) === this.failing_report) {
				this.fail_report_write = false;
				throw new Error("Injected report publication failure");
			}
		}
		super.write_text(file, text);
	}
}
