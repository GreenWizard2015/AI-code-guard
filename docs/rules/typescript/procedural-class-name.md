# `procedural-class-name`

Description: Warn when a class name describes a job rather than the entity, value, collection, or
technical boundary it represents. This is a naming signal, not proof of a design defect.

### Naming guidance

The rule checks names only; stateful adapters, protocols, mixins, and test types may have technical
names. Prefer “what is it?” over “what does it do?”:

| Job-like name | Consider representing |
| --- | --- |
| `Manager`, `Controller`, `Service` | owned entities and their lifecycle |
| `Handler`, `Processor`, `Dispatcher` | the message, result, or participants |
| `Helper`, `Utils`, `Utility` | focused domain objects that own each operation |
| `Reader`, `Writer`, `Parser`, `Converter` | the file, parsed value, or representation |
| `Validator`, `Resolver`, `Provider`, `Loader` | the validated value, path, token, or configuration |
| `Fetcher`, `Generator`, `Calculator`, `Sorter` | the user, report, price, or sorted value |
| `Encoder`, `Decoder`, `Router`, `Runner`, `Locator` | encoded data, route, execution, or explicit dependencies |
| `Observer`, `Listener`, `Client` | the domain participant or a narrow technical boundary |

Regular plurals are checked (`Helpers`, `Readers`, `Validators`); `-ies` normalizes to `-y`
(`Factories`). `Data`, `Info`, `Object`, `Impl`, `Interface`, and `I...` are weak names; prefer
the actual concept or a distinguishing qualifier such as `SqlUsers` or `CachedUsers`.

These are not blanket bans: a stateful `RemoteClient` or an architectural `Factory` can be valid.
Treat `Builder` as a clue to inspect an oversized constructor. If a class has unrelated operations,
split ownership instead of only renaming it.

### References

- [Seven Virtues of a Good Object](https://www.yegor256.com/2014/11/20/seven-virtues-of-a-good-object.html)
- [OOP Alternative to Utility Classes](https://www.yegor256.com/2014/05/05/oop-alternative-to-utility-classes.html)

## Bad

```ts
class MessageProcessor { // <- error
	public process(message: string): string { return message.trim(); }
}
```


## Good

`Message` represents the same trimmed input as a value and owns operations on that value.

```ts
// File: src/message.ts
/** Responsibilities: _message value_. **/
export class Message {
	public readonly text: string;
	/** Responsibilities: _message initialization_. **/
	public constructor(content: string) { this.text = content.trim(); }
	/** Responsibilities: _empty message classification_. **/
	public empty(): boolean { return this.text.length === 0; }
	/** Responsibilities: _message word count_. **/
	public word_count(): number {
		if (this.text.length === 0) { return 0; }
		return this.text.split(/\s+/u).length;
	}
	/** Responsibilities: _message character count_. **/
	public character_count(): number {
		let count = 0;
		for (let index = 0; index < this.text.length; index += 1) { count += 1; }
		return count;
	}
	/** Responsibilities: _message content search_. **/
	public contains(fragment: string): boolean {
		const value = fragment.trim();
		if (value.length === 0) { return false; }
		return this.text.split(/\s+/u).includes(value);
	}
	/** Responsibilities: _message summary_. **/
	public summary(): string { return `${this.text} (${this.word_count()} words)`; }
}
// File: cli.ts
import { Message } from "src/message";
(function () {
	const message = new Message(" hello world ");
	console.log(message.text, message.empty(), message.word_count(), message.character_count(), message.contains("hello"), message.summary());
})();
```

