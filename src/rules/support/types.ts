export type MarkdownLine = {
	readonly text: string;
	readonly index: number;
};

export type MarkdownInlineCodeState = {
	readonly delimiter_length: number;
	readonly start_line: number;
	readonly start_column: number;
};

export type MarkdownInlineCodeSpan = {
	readonly start_line: number;
	readonly start_column: number;
	readonly end_line: number;
	readonly end_column: number;
};

export type MarkdownInlineCodeScan = {
	readonly state: MarkdownInlineCodeState;
	readonly spans: readonly MarkdownInlineCodeSpan[];
};

export type MarkdownInlineCodeStep = {
	readonly state: MarkdownInlineCodeState;
	readonly next_index: number;
	readonly spans: readonly MarkdownInlineCodeSpan[];
};

export type MarkdownFenceTransition = {
	readonly active_marker: string;
	readonly mask_line: boolean;
};
