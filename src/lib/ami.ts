/**
 * NodeJS Asterisk Manager API
 * (Based on https://github.com/mscdex/node-asterisk.git)
 * But radically altered thereafter so as to constitute a new work.
 *
 * © See LICENSE file
 */

import { EventEmitter } from "events";
import { createConnection, Socket } from "net";
import { defaultCallback, removeSpaces, stringHasLength } from "./utils";
import {
  AsteriskManager,
  ManagerOptions,
  ManagerContext,
  ManagerAction,
  ManagerEvent,
  ManagerCallback,
  ConnectionCallback,
  ManagerConstructor,
} from "../types";

/**
 * Debug flag for error logging
 */
const debug = false;

/**
 * AMI Manager class extending EventEmitter
 */
class AsteriskManagerImpl extends EventEmitter implements AsteriskManager {
  public options: ManagerOptions;
  private context: ManagerContext;
  public reconnect?: () => void;

  constructor(
    port?: number,
    host?: string,
    username?: string,
    password?: string,
    events?: boolean
  ) {
    super();

    this.options = {
      port: port || 0,
      host: host || "",
      username: username || "",
      password: password || "",
      events: events || false,
    };

    this.context = {
      backoff: 10000,
      emitter: this,
      held: [],
      authenticated: false,
    };

    /**
     * Set up event handlers
     */
    this.on("rawevent", this.handleManagerEvent.bind(this));
    this.on("error", () => {});
    this.on("connect", this.resetBackoff.bind(this));

    /**
     * Auto-connect if port is provided
     */
    if (port) {
      this.connect(
        this.options.port,
        this.options.host,
        this.options.username ? () => this.login() : undefined
      );
    }
  }

  /**
   * Connect to the Asterisk Manager Interface
   */
  connect(port: number, host: string, callback?: ConnectionCallback): void {
    const cb = defaultCallback(callback);

    /**
     * Reuse existing connection if available
     */
    if (
      this.context.connection &&
      this.context.connection.readyState !== "closed"
    ) {
      // Connection is still valid, reuse it
    } else {
      this.context.connection = undefined;
    }

    if (this.context.connection) {
      return cb.call(this, null);
    }

    this.context.authenticated = false;
    this.context.connection = createConnection(port, host);
    this.context.connection.setKeepAlive(true);
    this.context.connection.setNoDelay(true);
    this.context.connection.setEncoding("utf-8");

    /**
     * Set up connection event handlers
     */
    this.context.connection.once("connect", cb.bind(this, null));
    this.context.connection.on("connect", this.emit.bind(this, "connect"));
    this.context.connection.on("close", this.emit.bind(this, "close"));
    this.context.connection.on("end", this.emit.bind(this, "end"));
    this.context.connection.on("data", this.handleData.bind(this));
    this.context.connection.on("error", this.handleConnectionError.bind(this));
  }

  /**
   * Enable automatic reconnection
   */
  keepConnected(): void {
    if (this.reconnect) return;

    if (!this.isConnected()) {
      this.reconnect = this.handleReconnect.bind(this);
      this.on("close", this.reconnect);
    }
  }

  /**
   * Login to the AMI
   */
  login(callback?: ManagerCallback): void {
    const cb = defaultCallback(callback);

    this.action(
      {
        action: "login",
        username: this.options.username,
        secret: this.options.password,
        event: this.options.events ? "on" : "off",
      },
      (err?: ManagerEvent | Error | null) => {
        if (err) return cb(err);

        process.nextTick(cb.bind(this));
        this.context.authenticated = true;

        /**
         * Process held actions
         */
        const held = this.context.held;
        this.context.held = [];
        held.forEach((heldAction) => {
          this.action(heldAction.action, heldAction.callback);
        });
      }
    );
  }

