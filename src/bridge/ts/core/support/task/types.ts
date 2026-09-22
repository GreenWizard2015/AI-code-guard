import type { ReportViolation } from 'src/bridge/ts/core/types';

export type TaskFileSelection = {
	files: string[];
	violations: ReportViolation[];
};
