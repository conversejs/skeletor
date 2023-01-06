declare function History(): void;
declare class History {
    handlers: any[];
    checkUrl: any;
    location: Location;
    history: History;
}
declare namespace History {
    export { inherits as extend };
    export const started: boolean;
}
export default History;
import { inherits } from "./helpers.js";
