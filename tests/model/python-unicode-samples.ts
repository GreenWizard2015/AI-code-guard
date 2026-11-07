/** Responsibilities: _Cyrillic source text_, _CJK source text_, _Python type names_. **/
export class PythonUnicodeSamples {
	/** Responsibilities: _Cyrillic greeting_. **/
	public greeting(): string {
		return String.fromCodePoint(0x041f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _CJK label_. **/
	public cjk_label(): string {
		return String.fromCodePoint(0x6f22, 0x5b57);
	}

	/** Responsibilities: _CJK greeting_. **/
	public cjk_greeting(): string {
		return String.fromCodePoint(0x4f60, 0x597d);
	}

	/** Responsibilities: _Cyrillic identifier_. **/
	public identifier(): string {
		return String.fromCodePoint(0x043f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442);
	}

	/** Responsibilities: _Cyrillic welcome_. **/
	public welcome(): string {
		return String.fromCodePoint(0x0414, 0x043e, 0x0431, 0x0440, 0x043e, 0x0020, 0x043f, 0x043e, 0x0436, 0x0430);
	}

	/** Responsibilities: _Cyrillic farewell_. **/
	public farewell(): string {
		return String.fromCodePoint(0x0415, 0x0449, 0x0451);
	}
}
