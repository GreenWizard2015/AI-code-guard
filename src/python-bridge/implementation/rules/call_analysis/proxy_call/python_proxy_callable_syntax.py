import ast

from implementation.protocols import PythonProxyCallableSyntaxContract
from implementation.references.protocols import PythonProxyReceiverAliasesContract
from implementation.rules.constants import (
    PYTHON_COLLECTION_MUTATION_METHODS,
    PYTHON_PROXY_PROPERTY_DECORATORS,
)


class PythonProxyCallableSyntax(PythonProxyCallableSyntaxContract):
    """Responsibilities: _proxy callable syntax_, _receiver ownership analysis_."""

    def supported_target(self, invocation: ast.Call) -> bool:
        """Responsibilities: _supported proxy invocation target_."""
        function = invocation.func
        if type(function) is ast.Name:
            return True
        if type(function) is not ast.Attribute:
            return False
        owner = function.value
        if type(owner) not in (ast.Name, ast.Attribute):
            return False
        if type(owner) is ast.Name:
            if owner.id.startswith("_"):
                return False
            if owner.id[:1].isupper():
                return False
        return True

    def property_decorated(self, callable_definition: ast.AST) -> bool:
        """Responsibilities: _property decorator classification_."""
        if type(callable_definition) is ast.FunctionDef or type(callable_definition) is ast.AsyncFunctionDef:
            decorators = callable_definition.decorator_list
        else:
            return False
        for decorator in decorators:
            if type(decorator) is ast.Name:
                if decorator.id in PYTHON_PROXY_PROPERTY_DECORATORS:
                    return True
            if type(decorator) is ast.Call and type(decorator.func) is ast.Name:
                if decorator.func.id in PYTHON_PROXY_PROPERTY_DECORATORS:
                    return True
        return False

    def owned_collection_mutation(
        self,
        callable_definition: ast.AST,
        mutation_call: ast.Call,
    ) -> bool:
        """Responsibilities: _callable-owned collection mutation_."""
        mutation = mutation_call.func
        if type(mutation) is not ast.Attribute:
            return False
        if mutation.attr not in PYTHON_COLLECTION_MUTATION_METHODS:
            return False
        collection = mutation.value
        if type(collection) is not ast.Attribute:
            return False
        owner = collection.value
        if type(owner) is not ast.Name:
            return False
        if type(callable_definition) is ast.FunctionDef or type(callable_definition) is ast.AsyncFunctionDef:
            arguments = callable_definition.args
        else:
            return False
        if arguments.posonlyargs:
            receiver = arguments.posonlyargs[0].arg
        else:
            if arguments.args:
                receiver = arguments.args[0].arg
            else:
                receiver = ""
        return bool(receiver) and receiver == owner.id

    def _argument_root(self, expression: ast.AST) -> str:
        """Responsibilities: _forwarded argument identity_."""
        if type(expression) is ast.Name:
            return expression.id
        if type(expression) is ast.Attribute:
            return self._argument_root(expression.value)
        if type(expression) is ast.Starred:
            return self._argument_root(expression.value)
        return ""

    def _parameter_names(self, arguments: ast.arguments) -> list[str]:
        """Responsibilities: _callable parameter names_."""
        positional = [*arguments.posonlyargs, *arguments.args]
        if positional and positional[0].arg in {"self", "cls"}:
            positional = positional[1:]
        names = [argument.arg for argument in positional]
        names.extend(argument.arg for argument in arguments.kwonlyargs)
        if arguments.vararg is not None:
            names.append(arguments.vararg.arg)
        return names

    def _forwarded_names(self, invocation: ast.Call) -> list[str]:
        """Responsibilities: _forwarded parameter names_."""
        names: list[str] = []
        for argument in invocation.args:
            name = self._argument_root(argument)
            if not name:
                return []
            names.append(name)
        for keyword in invocation.keywords:
            if keyword.arg is None:
                return []
            name = self._argument_root(keyword.value)
            if not name:
                return []
            names.append(name)
        return names

    def _vararg_forwarded(self, invocation: ast.Call, vararg_name: str) -> bool:
        """Responsibilities: _variadic argument matching_."""
        if not vararg_name:
            return True
        forwarded_count = 0
        for argument in invocation.args:
            if type(argument) is ast.Starred:
                if self._argument_root(argument) == vararg_name:
                    forwarded_count += 1
        return forwarded_count == 1

    def _matches_forwarding(
        self,
        invocation: ast.Call,
        arguments: ast.arguments,
    ) -> bool:
        """Responsibilities: _proxy forwarding contract match_."""
        if arguments.kwarg is not None:
            return False
        parameters = self._parameter_names(arguments)
        if len(invocation.args) + len(invocation.keywords) != len(parameters):
            return False
        keyword_only_names = {argument.arg for argument in arguments.kwonlyargs}
        for argument in invocation.args:
            if self._argument_root(argument) in keyword_only_names:
                return False
        vararg_name = ""
        if arguments.vararg is not None:
            vararg_name = arguments.vararg.arg
        if not self._vararg_forwarded(invocation, vararg_name):
            return False
        names = self._forwarded_names(invocation)
        if len(names) != len(parameters):
            return False
        return sorted(names) == sorted(parameters)

    def _statement_forwards(
        self,
        statement: ast.stmt,
        callable_definition: ast.AST,
        arguments: ast.arguments,
    ) -> bool:
        """Responsibilities: _single statement forwarding_."""
        if type(statement) is ast.Expr:
            invocation = statement.value
        else:
            if type(statement) is not ast.Return or statement.value is None:
                return False
            invocation = statement.value
        if type(invocation) is ast.Await:
            invocation = invocation.value
        if type(invocation) is not ast.Call:
            return False
        if not self.supported_target(invocation):
            return False
        if self.owned_collection_mutation(callable_definition, invocation):
            return False
        return self._matches_forwarding(invocation, arguments)

    def _body_forwards(
        self,
        body: list[ast.stmt],
        callable_definition: ast.AST,
        arguments: ast.arguments,
    ) -> bool:
        """Responsibilities: _callable body forwarding_."""
        statements = body
        if statements:
            first = statements[0]
            if type(first) is ast.Expr:
                value = first.value
                if type(value) is ast.Constant and type(value.value) is str:
                    statements = statements[1:]
        if len(statements) != 1:
            return False
        return self._statement_forwards(statements[0], callable_definition, arguments)

    def __init__(self, receiver_aliases: PythonProxyReceiverAliasesContract) -> None:
        """Responsibilities: _proxy receiver analysis setup_."""
        self._receiver_aliases: PythonProxyReceiverAliasesContract = receiver_aliases

    def proxy_call(self, callable_definition: ast.AST) -> bool:
        """Responsibilities: _callable forwarding classification_."""
        if type(callable_definition) is ast.FunctionDef:
            body = callable_definition.body
            arguments = callable_definition.args
        else:
            if type(callable_definition) is not ast.AsyncFunctionDef:
                return False
            body = callable_definition.body
            arguments = callable_definition.args
        return self._body_forwards(body, callable_definition, arguments)

    def proxy_lambda(self, lambda_expression: ast.AST) -> bool:
        """Responsibilities: _lambda forwarding classification_."""
        if type(lambda_expression) is not ast.Lambda:
            return False
        if not self._receiver_aliases.lambda_receiver(lambda_expression):
            return False
        invocation = lambda_expression.body
        if type(invocation) is not ast.Call:
            return False
        if not self.supported_target(invocation):
            return False
        return self._matches_forwarding(invocation, lambda_expression.args)
