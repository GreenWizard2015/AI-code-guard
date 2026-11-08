import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { REPORTING_PROJECT_ROOT } from "src/constants";
import { RULE_DOCUMENT_PATHS_BY_ID } from "src/constants";
import {
	REVIEW_COMMON_DOCUMENT,
	REVIEW_DOCUMENT_NAMES,
	REVIEW_FINDING_DOCUMENT,
	REVIEW_PATH_PLACEHOLDER,
	REVIEW_PREAMBLE_DOCUMENT,
	REVIEW_PREAMBLE_PLACEHOLDER,
} from "src/core/support/task/constants";
import { TaskRuleDocumentation } from "src/core/support/task/reporting/task_rule_documentation";
import { ON_REVIEW_DOCUMENT } from "src/core/support/task/review-agent/constants";
import type { IOContract } from "src/io/protocols";
import { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";
import { TaskReportingMemoryWorkspace } from "tests/bridge/ts/core/support/task-reporting-memory-workspace";
import type { CallableFileIOFactory } from "tests/bridge/ts/core/types";

/** Responsibilities: _rule documentation registration_, _review workspace preparation_. **/
export class TaskReportingMemoryFixture {
	/** Responsibilities: _rule documentation registration_. **/
	private rule_documents(root: string, file_io: IOContract): void {
		for (const paths of RULE_DOCUMENT_PATHS_BY_ID.values()) {
			for (const path of paths) {
				const file = resolve(root, path);
				const rule_name = basename(path)
					.replace(/^(?:typescript|python)-/u, "")
					.replace(/\.md$/u, "");
				file_io.create_directory(dirname(file));
				file_io.file(file).write_text(`# \`${rule_name}\`\n`);
			}
		}
	}

	/** Responsibilities: _review workspace preparation_. **/
	private review_documents(file_io: IOContract): void {
		const directory = join(REPORTING_PROJECT_ROOT, "docs", "agent");
		file_io.create_directory(directory);
		const prompt = `# Architecture review agent instructions\n${REVIEW_PATH_PLACEHOLDER}\n${REVIEW_PREAMBLE_PLACEHOLDER}\n`;
		for (const file of REVIEW_DOCUMENT_NAMES) {
			file_io.file(join(directory, file)).write_text(prompt);
		}
		file_io.file(join(directory, REVIEW_PREAMBLE_DOCUMENT)).write_text("Review preamble.\n");
		file_io.file(join(directory, REVIEW_COMMON_DOCUMENT)).write_text("Allowed operations.\n");
		file_io.file(join(directory, REVIEW_FINDING_DOCUMENT)).write_text("Finding requirements.\n");
		file_io.file(join(directory, ON_REVIEW_DOCUMENT)).write_text("Defects remaining to find: {N}.\n");
	}

	/** Responsibilities: _fixture creation_. **/
	public create(files: Record<string, string> = {}): TaskReportingMemoryWorkspace<InMemoryFileIO> {
		return this.create_with_file_io_factory(files, (root, source_files) => {
			const file_io = new InMemoryFileIO();
			const absolute_files = new Map(Object.entries(source_files).map(([file, text]) => [resolve(root, file), text]));
			file_io.seed_files(absolute_files);
			return file_io;
		});
	}

	/** Responsibilities: _custom IOContract fixture creation_. **/
	public create_with_file_io_factory<FileIO extends IOContract>(
		files: Record<string, string>,
		file_io_factory: CallableFileIOFactory<FileIO>,
	): TaskReportingMemoryWorkspace<FileIO> {
		const root = `/virtual/task-reporting-${randomUUID()}`;
		const file_io = file_io_factory(root, files);
		file_io.create_directory(root);
		this.rule_documents(root, file_io);
		this.review_documents(file_io);
		const documentation = new TaskRuleDocumentation(root, file_io);
		return new TaskReportingMemoryWorkspace(root, file_io, documentation);
	}
}
