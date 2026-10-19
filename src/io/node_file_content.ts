import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import type { FileContentContract } from "src/io/protocols";

/** Responsibilities: _file content reading_, _file content modification_. **/
export class NodeFileContent implements FileContentContract {
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
}
