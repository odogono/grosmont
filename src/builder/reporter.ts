import { toCapitalized } from "@odgn/utils";



export class Reporter {
    prefix: string;

    setLocation(loc:string){
        let parts = loc.split('/');
        this.prefix = '[' + parts.filter(Boolean).map( p => toCapitalized(p) ).join('][') + ']';
    }

    info(...message:any[]){
        this.write('Info', message );
    }
    
    debug(...message:any[]){
        this.write('Debug', message );
    }

    warn(message:string){
        this.write('Warn', [message] );
    }
    error(message:string, error?:Error){
        this.write('Error', [message] );
        if( error ) console.log( error );
    }


    write(level:string, message:string[]){
        console.log(`${this.prefix}[${level}]`, ...message );
    }
}

export function setLocation( reporter:Reporter, loc:string ){
    if( reporter ){
        reporter.setLocation(loc);
    }
}

export function info( reporter, ...message:any[] ){
    if( reporter ){
        reporter.info(...message);
    }
}
export function debug( reporter, ...message:any[] ){
    if( reporter ){
        reporter.debug(...message);
    }
}

export function error( reporter, message:string, error?:Error ){
    if( reporter ){
        reporter.error(message, error);
    }
}