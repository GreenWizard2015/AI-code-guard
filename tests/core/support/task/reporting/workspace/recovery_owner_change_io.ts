import { resolve } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _recovery owner race_, _replacement document state_, _journal state change_. **/
export class RecoveryOwnerChangeIO extends InMemoryFileIO {
	private _journal_path = "";
	private _owner_path = "";
	private _replacement_documents: ReadonlyMap<string, string>;

	/** Responsibilities: _owner change state initialization_. **/
	public constructor() {
		super();
		this._replacement_documents = new Map();
	}

	/** Responsibilities: _ownership race configuration_. **/
	public change_owner_on_journal_read(
		journal_path: string,
		owner_path: string,
		replacement_documents: ReadonlyMap<string, string>,
	): void {
		this._journal_path = resolve(journal_path);
		this._owner_path = resolve(owner_path);
		this._replacement_documents = replacement_documents;
	}

	/** Responsibilities: _owner state mutation_, _publication document replacement_. **/
	public override file_text(file: string): string {
		const text = super.file_text(file);
		if (resolve(file) === this._journal_path) {
			this._journal_path = "";
			this.file(this._owner_path).write_text("999999998\nreplacement-transaction\nreplacement-token\n");
			for (const [path, replacement] of this._replacement_documents) {
				this.file(path).write_text(replacement);
			}
		}
		return text;
	}
}
