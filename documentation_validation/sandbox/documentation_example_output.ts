import {
	DOCUMENTATION_EXAMPLE_OUTPUT_LIMIT,
	DOCUMENTATION_OUTPUT_LIMIT_MARKER,
} from "documentation_validation/constants";
import type { DocumentationExampleOutputContract } from "documentation_validation/protocols";

/** Responsibilities: _bounded output ownership_, _output call tracking_. **/
export class DocumentationExampleOutput implements DocumentationExampleOutputContract {
	private readonly _chunks: string[];
	private readonly _call_records: number[];

	/** Responsibilities: _output buffer initialization_. **/
	public constructor() {
		this._chunks = [];
		this._call_records = [];
	}

	/** Responsibilities: _bounded console output collection_. **/
	public write(value: string): void {
		this._call_records.push(0);
		if (this.exceeded()) {
			return;
		}
		const size = this._chunks.join("").length + value.length;
		if (size > DOCUMENTATION_EXAMPLE_OUTPUT_LIMIT) {
			this._chunks.push(DOCUMENTATION_OUTPUT_LIMIT_MARKER);
			return;
		}
		this._chunks.push(value);
	}

	/** Responsibilities: _output limit status_. **/
	public exceeded(): boolean {
		return this._chunks.at(-1) === DOCUMENTATION_OUTPUT_LIMIT_MARKER;
	}

	/** Responsibilities: _output chunk count_. **/
	public calls(): number {
		return this._call_records.length;
	}

	/** Responsibilities: _output text access_. **/
	public text(): string {
		return this._chunks.filter((chunk) => chunk !== DOCUMENTATION_OUTPUT_LIMIT_MARKER).join("");
	}

	/** Responsibilities: _per-example output reset_. **/
	public reset(): void {
		this._chunks.length = 0;
		this._call_records.length = 0;
	}
}
