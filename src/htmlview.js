import { isFunction, isNil } from "lodash";
import { View } from "./view";
import { render } from 'lit-html';
import tovnode from "tovnode";


export const HTMLView = View.extend({

    render () {
        isFunction(this.beforeRender) && this.beforeRender();
        render(this.toHTML(), this.el);
        isFunction(this.afterRender) && this.afterRender();
        return this;
    }
});
