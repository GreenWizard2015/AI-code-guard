# `stateless-class`

**Purpose:** A class with no state is often a namespace in disguise.

```ts
class TextTools { public trim(value: string): string { return value.trim(); } }
```

**Fix:** First search the whole repository for construction, type references, and member calls. Then
inspect the callers for options, dependencies, and lifecycle data that belong together as immutable
class state. Keep the class when that state defines a real adapter or protocol boundary; otherwise
use module functions or composition. Do not add fields, wrappers, or methods only to silence lint.

```ts
class MessageReader {
  private readonly source: MessageSource;
  private readonly options: ReaderOptions;

  public constructor(source: MessageSource, options: ReaderOptions) {
    this.source = source;
    this.options = options;
  }

  public read(): Message { return this.source.read(this.options); }
}
```
