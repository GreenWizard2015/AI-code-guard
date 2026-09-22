import { existsSync } from 'node:fs';
import type { SpawnOptions, SpawnSyncOptionsWithStringEncoding } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Responsibilities: _configuration Python bridge paths_. **/
export class PythonAstBridge {
	private readonly project_root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
	private readonly python_bridge_path = resolve(this.project_root, 'src/parser/python-bridge');
	private readonly bridge_file_name = 'src/parser/python-bridge/entrypoint.py';

	/** Responsibilities: _construction command-line arguments bridge_. **/
	private bridge_file_arguments(bridge_file: string, batch: boolean): string[] {
		if (!batch) {
			return [bridge_file];
		}
		return [bridge_file, '--batch'];
	}

	/** Responsibilities: _resolution Python bridge entrypoint_. **/
	public bridge_path(): string {
		const bridge_file = resolve(this.project_root, this.bridge_file_name);
		if (!existsSync(bridge_file)) {
			throw new Error('Python AST bridge script was not found.');
		}
		return bridge_file;
	}

	/** Responsibilities: _construction arguments one-shot Python_. **/
	public bridge_arguments(batch = false): string[] {
		const bridge_file = this.bridge_path();
		const bridge_arguments = this.bridge_file_arguments(bridge_file, batch);
		if (!process.env.COVERAGE_PROCESS_START?.trim()) {
			return bridge_arguments;
		}
		return ['-m', 'coverage', 'run', '--parallel-mode', ...bridge_arguments];
	}

	/** Responsibilities: _construction arguments persistent Python_. **/
	public worker_arguments(): string[] {
		return [...this.bridge_arguments(), '--worker'];
	}

	/** Responsibilities: _construction synchronous process options_. **/
	public bridge_options(text: string): SpawnSyncOptionsWithStringEncoding {
		return {
			input: `code:${text}`,
			encoding: 'utf8' as const,
			maxBuffer: 4 * 1024 * 1024,
			env: { ...process.env, PYTHONPATH: this.python_bridge_path },
		};
	}

	/** Responsibilities: _persistent-worker process options construction_. **/
	public worker_options(): SpawnOptions {
		const bridge_options = this.bridge_options('');
		return {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: bridge_options.env,
		};
	}
}
