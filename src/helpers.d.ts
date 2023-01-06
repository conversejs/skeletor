export function guid(): string;
export function inherits(protoProps: any, staticProps: any): any;
export function getResolveablePromise(): Promise<any>;
export function urlError(): void;
export function wrapError(model: any, options: any): void;
export function getSyncMethod(model: any): any;
export function sync(method: any, model: any, options?: {}): any;
export function ajax(...args: any[]): any;
/**
 * Custom error for indicating timeouts
 * @namespace _converse
 */
export class NotImplementedError extends Error {
}
