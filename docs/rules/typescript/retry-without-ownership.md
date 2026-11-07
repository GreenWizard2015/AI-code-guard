# retry-without-ownership

Description: Reports an unbounded production retry loop: an operation fails, the handler continues the loop, and no attempt owner limits retries.

## Bad

A profile synchronizer retries every failed request forever. No object owns an attempt limit or terminal failure.

```ts
// File: src/profile_synchronizer.ts
export class ProfileSynchronizer {
	private attempts: number;

	private fetch_profile(): void {
		this.attempts += 1;
		if (this.attempts === 1) {
			throw new Error("Temporary profile failure.");
		}
	}

	public constructor() {
		this.attempts = 0;
	}

	public synchronize(): void {
		while (true) {
			try {
				this.fetch_profile();
				return;
			} catch {
				continue;
			}
		}
	}

	public report(): void {
		this.synchronize();
		console.log("Synchronized local profile");
	}
}
// File: cli.ts
import { ProfileSynchronizer } from "src/profile_synchronizer";

(function () {
	const synchronizer = new ProfileSynchronizer();
	synchronizer.report();
})();
```
## Good

The same synchronizer bounds the attempts and stops after the final unsuccessful response.

```ts
// File: src/profile_synchronizer.ts
export class ProfileSynchronizer {
	private readonly _attempt_limit: number;
	private profile_response(attempt_number: number): string {
		if (attempt_number < 2) {
			return "";
		}
		const profile_words = "local profile".split(/\s+/u);
		const normalized_words = profile_words.map((profile_word) => profile_word.toUpperCase());
		return normalized_words.join(" ");
	}

	public constructor(attempt_limit: number) {
		if (attempt_limit < 1) {
			throw new Error("Attempt limit must be positive.");
		}
		this._attempt_limit = attempt_limit;
	}

	public synchronize(): string {
		for (let attempt_number = 1; attempt_number <= this._attempt_limit; attempt_number += 1) {
			const profile = this.profile_response(attempt_number);
			if (profile.length > 0) {
				return profile;
			}
			if (attempt_number === this._attempt_limit) {
				throw new Error("Profile synchronization failed.");
			}
		}
		throw new Error("Profile synchronization ended without a result.");
	}

	public report(): void {
		const profile = this.synchronize();
		console.log(`Synchronized ${profile}`);
	}
}
// File: cli.ts
import { ProfileSynchronizer } from "src/profile_synchronizer";

(function () {
	const synchronizer = new ProfileSynchronizer(3);
	synchronizer.report();
})();
```
