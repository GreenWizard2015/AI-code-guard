import { join } from "node:path";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

/** Responsibilities: _directory swap injection_, _failure state control_. **/
export class FailingDirectorySwapIO extends InMemoryFileIO {
	private _failure_armed = false;

	/** Responsibilities: _staging failure activation_. **/
	public arm_staging_failure(): void {
		this._failure_armed = true;
	}

	/** Responsibilities: _staging move interception_. **/
	public override move_path(source: string, destination: string): void {
		if (this._failure_armed && source.endsWith("/new")) {
			this._failure_armed = false;
			const blocked_destination = join(destination, "simulated staged directory swap failure");
			this.create_directory(destination);
			this.create_directory(blocked_destination);
			super.move_path(source, blocked_destination);
			return;
		}
		super.move_path(source, destination);
	}
}
