# `typescript-inline-object-type`

**Purpose:** Anonymous object shapes cannot be reused or named at a boundary.

```ts
function load(input: { id: string }): Result {
  const input_id = input.id.trim();
  if (input_id.length === 0) {
    throw new Error('id is required');
  }
  const request = { id: input_id };
  const result = read(request);
  if (result === undefined) {
    throw new Error('result is required');
  }
  return result;
}

function create_shell(): {
  header: HTMLDivElement;
  body: HTMLDivElement;
  footer: HTMLDivElement;
} {
  const shell = buildShell();
  if (shell.header === undefined) {
    throw new Error('header is required');
  }
  return { header: shell.header, body: shell.body, footer: shell.footer };
}
```

**Fix:** Declare `interface LoadInput { id: string }` and use it.

The rule also covers multiline anonymous object return types. Name the shape before returning it.
