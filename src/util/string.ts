export function truncate(str: string, len = 10) {
    return str === undefined ? '' : str.length <= len ? str : str.slice(0, len) + '...';
}