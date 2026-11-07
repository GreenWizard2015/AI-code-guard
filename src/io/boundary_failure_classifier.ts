import { BoundaryFailureCategory } from "src/analysis_protocols";
import type { SystemFailureClassificationContract } from "src/analysis_protocols";
import { SYNTAX_ERROR_PREFIX, SYSTEM_MISSING_PROCESS_CODE, SYSTEM_PERMISSION_DENIED_CODE } from "src/io/constants";

/** Responsibilities: _filesystem error classification_, _process failure classification_, _cache-read classification_. **/
export class BoundaryFailureClassifier implements SystemFailureClassificationContract {
	private readonly _system_error_codes: readonly string[];

	/** Responsibilities: _system error message classification_. **/
	private system_error(message: string): boolean {
		const words = message.split(/[^A-Z0-9]+/u);
		for (const word of words) {
			if (this._system_error_codes.includes(word)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _system error code policy_. **/
	public constructor(system_error_codes: readonly string[]) {
		this._system_error_codes = system_error_codes;
	}

	/** Responsibilities: _failure category dispatch_. **/
	public check(message: string, category: BoundaryFailureCategory): boolean {
		switch (category) {
			case BoundaryFailureCategory.System:
				return this.system_error(message);
			case BoundaryFailureCategory.Permission:
				return message.includes(SYSTEM_PERMISSION_DENIED_CODE);
			case BoundaryFailureCategory.MissingProcess:
				return message.includes(SYSTEM_MISSING_PROCESS_CODE);
			case BoundaryFailureCategory.CacheRead: {
				if (message.startsWith(SYNTAX_ERROR_PREFIX)) {
					return true;
				}
				return this.system_error(message);
			}
			case BoundaryFailureCategory.JsonParse:
				return message.startsWith(SYNTAX_ERROR_PREFIX);
			default:
				return category satisfies never;
		}
	}
}
