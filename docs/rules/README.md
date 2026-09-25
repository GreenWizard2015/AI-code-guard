# Coding Lint Rules

Every active rule is defined in `src/parser/ts/constants.ts` and has exactly one reference
document with the same name: `docs/rules/{rule-id}.md`. The reporter validates this mapping at
startup and fails when a rule document is missing or a diagnostic uses an unknown rule ID.

## Rules

- [`assertion-outside-test`](assertion-outside-test.md)
- [`argument-count`](argument-count.md)
- [`attribute-depth`](attribute-depth.md)
- [`bare-type-alias`](bare-type-alias.md)
- [`typescript-bind`](typescript-bind.md)
- [`singular-plural-alias`](singular-plural-alias.md)
- [`branch-duplication`](branch-duplication.md)
- [`broad-except`](broad-except.md)
- [`python-call-method`](python-call-method.md)
- [`python-callable`](python-callable.md)
- [`responsibilities`](responsibilities.md)
- [`responsibilities-min-count`](responsibilities-min-count.md)
- [`responsibilities-max-count`](responsibilities-max-count.md)
- [`responsibilities-wording`](responsibilities-wording.md)
- [`callable-max-size`](callable-max-size.md)
- [`callable-min-size`](callable-min-size.md)
- [`test-max-size`](test-max-size.md)
- [`test-min-size`](test-min-size.md)
- [`class-callback-fields`](class-callback-fields.md)
- [`class-field-import`](class-field-import.md)
- [`class-like-prefix`](class-like-prefix.md)
- [`class-max-size`](class-max-size.md)
- [`composite-state-type`](composite-state-type.md)
- [`class-method-count-info`](class-method-count-info.md)
- [`class-method-min-count`](class-method-min-count.md)
- [`class-method-max-count`](class-method-max-count.md)
- [`class-interface-count`](class-interface-count.md)
- [`class-min-size`](class-min-size.md)
- [`class-reference-info`](class-reference-info.md)
- [`class-reference-warning`](class-reference-warning.md)
- [`class-size`](class-size.md)
- [`python-class-method`](python-class-method.md)
- [`complex-constructor`](complex-constructor.md)
- [`complex-default-parameter`](complex-default-parameter.md)
- [`cyrillic-comment`](cyrillic-comment.md)
- [`composition-depth`](composition-depth.md)
- [`conditional-execution`](conditional-execution.md)
- [`typescript-console-in-test`](typescript-console-in-test.md)
- [`typescript-console-mock-in-test`](typescript-console-mock-in-test.md)
- [`constants-file-content`](constants-file-content.md)
- [`contract-fields`](contract-fields.md)
- [`typescript-dictionary-return`](typescript-dictionary-return.md)
- [`python-direct-class-init`](python-direct-class-init.md)
- [`directory-class-min-size`](directory-class-min-size.md)
- [`directory-class-max-size`](directory-class-max-size.md)
- [`directory-min-size`](directory-min-size.md)
- [`directory-max-size`](directory-max-size.md)
- [`dynamic-import`](dynamic-import.md)
- [`typescript-dynamic-runtime-usage`](typescript-dynamic-runtime-usage.md)
- [`dynamic-type`](dynamic-type.md)
- [`empty-contract`](empty-contract.md)
- [`exception-grouping`](exception-grouping.md)
- [`exception-raising`](exception-raising.md)
- [`typescript-explicit-visibility`](typescript-explicit-visibility.md)
- [`facade-file-content`](facade-file-content.md)
- [`typescript-fake-object`](typescript-fake-object.md)
- [`file-function-count-info`](file-function-count-info.md)
- [`file-function-count-warning`](file-function-count-warning.md)
- [`file-max-size`](file-max-size.md)
- [`file-min-size`](file-min-size.md)
- [`function-placement`](function-placement.md)
- [`getattr`](getattr.md)
- [`inline-generic-type`](inline-generic-type.md)
- [`typescript-inline-object-type`](typescript-inline-object-type.md)
- [`typescript-inline-union-type`](typescript-inline-union-type.md)
- [`typescript-instanceof`](typescript-instanceof.md)
- [`typescript-interface-shape`](typescript-interface-shape.md)
- [`typescript-index-signature`](typescript-index-signature.md)
- [`python-isinstance`](python-isinstance.md)
- [`typescript-jest-describe-count`](typescript-jest-describe-count.md)
- [`typescript-jest-max-size`](typescript-jest-max-size.md)
- [`typescript-jest-min-size`](typescript-jest-min-size.md)
- [`typescript-jest-nested-describe`](typescript-jest-nested-describe.md)
- [`typescript-jest-min-count`](typescript-jest-min-count.md)
- [`typescript-jest-max-count`](typescript-jest-max-count.md)
- [`typescript-jest-test-ending`](typescript-jest-test-ending.md)
- [`typescript-jest-test-expect`](typescript-jest-test-expect.md)
- [`typescript-jest-test-lambda`](typescript-jest-test-lambda.md)
- [`typescript-jest-type-only-test`](typescript-jest-type-only-test.md)
- [`large-union`](large-union.md)
- [`late-import`](late-import.md)
- [`local-inheritance`](local-inheritance.md)
- [`typescript-logical-assignment`](typescript-logical-assignment.md)
- [`typescript-in-operator`](typescript-in-operator.md)
- [`method-order-constructor-after`](method-order-constructor-after.md)
- [`method-order-constructor-before`](method-order-constructor-before.md)
- [`method-order-public`](method-order-public.md)
- [`method-get-name`](method-get-name.md)
- [`method-find-fetch-lookup-name`](method-find-fetch-lookup-name.md)
- [`method-load-read-open-name`](method-load-read-open-name.md)
- [`method-calculate-compute-name`](method-calculate-compute-name.md)
- [`method-create-build-generate-name`](method-create-build-generate-name.md)
- [`method-parse-convert-transform-name`](method-parse-convert-transform-name.md)
- [`method-set-name`](method-set-name.md)
- [`method-process-name`](method-process-name.md)
- [`method-handle-name`](method-handle-name.md)
- [`method-execute-perform-do-name`](method-execute-perform-do-name.md)
- [`method-and-name`](method-and-name.md)
- [`method-long-name`](method-long-name.md)
- [`boolean-is-name`](boolean-is-name.md)
- [`boolean-exists-name`](boolean-exists-name.md)
- [`boolean-equals-name`](boolean-equals-name.md)
- [`boolean-has-can-name`](boolean-has-can-name.md)
- [`boolean-query-name`](boolean-query-name.md)
- [`missing-import`](missing-import.md)
- [`mixed-module`](mixed-module.md)
- [`mixin`](mixin.md)
- [`module-constants-separation`](module-constants-separation.md)
- [`module-types-separation`](module-types-separation.md)
- [`module-protocols-separation`](module-protocols-separation.md)
- [`module-placement`](module-placement.md)
- [`python-multi-except`](python-multi-except.md)
- [`multiple-result-shapes`](multiple-result-shapes.md)
- [`mutable-field-assignment`](mutable-field-assignment.md)
- [`typescript-mutable-field`](typescript-mutable-field.md)
- [`naming`](naming.md)
- [`naming-private`](naming-private.md)
- [`naming-type`](naming-type.md)
- [`nested-class`](nested-class.md)
- [`nested-import`](nested-import.md)
- [`nullable-domain-type`](nullable-domain-type.md)
- [`single-item-array-state`](single-item-array-state.md)
- [`typescript-union-contract-bypass`](typescript-union-contract-bypass.md)
- [`typescript-rest-union-contract`](typescript-rest-union-contract.md)
- [`typescript-object-assign`](typescript-object-assign.md)
- [`typescript-object-literal-return`](typescript-object-literal-return.md)
- [`typescript-object-method-call`](typescript-object-method-call.md)
- [`typescript-object-prototype-string`](typescript-object-prototype-string.md)
- [`python-object-setattr`](python-object-setattr.md)
- [`python-optional-union`](python-optional-union.md)
- [`python-conditional-type-alias`](python-conditional-type-alias.md)
- [`typescript-parameter-property`](typescript-parameter-property.md)
- [`parse-error`](parse-error.md)
- [`pointless-assignment`](pointless-assignment.md)
- [`private-member`](private-member.md)
- [`procedural-class-name`](procedural-class-name.md)
- [`python-property`](python-property.md)
- [`python-property-setter`](python-property-setter.md)
- [`protocol-grouping`](protocol-grouping.md)
- [`typescript-prototype-assignment`](typescript-prototype-assignment.md)
- [`proxy-callable`](proxy-callable.md)
- [`proxy-lambda`](proxy-lambda.md)
- [`python-elif`](python-elif.md)
- [`python-explicit-field-type`](python-explicit-field-type.md)
- [`python-explicit-parameter-type`](python-explicit-parameter-type.md)
- [`explicit-return-type`](explicit-return-type.md)
- [`logical-chain-size`](logical-chain-size.md)
- [`mixed-boolean-precedence`](mixed-boolean-precedence.md)
- [`mixed-arithmetic-precedence`](mixed-arithmetic-precedence.md)
- [`python-test-assert`](python-test-assert.md)
- [`python-test-assert-ending`](python-test-assert-ending.md)
- [`python-test-assert-statement`](python-test-assert-statement.md)
- [`python-test-shape`](python-test-shape.md)
- [`python-test-subtest`](python-test-subtest.md)
- [`python-test-class-inheritance`](python-test-class-inheritance.md)
- [`python-test-framework-consistency`](python-test-framework-consistency.md)
- [`python-walrus`](python-walrus.md)
- [`reexports`](reexports.md)
- [`relative-import`](relative-import.md)
- [`setattr`](setattr.md)
- [`shared-parameter-combination`](shared-parameter-combination.md)
- [`shared-parameter-type`](shared-parameter-type.md)
- [`singleton`](singleton.md)
- [`stateless-class`](stateless-class.md)
- [`typescript-static-method`](typescript-static-method.md)
- [`typescript-static-field`](typescript-static-field.md)
- [`python-static-method`](python-static-method.md)
- [`switch`](switch.md)
- [`python-sys-path-mutation`](python-sys-path-mutation.md)
- [`temporary-instance-method-call`](temporary-instance-method-call.md)
- [`ternary-expression`](ternary-expression.md)
- [`test-assertion-grouping`](test-assertion-grouping.md)
- [`test-file-location`](test-file-location.md)
- [`test-too-many-assertions`](test-too-many-assertions.md)
- [`typescript-type-guard`](typescript-type-guard.md)
- [`top-level-classes`](top-level-classes.md)
- [`tuple-type`](tuple-type.md)
- [`python-type-factory`](python-type-factory.md)
- [`type-field-count`](type-field-count.md)
- [`type-info`](type-info.md)
- [`typescript-type-operation`](typescript-type-operation.md)
- [`typescript-type-assertion`](typescript-type-assertion.md)
- [`type-warning`](type-warning.md)
- [`unnecessary-undefined-check`](unnecessary-undefined-check.md)
- [`typescript-typeof`](typescript-typeof.md)
- [`typescript-unknown-parameter-type`](typescript-unknown-parameter-type.md)
- [`typescript-conditional-block`](typescript-conditional-block.md)
- [`unused-callable`](unused-callable.md)
- [`unused-file`](unused-file.md)

