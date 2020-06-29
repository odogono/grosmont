const getClass:Function = {}.toString;


/**
 *
 * @param {*} object
 */
export function isDate(value:any): boolean {
    return value && getClass.call(value) === '[object Date]';
}


/**
 *
 * @param {*} object
 */
export function isString(value:any): boolean {
    return getClass.call(value) === '[object String]';
}

