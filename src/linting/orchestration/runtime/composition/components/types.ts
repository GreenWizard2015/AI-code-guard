export type CompositionChainState = {
	depth: number;
	next_key: string;
};

export type CompositionChainFrame = {
	key: string;
	next_index: number;
	best_depth: number;
	best_next: string;
	cycle_dependent: boolean;
	waiting_for: string;
};

export type CompositionFrameContext = {
	active: Set<string>;
	frames: CompositionChainFrame[];
	states: Map<string, CompositionChainState>;
	contextual: Set<string>;
};
