# `multiple-result-shapes`

**Purpose:** Business logic should not know every upstream response representation.

```ts
if (response.content !== undefined) {
  return response.content;
}
if (response.result !== undefined) {
  if (response.result.content !== undefined) {
    return response.result.content;
  }
}
return response;
```

Python response branching is covered too:

```py
if response.content is not None:
    return response.content
return response
```

**Fix:** Normalize the upstream response once at the transport boundary.
