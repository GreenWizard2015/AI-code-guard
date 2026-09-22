# `method-handle-name`


Review public commands beginning with `handle*`. `handleRequest()` or
`handleEvent()` says only “do something with X”. Prefer the real action, such
as `respond()`, `retry()`, `reject()`, `publish()`, or `store()`. Framework
callback boundaries may legitimately retain `handle`.
