#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const arguments_list = process.argv.slice(2);
let report_argument;
let temperature = 0.1;

for (let index = 0; index < arguments_list.length; index += 1) {
	const argument = arguments_list[index];
	if (argument === "--temperature") {
		index += 1;
		const value = arguments_list[index];
		if (value === undefined) {
			console.error("--temperature requires a number greater than zero.");
			process.exit(2);
		}
		temperature = Number(value);
		continue;
	}
	if (argument.startsWith("--temperature=")) {
		temperature = Number(argument.slice("--temperature=".length));
		continue;
	}
	if (argument === "--help" || argument === "-h") {
		console.log("Usage: node sample-hotspots.mjs [report.md] [--temperature VALUE]");
		console.log("Temperature defaults to 0.1; it must be greater than zero.");
		console.log("Samples deepest positive-duration nodes; no duration cutoff.");
		console.log("Only cold snapshots are accepted; without a path, the newest one is used.");
		console.log("Draws 1000 samples when at least two timed leaves are available.");
		process.exit(0);
	}
	if (argument.startsWith("-")) {
		console.error(`Unknown option: ${argument}`);
		process.exit(2);
	}
	if (report_argument !== undefined) {
		console.error("Provide at most one performance report path.");
		process.exit(2);
	}
	report_argument = argument;
}

if (!Number.isFinite(temperature) || temperature <= 0) {
	console.error("--temperature must be a finite number greater than zero.");
	process.exit(2);
}

const report_path = report_argument ? resolve(report_argument) : latest_cold_report();
if (report_path === undefined) {
	console.error("No cold timing snapshot found. Run measure-runs.sh before sampling hotspots.");
	process.exit(1);
}
if (!/^cold_\d+\.performance\.md$/.test(basename(report_path))) {
	console.error("Hotspot sampling requires a cold_*.performance.md snapshot.");
	process.exit(2);
}

class StageNode {
	name;
	path;
	seconds;
	children;

	constructor(name, path) {
		this.name = name;
		this.path = path;
		this.seconds = undefined;
		this.children = new Map();
	}
}

function stage_parts(stage_name) {
	const slash = stage_name.indexOf("/");
	const stage_prefix = slash < 0 ? stage_name : stage_name.slice(0, slash);
	const parts = stage_prefix.split(".").filter((part) => part.length > 0);
	if (slash >= 0) {
		parts.push(stage_name.slice(slash));
	}
	return parts;
}

function stage_path(parts) {
	return parts.reduce((path, part, index) => {
		if (index === 0) {
			return part;
		}
		return part.startsWith("/") ? `${path}${part}` : `${path}.${part}`;
	}, "");
}

function append_stage(root, stage_name, seconds) {
	const parts = stage_parts(stage_name);
	let current = root;
	const path = [];
	for (const part of parts) {
		path.push(part);
		let child = current.children.get(part);
		if (child === undefined) {
			child = new StageNode(part, [...path]);
			current.children.set(part, child);
		}
		current = child;
	}
	current.seconds = seconds;
}

function parse_report(report_text) {
	const root = new StageNode("", []);
	for (const line of report_text.split(/\r?\n/)) {
		const match = line.match(/^\|\s*(.*?)\s*\|\s*(\d+(?:\.\d+)?)\s*sec\s*\|$/);
		if (match === null) {
			continue;
		}
		const stage_name = match[1].trim();
		if (stage_name.toLowerCase() === "total measured stages") {
			continue;
		}
		append_stage(root, stage_name, Number(match[2]));
	}
	return root;
}

function node_weight(node) {
	return Math.max(node.seconds ?? 0, 0);
}

function duration(node) {
	return node.seconds ?? 0;
}

function latest_cold_report() {
	const snapshots = resolve(workspace, ".ai-code-guard/performance-runs");
	let run_names;
	try {
		run_names = readdirSync(snapshots).sort().reverse();
	} catch {
		return undefined;
	}
	for (const run_name of run_names) {
		let file_names;
		try {
			file_names = readdirSync(join(snapshots, run_name));
		} catch {
			continue;
		}
		const cold_reports = file_names
			.filter((name) => /^cold_\d+\.performance\.md$/.test(name))
			.sort((left, right) => Number(right.match(/\d+/)?.[0] ?? 0) - Number(left.match(/\d+/)?.[0] ?? 0));
		const latest_report = cold_reports[0];
		if (latest_report !== undefined) {
			return join(snapshots, run_name, latest_report);
		}
	}
	return undefined;
}

