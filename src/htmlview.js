import { isFunction } from "lodash";
import { View } from "./view";
import { render } from 'lit-html';


export const HTMLView = View.extend({

    render () {
        isFunction(this.beforeRender) && this.beforeRender();
        render(this.toHTML(), this.el);
        isFunction(this.afterRender) && this.afterRender();
        return this;
    }
});
