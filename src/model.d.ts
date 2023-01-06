export function Model(attributes: any, options: any, ...args: any[]): void;
export class Model {
    constructor(attributes: any, options: any, ...args: any[]);
    cid: any;
    attributes: {};
    collection: any;
    changed: {};
}
export namespace Model {
    export { inherits as extend };
}
import { inherits } from "./helpers.js";
