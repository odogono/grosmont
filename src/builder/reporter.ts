import { toCapitalized, toPascalCase } from "@odgn/utils";
import { EntityId } from "odgn-entity/src/entity";

// https://stackoverflow.com/a/41407246
const Reset = "\x1b[0m";
const Bright = "\x1b[1m";
const Dim = "\x1b[2m";
const Underscore = "\x1b[4m";
const Blink = "\x1b[5m";
const Reverse = "\x1b[7m";
const Hidden = "\x1b[8m";

const FgBlack = "\x1b[30m";
const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgYellow = "\x1b[33m";
const FgBlue = "\x1b[34m";
const FgMagenta = "\x1b[35m";
const FgCyan = "\x1b[36m";
const FgWhite = "\x1b[37m";

const BgBlack = "\x1b[40m";
const BgRed = "\x1b[41m";
const BgGreen = "\x1b[42m";
const BgYellow = "\x1b[43m";
const BgBlue = "\x1b[44m";
const BgMagenta = "\x1b[45m";
const BgCyan = "\x1b[46m";
const BgWhite = "\x1b[47m";

export interface ReportOptions {
    eid?: EntityId;
}

export class Reporter {
    prefix: string;

    setLocation(loc: string) {
        let parts = loc.split('/');
        this.prefix = '[' + parts.filter(Boolean).map(p => toPascalCase(p) ).join('][') + ']';
    }

    info(message: string, options: ReportOptions = {}) {
        this.write('Info', message, options);
    }

    debug(message: string, options: ReportOptions = {}) {
        this.write('Debug', message, options);
    }

    warn(message: string, options: ReportOptions = {}) {
        this.write('Warn', message, options);
    }
    error(message: string, error?: Error, options: ReportOptions = {}) {
        this.write('Error', message, options);
        if (error) console.log(error);
    }


    write(level: string, message: string, options: ReportOptions = {}) {
        const { eid } = options;
        let entry = [`[${level}]`, this.prefix];
        // entry.push(`[${level}]`);
        if (eid !== undefined) {
            entry.push(`[${yellow(eid)}]`);
        }
        entry.push( (message.startsWith('[') ? '' : ' ') + message);
        console.log(entry.join(''));
    }
}

function yellow(str:any){
    return `${FgYellow}${str}${Reset}`;
}
function cyan(str:any){
    return `${FgCyan}${str}${Reset}`;
}

export function setLocation(reporter: Reporter, loc: string) {
    if (reporter) {
        reporter.setLocation(loc);
    }
}

export function info(reporter, message: string, options: ReportOptions = {}) {
    if (reporter) {
        reporter.info(message, options);
    }
}
export function debug(reporter, message: string, options: ReportOptions = {}) {
    if (reporter) {
        reporter.debug(message, options);
    }
}

export function error(reporter, message: string, error?: Error, options: ReportOptions = {}) {
    if (reporter) {
        reporter.error(message, error, options);
    }
}