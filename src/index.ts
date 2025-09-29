/**
 * NodeJS Asterisk Manager API
 * (Based on https://github.com/mscdex/node-asterisk.git)
 * But radically altered thereafter so as to constitute a new work.
 *
 * © See LICENSE file
 */

export { default as Manager } from "./lib/ami";
export * from "./types";
export * from "./lib/utils";

/**
 * Default export for CommonJS compatibility
 */
import Manager from "./lib/ami";
export default Manager;
