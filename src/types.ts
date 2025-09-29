import { EventEmitter } from "events";
import { Socket } from "net";

/**
 * Configuration options for the Asterisk Manager Interface
 */
export interface ManagerOptions {
  /** Port number for AMI connection */
  port: number;
  /** Hostname or IP address */
  host: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Whether to receive events */
  events: boolean;
}

/**
 * Internal context for managing connection state
 */
export interface ManagerContext {
  /** Network connection socket */
  connection?: Socket | undefined;
  /** Event emitter instance */
  emitter: EventEmitter;
  /** Whether the manager is authenticated */
  authenticated: boolean;
  /** Buffered lines from incoming data */
  lines?: string[];
  /** Leftover data from incomplete reads */
  leftOver?: string;
  /** Actions held while not authenticated */
  held: HeldAction[];
  /** Last action ID used */
  lastid?: string;
  /** Current follow state for multi-line responses */
  follow?: boolean;
  /** Reconnection backoff time in milliseconds */
  backoff: number;
}

/**
 * Action held while not authenticated
 */
export interface HeldAction {
  /** The action to execute */
  action: ManagerAction;
  /** Callback for the action */
  callback: ManagerCallback;
}

/**
 * Generic AMI action object
 */
export interface ManagerAction {
  /** Action name */
  action: string;
  /** Optional action ID */
  actionid?: string;
  /** Additional action parameters */
  [key: string]: unknown;
}

/**
 * Login action parameters
 */
export interface LoginAction extends ManagerAction {
  action: "login";
  username: string;
  secret: string;
  event: "on" | "off";
}

/**
 * Generic AMI event object
 */
export interface ManagerEvent {
  /** Event name */
  event?: string;
  /** Response type for action responses */
  response?: string;
  /** Action ID for correlating responses */
  actionid?: string;
  /** Content for follow responses */
  content?: string;
  /** User event name for user events */
  userevent?: string;
  /** Variables attached to events */
  variable?: Record<string, string>;
  /** Channel variables */
  chanvariable?: Record<string, string>;
  /** Additional event data */
  [key: string]: unknown;
}

/**
 * Callback function type for AMI actions
 */
export type ManagerCallback = (
  error?: ManagerEvent | Error | null,
  response?: ManagerEvent
) => void;

/**
 * Connection callback type
 */
export type ConnectionCallback = (error?: Error | null) => void;

/**
 * Main AMI Manager interface
 */
export interface AsteriskManager extends EventEmitter {
  /** Configuration options */
  options: ManagerOptions;

  /**
   * Connect to the AMI
   */
  connect(port: number, host: string, callback?: ConnectionCallback): void;

  /**
   * Enable automatic reconnection
   */
  keepConnected(): void;

  /**
   * Login to the AMI
   */
  login(callback?: ManagerCallback): void;

  /**
   * Execute an AMI action
   */
  action(action: ManagerAction, callback?: ManagerCallback): string;

  /**
   * Disconnect from the AMI
   */
  disconnect(callback?: () => void): void;

  /**
   * Check if connected to AMI
   */
  isConnected(): boolean;

  /**
   * Alias for isConnected
   */
  connected(): boolean;

  /**
   * Reconnection function reference
   */
  reconnect?: () => void;
}

/**
 * Constructor function type for creating AMI Manager instances
 */
export interface ManagerConstructor {
  (
    port?: number,
    host?: string,
    username?: string,
    password?: string,
    events?: boolean
  ): AsteriskManager;
}
