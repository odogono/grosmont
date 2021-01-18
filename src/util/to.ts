/**
 *
 * @param {*} value
 * @param {*} defaultValue
 */
export function toBoolean(value:(boolean|number|string), defaultValue = false) {
    switch (value) {
        case true:
        case 'true':
        case 1:
        case '1':
        case 'yes':
        case 'Yes':
            return true;
        case false:
        case 'false':
        case 0:
        case '0':
        case 'no':
        case 'No':
            return false;
        default:
            return defaultValue;
    }
}