  /**
   * Execute an AMI action
   */
  action(action: ManagerAction, callback?: ManagerCallback): string {
    const cb = defaultCallback(callback);
    const actionObj = action || { action: "" };
    let id = actionObj.actionid || String(new Date().getTime());

    /**
     * Ensure unique action ID
     */
    while (this.listeners(id).length) {
      id += String(Math.floor(Math.random() * 9));
    }

    if (actionObj.actionid) {
      delete actionObj.actionid;
    }

    /**
     * Hold action if not authenticated
     */
    if (!this.context.authenticated && actionObj.action !== "login") {
      this.context.held = this.context.held || [];
      actionObj.actionid = id;
      this.context.held.push({
        action: actionObj,
        callback: cb,
      });
      return id;
    }

    try {
      if (!this.context.connection) {
        throw new Error("There is no connection yet");
      }

      this.context.connection.write(
        this.makeActionMessage(actionObj, id),
        "utf-8"
      );
    } catch (e) {
      console.log("ERROR: ", e);

      /**
       * Hold action on connection error
       */
      this.context.held = this.context.held || [];
      actionObj.actionid = id;
      this.context.held.push({
        action: actionObj,
        callback: cb,
      });

      return id;
    }

    this.once(id, cb);
    return (this.context.lastid = id);
  }

  /**
   * Disconnect from the AMI
   */
  disconnect(callback?: () => void): void {
    if (this.reconnect) {
      this.removeListener("close", this.reconnect);
    }

    if (
      this.context.connection &&
      this.context.connection.readyState === "open"
    ) {
      this.context.connection.end();
    }

    delete this.context.connection;

    if (typeof callback === "function") {
      setImmediate(callback);
    }
  }

  /**
   * Check if connected to AMI
   */
  isConnected(): boolean {
    return Boolean(
      this.context.connection && this.context.connection.readyState === "open"
    );
  }

