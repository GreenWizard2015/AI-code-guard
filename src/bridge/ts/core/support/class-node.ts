import type { ClassNodeInput } from 'src/bridge/ts/core/support/types';

/** Responsibilities: _exposure normalization class metrics_. **/
export class ClassNode {
	private readonly value: ClassNodeInput;

	/** Responsibilities: _classification any base class_. **/
	private has_exception_base(): boolean {
		for (const base_name of this.base_names()) {
			const parts = base_name.split('.');
			const name = parts[parts.length - 1];
			if (this.is_exception_base(name)) {
				return true;
			}
		}
		return false;
	}

	/** Responsibilities: _classification base class name_. **/
	private is_exception_base(name: string): boolean {
if (name === 'Error' || name === 'Exception' || name === 'BaseException') {
			return true;
		}
		return name.endsWith('Error');
	}

	/** Responsibilities: _combination direct inherited class_. **/
	private base_names(): readonly string[] {
		if (this.value.base_class_names.length > 0) {
			return this.value.base_class_names;
		}
		if (this.value.base_class_name.length > 0) {
			return [this.value.base_class_name];
		}
		return [];
	}

	/** Responsibilities: _initialization normalization class data_. **/
	public constructor(value: ClassNodeInput) {
		this.value = value;
	}

	/** Responsibilities: _exposure class start line_. **/
	public get start(): number {
		return this.value.start;
	}

	/** Responsibilities: _exposure class type contract_. **/
	public get type_contract(): boolean {
		return this.value.type_contract === true;
	}

	/** Responsibilities: _exposure class protocol_. **/
	public get protocol(): boolean {
		return this.value.protocol === true;
	}

	/** Responsibilities: _reporting class inherits exception_. **/
	public exception(): boolean {
		if (this.value.name.endsWith('Error')) {
			return true;
		}
		if (this.value.name.endsWith('Exception')) {
			return true;
		}
		return this.has_exception_base();
	}
}
