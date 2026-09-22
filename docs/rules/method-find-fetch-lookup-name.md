# `method-find-fetch-lookup-name`


Review public non-boolean result methods beginning with `find*`, `fetch*`, or
`lookup*`. These names expose how a result is obtained rather than the result
itself. Prefer `book(title)` over `find(title)`: the implementation remains
free to use a cache, construct the value, or retrieve it remotely.
