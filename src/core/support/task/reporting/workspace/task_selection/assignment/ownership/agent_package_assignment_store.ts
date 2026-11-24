import { join } from "node:path";
import { AI_CODE_GUARD_DIRECTORY } from "src/constants";
import {
	AGENT_PACKAGE_OWNED_PATHS_HEADING,
	AGENT_PACKAGE_OWNERSHIP_MANIFEST_FILE_NAME,
	AGENT_PACKAGE_PRODUCTION_PATHS_HEADING,
	AGENT_PACKAGE_TASKS_DIRECTORY_NAME,
	AGENT_PACKAGE_TEST_PATHS_HEADING,
} from "src/core/support/task/reporting/workspace/task_selection/constants";
import type { IOContract } from "src/io/protocols";
import type {
	AgentPackageAssignmentStoreContract,
	AgentPackagePlan,
	AgentPackagePreviousAssignment,
} from "src/task_selection_types";

/** Responsibilities: _package assignment recovery_, _ownership manifest persistence_. **/
export class AgentPackageAssignmentStore implements AgentPackageAssignmentStoreContract {
	private readonly _directory: string;
	private readonly _file_io: IOContract;

	/** Responsibilities: _package document section lines_. **/
	private section_lines(document: string, heading: string): string[] {
		const lines = document.split("\n");
		const heading_index = lines.indexOf(heading);
		if (heading_index < 0) {
			return [];
		}
		return lines.slice(heading_index + 1);
	}

	/** Responsibilities: _owned-path section extraction_. **/
	private section_paths(document: string, heading: string): string[] {
		const lines = this.section_lines(document, heading);
		const paths: string[] = [];
		for (const line of lines) {
			if (line.startsWith("## ")) {
				break;
			}
			const match = /^- `([^`]+)`$/.exec(line.trim());
			if (match === null) {
				continue;
			}
			const path = match[1];
			if (path !== undefined && path !== "None") {
				paths.push(path);
			}
		}
		return paths;
	}

	/** Responsibilities: _package number parsing_. **/
	private package_number(file_name: string): number {
		const match = /^agent-(\d+)\.md$/.exec(file_name);
		if (match === null) {
			return 0;
		}
		const value = match[1];
		if (value === undefined) {
			return 0;
		}
		const package_number = Number(value);
		if (!Number.isSafeInteger(package_number) || package_number <= 0) {
			return 0;
		}
		return package_number;
	}

	/** Responsibilities: _previous package assignment parsing_. **/
	private assignment_from_file(file_name: string, package_number: number): AgentPackagePreviousAssignment {
		const document = this._file_io.file(join(this._directory, file_name)).file_text();
		const path_scopes = this.section_paths(document, AGENT_PACKAGE_OWNED_PATHS_HEADING);
		const production_files = this.section_paths(document, AGENT_PACKAGE_PRODUCTION_PATHS_HEADING);
		const test_files = this.section_paths(document, AGENT_PACKAGE_TEST_PATHS_HEADING);
		const files = [...production_files, ...test_files];
		return { package_number, files, path_scopes };
	}

	/** Responsibilities: _package assignment history_. **/
	public constructor(root: string, file_io: IOContract) {
		this._directory = join(root, AI_CODE_GUARD_DIRECTORY, AGENT_PACKAGE_TASKS_DIRECTORY_NAME);
		this._file_io = file_io;
	}

	/** Responsibilities: _previous assignment reconstruction_. **/
	public previous_assignments(): AgentPackagePreviousAssignment[] {
		if (!this._file_io.path_is_directory(this._directory)) {
			return [];
		}
		const assignments: AgentPackagePreviousAssignment[] = [];
		const listed_file_names = this._file_io.list_files(this._directory);
		const file_names = [...listed_file_names];
		file_names.sort();
		for (const file_name of file_names) {
			const package_number = this.package_number(file_name);
			if (package_number === 0) {
				continue;
			}
			assignments.push(this.assignment_from_file(file_name, package_number));
		}
		return assignments;
	}

	/** Responsibilities: _ownership manifest writing_. **/
	public write_manifest(staging_directory: string, plan: AgentPackagePlan): void {
		const manifest = {
			schema_version: 1,
			packages: plan.packages.map(({ number, files, path_scopes }) => ({
				package_number: number,
				files,
				path_scopes,
			})),
		};
		this._file_io
			.file(join(staging_directory, AGENT_PACKAGE_OWNERSHIP_MANIFEST_FILE_NAME))
			.write_text(JSON.stringify(manifest, null, 2));
	}
}
