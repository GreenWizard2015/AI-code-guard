# `method-process-name`


Review public commands beginning with `process*`. The name often hides several
actions: `processPayment()` may validate, authorize, charge, store, and notify.
Replace it with the concrete domain action or split the responsibilities.
`process` may remain at a genuine generic processing boundary.
