TYPE_SOURCE = """
from typing import TypeAlias, Union

ALIAS: TypeAlias = str
Domain = list[str]
CONSTANT = 1

class Contract:
    value: str

class Derived(Protocol, External.Base):
    value: list[str]
    other = alias

@staticmethod
def static(value: list[list[str]], other: int | None = None):
    return value

@classmethod
def class_method(cls, value: Union[str, None]):
    return value

def setter(self, value):
    return value

factory = namedtuple("Factory", "value")
factory_two = typing.NamedTuple("FactoryTwo", [])
"""

EDGE_SOURCE = """
import package
from .relative import item
value = 1
import late

class Service:
    _value: str

    def forward(self, value):
        return worker(value)

    @property
    def hidden(self):
        return self._value

    def run(self, value):
        self._value += value
        return value if value else make(value)

async def forward_async(value):
    return await worker(value)

def invoke(value, *items, **options):
    return worker(value)

def condition(value):
    result = value and fallback()
    return (value if value else fallback())

package._value
getattr(package, "_value")
setattr(package, "_value", value)
package.__getattribute__("_value")
package.__dict__["_value"]
"""

INSTANCE_SOURCE = """
from models import Model as ModelAlias

class Service:
    def __init__(self, model: ModelAlias):
        self.model = model
        self.models: list[ModelAlias] = [model]

    def make(self) -> ModelAlias:
        return ModelAlias()

    def run(self):
        current = self.make()
        for model in self.models:
            model.save()
        current.save()
"""

CLASS_SOURCE = """
@dataclass
class Record:
    value: str

class Service(Record):
    def _hidden(self, value: str):
        return value

    def forward(self, value):
        return self._hidden(value)

def helper(value):
    return value

record = Record()
"""

METRIC_SOURCE = """
async def measure(items, value):
    if value:
        value = value
    else:
        value = None
    for item in items:
        value += item
    while value:
        break
    with resource() as opened:
        value = opened
    async with async_resource() as opened:
        value = opened
    try:
        value = transform(value)
    except ValueError:
        value = 0
    except (TypeError, KeyError):
        value = 1
    else:
        value = 2
    finally:
        value = 3
    match value:
        case 0:
            return None
        case _:
            return value
"""

CONSTRUCTOR_SOURCE = """
class Valid:
    def __init__(self, value):
        '''constructor documentation'''
        super().__init__()
        self.value = value
        self.items = [value]
        self.mapping = {"value": value}
        self.other = Factory()
        validate_value(value)
        pass
        raise RuntimeError()

    def __post_init__(self):
        if self.value:
            self.ready = True
        else:
            self.ready = False

class Invalid:
    def __init__(self):
        self.value = self.make()

    def update(self, value):
        self.value = value

try:
    value = type("Dynamic", (), {})
except:
    value = None
except (ValueError, TypeError):
    value = None

structuredContent = value
result = obj.structuredContent
"""

REFERENCE_SOURCE = """
from models import Model as Alias

class Service:
    typed: list[Alias]

    @property
    def current(self) -> Alias:
        return self.model

    @cached_property()
    async def cached(self) -> Alias:
        return self.model

    def __init__(self, model: Alias, optional: Optional[Alias]):
        self.model = model
        self.typed = [model]
        self.created: Alias = Alias()

    def run(self):
        first = self.model
        second = self.current
        for item in self.typed:
            item.save()
        return self.make()
"""

ENTRYPOINT_SOURCE = '''
"""module documentation"""
from package import Item as Alias

class Holder:
    """class documentation"""
    item: Alias

    def get(self):
        return self.item

def main() -> None:
    """function documentation"""
    return None

if __name__ == "__main__":
    main()
'''

UNDEFINED_INDEX_SOURCE = """
class Parsed:
    attribute_accesses: list[str]

def first(parsed: Parsed) -> bool:
    return parsed.attribute_accesses is None

def second(parsed: Parsed) -> bool:
    return parsed.attribute_accesses is None
"""
