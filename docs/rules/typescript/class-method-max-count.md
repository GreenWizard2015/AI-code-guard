# `class-method-max-count`

Description: An implementation class must not expose more than fifteen public or non-public
methods. Refactor excess operations into focused domain collaborators; do not
retain unrelated operations in a namespace-like class.

## Bad

```ts
// File: src/status_labels.ts
export class StatusLabels {
	public member_status(): string { return "member"; }
	public group_status(): string { return "group"; }
	public page_status(): string { return "page"; }
	public post_status(): string { return "post"; }
	public photo_status(): string { return "photo"; }
	public video_status(): string { return "video"; }
	public event_status(): string { return "event"; }
	public comment_status(): string { return "comment"; }
	public reaction_status(): string { return "reaction"; }
	public message_status(): string { return "message"; }
	public thread_status(): string { return "thread"; }
	public story_status(): string { return "story"; }
	public album_status(): string { return "album"; }
	public notification_status(): string { return "notification"; }
	public attachment_status(): string { return "attachment"; }
	public contact_status(): string { return "contact"; }
	public report(): void {
		const labels = [this.member_status(), this.group_status(), this.page_status(), this.post_status(), this.photo_status(), this.video_status(), this.event_status(), this.comment_status(), this.reaction_status(), this.message_status(), this.thread_status(), this.story_status(), this.album_status(), this.notification_status(), this.attachment_status(), this.contact_status()];
		console.log(labels.join(" "));
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";
(function () {
	const labels = new StatusLabels();
	labels.report();
})();
```

## Good

```ts
// File: src/status_labels.ts
/** Responsibilities: _status label mapping_. **/
export class StatusLabels {
	private readonly _labels: ReadonlyMap<string, string>;
	private readonly _fallback: string;

	/** Responsibilities: _mapping initialization_. **/
	public constructor(labels: ReadonlyMap<string, string>, fallback: string) {
		this._labels = labels;
		this._fallback = fallback;
	}

	/** Responsibilities: _status label selection_. **/
	public label(status: string): string {
		const label = this._labels.get(status);
		if (label === undefined) {
			return this._fallback;
		}
		return label;
	}

	/** Responsibilities: _prefixed label composition_. **/
	public label_with_prefix(prefix: string, status: string): string {
		const label = this.label(status);
		return `${prefix}: ${label}`;
	}

	/** Responsibilities: _fallback capitalization_. **/
	public uppercase_fallback(): string {
		const normalized = this._fallback.trim();
		return normalized.toUpperCase();
	}

	/** Responsibilities: _mapping size reporting_. **/
	public status_count(): number {
		let count = 0;
		for (const status_name of this._labels.keys()) {
			if (status_name.length > 0) {
				count += 1;
			}
		}
		return count;
	}
	/** Responsibilities: _status report output_. **/
	public report(): void {
		const label = this.label("ready");
		const detailed = this.label_with_prefix("State", "blocked");
		const fallback = this.uppercase_fallback();
		const count = this.status_count();
		console.log(`${label} ${detailed} ${fallback} ${count}`);
	}
}
// File: cli.ts
import { StatusLabels } from "src/status_labels";

(function () {
	const labels = new Map<string, string>();
	labels.set("ready", "Ready");
	labels.set("blocked", "Blocked");
	const status_labels = new StatusLabels(labels, "Unknown");
	status_labels.report();
})();
```
