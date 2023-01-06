export default skeletor;
declare namespace skeletor {
    const VERSION: string;
    function noConflict(): {
        Collection: typeof Collection;
        Events: typeof Events;
        History: typeof History;
        Model: typeof Model;
        Router: typeof Router;
        View: typeof View;
        ajax: typeof ajax;
        sync: typeof sync;
    };
}
import { Collection } from "./collection.js";
import { Events } from "./events.js";
import History from "./history.js";
import { Model } from "./model.js";
import { Router } from "./router.js";
import { View } from "./view.js";
import { ajax } from "./helpers.js";
import { sync } from "./helpers.js";