function collect_candidates(node, candidates) {
	let descendant_has_time = false;
	for (const child of node.children.values()) {
		if (collect_candidates(child, candidates)) {
			descendant_has_time = true;
		}
	}
	const has_time = node.seconds !== undefined && node.seconds > 0;
	if (has_time && !descendant_has_time) {
		candidates.set(node, { node, count: 0 });
	}
	return has_time || descendant_has_time;
}

function weighted_distribution(nodes) {
	const maximum_log_weight = nodes
		.map((node) => Math.log(node_weight(node)) / temperature)
		.reduce((maximum, weight) => Math.max(maximum, weight), Number.NEGATIVE_INFINITY);
	let total = 0;
	const entries = nodes.map((node) => {
		total += Math.exp(Math.log(node_weight(node)) / temperature - maximum_log_weight);
		return { node, cumulative_weight: total };
	});
	return { entries, total };
}

function create_seeded_random(seed_text) {
	let state = createHash("sha256").update(seed_text).digest().readUInt32BE(0);
	if (state === 0) {
		state = 1;
	}
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function weighted_choice(distribution, random) {
	let lower = 0;
	let upper = distribution.entries.length - 1;
	const marker = random() * distribution.total;
	while (lower < upper) {
		const middle = Math.floor((lower + upper) / 2);
		const entry = distribution.entries[middle];
		if (entry !== undefined && marker < entry.cumulative_weight) {
			upper = middle;
		} else {
			lower = middle + 1;
		}
	}
	return distribution.entries[lower]?.node;
}

let report_text;
try {
	report_text = readFileSync(report_path, "utf8");
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Cannot read performance report ${report_path}: ${message}`);
	process.exit(1);
}

const root = parse_report(report_text);
if (root.children.size === 0) {
	console.error(`No timed stage rows found in ${report_path}.`);
	process.exit(1);
}

const sample_count = 1000;
const candidate_counts = new Map();
collect_candidates(root, candidate_counts);

if (candidate_counts.size === 0) {
	console.log(`No positive-duration leaf stages found in ${report_path}.`);
} else if (candidate_counts.size === 1) {
	const only_node = candidate_counts.keys().next().value;
	if (only_node !== undefined) {
		const route = only_node.path
			.map((part, part_index) => (part.startsWith("/") ? part : part_index === 0 ? part : `.${part}`))
			.join("");
		console.log(`Only one positive-duration leaf in ${report_path}; no relative sampling is possible:`);
		console.log(`${route} — ${duration(only_node).toFixed(3)} sec — sole timed leaf`);
	}
} else {
	const distribution = weighted_distribution([...candidate_counts.keys()]);
	const random = create_seeded_random(report_text);
	for (let attempt = 0; attempt < sample_count; attempt += 1) {
		const candidate = weighted_choice(distribution, random);
		if (candidate === undefined) {
			continue;
		}
		const current = candidate_counts.get(candidate);
		if (current !== undefined) {
			current.count += 1;
		}
	}
	const candidates = [...candidate_counts.values()]
		.filter((candidate) => candidate.count > 0)
		.sort((left, right) => right.count - left.count || duration(right.node) - duration(left.node))
		.slice(0, 5);
	console.log(`Top ${candidates.length} optimization candidates from ${sample_count} samples in ${report_path}:`);
	for (const [index, candidate] of candidates.entries()) {
		const seconds = duration(candidate.node);
		const route = candidate.node.path
			.map((part, part_index) => (part.startsWith("/") ? part : part_index === 0 ? part : `.${part}`))
			.join("");
		const percentage = (candidate.count * 100) / sample_count;
		console.log(
			`${index + 1}. ${route} — ${seconds.toFixed(3)} sec — ${candidate.count}/${sample_count} (${percentage.toFixed(1)}% of draws)`,
		);
	}
	if (candidates.length < 5) {
		console.log(`Only ${candidates.length} distinct positive-duration leaves received samples.`);
	}
}
