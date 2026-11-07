import { PYTHON_FRAME_ATTRIBUTE_PATTERN, PYTHON_REFLECTIVE_ATTRIBUTE_NAMES } from "documentation_validation/constants";

/** Responsibilities: _Python operation restrictions_, _Python reflection restrictions_. **/
export class PythonCapabilityPolicy {
	private readonly _unsafe_operations: Map<RegExp, string>;

	/** Responsibilities: _Python operation policy setup_. **/
	public constructor() {
		this._unsafe_operations = new Map<RegExp, string>();
		this._unsafe_operations.set(
			/\b(?:open|eval|exec|compile|__import__|input)\s*\(/u,
			"file, dynamic-code, and input operations are not allowed",
		);
		this._unsafe_operations.set(/\b(?:delattr|globals|locals|vars)\s*\(/u, "dynamic object access is not allowed");
	}

	/** Responsibilities: _unsafe operation checks_. **/
	public unsafe_operation_issues(source: string): string[] {
		const issues: string[] = [];
		for (const [pattern, message] of this._unsafe_operations) {
			if (pattern.test(source)) {
				issues.push(message);
			}
		}
		return issues;
	}

	/** Responsibilities: _Python reflective access checks_. **/
	public uses_reflective_access(source: string): boolean {
		for (const match of source.matchAll(/__[A-Za-z_]+__/gu)) {
			if (PYTHON_REFLECTIVE_ATTRIBUTE_NAMES.has(match[0])) {
				return true;
			}
		}
		return PYTHON_FRAME_ATTRIBUTE_PATTERN.test(source);
	}
}