  /**
   * Alias for isConnected
   */
  connected(): boolean {
    return this.isConnected();
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(error: Error): void {
    this.emit("error", error);

    if (debug) {
      const errorLines = String(error.stack).split(/\r?\n/);
      const msg = errorLines.shift();
      const stack = errorLines.map(
        (line) => " ↳ " + line.replace(/^\s*at\s+/, "")
      );

      if (msg) stack.unshift(msg);

      stack.forEach((line) => {
        process.stderr.write(line + "\n");
      });
    }
  }

  /**
   * Handle incoming data from the connection
   */
  private handleData(data: string): void {
    this.context.lines = this.context.lines || [];
    this.context.leftOver = this.context.leftOver || "";
    this.context.leftOver += String(data);
    this.context.lines = this.context.lines.concat(
      this.context.leftOver.split(/\r?\n/)
    );
    this.context.leftOver = this.context.lines.pop() || "";

    const lines: string[] = [];
    let follow = 0;
    let item: ManagerEvent = {};

    while (this.context.lines.length) {
      const line = this.context.lines.shift();
      if (!line) continue;

      if (!lines.length && line.substr(0, 21) === "Asterisk Call Manager") {
        /**
         * Ignore greeting message
         */
        continue;
      } else if (
        !lines.length &&
        line.substr(0, 9).toLowerCase() === "response:" &&
        line.toLowerCase().indexOf("follow") > -1
      ) {
        follow = 1;
        lines.push(line);
      } else if (
        follow &&
        (line === "--END COMMAND--" || line === "--END SMS EVENT--")
      ) {
        follow = 2;
        lines.push(line);
      } else if (follow > 1 && !line.length) {
        follow = 0;
        lines.pop();
        item = {
          response: "follows",
          content: lines.join("\n"),
        };

        /**
         * Extract action ID from content
         */
        const matches = item.content?.match(/actionid: ([^\r\n]+)/i);
        if (matches && matches[1]) {
          item.actionid = matches[1];
        }

        lines.length = 0;
        this.emit("rawevent", item);
      } else if (!follow && !line.length) {
        /**
         * Process complete item
         */
        const filteredLines = lines.filter(stringHasLength);
        item = {};

        while (filteredLines.length) {
          const currentLine = filteredLines.shift();
          if (!currentLine) continue;

          const parts = currentLine.split(": ");
          const keyPart = parts.shift();
          if (!keyPart) continue;
          const key = removeSpaces(keyPart).toLowerCase();
          const value = parts.join(": ");

          if (key === "variable" || key === "chanvariable") {
            /**
             * Handle special case of variables
             */
            if (typeof item[key] !== "object") {
              item[key] = {};
            }
            const variableParts = value.split("=");
            const subkey = variableParts.shift();
            if (subkey && typeof item[key] === "object" && item[key] !== null) {
              (item[key] as Record<string, string>)[subkey] =
                variableParts.join("=");
            }
          } else {
            /**
             * Handle multiple values for the same key
             */
            if (key in item) {
              if (Array.isArray(item[key])) {
                (item[key] as string[]).push(value);
              } else {
                item[key] = [item[key] as string, value];
              }
            } else {
              item[key] = value;
            }
          }
        }

        this.context.follow = false;
        lines.length = 0;
        this.emit("rawevent", item);
      } else {
        lines.push(line);
      }
    }

    this.context.lines = lines;
  }

  /**
   * Handle manager events
   */
  private handleManagerEvent(event: ManagerEvent): void {
    const emits: (() => void)[] = [];

    if (
      event.response &&
      event.actionid &&
      typeof event.response === "string"
    ) {
      /**
       * Handle action responses
       */
      emits.push(
        this.emit.bind(
          this,
          event.actionid,
          event.response.toLowerCase() === "error" ? event : undefined,
          event
        )
      );
      emits.push(this.emit.bind(this, "response", event));
    } else if (event.response && event.content) {
      /**
       * Handle follow responses
       */
      emits.push(
        this.emit.bind(this, this.context.lastid || "", undefined, event)
      );
      emits.push(this.emit.bind(this, "response", event));
    }

    if (event.event) {
      /**
       * Handle real events
       */
      event.event = Array.isArray(event.event) ? event.event[0] : event.event;
      event.event = String(event.event);

      emits.push(this.emit.bind(this, "managerevent", event));
      emits.push(this.emit.bind(this, event.event.toLowerCase(), event));

      if (event.event.toLowerCase() === "userevent" && event.userevent) {
        emits.push(
          this.emit.bind(
            this,
            `userevent-${String(event.userevent).toLowerCase()}`,
            event
          )
        );
      }
    } else {
      /**
       * Handle unknown events
       */
      emits.push(this.emit.bind(this, "asterisk", event));
    }

    emits.forEach((emitFn) => process.nextTick(emitFn));
  }

  /**
   * Handle reconnection with backoff
   */
  private handleReconnect(): void {
    console.log(
      `Trying to reconnect to AMI in ${this.context.backoff / 1000} seconds`
    );

    const connect = () => {
      this.connect(this.options.port, this.options.host, () => this.login());
    };

    setTimeout(connect, this.context.backoff);

    if (this.context.backoff < 60000) {
      this.context.backoff += 10000;
    }
  }

  /**
   * Reset the reconnection backoff
   */
  private resetBackoff(): void {
    this.context.backoff = 10000;
  }

  /**
   * Create a formatted AMI action message
   */
  private makeActionMessage(req: ManagerAction, id: string): string {
    const msg: string[] = [];
    msg.push(`ActionID: ${id}`);

    Object.keys(req).forEach((key) => {
      const nkey = removeSpaces(key).toLowerCase();
      if (!nkey.length || nkey === "actionid") {
        return;
      }

      let nval = req[key];
      const formattedKey = nkey.charAt(0).toUpperCase() + nkey.slice(1);

      switch (typeof nval) {
        case "undefined":
          return;
        case "object":
          if (!nval) return;

          if (Array.isArray(nval)) {
            nval = nval.map((e) => String(e)).join(",");
          } else if (!(nval instanceof RegExp)) {
            Object.keys(nval as Record<string, unknown>).forEach((name) => {
              const value = (nval as Record<string, unknown>)[name];
              msg.push(`${formattedKey}: ${name}=${String(value)}`);
            });
            return;
          }
          break;
        default:
          nval = String(nval);
          break;
      }

      msg.push(`${formattedKey}: ${nval}`);
    });

    msg.sort();
    return msg.join("\r\n") + "\r\n\r\n";
  }
}

/**
 * Factory function to create AMI Manager instances
 */
const Manager: ManagerConstructor = function Manager(
  port?: number,
  host?: string,
  username?: string,
  password?: string,
  events?: boolean
): AsteriskManager {
  return new AsteriskManagerImpl(port, host, username, password, events);
};

export default Manager;
