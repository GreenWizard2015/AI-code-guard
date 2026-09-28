# cyrillic-comment

Comments and supported text files use English. Standalone Python triple-quoted
strings and TypeScript template-literal expression statements are treated as
comments. Cyrillic text remains allowed inside assigned or returned source
string literals.

```ts
// Localized text belongs in a string literal.
const message = "localized text";
```

```py
# English comment
message = "localized text"
```

Keep user-facing Cyrillic in data or string literals assigned to a value or
returned from a callable. Write comments and text files in English, and do not
use standalone multiline strings as comments. A text-file diagnostic is emitted
once per file; source code keeps its current per-comment behavior.
