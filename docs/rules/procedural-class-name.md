# `procedural-class-name`


## Principle

In TrueOOP, the problem is not a word by itself but the architectural problem
that the name may hide. A class name should answer **“what is it?”**, not
**“what does it do?”**. `FileReader`, `TextParser`, and `UrlValidator` describe
a job or profession and may be procedures packaged as objects.

The rule checks names only. It does not infer domain meaning, state, or design
quality from a class body. A stateful adapter, protocol implementation, type
contract, mixin, or test class may be valid even when its name contains a
technical role.

## Common job-title names

| Name | Typical smell | Preferred direction | Example |
| --- | --- | --- | --- |
| `Manager` | God object, orchestration, CRUD | Find what it manages and make those objects | `UserManager` → `Users` |
| `Controller` | Receives data and commands others | Distribute behavior across domain objects | `OrderController` → `Order`, `Orders` |
| `Handler` | Procedural callback | Name the result, action, or entity | `MessageHandler` → `Message` |
| `Processor` | Large algorithmic procedure | Represent the result or state | `PaymentProcessor` → `Payment` |
| `Helper` | No independent identity | Extract focused objects | `JsonHelper` → `JsonText` |
| `Utils`, `Utility` | Bag of static methods | Give each operation to its owner object | `FileUtils` → `FileLines` |
| `Reader` | Reading procedure | Represent the readable entity | `FileReader` → `DataFile` |
| `Writer` | Imperative write executor | Represent the destination or resource | `FileWriter` → `File` |
| `Parser` | `data → parser → DTO` procedure | Represent parsed or parseable data | `XmlParser` → `ParsedXml` |
| `Validator` | Validation external to the entity | Represent a valid entity or decorator | `UrlValidator` → `ValidUrl` |
| `Converter` | Object exists only for conversion | Name the representation or result | `ImageConverter` → `PngImage` |
| `Sorter` | Client chooses an algorithm | Represent sorted state | `Sorter` → `Sorted` |
| `Encoder` | Algorithm detached from its value | Represent encoded data | `Base64Encoder` → `Base64Text` |
| `Decoder` | Algorithm detached from its value | Represent decoded data | `JsonDecoder` → `Json` |
| `Router` | Central coordinator | Represent routes or destinations | `RequestRouter` → `Route` |
| `Dispatcher` | Commands other objects | Distribute behavior to participants | `EventDispatcher` → `Events`, `Subscribers` |
| `Listener` | Framework role instead of domain concept | Name the domain participant | `OrderListener` → `OrderEvents` |
| `Observer` | Pattern mechanism in the name | Name what the object represents | `PriceObserver` → `PriceChanges` |
| `Runner` | Launches an unspecified thing | Represent the task or execution | `ScriptRunner` → `Execution` |
| `Locator` | Finds and returns other objects | Pass dependencies explicitly or use a collection | `ServiceLocator` → explicit dependencies |
| `Client` | Represents an entire remote service | Model remote entities locally | `S3Client` → `Region`, `Bucket`, `Object` |

The characteristic job-title set is `Manager`, `Controller`, `Helper`,
`Handler`, `Writer`, `Reader`, `Converter`, `Validator`, `Router`,
`Dispatcher`, `Observer`, `Listener`, `Sorter`, `Encoder`, and `Decoder`.
The concern with `-er`/`-or` is that the object becomes an executor of orders
instead of an independent abstraction with a contract.

The useful transformation is not `Sorter.sort(items)` but an object such as
`Sorted(items)`, which represents the desired state and owns its realization.

## Special groups

### `Utils`, `Utility`, and `Helper`

These names are especially dangerous. `StringUtils`, `FileUtils`, and
`NumberUtils` usually mean that functions exist but their owning objects have
not been identified. They commonly hide several unrelated static operations.

```text
FileUtils
 ├ read()
 ├ write()
 ├ copy()
 ├ lines()
 ├ size()
 ├ extension()
 └ normalize()
```

Look for the missing objects instead:

```text
File
FileLines
UnicodeFile
NormalizedPath
CopiedFile
```

### `Client`

`Client` is a smell when one object represents an entire remote server or API.
That scope naturally grows to include buckets, objects, versions, policies,
and many unrelated operations. Model the remote domain locally instead:

```text
GitHub
 └ Organization
     └ Repository
         ├ Issue
         └ PullRequest
```

The literal word `Client` is not the defect. A stateful `RemoteClient` with a
transport and endpoint can be a valid technical boundary. The smell is the
single object that represents the whole remote service.

