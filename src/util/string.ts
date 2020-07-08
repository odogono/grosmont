export function truncate(str: string, len = 10) {
    return str === undefined ? '' : str.length <= len ? str : str.slice(0, len) + '...';
}


/**
 * https://lucidar.me/en/web-dev/how-to-slugify-a-string-in-javascript/
 * 
 * @param value 
 */
export function slugify(value:string){
    value = value.replace(/^\s+|\s+$/g, '');

    // Make the string lowercase
    value = value.toLowerCase();

    // Remove accents, swap ñ for n, etc
    var from = "ÁÄÂÀÃÅČÇĆĎÉĚËÈÊẼĔȆÍÌÎÏŇÑÓÖÒÔÕØŘŔŠŤÚŮÜÙÛÝŸŽáäâàãåčçćďéěëèêẽĕȇíìîïňñóöòôõøðřŕšťúůüùûýÿžþÞĐđßÆa·/_,:;";
    var to   = "AAAAAACCCDEEEEEEEEIIIINNOOOOOORRSTUUUUUYYZaaaaaacccdeeeeeeeeiiiinnooooooorrstuuuuuyyzbBDdBAa------";
    for (let ii=0, len=from.length ; ii<len ; ii++) {
        value = value.replace(new RegExp(from.charAt(ii), 'g'), to.charAt(ii));
    }

    // Remove invalid chars
    value = value.replace(/[^a-z0-9 -]/g, '') 
    // Collapse whitespace and replace by -
    .replace(/\s+/g, '-') 
    // Collapse dashes
    .replace(/-+/g, '-'); 

    return value;
}