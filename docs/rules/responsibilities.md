# responsibilities

**Purpose:** Require every class, interface, type, method, and function to state its real ownership boundary in a docstring.

Use one line in the declaration documentation:

```text
Responsibilities: _parse input, normalize input_, _validate state_.
```

In TypeScript doc comments, close the documentation with `**/`, not `*/`.

Keep the list concise and comma-separated. Wrap every responsibility in paired `_` characters; commas inside a wrapped responsibility are allowed. Interface methods are excluded because the interface contract is the documented boundary.

Write responsibilities as short noun phrases naming the owned work, not as descriptions of a return value or a condition. For example, use `_user validation_`, not `_returns whether the user is valid_`.

Do not invent generic labels, hide multiple responsibilities in one phrase, or use the line only to silence the diagnostic. Split the owner when its responsibilities cannot be named honestly within the limit.
