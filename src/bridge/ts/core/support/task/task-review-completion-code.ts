import { createHash } from "node:crypto";
import type { TaskReviewCompletionCodeProtocol } from "src/protocols";

/** Responsibilities: _architecture review completion code_. **/
export class TaskReviewCompletionCode implements TaskReviewCompletionCodeProtocol {
	private readonly validity_window_minutes = 5;

	/** Responsibilities: _review minute value_. **/
	private minute_value(timestamp: Date): string {
		return [
			timestamp.getFullYear().toString().padStart(4, "0"),
			(timestamp.getMonth() + 1).toString().padStart(2, "0"),
			timestamp.getDate().toString().padStart(2, "0"),
			timestamp.getHours().toString().padStart(2, "0"),
			timestamp.getMinutes().toString().padStart(2, "0"),
		].join("");
	}

	/** Responsibilities: _completion code generation_. **/
	public completion_code(timestamp: Date): string {
		return createHash("md5").update(this.minute_value(timestamp)).digest("hex");
	}

	/** Responsibilities: _completion code presence detection_. **/
	public contains(text: string, current_time: Date): boolean {
		for (let offset = 0; offset < this.validity_window_minutes; offset += 1) {
			const offset_milliseconds = offset * 60_000;
			const timestamp = new Date(current_time.getTime() - offset_milliseconds);
			const code = this.completion_code(timestamp);
			if (text.includes(code)) {
				return true;
			}
		}
		return false;
	}
}
