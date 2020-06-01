import {isDate, isString} from './is';

/**
 * 
 * from: http://www.tuanhuynh.com/blog/2014/unpacking-underscore-clone-and-extend/
 */
export function deepExtend<T>(out = {}, ...others) : T {
    let ii:number;
    let len:number;
    let obj;
    let key, val;

    for (ii = 0, len = others.length; ii < len; ii++) {
        obj = others[ii];

        if (!obj) {
            continue;
        }

        for (key in obj) {
            if (!obj.hasOwnProperty(key)) {
                continue;
            }

            val = obj[key];

            if (Array.isArray(val)) {
                out[key] = deepExtend(out[key] || [], val);
            } else if (isString(val)) {
                out[key] = String.prototype.slice.call(val);
            } else if (isDate(val)) {
                out[key] = new Date(val.valueOf());
            } else if (typeof val === 'object') {
                out[key] = deepExtend(out[key], val);
            } else {
                out[key] = val;
            }
        }
    }
    return out as T;
}