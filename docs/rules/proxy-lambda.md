# `proxy-lambda`

**Purpose:** Reject a lambda that only forwards its parameters, in any order, to a method of the current project-owned object.

```python
lambda expression, owner: self.resolve_owner(expression, owner)
```

```ts
(expression, owner) => this.resolve_owner(expression, owner)
```

**Fix:** Call the owning method directly or pass the owning object through the interface. The rule compares parameter references with forwarded argument references without requiring positional order or a special method name. Callbacks passed directly to external APIs, such as `HTMLElement.addEventListener`, are outside this rule because they are call arguments rather than object-property implementations.
