export default Storage;
declare class Storage {
    constructor(id: any, type: any, batchedWrites?: boolean);
    storeInitialized: Promise<void>;
    store: any;
    name: any;
    /**
     * @param {'local'|'session'|'indexed'|'in_memory'} type
     * @param {boolean} batchedWrites
     */
    initStore(type: 'local' | 'session' | 'indexed' | 'in_memory', batchedWrites: boolean): Promise<void>;
    flush(): any;
    clear(): Promise<void>;
    sync(): {
        (method: any, model: any, options: any): Promise<void>;
        __name__: string;
    };
    removeCollectionReference(model: any, collection: any): any;
    addCollectionReference(model: any, collection: any): any;
    getCollectionReferenceData(model: any): {};
    save(model: any): Promise<any>;
    create(model: any, options: any): Promise<any>;
    update(model: any): Promise<any>;
    find(model: any): any;
    findAll(): Promise<any[]>;
    destroy(model: any, collection: any): Promise<any>;
    getStorageSize(): any;
    getItemName(id: any): string;
}
declare namespace Storage {
    export let sessionStorageInitialized: any;
    export { localForage };
}
//# sourceMappingURL=storage.d.ts.map