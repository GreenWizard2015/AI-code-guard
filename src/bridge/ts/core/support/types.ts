import type { AstCallableNode } from 'src/types';

export type ClassNodeInput = {
	name: string;
	start: number;
	end: number;
	methods: AstCallableNode[];
	base_class_name: string;
	base_class_names: string[];
	type_contract: boolean;
	protocol: boolean;
};

export type ViolationPriorityCounts = {
	info: number;
	warning: number;
	critical: number;
	files: number;
	total: number;
};
