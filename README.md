# Asterisk Manager Interface (AMI) - TypeScript

A modern, fully-typed TypeScript library for interacting with the Asterisk Manager Interface (AMI). This library provides a robust, event-driven interface for managing Asterisk PBX systems with full TypeScript support.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-See%20LICENSE-blue.svg)](./LICENSE)

## Features

- 🎯 **Full TypeScript Support** - Complete type definitions for all AMI operations
- 🔄 **Event-Driven Architecture** - Built on Node.js EventEmitter with proper typing
- 🔐 **Authentication Management** - Automatic login and session handling
- 🔌 **Auto-Reconnection** - Configurable automatic reconnection with exponential backoff
- 📡 **Action Queue** - Intelligent action queuing when not authenticated
- 🛡️ **Error Handling** - Comprehensive error handling and debugging support
- 📦 **Zero Dependencies** - Only requires Node.js built-in modules
- 🏗️ **Clean API** - Simple, intuitive interface for all AMI operations

## Installation

```bash
npm install asterisk-manager
```

## Quick Start

### TypeScript

```typescript
import Manager from "asterisk-manager";

const ami = new Manager(5038, "localhost", "admin", "secret", true);

ami.on("connect", () => {
  console.log("Connected to Asterisk Manager Interface");
});

ami.on("managerevent", (event) => {
  console.log("AMI Event:", event);
});

// Execute an action
ami.action(
  {
    action: "Status",
  },
  (error, response) => {
    if (error) {
      console.error("Action failed:", error);
    } else {
      console.log("Status response:", response);
    }
  }
);
```

### JavaScript (CommonJS)

```javascript
const Manager = require("asterisk-manager");

const ami = new Manager(5038, "localhost", "admin", "secret", true);

ami.on("connect", () => {
  console.log("Connected to Asterisk Manager Interface");
});
```

## API Documentation

### Constructor

```typescript
new Manager(port?: number, host?: string, username?: string, password?: string, events?: boolean)
```

- `port` - AMI port (default: 5038)
- `host` - Asterisk server hostname or IP
- `username` - AMI username
- `password` - AMI password
- `events` - Whether to receive events (default: false)

### Methods

#### `connect(port: number, host: string, callback?: ConnectionCallback): void`

Establishes a connection to the AMI.

```typescript
ami.connect(5038, "192.168.1.100", (error) => {
  if (error) {
    console.error("Connection failed:", error);
  } else {
    console.log("Connected successfully");
  }
});
```

#### `login(callback?: ManagerCallback): void`

Authenticates with the AMI using provided credentials.

```typescript
ami.login((error, response) => {
  if (error) {
    console.error("Login failed:", error);
  } else {
    console.log("Logged in successfully");
  }
});
```

#### `action(action: ManagerAction, callback?: ManagerCallback): string`

Executes an AMI action and returns the action ID.

```typescript
const actionId = ami.action(
  {
    action: "Originate",
    channel: "SIP/1001",
    context: "default",
    exten: "1002",
    priority: 1,
  },
  (error, response) => {
    if (error) {
      console.error("Originate failed:", error);
    } else {
      console.log("Call originated:", response);
    }
  }
);
```

#### `keepConnected(): void`

Enables automatic reconnection with exponential backoff.

```typescript
ami.keepConnected();
```

#### `disconnect(callback?: () => void): void`

Disconnects from the AMI.

```typescript
ami.disconnect(() => {
  console.log("Disconnected from AMI");
});
```

#### `isConnected(): boolean`

Returns the current connection status.

```typescript
if (ami.isConnected()) {
  console.log("AMI is connected");
}
```

### Events

The library extends Node.js EventEmitter and emits various events:

#### Connection Events

```typescript
ami.on("connect", () => {
  console.log("Connected to AMI");
});

ami.on("close", () => {
  console.log("Connection closed");
});

ami.on("error", (error) => {
  console.error("Connection error:", error);
});
```

#### AMI Events

```typescript
// All AMI events
ami.on("managerevent", (event) => {
  console.log("AMI Event:", event.event, event);
});

// Specific events (case-insensitive)
ami.on("newchannel", (event) => {
  console.log("New channel:", event.channel);
});

ami.on("hangup", (event) => {
  console.log("Channel hung up:", event.channel);
});

// User events
ami.on("userevent-myevent", (event) => {
  console.log("Custom user event:", event);
});
```

#### Action Responses

