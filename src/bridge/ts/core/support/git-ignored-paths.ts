import { spawnSync } from 'node:child_process';
import { relative } from 'node:path';

/** Responsibilities: _Git ignored path filtering_. **/
export class GitIgnoredPaths {
	private readonly repo_root: string;

	/** Responsibilities: _Git repository path initialization_. **/
	public constructor(repo_root: string) {
		this.repo_root = repo_root;
	}

	/** Responsibilities: _Git ignored paths discovery_. **/
	public ignored_paths(files: readonly string[]): ReadonlySet<string> {
		const paths = files.map(file => relative(this.repo_root, file).split('\\').join('/'));
		if (paths.length === 0 || paths.some(path => path === '..' || path.startsWith('../'))) {
			return new Set();
		}
		const result = spawnSync(
			'git',
			['-C', this.repo_root, 'check-ignore', '--no-index', '--stdin', '-z'],
			{ input: `${paths.join('\0')}\0`, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
		);
		if (result.error !== undefined || (result.status !== 0 && result.status !== 1)) {
			return new Set();
		}
		if (typeof result.stdout !== 'string') {
			return new Set();
		}
		return new Set(result.stdout.split('\0').filter(path => path.length > 0));
	}

	/** Responsibilities: _Git ignored files removal_. **/
	public filter(files: readonly string[]): string[] {
		const paths = files.map(file => relative(this.repo_root, file).split('\\').join('/'));
		const ignored = this.ignored_paths(files);
		if (ignored.size === 0 && paths.length > 0) {
			return [...files];
		}
		return files.filter((_, index) => {
			const path = paths[index];
			return path !== undefined && !ignored.has(path);
		});
	}
}
