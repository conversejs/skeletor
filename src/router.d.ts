export function Router(options?: {}, ...args: any[]): void;
export class Router {
    constructor(options?: {}, ...args: any[]);
    history: any;
    routes: any;
}
export namespace Router {
    export { inherits as extend };
}
import { inherits } from "./helpers.js";
