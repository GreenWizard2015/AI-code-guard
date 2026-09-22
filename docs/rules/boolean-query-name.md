# `boolean-query-name`


Boolean queries are the exception to the general noun rule: their names
should read as adjectives or natural predicates. The mental test is whether
`is` can be placed before the name naturally.

## `is*`

Prefer the adjective without the redundant verb prefix:

```java
isEmpty()     → empty()
isReadable()  → readable()
isNegative()  → negative()
```

```text
is empty
is readable
is negative
```

Do not reject a valid predicate mechanically; the rule is about the declared
boolean result and whether the name reads naturally.

## `exists()`

`exists()` does not form a natural property phrase (`is exists`). Prefer a
property such as `present()`:

```text
file.exists()  →  file.present()
is present
```

## `equals()`

Use a property-shaped comparison name when the API permits it:

```text
equals(other)  →  equalTo(other)
is equal to
```

The preferred form is a naming recommendation for boolean results, not a
claim that every language's equality protocol can be renamed.

## `has*` and `can*`

These are logical extensions of the adjective rule, not absolute bans. If a
natural property exists, prefer it:

```text
hasAccess()  →  accessible()
hasValue()   →  present()
canWrite()   →  writable()
canRead()    →  readable()
```

Do not invent an awkward adjective merely to satisfy the rule. If
`object is <method>` sounds natural, the predicate is usually acceptable.
