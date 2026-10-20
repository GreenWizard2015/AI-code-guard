export const NAMING_RULE_DATA = {
	"method-get-name": {
		message: 'public result method "{name}" uses get*',
		hint: "Name the returned value instead of exposing getter-style storage access.",
		priority: 2,
	},
	"method-find-fetch-lookup-name": {
		message: 'public result method "{name}" exposes its lookup mechanism',
		hint: "Name the returned domain result; keep search, cache, and remote retrieval details private.",
		priority: 2,
	},
	"method-load-read-open-name": {
		message: 'public result method "{name}" exposes its loading mechanism',
		hint: "Name the returned value instead of exposing whether it is loaded, read, or opened.",
		priority: 2,
	},
	"method-calculate-compute-name": {
		message: 'public result method "{name}" exposes its calculation mechanism',
		hint: "Name the returned result, such as price, total, hash, or distance.",
		priority: 2,
	},
	"method-create-build-generate-name": {
		message: 'public result method "{name}" exposes its construction mechanism',
		hint: "Name the returned value; use a concrete command only when the method changes the outside world.",
		priority: 2,
	},
	"method-parse-convert-transform-name": {
		message: 'public result method "{name}" exposes its transformation mechanism',
		hint: "Name the returned representation or value object instead of the conversion procedure.",
		priority: 2,
	},
	"method-set-name": {
		message: "public method uses a storage-shaped setter name",
		hint: "Review whether a domain transition name such as approve, assign_owner, or rename is clearer than set_.",
		priority: 2,
	},
	"method-process-name": {
		message: 'public command "{name}" uses process*',
		hint: "Replace process* with the concrete domain action, or split the method if it performs several actions.",
		priority: 2,
	},
	"method-handle-name": {
		message: 'public command "{name}" uses handle*',
		hint: "Replace handle* with the concrete domain action; framework callback boundaries may keep it.",
		priority: 2,
	},
	"method-execute-perform-do-name": {
		message: 'public command "{name}" uses a technical command verb',
		hint: "Replace execute*, perform*, or do* with the concrete domain action.",
		priority: 2,
	},
	"method-and-name": {
		message: 'public method "{name}" contains And and may have two responsibilities',
		hint: "Split the independent contracts unless the combined operation must be atomic.",
		priority: 2,
	},
	"method-long-name": {
		message: 'public method "{name}" has an excessive compound name',
		hint: "Review the class boundary and split responsibilities before shortening the name mechanically.",
		priority: 2,
	},
	"boolean-is-name": {
		message: 'boolean method "{name}" uses an is* name',
		hint: "Prefer the adjective when it reads naturally, such as empty, readable, or negative.",
		priority: 2,
	},
	"boolean-exists-name": {
		message: 'boolean method "{name}" uses exists()',
		hint: "Prefer a property-shaped name such as present() when it expresses the contract naturally.",
		priority: 2,
	},
	"boolean-equals-name": {
		message: 'boolean method "{name}" uses equals()',
		hint: "Prefer a property-shaped comparison such as equal_to when the language protocol permits it.",
		priority: 2,
	},
	"boolean-has-can-name": {
		message: 'boolean method "{name}" uses has* or can*',
		hint: "Prefer a natural property such as accessible, present, writable, or readable when appropriate.",
		priority: 2,
	},
	naming: {
		message: '{kind} "{name}" must use snake_case and has too many words (found {word_count})',
		hint: "rename the symbol to concise snake_case. Do not: hide a long name behind an alias.",
		priority: 2,
	},
	"naming-private": {
		message: '{label} "{name}" must not use a leading underscore',
		hint: "remove the leading underscore. Leading underscores are reserved for fields, private methods, and names made only of underscores.",
		priority: 2,
	},
} as const;
