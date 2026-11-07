import type {
	DocumentationExampleExecution,
	DocumentationPythonProcessResult,
	DocumentationPythonSandboxResponse,
} from "documentation_validation/types";

/** Responsibilities: _Python process outcome_, _sandbox response decoding_. **/
export class PythonSandboxResult {
	private readonly _process_result: DocumentationPythonProcessResult;

	/** Responsibilities: _process failure response_. **/
	private failure_execution(): DocumentationExampleExecution {
		let message = this._process_result.stderr;
		if (message.length === 0) {
			if (this._process_result.error !== undefined) {
				message = String(this._process_result.error);
			} else {
				message = "Python sandbox failed.";
			}
		}
		let exit_code = this._process_result.status;
		if (exit_code === null) {
			exit_code = 1;
		}
		return { stdout: message, exit_code };
	}

	/** Responsibilities: _sandbox response decoding_. **/
	private decoded_execution(): DocumentationExampleExecution {
		const response = this.parse_response();
		if (response.exit_code !== 0 && response.error.length > 0) {
			return {
				stdout: [response.stdout, response.error].filter((line) => line.length > 0).join("\n"),
				exit_code: response.exit_code,
			};
		}
		return response;
	}

	/** Responsibilities: _sandbox JSON decoding_. **/
	private parse_response(): DocumentationPythonSandboxResponse {
		try {
			return JSON.parse(this._process_result.stdout.trim());
		} catch {
			return { stdout: "Python sandbox returned an invalid result.", exit_code: 1, error: "" };
		}
	}

	/** Responsibilities: _process result ownership_. **/
	public constructor(process_result: DocumentationPythonProcessResult) {
		this._process_result = process_result;
	}

	/** Responsibilities: _process failure classification_. **/
	public failed(): boolean {
		return this._process_result.error !== undefined || this._process_result.status !== 0;
	}

	/** Responsibilities: _execution result conversion_. **/
	public execution(): DocumentationExampleExecution {
		if (this.failed()) {
			return this.failure_execution();
		}
		return this.decoded_execution();
	}
}
