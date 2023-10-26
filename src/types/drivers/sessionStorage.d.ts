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
declare function setItem(key: any, value: any, callback: any): Promise<void>;
declare function removeItem(key: any, callback: any): any;
declare function clear(callback: any): any;
declare function length(callback: any): any;
declare function key(n: any, callback: any): any;
declare function keys(callback: any): any;
declare function dropInstance(options: any, callback: any, ...args: any[]): Promise<void>;
//# sourceMappingURL=sessionStorage.d.ts.map