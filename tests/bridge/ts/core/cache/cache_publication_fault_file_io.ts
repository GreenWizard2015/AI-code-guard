import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import {
	type CachePublicationFaultConfiguration,
	CachePublicationFaultSchedule,
} from "tests/bridge/ts/core/cache/types";

/** Responsibilities: _publication fault policy_, _temporary record state_. **/
export class CachePublicationFaultFileIO extends InMemoryFileIO {
	private readonly _schedule: CachePublicationFaultSchedule;
	private readonly _failure: Error;
	private _injected: boolean;
	private _cleanup_injected: boolean;
	private _cleanup_attempts: number;

	/** Responsibilities: _fault scenario state_. **/
	public constructor(configuration: CachePublicationFaultConfiguration) {
		super();
		this._schedule = configuration.schedule;
		this._failure = configuration.failure;
		this._injected = false;
		this._cleanup_injected = false;
		this._cleanup_attempts = 0;
	}

	/** Responsibilities: _temporary record fault_. **/
	public override write_text(file: string, text: string): void {
		super.write_text(file, text);
		const is_temporary_file = file.endsWith(".tmp");
		if (!is_temporary_file) {
			return;
		}
		if (this._injected) {
			return;
		}
		switch (this._schedule) {
			case CachePublicationFaultSchedule.WriteAfterTempCreatedWithPeer:
				super.write_text(`${file}.peer.tmp`, "another writer's active temporary record");
				break;
			case CachePublicationFaultSchedule.WriteAfterTempCreated:
			case CachePublicationFaultSchedule.WriteAfterTempCreatedCleanupFails:
				break;
			default:
				return;
		}
		this._injected = true;
		throw this._failure;
	}

	/** Responsibilities: _temporary record replacement fault_. **/
	public override move_file(source: string, destination: string): void {
		const rename_failure_is_scheduled = this._schedule === CachePublicationFaultSchedule.RenameTemp;
		if (!rename_failure_is_scheduled) {
			super.move_file(source, destination);
			return;
		}
		const source_is_temporary = source.endsWith(".tmp");
		if (!source_is_temporary) {
			super.move_file(source, destination);
			return;
		}
		if (this._injected) {
			super.move_file(source, destination);
			return;
		}
		this._injected = true;
		throw this._failure;
	}

	/** Responsibilities: _temporary record reclamation fault_. **/
	public override remove_file(file: string): void {
		if (!file.endsWith(".tmp")) {
			super.remove_file(file);
			return;
		}
		this._cleanup_attempts += 1;
		if (this._schedule === CachePublicationFaultSchedule.ConcurrentCleanupRace && !this._cleanup_injected) {
			this._cleanup_injected = true;
			super.remove_file(file);
			throw new Error(`ENOENT: ${file}`);
		}
		const cleanup_failure_is_scheduled =
			this._schedule === CachePublicationFaultSchedule.WriteAfterTempCreatedCleanupFails;
		if (!cleanup_failure_is_scheduled) {
			super.remove_file(file);
			return;
		}
		if (this._cleanup_injected) {
			super.remove_file(file);
			return;
		}
		this._cleanup_injected = true;
		throw new Error("EIO: injected temporary cleanup failure");
	}

	/** Responsibilities: _temporary record inventory_. **/
	public temporary_files(directory: string): string[] {
		return this.list_files(directory).filter((file) => file.endsWith(".tmp"));
	}

	/** Responsibilities: _reclamation attempt tally_. **/
	public cleanup_attempts(): number {
		return this._cleanup_attempts;
	}
}
