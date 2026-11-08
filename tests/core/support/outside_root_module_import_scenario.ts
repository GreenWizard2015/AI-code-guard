import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { TSX_IMPORT_WORKER_SOURCE } from "tests/core/constants";

/** Responsibilities: _working-directory isolation_, _module import verification_. **/
export class OutsideRootModuleImportScenario {
	private readonly _module_path: string;
	private readonly _tsx_api_path: string;

	/** Responsibilities: _outside-root module import setup_. **/
	public constructor(module_path: string, tsx_api_path: string) {
		this._module_path = module_path;
		this._tsx_api_path = tsx_api_path;
	}

	/** Responsibilities: _outside-root module resolution_. **/
	public async load(outside_directory: string, parent_module_name: string): Promise<string> {
		const original_directory = process.cwd();
		process.chdir(outside_directory);
		const worker = new Worker(TSX_IMPORT_WORKER_SOURCE, {
			eval: true,
			workerData: {
				module_path: this._module_path,
				parent_url: pathToFileURL(join(outside_directory, parent_module_name)).href,
				tsx_api_path: this._tsx_api_path,
			},
		});
		try {
			return await new Promise<string>((resolve, reject) => {
				worker.once("message", resolve);
				worker.once("error", reject);
				worker.once("exit", (code) => {
					if (code !== 0) {
						reject(new Error(`TSX import worker exited with code ${code}`));
					}
				});
			});
		} finally {
			await worker.terminate();
			process.chdir(original_directory);
		}
	}
}