Diagnostics contain only the short rule ID, source location, rendered message, and a
short actionable hint. Reference documents are printed as absolute paths in a final list after
the diagnostic summary.

## Method-contract guidance

Method names should describe the domain contract visible to callers. Keep
queries, commands, and construction operations distinct. A public method that
returns a domain value should make that result clear; `find` may communicate
optional absence while `require` may communicate that absence is an error.
Commands normally return `void`/`None` unless the returned value is meaningful
to the state transition. `create_`, `build_`, and `generate_` are appropriate
when a method really creates a new value; construction should not hide an
unrelated side effect.

The method-name rules are review signals. A technical name can be correct at
an I/O, parser, serializer, adapter, or dispatcher boundary, and a longer
atomic domain operation can be correct. A common verb alone is not proof that
a method is semantically wrong.

## Guidance for rule documents

Keep each rule document short and generic. Explain the design risk, show the smallest valid
counterexample, then list refactoring options from the strongest ownership improvement to the
smallest safe change. State important detection boundaries, such as declarations that are already
valid or types that belong to an external boundary. Never recommend renaming, aliases, wrappers,
or exclusions solely to silence a diagnostic. When a proposed fix is not appropriate after a
caller and ownership review, record that decision outside the rule document rather than weakening
the rule's guidance.

## AST and test policy

The linter reports mandatory violations only when the AST can prove them. It
may use the method name, declared return type, visibility, and syntactic shape
for review diagnostics, but it must not infer domain meaning from a method
verb. The rules apply to project code and tests, including ordinary modules,
protocol declarations, `types`, `constants`, and `index` files. These files do
not receive language-specific exemptions; ordinary declarations in them are
checked normally.

Every mandatory rule needs positive and negative tests. Tests must verify real
behavior or returned values, not merely the presence of methods or fields.
Shared method-shape rules require TypeScript and Python regression coverage;
the three Python annotation rules require Python coverage.
