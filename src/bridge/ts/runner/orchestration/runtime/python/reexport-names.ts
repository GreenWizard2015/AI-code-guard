/** Responsibilities: _Python re-export lines classification_, _Python names validation_. **/
export class ReexportNames {
	private readonly name_start_pattern = /^[A-Za-z_]$/u;
	private readonly name_character_pattern = /^[A-Za-z0-9_]$/u;

	/** Responsibilities: _validation dotted Python name_. **/
	private is_python_name(value: string): boolean {
		const parts = value.split('.');
		if (parts.length === 0) {
			return false;
		}
		for (const part of parts) {
			if (!part || !this.is_name_start(part[0])) {
				return false;
			}
			if (![...part.slice(1)].every(character => this.name_character_pattern.test(character))) {
				return false;
			}
		}
		return true;
	}

	/** Responsibilities: _validation Python name start_. **/
	private is_name_start(value: string): boolean {
		if (value.length === 0) {
			return false;
		}
		return this.name_start_pattern.test(value);
	}

	/** Responsibilities: _identification simple Python alias_. **/
	public simple_alias(line: string): boolean {
		const parts = line.split('=');
		if (parts.length !== 2) {
			return false;
		}
return this.is_python_name(parts[0].trim()) && this.is_python_name(parts[1].trim());
	}

	/** Responsibilities: _implementation line identification_. **/
	public implementation_line(line: string): boolean {
		const trimmed = line.trim();
		if ((!trimmed) || trimmed.startsWith('#') || trimmed === ')') {
			return false;
		}
if (trimmed.startsWith('from ') || trimmed.startsWith('import ')) {
			return false;
		}
		if (trimmed.startsWith('__all__') && trimmed.includes('=')) {
			return false;
		}
		return !this.simple_alias(trimmed);
	}
}
