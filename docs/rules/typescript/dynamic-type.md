# `dynamic-type`

Description: Runtime-built project classes hide their field and behavior contracts. Declare
normal domain classes with explicit state and operations instead.

## Bad

```ts
// File: src/model_reporter.ts
export class ModelReporter {
	private readonly section: string;
	private readonly subject: string;

	public constructor(section: string, subject: string) {
		this.section = section;
		this.subject = subject;
	}

	public report_model(model: { name: string; label: string }): void {
		const section_label = this.section.toUpperCase();
		const subject_label = this.subject.toLowerCase();
		const model_label = model.label.trim();
		console.log(`${section_label}: ${subject_label} ${model.name} (${model_label})`);
	}
}
// File: src/cli.ts
import { ModelReporter } from "src/model_reporter";

(() => {
	const type = (model_name: string, label: string) => {
		return class RuntimeModel {
			public readonly name = model_name;
			public readonly label = label;
		};
	};
	const RuntimeModel = type("RuntimeModel", "ready");
	const runtime_model = new RuntimeModel();
	const reporter = new ModelReporter("runtime", "model");
	reporter.report_model(runtime_model);
})();
```


## Good

```ts
// File: src/status_model.ts
/** Responsibilities: _status model and report_. **/
export class StatusModel {
	private readonly _status: string;
	private readonly _detail: string;

	/** Responsibilities: _status model initialization_. **/
	public constructor(status: string, detail: string) {
		this._status = status;
		this._detail = detail;
	}

	/** Responsibilities: _status normalization_. **/
	public normalized_status(): string {
		return this._status.trim().toLowerCase();
	}

	/** Responsibilities: _model summary composition_. **/
	public summary(): string {
		if (this._status.trim().length === 0) {
			return "";
		}
		const status_label = this.normalized_status().toUpperCase();
		const detail_label = this._detail.trim();
		return `${status_label}: ${detail_label}`;
	}

	/** Responsibilities: _detail size reporting_. **/
	public detail_length(): number {
		const normalized_detail = this._detail.trim();
		return normalized_detail.length;
	}

	/** Responsibilities: _status report output_. **/
	public report(): void {
		const summary = this.summary();
		const normalized_status = this.normalized_status();
		const size = this.detail_length();
		console.log(`${summary} (${normalized_status}, ${size} characters)`);
	}
}
// File: src/cli.ts
import { StatusModel } from "src/status_model";

(() => {
	const model = new StatusModel("ready", "request accepted");
	model.report();
})();
```
