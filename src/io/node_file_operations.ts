import { copyFileSync, renameSync, unlinkSync } from "node:fs";
import type { FileOperationsContract } from "src/io/protocols";

/** Responsibilities: _file copying_, _file movement_, _file removal_. **/
export class NodeFileOperations implements FileOperationsContract {
	/** Responsibilities: _file duplication_. **/
	public copy_file(source: string, destination: string): void {
		copyFileSync(source, destination);
	}

	/** Responsibilities: _file movement_. **/
	public move_file(source: string, destination: string): void {
		renameSync(source, destination);
	}

	/** Responsibilities: _file removal_. **/
	public remove_file(file: string): void {
		unlinkSync(file);
	}
}
