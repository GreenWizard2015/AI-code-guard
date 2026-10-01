import { spawnSync } from "node:child_process";
import { relative } from "node:path";

/** Responsibilities: _Git ignored path filtering_. **/
export class GitIgnoredPaths {
	private readonly repo_root: string;

	/** Responsibilities: _Git path boundary validation_. **/
	private valid_paths(paths: readonly string[]): boolean {
		if (paths.length === 0) {
			return false;
		}
		return !paths.some((path) => [".."].includes(path) || path.startsWith("../"));
	}

	/** Responsibilities: _Git ignored result collection_. **/
	private ignored_result(paths: readonly string[]): ReadonlySet<string> {
		const result = spawnSync("git", ["-C", this.repo_root, "check-ignore", "--no-index", "--stdin", "-z"], {
			input: `${paths.join("\0")}\0`,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		});
		if (result.error !== undefined) {
			return new Set();
		}
		if (result.status === null) {
			return new Set();
		}
		if (![0, 1].includes(result.status)) {
			return new Set();
		}
		if (typeof result.stdout !== "string") {
			return new Set();
		}
		return new Set(result.stdout.split("\0").filter((path) => path.length > 0));
	}

	/** Responsibilities: _Git repository path initialization_. **/
	public constructor(repo_root: string) {
		this.repo_root = repo_root;
	}

	/** Responsibilities: _Git ignored paths discovery_. **/
	public ignored_paths(files: readonly string[]): ReadonlySet<string> {
		const paths = files.map((file) => relative(this.repo_root, file).split("\\").join("/"));
		if (!this.valid_paths(paths)) {
			return new Set();
		}
		return this.ignored_result(paths);
	}

	/** Responsibilities: _Git ignored files removal_. **/
	public filter(files: readonly string[]): string[] {
		const paths = files.map((file) => relative(this.repo_root, file).split("\\").join("/"));
		const ignored = this.ignored_paths(files);
		if (ignored.size === 0) {
			return [...files];
		}
		return files.filter((_, index) => {
			const path = paths[index];
			if (path === undefined) {
				return false;
			}
			return !ignored.has(path);
		});
	}
}
