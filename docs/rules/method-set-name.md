# `method-set-name`


## `set*`

`set` usually exposes a mutable data holder: callers learn the object's fields
and directly control its state.

```java
setName(...)
setStatus(...)
setPrice(...)
setOwner(...)
```

Prefer a domain command when the change is a real business action:

```java
setStatus(APPROVED)  →  approve()
setOwner(user)       →  assign(user)
```

If the changed value is part of the object's identity, prefer a new immutable
object instead of mutating the existing one. The rule is a design prompt, not
a ban on every setter: a technical adapter or genuine configuration property
may need `set_timeout`.
