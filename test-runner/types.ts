export type TestRunnerRequest = {
	readonly args: readonly string[];
	readonly help_requested: boolean;
	readonly headless: boolean;
	readonly skip_quality: boolean;
	readonly skip_review: boolean;
};

export type QualityCheck = {
	readonly label: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly environment: NodeJS.ProcessEnv;
	readonly supports_skip_review: boolean;
};
