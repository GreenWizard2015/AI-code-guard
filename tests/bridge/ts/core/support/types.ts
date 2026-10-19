import type { InMemoryFileIO } from "tests/bridge/ts/core/cache/in_memory_file_io";

export type TaskReportingFixtureFiles = Record<string, string>;
export type TaskReportingFileIOFactory = (root: string, files: TaskReportingFixtureFiles) => InMemoryFileIO;
