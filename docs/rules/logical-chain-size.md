# `logical-chain-size`

Logical conditions with more than three parts or at least 100 significant characters are difficult to name,
review, and reuse. The rule counts the operands in a connected TypeScript `&&`, `||`, or `??`
expression and Python `and` or `or` expression. A single operand is ignored because it is not a
logical chain. Significant characters are counted with the same whitespace-insensitive metric used by callable-size checks. Mixed nested logical operators are counted as one chain, and only the outer
expression is reported.

```ts
return has_name && has_type && is_active && is_visible;
```

```ts
return request.user.permission_names && request.user.is_active && request.user.is_verified;
```

```python
return has_name and has_type and is_active and is_visible
```

```python
return request.user.permission_names and request.user.is_active and request.user.is_verified
```

**Fix:** Extract the condition into a named boolean variable or a predicate method, then use that
name at the decision or return boundary.

```ts
const can_publish = has_name && has_type && is_active && is_visible;
return can_publish;
```

```python
can_publish = has_name and has_type and is_active and is_visible
return can_publish
```
