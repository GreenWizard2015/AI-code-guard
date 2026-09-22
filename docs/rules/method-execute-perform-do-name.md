# `method-execute-perform-do-name`


Review public commands beginning with `execute*`, `perform*`, or `do*`. These
technical verbs carry little domain meaning. Replace `performValidation()` or
`doUpdate()` with the concrete domain action. Generic command infrastructure
may keep the technical name when it is the actual contract.
