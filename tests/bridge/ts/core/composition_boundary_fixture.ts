import type { ClassGraph, CodeClass } from "src/types";

/** Responsibilities: _composition graph construction_, _cycle scenario construction_. **/
export class CompositionBoundaryFixture {
	private readonly classes: Map<string, CodeClass>;

	/** Responsibilities: _deep class fixture addition_. **/
	private append_deep_class(root: string, index: number, depth: number): void {
		const key = `${root}/src/deep-${index}.ts:Deep${index}`;
		const dependency = `${root}/src/deep-${index + 1}.ts:Deep${index + 1}`;
		let dependencies: string[] = [];
		if (index + 1 < depth) {
			dependencies = [dependency];
		}
		this.classes.set(key, {
			key,
			file: `${root}/src/deep-${index}.ts`,
			line: 0,
			name: `Deep${index}`,
			dependencies,
		});
	}

	/** Responsibilities: _composition boundary fixture initialization_. **/
	public constructor() {
		this.classes = new Map<string, CodeClass>();
	}

	/** Responsibilities: _deep dependency graph fixture_. **/
	public deep_graph(root: string, depth: number): ClassGraph {
		this.classes.clear();
		for (let index = 0; index < depth; index += 1) {
			this.append_deep_class(root, index, depth);
		}
		return { classes: this.classes, classes_by_file: new Map(), imports_by_file: new Map() };
	}

	/** Responsibilities: _empty composition graph fixture_. **/
	public empty_graph(): ClassGraph {
		return { classes: new Map(), classes_by_file: new Map(), imports_by_file: new Map() };
	}

	/** Responsibilities: _cycle-context composition graph fixture_. **/
	public cycle_context_graph(root: string, order: readonly string[]): ClassGraph {
		const dependencies = new Map<string, readonly string[]>([
			["X", ["A"]],
			["Y", ["B"]],
			["A", ["B", "C"]],
			["B", ["A"]],
			["C", ["D"]],
			["D", []],
		]);
		const keys = new Map<string, string>();
		for (const name of dependencies.keys()) {
			keys.set(name, `${root}/src/${name}.ts:${name}`);
		}
		const classes = new Map<string, CodeClass>();
		for (const name of order) {
			const key = keys.get(name);
			const class_dependencies = dependencies.get(name);
			if (key === undefined || class_dependencies === undefined) {
				continue;
			}
			const dependency_keys: string[] = [];
			for (const dependency of class_dependencies) {
				const dependency_key = keys.get(dependency);
				if (dependency_key !== undefined) {
					dependency_keys.push(dependency_key);
				}
			}
			classes.set(key, {
				key,
				file: `${root}/src/${name}.ts`,
				line: 0,
				name,
				dependencies: dependency_keys,
			});
		}
		return { classes, classes_by_file: new Map(), imports_by_file: new Map() };
	}

	/** Responsibilities: _cycle-context fixture class key_. **/
	public cycle_context_key(root: string, name: string): string {
		return `${root}/src/${name}.ts:${name}`;
	}

	/** Responsibilities: _shared acyclic tail fixture_. **/
	public shared_acyclic_tail_graph(root: string): ClassGraph {
		const names = ["Y", "A", "B", "C", "D", "E", "F"];
		const y = `${root}/src/Y.ts:Y`;
		const a = `${root}/src/A.ts:A`;
		const b = `${root}/src/B.ts:B`;
		const c = `${root}/src/C.ts:C`;
		const d = `${root}/src/D.ts:D`;
		const e = `${root}/src/E.ts:E`;
		const f = `${root}/src/F.ts:F`;
		const keys = new Map<string, string>([
			["Y", y],
			["A", a],
			["B", b],
			["C", c],
			["D", d],
			["E", e],
			["F", f],
		]);
		const dependencies = new Map<string, readonly string[]>([
			["Y", [d]],
			["A", [b]],
			["B", [c]],
			["C", [d]],
			["D", [e]],
			["E", [f]],
			["F", []],
		]);
		const classes = new Map<string, CodeClass>();
		for (const name of names) {
			const key = keys.get(name);
			const class_dependencies = dependencies.get(name);
			if (key === undefined || class_dependencies === undefined) {
				continue;
			}
			classes.set(key, { key, file: `${root}/src/${name}.ts`, line: 0, name, dependencies: [...class_dependencies] });
		}
		return { classes, classes_by_file: new Map(), imports_by_file: new Map() };
	}

	/** Responsibilities: _cycle-tail graph_. **/
	public cycle_with_acyclic_tail_graph(root: string): ClassGraph {
		const names = ["Y", "A", "B", "C", "D", "E", "F"];
		const y = `${root}/src/Y.ts:Y`;
		const a = `${root}/src/A.ts:A`;
		const b = `${root}/src/B.ts:B`;
		const c = `${root}/src/C.ts:C`;
		const d = `${root}/src/D.ts:D`;
		const e = `${root}/src/E.ts:E`;
		const f = `${root}/src/F.ts:F`;
		const keys = new Map<string, string>([
			["Y", y],
			["A", a],
			["B", b],
			["C", c],
			["D", d],
			["E", e],
			["F", f],
		]);
		const dependencies = new Map<string, readonly string[]>([
			["Y", [d]],
			["A", [a, b]],
			["B", [c]],
			["C", [d]],
			["D", [e]],
			["E", [f]],
			["F", []],
		]);
		const classes = new Map<string, CodeClass>();
		for (const name of names) {
			const key = keys.get(name);
			const class_dependencies = dependencies.get(name);
			if (key === undefined || class_dependencies === undefined) {
				continue;
			}
			classes.set(key, { key, file: `${root}/src/${name}.ts`, line: 0, name, dependencies: [...class_dependencies] });
		}
		return { classes, classes_by_file: new Map(), imports_by_file: new Map() };
	}
}
