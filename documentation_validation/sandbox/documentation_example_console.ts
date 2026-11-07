import type {
	DocumentationExampleConsoleContract,
	DocumentationExampleConsoleSpyContract,
	DocumentationExampleOutputContract,
} from "documentation_validation/protocols";
import { DocumentationExampleConsoleSpy } from "documentation_validation/sandbox/documentation_example_console_spy";
import { MODULE_FUNCTION_KIND } from "src/rules/constants";

/** Responsibilities: _sandbox console output_, _console spy ownership_. **/
export class DocumentationExampleConsole implements DocumentationExampleConsoleContract {
	private readonly _output: DocumentationExampleOutputContract;

	/** Responsibilities: _console value formatting_. **/
	private format<T>(value: T): string {
		const kind = typeof value;
		if (value === null) {
			return "null";
		}
		if (kind === "object" || kind === MODULE_FUNCTION_KIND) {
			return "[object]";
		}
		return String(value);
	}

	/** Responsibilities: _console adapter initialization_. **/
	public constructor(output: DocumentationExampleOutputContract) {
		this._output = output;
	}

	/** Responsibilities: _console output recording_. **/
	public log<T>(...values: readonly T[]): void {
		const rendered_values = values.map((value) => this.format(value));
		const rendered_line = rendered_values.join(" ");
		this._output.write(`${rendered_line}\n`);
	}

	/** Responsibilities: _console spy creation_. **/
	public spy(): DocumentationExampleConsoleSpyContract {
		return new DocumentationExampleConsoleSpy(this._output, this._output.calls());
	}
}
