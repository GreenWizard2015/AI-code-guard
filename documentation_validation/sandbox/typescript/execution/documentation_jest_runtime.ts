import { DOCUMENTATION_CONSOLE_LOG_METHOD } from "documentation_validation/constants";
import type {
	DocumentationExampleConsoleContract,
	DocumentationExampleConsoleSpyContract,
	DocumentationJestRuntimeContract,
} from "documentation_validation/protocols";

/** Responsibilities: _Jest spy API_, _console spy validation_. **/
export class DocumentationJestRuntime implements DocumentationJestRuntimeContract {
	private readonly _example_console: DocumentationExampleConsoleContract;
	private readonly _spies: DocumentationExampleConsoleSpyContract[];

	/** Responsibilities: _Jest adapter initialization_. **/
	public constructor(example_console: DocumentationExampleConsoleContract) {
		this._example_console = example_console;
		this._spies = [];
	}

	/** Responsibilities: _console spy creation_. **/
	public spy_on(
		target: DocumentationExampleConsoleContract,
		method_name: string,
	): DocumentationExampleConsoleSpyContract {
		if (!this.supports(target, method_name)) {
			throw new Error("The documentation Jest runtime only supports spying on console.log.");
		}
		const spy = target.spy();
		this._spies.push(spy);
		return spy;
	}

	/** Responsibilities: _supported spy target check_. **/
	public supports(target: DocumentationExampleConsoleContract, method_name: string): boolean {
		return target === this._example_console && method_name === DOCUMENTATION_CONSOLE_LOG_METHOD;
	}

	/** Responsibilities: _spy registry reset_. **/
	public reset(): void {
		this._spies.length = 0;
	}
}