### `Service`

Treat `Service` as a smell, not an absolute ban. A service often becomes a
namespace for procedures:

```text
PaymentService
 ├ calculate()
 ├ validate()
 ├ authorize()
 ├ charge()
 ├ refund()
 └ cancel()
```

Look for the missing domain objects: `Payment`, `Payments`, `Charge`, `Refund`,
`Invoice`, or `Transaction`. Do not mechanically rename `PaymentService` to
`PaymentApi`; change the model when the class contains several responsibilities.

### `Factory`

`Factory` is not an absolute prohibition. `UserFactory` is suspicious when it
exists only because “someone must create Users”, but an Abstract Factory can
be justified by an architecture. Prefer a constructor, secondary constructor,
or a domain collection such as `Users` when that is the real contract.

This is a **WARN**, not an automatic error.

### `Builder`

`Builder` is also a strong smell rather than a word-level ban. A builder often
appears because the final object has 15–30 parameters and is too large to
construct normally. Ask why `Request` needs 24 parameters and which missing
objects should be extracted instead of automatically adding a builder.

### `Provider`, `Loader`, `Fetcher`, `Resolver`, `Generator`, `Calculator`

These names extend the `-er` smell: they describe a job title rather than an
object. Try to identify the represented value:

```text
TokenProvider     → Token
ConfigLoader      → Configuration
UserFetcher       → User / Users
PathResolver      → Path
ReportGenerator   → Report
PriceCalculator   → Price
```

If a one-to-one rename is difficult, that may indicate that responsibilities
need to be recomposed rather than that a different name is needed.

### `Data`, `Info`, and `Object`

`UserData`, `PaymentInfo`, `RequestObject`, and `DomainObject` do not describe a
job, but they often say that the author has not identified what the object is.
Consider `User`, `Profile`, `Credentials`, `Identity`, or `Address` according
to the actual contents. `Info`, `Data`, and `Object` are too weak to narrow the
semantics.

### `Impl`, `Interface`, and `I...`

Do not name a class only by its technical relationship to an interface:
`IUser`, `UserInterface`, `UserImpl`, and `DefaultUserImpl` hide the actual
difference between implementations.

Prefer an entity-shaped interface and qualified implementations:

```text
Users
 ├ SqlUsers
 ├ MemoryUsers
 ├ CachedUsers
 └ RemoteUsers
```

The implementation name should answer “which kind of `Users` is this?”, not
“is this an implementation?”.

## How to fix a reported name

1. Remove the profession temporarily. For `XManager`, `XProcessor`, or
   `XReader`, ask what remains after removing the suffix.
2. Find the noun. Ask “what do I need to have?” rather than “who sorts or
   calculates?” — this may lead to `Sorted` or `Price`.
3. If a class performs five to ten unrelated verbs, split it instead of
   merely renaming it. `OrderManager` may need `Orders`, `Order`, `Payment`,
   and `Refund`.
4. Name implementations with a qualifier plus entity: `CachedUsers`,
   `SqlUsers`, `ValidRequest`, `EncryptedText`, or `RemoteDocument`.

```text
UserManager       → “It manages users.”       ✗ a job
Users             → “It is a set of users.”    ✓ an entity

PriceCalculator   → “It calculates a price.”   ✗ a job
Price             → “It is a price.”           ✓ an entity

JsonParser        → “It parses JSON.”          ✗ a job
Json              → “It is a JSON document.”   ✓ an entity
```

Do not turn this into a blind suffix ban. `-er` names can be valid at a
technical boundary, and a domain-specific object may legitimately need a
technical name. The diagnostic is a design prompt: first check the entity,
value, collection, adapter, or protocol represented by the class.

## References

- [Seven Virtues of a Good Object](https://www.yegor256.com/2014/11/20/seven-virtues-of-good-object.html)
- [Don't Create Objects That End With -ER](https://www.yegor256.com/2015/03/09/objects-end-with-er.html)
- [OOP Alternative to Utility Classes](https://www.yegor256.com/2014/05/05/oop-alternative-to-utility-classes.html)
- [Yet Another Evil Suffix For Object Names: Client](https://www.yegor256.com/2017/09/12/evil-object-name-suffix-client.html)
- [Design Patterns and Anti-Patterns](https://www.yegor256.com/2016/02/03/design-patterns-and-anti-patterns.html)
- [Typical Mistakes in Java Code](https://www.yegor256.com/ru/2014/04/27/typical-mistakes-in-java-code.html)
