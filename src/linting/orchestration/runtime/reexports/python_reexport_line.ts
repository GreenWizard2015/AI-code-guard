/** Responsibilities: _Python import line syntax_, _Python facade line classification_. **/
export class PythonReexportLine {
	private readonly _text: string;
	private readonly _name_start_pattern: RegExp;
	private readonly _name_character_pattern: RegExp;

	/** Responsibilities: _Python identifier validation_. **/
	private valid_name(value: string): boolean {
		for (const part of value.split(".")) {
			if (part.length === 0) {
				return false;
			}
			const first = part[0];
			if (first === undefined || !this._name_start_pattern.test(first)) {
				return false;
			}
			for (const character of part.slice(1)) {
				if (!this._name_character_pattern.test(character)) {
					return false;
				}
			}
		}
		return true;
	}

	/** Responsibilities: _source line syntax context_. **/
	public constructor(text: string, name_start_pattern: RegExp, name_character_pattern: RegExp) {
		this._text = text;
		this._name_start_pattern = name_start_pattern;
		this._name_character_pattern = name_character_pattern;
	}

	/** Responsibilities: _Python alias line classification_. **/
	public simple_alias(): boolean {
		const parts = this._text.split("=");
		if (parts.length !== 2) {
			return false;
		}
		const left_part = parts[0];
		const right_part = parts[1];
		if (left_part === undefined || right_part === undefined) {
			return false;
		}
		return this.valid_name(left_part.trim()) && this.valid_name(right_part.trim());
	}

	/** Responsibilities: _Python executable line classification_. **/
	public implementation_line(): boolean {
		const trimmed = this._text.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed === ")") {
			return false;
		}
		if (trimmed.startsWith("from ") || trimmed.startsWith("import ")) {
			return false;
		}
		if (trimmed.startsWith("__all__") && trimmed.includes("=")) {
			return false;
		}
		return !this.simple_alias();
	}

	/** Responsibilities: _Python import depth_. **/
	public import_depth(): number {
		if (!this._text.startsWith("from ") && !this._text.startsWith("import ")) {
			return -1;
		}
		return this.parenthesis_delta();
	}

	/** Responsibilities: _Python multiline import depth_. **/
	public next_import_depth(current: number): number {
		if (current > 0) {
			return current + this.parenthesis_delta();
		}
		return this.import_depth();
	}

	/** Responsibilities: _Python import parenthesis balance_. **/
	public parenthesis_delta(): number {
		let delta = 0;
		for (const character of this._text) {
			if (character === "(") {
				delta += 1;
			}
			if (character === ")") {
				delta -= 1;
			}
		}
		return delta;
	}
}
