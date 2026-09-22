# `class-size`

**Purpose:** Classes whose combined body-size metric is outside the configured range indicate weak
ownership.

```ts
class Everything {
  private readonly responsibility = 'unrelated operations';
}
```

**Fix:** Split by cohesive capability or use a module function. The combined body-size metric uses
source lines and executable SLOC, excluding the class declaration signature. Never add meaningless
padding. A class with an explicit base class, protocol, or interface is not required to meet the
minimum public method count, but its size, maximum method count, and implementation rules still
apply.