```typescript
// All action responses
ami.on("response", (response) => {
  console.log("Action response:", response);
});

// Specific action response by ID
ami.once(actionId, (error, response) => {
  if (error) {
    console.error("Action failed:", error);
  } else {
    console.log("Action succeeded:", response);
  }
});
```

## TypeScript Types

The library provides comprehensive TypeScript definitions:

### Core Interfaces

```typescript
interface ManagerOptions {
  port: number;
  host: string;
  username: string;
  password: string;
  events: boolean;
}

interface ManagerAction {
  action: string;
  actionid?: string;
  [key: string]: unknown;
}

interface ManagerEvent {
  event?: string;
  response?: string;
  actionid?: string;
  content?: string;
  [key: string]: unknown;
}

type ManagerCallback = (
  error?: ManagerEvent | Error | null,
  response?: ManagerEvent
) => void;
```

### Specific Action Types

```typescript
interface LoginAction extends ManagerAction {
  action: "login";
  username: string;
  secret: string;
  event: "on" | "off";
}

// Define your own action types
interface OriginateAction extends ManagerAction {
  action: "Originate";
  channel: string;
  context: string;
  exten: string;
  priority: number;
  timeout?: number;
  callerid?: string;
}
```

## Common Examples

### Making a Call

```typescript
ami.action(
  {
    action: "Originate",
    channel: "SIP/1001",
    context: "default",
    exten: "1002",
    priority: 1,
    timeout: 30000,
    callerid: "Test Call <1001>",
  },
  (error, response) => {
    if (error) {
      console.error("Failed to originate call:", error);
    } else {
      console.log("Call originated successfully:", response);
    }
  }
);
```

### Monitoring Channel Events

```typescript
ami.on("newchannel", (event) => {
  console.log(`New channel created: ${event.channel}`);
});

ami.on("hangup", (event) => {
  console.log(`Channel ${event.channel} hung up. Cause: ${event.cause}`);
});

ami.on("newstate", (event) => {
  console.log(
    `Channel ${event.channel} changed state to ${event.channelstatedesc}`
  );
});
```

### Getting System Status

```typescript
ami.action({ action: "Status" }, (error, response) => {
  if (error) {
    console.error("Failed to get status:", error);
  } else {
    console.log("System status:", response);
  }
});
```

### Listing Active Channels

```typescript
ami.action({ action: "CoreShowChannels" }, (error, response) => {
  if (response?.response === "follows") {
    console.log("Active channels:");
    console.log(response.content);
  }
});
```

## Error Handling

The library provides comprehensive error handling:

```typescript
ami.on("error", (error) => {
  console.error("AMI Error:", error.message);

  // Handle different error types
  if (error.message.includes("ECONNREFUSED")) {
    console.log("Asterisk server is not running or AMI is disabled");
  }
});

// Action-specific error handling
ami.action({ action: "InvalidAction" }, (error, response) => {
  if (error) {
    console.error("Action error:", error);
    // error will contain the error response from Asterisk
  }
});
```

## Auto-Reconnection

Enable automatic reconnection to handle network issues:

```typescript
const ami = new Manager(5038, "localhost", "admin", "secret", true);

// Enable auto-reconnection
ami.keepConnected();

ami.on("connect", () => {
  console.log("Connected to AMI");
});

ami.on("close", () => {
  console.log("Connection lost, will attempt to reconnect...");
});
```

## Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd NodeJS-AsteriskManager

# Install dependencies
npm install

# Build the project
npm run build

# The compiled JavaScript and type definitions will be in the dist/ directory
```

## Development Scripts

```bash
# Build the project
npm run build

# Clean build artifacts
npm run clean

# Build for publishing
npm run prepublishOnly
```

## Requirements

- Node.js 16.0.0 or higher
- TypeScript 5.9+ (for development)
- Asterisk PBX with AMI enabled

## Asterisk Configuration

Ensure AMI is enabled in your Asterisk configuration (`/etc/asterisk/manager.conf`):

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = your-secret-password
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.0
read = system,call,log,verbose,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,agent,user,config,command,reporting,originate
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

See the [LICENSE](./LICENSE) file for license information.

## Credits

This library is based on the original work from [node-asterisk](https://github.com/mscdex/node-asterisk) but has been completely rewritten in TypeScript with modern Node.js practices.

### Authors & Maintainers

- **Philipp Dunkel** - Original concept
- **Uchkun Rakhimov** - JavaScript implementation
- **Igor Escobar** - Maintenance and improvements

---

**Note**: This library provides a TypeScript-first approach to Asterisk AMI integration with comprehensive type safety and modern JavaScript features.
