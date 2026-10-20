import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { SYSTEM_FAILURE_CODES, SYSTEM_MISSING_PROCESS_CODE, SYSTEM_PERMISSION_DENIED_CODE } from "src/io/constants";

/** Responsibilities: _filesystem error classification_, _process failure classification_, _cache-read classification_. **/
export class BoundaryFailureClassifier implements SystemFailureClassificationContract {
	private readonly system_error_codes: ReadonlySet<string>;

	/** Responsibilities: _system error code initialization_. **/
	public constructor() {
		this.system_error_codes = new Set(SYSTEM_FAILURE_CODES);
	}

	/** Responsibilities: _filesystem boundary failure recognition_. **/
	public system_failure_message(message: string): boolean {
		return message.split(/[^A-Z0-9]+/u).some((word) => this.system_error_codes.has(word));
	}

	/** Responsibilities: _permission failure recognition_. **/
	public permission_denied(message: string): boolean {
		return message.includes(SYSTEM_PERMISSION_DENIED_CODE);
	}

	/** Responsibilities: _missing process classification_. **/
	public missing_process(message: string): boolean {
		return message.includes(SYSTEM_MISSING_PROCESS_CODE);
	}

	/** Responsibilities: _cache-read classification_. **/
	public cache_read_failure(message: string): boolean {
		if (this.json_parse_failure(message)) {
			return true;
		}
		return this.system_failure_message(message);
	}

	/** Responsibilities: _JSON syntax classification_. **/
	public json_parse_failure(message: string): boolean {
		return message.startsWith("SyntaxError:");
	}
}
