const log = (...args) => console.log('[sse]', ...args);

let keepAliveTimer = null;

function gotActivity(){
  if(keepaliveTimer != null) clearTimeout(keepaliveTimer);
  keepaliveTimer = setTimeout(connect, 30 * 1000);
}


if (!!window.EventSource) {
    const {eid,path} = window.odgnServe;
    var source = new EventSource(`/sse?e=${eid}&path=${path}`);

    
    function setDebug(data){
        
        // const debugDataEl = document.getElementById('data');
        // if( debugDataEl !== undefined ){
        //     debugDataEl.innerHTML = data;
        // }
        log('[debug]', data);
    }

    function setState(msg){
        const id_state = document.getElementById('state');
        if( id_state ){
            id_state.innerHTML = msg;
        }
        log('[state]', msg);
    }

    source.addEventListener('message', function (e) {
        log('[message]', e);
        setDebug( e.data );
    }, false)

    source.addEventListener('initial', function (e) {
        log('[initial]', e);
        setDebug( e.data )
    }, false)

    source.addEventListener('change', function (e) {
        log('[change]', e);
        setDebug( JSON.parse(e.data) );
    }, false);
    
    source.addEventListener('ping', function (e) {
        // log('[ping]', e);
        // setDebug( e.data );
    }, false);

    source.addEventListener('reload', function (e) {
        log('[reload]', e);
        setDebug( JSON.parse(e.data) );
        window.location.reload();
    }, false);

    source.onmessage = (evt) => {
        log('[onmessage]', evt);
    }

    source.addEventListener('open', function (e) {
        log('connected');
        // document.getElementById('state').innerHTML = "Connected"
    }, false);
    
    source.addEventListener('error', (e) => {
        log('[error]', e);
        
        if (e.eventPhase == EventSource.CLOSED)
            source.close()
        if (e.target.readyState == EventSource.CLOSED) {
            setState( "Disconnected" );
        }
        else if (e.target.readyState == EventSource.CONNECTING) {
            setState( "Connecting..." );
        }
    }, false)
} else {
    log("Your browser doesn't support SSE");
}