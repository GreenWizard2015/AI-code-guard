import type { ReportViolation } from 'src/types';

export type TaskFileSelection = {
	files: string[];
	violations: ReportViolation[];
};
