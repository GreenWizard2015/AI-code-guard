# `typescript-fake-object`

**Purpose:** Object literals with callable fields imitate classes without invariants or owned state.

Data-only object literals are outside this rule. A payload or configuration object with no
callable field does not imitate a class and must not be reported as `typescript-fake-object`.

Callable result objects created inside a function are allowed when they are a local return value or
factory result. The rule targets module-level objects that act as namespaces or long-lived services.

Lint diagnostic:

```text
avoid object literals that imitate classes
```

```ts
const FEEDBACK: FacebookAiFeedbackPort = {
  write: async (text, reaction) => {
    await client.call({ name: 'gwmcp_files_write', args: { text, reaction } });
  },
};
```

The object above owns callable behavior but has no named owner. Use a focused class when the
behavior needs dependencies or state:

```ts
class FacebookFeedbackWriter implements FacebookAiFeedbackPort {
  private readonly client: ProxyMcpClient;

  public constructor(client: ProxyMcpClient) {
    this.client = client;
  }

  public async write(text: string, reaction: FacebookAiSuggestionReaction): Promise<void> {
    const name = 'gwmcp_files_write';
    const args = { text, reaction };
    await this.client.call({ name, args });
  }
}
```

If the operation is stateless, use explicit module functions instead of a callable object.
