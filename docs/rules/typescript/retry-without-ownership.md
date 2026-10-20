# retry-without-ownership

Description: Reports an unbounded production retry loop: an operation fails, the handler continues the loop, and no attempt owner limits retries.

## Bad

A profile synchronizer retries every failed request forever. No object owns an attempt limit or terminal failure.

```ts
// File: src/profile_synchronizer.ts
export class ProfileSynchronizer {
	private readonly endpoint: string;

	public constructor(endpoint: string) {
		this.endpoint = endpoint;
	}

	public async synchronize(): Promise<void> {
		while (true) {
			try {
				await fetch_profile(this.endpoint);
				return;
			} catch (error) {
				if (!is_expected_boundary_failure(String(error))) {
					throw error;
				}
				continue;
			}
		}
	}

	public endpoint_host(): string {
		const parsed_url = new URL(this.endpoint);
		const host = parsed_url.hostname;
		if (host.length === 0) {
			throw new Error("Endpoint must include a host.");
		}
		return host;
	}
}
// File: cli.ts
import { ProfileSynchronizer } from "src/profile_synchronizer";

(async function () {
	const synchronizer = new ProfileSynchronizer("https://example.test/profile");
	await synchronizer.synchronize();
	const host = synchronizer.endpoint_host();
	console.log(host);
})();
```
## Good

The same synchronizer bounds the attempts and stops after the final unsuccessful response.

```ts
// File: src/profile_synchronizer.ts
export class ProfileSynchronizer {
	private readonly endpoint: string;
	private readonly attempt_limit: number;

	public constructor(endpoint: string, attempt_limit: number) {
		if (attempt_limit < 1) {
			throw new Error("Attempt limit must be positive.");
		}
		this.endpoint = endpoint;
		this.attempt_limit = attempt_limit;
	}

	public async synchronize(): Promise<void> {
		for (let attempt = 0; attempt < this.attempt_limit; attempt += 1) {
			const succeeded = await fetch_profile(this.endpoint);
			if (succeeded) {
				return;
			}
			if (attempt + 1 === this.attempt_limit) {
				throw new Error("Profile synchronization failed.");
			}
		}
	}

	public endpoint_host(): string {
		const parsed_url = new URL(this.endpoint);
		const host = parsed_url.hostname;
		if (host.length === 0) {
			throw new Error("Endpoint must include a host.");
		}
		return host;
	}
}
// File: cli.ts
import { ProfileSynchronizer } from "src/profile_synchronizer";

(async function () {
	const synchronizer = new ProfileSynchronizer("https://example.test/profile", 3);
	await synchronizer.synchronize();
	const host = synchronizer.endpoint_host();
console.log(host);
})();
```
