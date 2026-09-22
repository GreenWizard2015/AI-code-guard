# `method-load-read-open-name`


Review public non-boolean result methods beginning with `load*`, `read*`, or
`open*`. Prefer the returned value or representation: `content()` may read a
file, use a cache, call HTTP, or return an existing object without exposing
that implementation choice.
