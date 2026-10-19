export type PythonClassNameSet = ReadonlySet<string>;

export type PythonClassNamesByFile = Map<string, PythonClassNameSet>;

export type PythonClassBinding = {
	readonly file: string;
	readonly name: string;
};
