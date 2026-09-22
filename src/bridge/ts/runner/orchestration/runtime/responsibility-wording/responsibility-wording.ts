import type { ResponsibilityWordingChecker } from 'src/bridge/ts/runner/orchestration/runtime/protocols';

/** Responsibilities: _responsibility wording validation_. **/
export class ResponsibilityWording implements ResponsibilityWordingChecker {
	private readonly action_words: ReadonlySet<string>;
	private readonly condition_words: ReadonlySet<string>;
	private readonly noun_words: ReadonlySet<string>;

	/** Responsibilities: _condition word detection_. **/
	private has_condition_word(value: string): boolean {
		return value
			.trim()
			.split(/\s+/u)
			.some(word => this.condition_words.has(word.toLowerCase()));
	}

	/** Responsibilities: _action word detection_. **/
	private has_action_word(value: string): boolean {
		return value
			.trim()
			.split(/\s+/u)
			.some(word => {
				const normalized_word = word.toLowerCase();
				return this.action_words.has(normalized_word) && !this.noun_words.has(normalized_word);
			});
	}

	/** Responsibilities: _initialization responsibility wording vocabulary_. **/
	public constructor(
		action_words: ReadonlySet<string>,
		condition_words: ReadonlySet<string>,
		noun_words: ReadonlySet<string>,
	) {
		this.action_words = action_words;
		this.condition_words = condition_words;
		this.noun_words = noun_words;
	}

	/** Responsibilities: _responsibility wording validation_. **/
	public valid(values: readonly string[]): boolean {
		for (const value of values) {
			if (value.trim().split(/\s+/u).length > 4) {
				return false;
			}
			if (this.has_condition_word(value)) {
				return false;
			}
			if (this.has_action_word(value)) {
				return false;
			}
		}
		return true;
	}
}
