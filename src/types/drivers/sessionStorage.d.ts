export default sessionStorageWrapper;
declare namespace sessionStorageWrapper {
    export let _driver: string;
    export { _initStorage };
    export let _support: boolean;
    export { iterate };
    export { getItem };
    export { setItem };
    export { removeItem };
    export { clear };
    export { length };
    export { key };
    export { keys };
    export { dropInstance };
}
declare function _initStorage(options: any): void;
declare function iterate(iterator: any, callback: any): any;
declare function getItem(key: any, callback: any): any;
/**
 * Set a key's value and run an optional callback once the value is set.
 * Unlike Gaia's implementation, the callback function is passed the value,
 * in case you want to operate on that value only after you're sure it
 * saved, or something like that.
 * @template T
 * @param {string} key - The key under which the value is stored.
 * @param {T} value - The value to be stored, can be of any type.
 * @param {(err: any, value: T) => void} [callback] - Optional callback function to be called after the value is set.
 * @returns {Promise<T>}
 */
declare function setItem<T>(key: string, value: T, callback?: (err: any, value: T) => void): Promise<T>;
declare function removeItem(key: any, callback: any): any;
declare function clear(callback: any): any;
declare function length(callback: any): any;
declare function key(n: any, callback: any): any;
declare function keys(callback: any): any;
declare function dropInstance(options: any, callback: any, ...args: any[]): Promise<void>;
//# sourceMappingURL=sessionStorage.d.ts.map