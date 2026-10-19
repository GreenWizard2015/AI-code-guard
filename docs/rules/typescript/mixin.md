# `mixin`

Description: Mixins assemble implementation through inheritance, hiding ownership and state boundaries.

Before:

```ts
class LoggingMixin {
  public log(message: string): void {
    const normalized_message = message.trim();
    const log_entry = `[client] ${normalized_message}`;
    console.info(log_entry);
  }
}
```

```ts
class Client extends LoggingMixin {
  private readonly client_name = 'client';

  public request(): void {
    this.log('request');
    this.log('request complete');
  }
}
```

After:

```ts
interface Logger {
  log(message: string): void;
}

class Client {
  private readonly logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
  }

  public request(): void {
    this.logger.log('request');
  }
}
```


Fix: Move behavior into a focused collaborator and inject it through composition. Use a narrow interface or protocol for a shared contract instead of inheriting implementation.

## Bad

```ts
class Service extends LoggingMixin {} // <- error
```



## Good

```ts
// File: src/protocols.ts
export interface HttpConnectionContract {
	send(message: string): string;
	cancel(request_id: string): string;
	connection_state(): string;
}
export interface LoggerContract { log(message: string): void; }
// File: src/http_connection.ts
import { HttpConnectionContract, LoggerContract } from "src/protocols";
/** Responsibilities: _HTTP request state and logging_. **/
export class HttpConnection implements HttpConnectionContract {
	private readonly logger: LoggerContract;
	private readonly host_name: string;
	/** Responsibilities: _connection initialization_. **/
	public constructor(logger: LoggerContract, host_name: string) { this.logger = logger; this.host_name = host_name; }
	/** Responsibilities: _request submission_. **/
	public send(message: string): string { const normalized = message.trim(); if (normalized.length === 0) { return "ignored"; } this.logger.log(`${this.host_name}: ${normalized}`); return "sent"; }
	/** Responsibilities: _request cancellation_. **/
	public cancel(request_id: string): string { const normalized_id = request_id.trim(); if (normalized_id.length === 0) { return "ignored"; } this.logger.log(`${this.host_name} cancelled ${normalized_id}`); return "cancelled"; }
	/** Responsibilities: _connection state reporting_. **/
	public connection_state(): string { if (this.host_name.trim().length === 0) { return "offline"; } return "connected"; }
}
// File: cli.ts
#!/usr/bin/env node
import { HttpConnection } from "src/http_connection";
(function () { const connection = new HttpConnection(console, "web"); console.log(connection.send("hello"), connection.cancel("request-1"), connection.connection_state()); })();
```

