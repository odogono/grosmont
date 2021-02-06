// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.


/**
 * 
 * https://gist.github.com/nmsdvid/8807205
 */
export function debounce(callback: Function, wait: number = 250) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), wait);
    };
};


/**
 * Delays calling the specified function for <wait> ms
 */
export const delay = (callback: Function, wait:number = 0, ...args:any[]):Promise<any> => {
    return new Promise( (resolve) => {
        setTimeout( () => {
            return resolve( callback(...args) );
        }, wait);
    })
};
  
/**
 * Defers a function, scheduling it to run after the current call stack has cleared.
 */
export const defer = (callback: Function, ...args) => delay(callback, 1, ...args);
