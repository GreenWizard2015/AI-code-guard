import { appendFileSync, copyFileSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import type { FileContentContract, FileOperationsContract } from "src/io/protocols";

/** Responsibilities: _file content access_, _file lifecycle operations_. **/
export class NodeFileStorage implements FileContentContract, FileOperationsContract {
	/** Responsibilities: _file text retrieval_. **/
	public file_text(file: string): string {
		return readFileSync(file, "utf8");
	}

	/** Responsibilities: _text file replacement_. **/
	public write_text(file: string, text: string): void {
		writeFileSync(file, text, "utf8");
	}

	/** Responsibilities: _text file extension_. **/
	public append_text(file: string, text: string): void {
		appendFileSync(file, text, "utf8");
	}

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
