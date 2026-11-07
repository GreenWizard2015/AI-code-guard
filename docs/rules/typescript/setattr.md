# `setattr`

Description: Dynamic assignment hides which state changes.

The equivalent TypeScript dynamic assignment is also rejected:

```ts
setattr(item, 'name', value);
```

Fix: Assign an explicit field or use a named state-transition method.

## Bad

```ts
// File: src/profile.ts
export class Profile {
	public name: string;
	public readonly group: string;
	public constructor(name: string, group: string) {
		this.name = name;
		this.group = group;
	}
	public rename(value: string): void { setattr(this, "name", value); }
	public label(): string { return `${this.name} (${this.group})`; }
	public report(): void {
		this.rename("Mira");
		console.log(this.label());
	}
}
function setattr(target: Profile, key: "name", value: string): void {
	if (key === "name") {
		target.name = value;
	}
}
// File: cli.ts
import { Profile } from "src/profile";
(function () {
	const profile = new Profile("Mira", "design");
	profile.report();
})();
```

## Good

```ts
// File: src/profile_types.ts
export enum ProfileName {
	Mira = "Mira",
	MiraChen = "Mira Chen",
}
export enum ProfileGroup {
	Design = "Design",
}
// File: src/profile.ts
import { ProfileGroup, ProfileName } from "src/profile_types";

export class Profile {
	private readonly _name: ProfileName;
	private readonly _group: ProfileGroup;
	public constructor(name: ProfileName, group: ProfileGroup) {
		this._name = name;
		this._group = group;
	}
	public report_with_name(replacement: ProfileName): void {
		const renamed_profile = new Profile(replacement, this._group);
		renamed_profile.report();
	}
	public summary(): string {
		const formatted_name = this._name.trim().replace(/\s+/gu, " ");
		const formatted_group = this._group.trim().toUpperCase();
		const name_words = formatted_name.split(/\s+/u);
		const word_count = name_words.filter((word) => word.length > 0).length;
		return `${formatted_name} (${formatted_group}, ${word_count} words)`;
	}
	public name_character_count(): number {
		let count = 0;
		for (const character of this._name) {
			if (character.trim().length > 0) { count += 1; }
		}
		return count;
	}
	public group_label(): string {
		const words = this._group.toLowerCase().split(/\s+/u);
		const formatted_words: string[] = [];
		for (const word of words) {
			if (word.length > 0) { formatted_words.push(word.toUpperCase()); }
		}
		return formatted_words.join("-");
	}
	public report(): void {
		const summary = this.summary();
		const character_count = this.name_character_count();
		const group_label = this.group_label();
		console.log(`${summary} | ${group_label} | ${character_count} visible characters`);
	}
}
// File: cli.ts
import { Profile } from "src/profile";
import { ProfileGroup, ProfileName } from "src/profile_types";
(function () {
	const profile = new Profile(ProfileName.Mira, ProfileGroup.Design);
	profile.report_with_name(ProfileName.MiraChen);
})();
```
