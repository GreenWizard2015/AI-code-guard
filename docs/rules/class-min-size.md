# `class-min-size`

**Purpose:** Detect classes too small to justify their own ownership boundary.

**Fix:** Inline the behavior, replace the class with a focused module function, or give the class a
real stateful responsibility. Do not add meaningless methods or padding.

Before changing a small class, search the whole repository for construction, type references, and
member calls. A class can look trivial in its definition while its callers rely on the class as a
boundary. Inspect those callers and extract repeated options, dependencies, and lifecycle inputs
into immutable fields when they form one coherent responsibility. Prefer composition or a focused
owner over renaming the class or adding a wrapper only to satisfy this rule.

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

The metric combines class body lines and executable SLOC. The class declaration signature and Python
docstrings are excluded from the measurement.

For a genuine minimum-size finding, either add real state or behavior that belongs to the class or
lower the character threshold when the boundary is intentionally small. Do not add padding methods
or fields just to cross a limit.
