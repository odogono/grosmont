const log = (...args) => console.log('[sse]', ...args);

let keepAliveTimer = null;

function gotActivity(){
  if(keepaliveTimer != null) clearTimeout(keepaliveTimer);
  keepaliveTimer = setTimeout(connect, 30 * 1000);
}


if (!!window.EventSource) {
    const {eid,path} = window.odgnServe;
    var source = new EventSource(`/sseEvents?e=${eid}&path=${path}`)

    source.addEventListener('message', function (e) {
        log('[message]', e);
        document.getElementById('data').innerHTML = e.data
    }, false)

    source.addEventListener('initial', function (e) {
        log('[initial]', e);
        document.getElementById('data').innerHTML = e.data
    }, false)

    source.addEventListener('change', function (e) {
        log('[change]', e);
        document.getElementById('data').innerHTML = JSON.parse(e.data);
    }, false);
    
    source.addEventListener('ping', function (e) {
        // log('[ping]', e);
        // document.getElementById('data').innerHTML = e.data;
    }, false);

    source.addEventListener('reload', function (e) {
        log('[reload]', e);
        document.getElementById('data').innerHTML = JSON.parse(e.data);
        window.location.reload();
    }, false);

    source.onmessage = (evt) => {
        log('[onmessage]', evt);
    }

    source.addEventListener('open', function (e) {
        document.getElementById('state').innerHTML = "Connected"
    }, false);
    
    source.addEventListener('error', (e) => {
        log('[error]', e);
        const id_state = document.getElementById('state')
        if (e.eventPhase == EventSource.CLOSED)
            source.close()
        if (e.target.readyState == EventSource.CLOSED) {
            id_state.innerHTML = "Disconnected"
        }
        else if (e.target.readyState == EventSource.CONNECTING) {
            id_state.innerHTML = "Connecting..."
        }
    }, false)
} else {
    log("Your browser doesn't support SSE");
}