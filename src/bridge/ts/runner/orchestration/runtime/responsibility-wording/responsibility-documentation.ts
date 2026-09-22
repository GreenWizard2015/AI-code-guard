/** Responsibilities: _responsibility documentation access_. **/
export class ResponsibilityDocumentation {
	private readonly lines: string[];

	/** Responsibilities: _documentation line cleanup_. **/
	private clean_line(line: string): string {
		let cleaned = line.trim();
		if (cleaned.startsWith('/**')) {
			cleaned = cleaned.slice(3);
		}
		if (cleaned.endsWith('**/')) {
			cleaned = cleaned.slice(0, -3);
		}
		if (cleaned.startsWith('*')) {
			cleaned = cleaned.slice(1);
		}
		return cleaned.trim();
	}

	/** Responsibilities: _documentation lines storage_. **/
	public constructor(documentation: string) {
		this.lines = documentation.split(/\r?\n/u).map(line => this.clean_line(line));
	}

	/** Responsibilities: _responsibilities line presence_. **/
	public present(): boolean {
		return this.lines.some(line => line.startsWith('Responsibilities:'));
	}

	/** Responsibilities: _responsibilities line access_. **/
	public line(): string {
		const line = this.lines.find(item => item.startsWith('Responsibilities:'));
		if (line === undefined) {
			return '';
		}
		return line;
	}
}
