# `method-get-name`


Review public non-boolean result methods beginning with `get*`. The name
usually exposes getter-style access to a mutable data holder. Prefer the
returned value: `getPrice()` → `price()` and `getUser(id)` → `user(id)`.

This is a review signal, not a ban at a technical adapter boundary.
