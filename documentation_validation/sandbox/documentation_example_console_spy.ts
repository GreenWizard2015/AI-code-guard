import type {
	DocumentationExampleConsoleSpyContract,
	DocumentationExampleOutputContract,
} from "documentation_validation/protocols";

/** Responsibilities: _call count evaluation_, _spy expectation evaluation_. **/
export class DocumentationExampleConsoleSpy implements DocumentationExampleConsoleSpyContract {
	private readonly _target: DocumentationExampleOutputContract;
	private readonly _initial_call_count: number;

	/** Responsibilities: _spy boundary initialization_. **/
	public constructor(target: DocumentationExampleOutputContract, initial_call_count: number) {
		this._target = target;
		this._initial_call_count = initial_call_count;
	}

	/** Responsibilities: _call count calculation_. **/
	public call_count(): number {
		return this._target.calls() - this._initial_call_count;
	}

	/** Responsibilities: _call presence check_. **/
	public called(): boolean {
		return this.call_count() > 0;
	}

	/** Responsibilities: _single call check_. **/
	public called_once(): boolean {
		return this.called_at_least(1) && this.call_count() <= 1;
	}

	/** Responsibilities: _minimum call count check_. **/
	public called_at_least(minimum: number): boolean {
		return this.call_count() >= minimum;
	}
}
