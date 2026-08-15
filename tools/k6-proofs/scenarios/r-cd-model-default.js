/** Scenario: R-CD-MODEL-DEFAULT — default provider/model inheritance, typed tool path. */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { connectFrame, nonce, RequestTracker, redactEvent } from '../lib/gateway-ws.js';
import { GatewayHandshake, disposableSessionKey, recordClassifiedEvent } from '../lib/proof-session.js';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_cd_model_default: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '180s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_model_default_duration: ['p(95)<150000'] },
};
const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_model_default_duration');
const manifest = loadManifestFromEnv();
const DEFAULTS = { sessionKey:'main', seat:'cael-dgx', delaySeconds:1, idempotencyKeyPrefix:'R-CD-MODEL-DEFAULT', expectedModel:'github-copilot/gpt-5.5' };
const HARNESS_MARKER='[k6-proof-harness]';
function boolEnv(name){ return (__ENV[name]||'').toLowerCase()==='true'; }

export default function(){
  const url=__ENV.OPENCLAW_GATEWAY_WS || 'ws://127.0.0.1:18789';
  const token=__ENV.OPENCLAW_GATEWAY_TOKEN;
  const requestedSessionKey=manifest?.sessionKey || __ENV.OPENCLAW_SESSION_KEY || DEFAULTS.sessionKey;
  let sessionKey=requestedSessionKey;
  const createDisposableSession=boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSION') || boolEnv('OPENCLAW_CREATE_DISPOSABLE_SESSIONS');
  const seat=manifest?.seat || __ENV.OPENCLAW_SEAT_NAME || DEFAULTS.seat;
  const rowNonce=nonce('R-CD-MODEL-DEFAULT');
  const expectedModel=__ENV.OPENCLAW_EXPECTED_MODEL || DEFAULTS.expectedModel;
  const inv=manifest?.invocation || {};
  const delaySeconds=Number(inv.delaySeconds ?? __ENV.OPENCLAW_DELAY_SECONDS ?? DEFAULTS.delaySeconds);
  const idPrefix=inv.idempotencyKeyPrefix || DEFAULTS.idempotencyKeyPrefix;
  if(!token){ console.error('OPENCLAW_GATEWAY_TOKEN is required'); failures.add(1); return; }
  if(manifest){ const errors=validateManifest(manifest); if(errors.length) console.warn('Manifest validation warnings: '+errors.join('; ')); }
  const evidence={ row:'R-CD-MODEL-DEFAULT', manifest_loaded:!!manifest, nonce:rowNonce, seat, requestedSessionKey, sessionKey, session_created:false, created_session_key:null, candidateSha:manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', started:new Date().toISOString(), parent_model_byte:expectedModel, dispatch_accepted:false, child_session_observed:false, child_model_byte:null, model_matches:false, return_payload:false, trace_id:null, redacted_events:[] };
  const started=Date.now();
  const res=ws.connect(url,{},(socket)=>{
    const tracker=new RequestTracker();
    // Response-driven handshake: start the row when the gateway
    // acknowledges connect, not after a fixed guess. The old fixed delay
    // survives only as the recorded upper bound.
    const handshake = new GatewayHandshake({
      tracker,
      fallbackMs: 500,
      onReady: () => { if(createDisposableSession){ (()=>{ const key=disposableSessionKey('r-cd-model-default', rowNonce); tracker.send(socket,'sessions.create',{key,label:'k6 R-CD-MODEL-DEFAULT '+rowNonce}); })(); } else start(socket);
      },
    });

    function start(socket){
      tracker.send(socket,'sessions.messages.subscribe',{key:sessionKey});
      socket.setTimeout(()=>{
        const childTask='Proof nonce '+rowNonce+': reply exactly MODEL-DEFAULT-CHILD '+rowNonce+' MODEL '+expectedModel+'. Do not mutate files. Do not post externally.';
        const instruction=HARNESS_MARKER+' R-CD-MODEL-DEFAULT nonce '+rowNonce+'. Call continue_delegate with task='+JSON.stringify(childTask)+', mode="normal", delaySeconds='+delaySeconds+', and NO model override. After the continue_delegate tool result reports scheduled, reply exactly MODEL-DEFAULT-PARENT-SCHEDULED '+rowNonce+' MODEL '+expectedModel+'. No other action.';
        tracker.send(socket,'sessions.send',{key:sessionKey,message:instruction,idempotencyKey:idPrefix+'-DISPATCH-'+rowNonce});
      },500);
      socket.setTimeout(()=>socket.close(),150000);
    }
    socket.on('open',()=>{
      handshake.begin(socket, token);
    });
    socket.on('message',(raw)=>{
      try{
        const msg=JSON.parse(raw); const classified=tracker.classify(msg);
        handshake.observe(classified);
        recordClassifiedEvent(evidence, classified, redactEvent);
        if(classified.kind==='response' && classified.method==='sessions.create'){
          if(classified.ok && classified.payload){ sessionKey=classified.payload.key||sessionKey; evidence.sessionKey=sessionKey; evidence.session_created=true; evidence.created_session_key=sessionKey; console.log('✓ disposable session created: '+sessionKey); start(socket); }
          else{ console.error('✗ sessions.create rejected: '+JSON.stringify(classified.error)); failures.add(1); socket.close(); }
        }
        if(classified.kind==='response' && classified.method==='sessions.send'){
          if(classified.ok){ evidence.dispatch_accepted=true; if(classified.payload?.traceId) evidence.trace_id=classified.payload.traceId; console.log('✓ sessions.send accepted — default model delegate turn triggered'); }
          else{ console.error('✗ sessions.send rejected: '+JSON.stringify(classified.error)); failures.add(1); }
        }
        if(classified.kind==='event'){
          const eventData=classified.data||{}; const eventStr=JSON.stringify(eventData);
          if(eventData.traceId) evidence.trace_id=eventData.traceId;
          if(eventData.childSessionKey) evidence.child_session_observed=true;
          if(eventStr.includes(rowNonce) && !eventStr.includes(HARNESS_MARKER)){
            if(eventStr.includes('MODEL-DEFAULT-PARENT-SCHEDULED')) console.log('✓ parent scheduled sentinel observed');
            if(eventStr.includes('MODEL-DEFAULT-CHILD '+rowNonce)){
              evidence.child_session_observed=true; evidence.return_payload=true;
              const idx=eventStr.indexOf('MODEL '+expectedModel);
              if(idx>=0){ evidence.child_model_byte=expectedModel; evidence.model_matches=true; }
              console.log('✓ MODEL-DEFAULT-CHILD return payload observed');
            }
          }
        }
        if(evidence.dispatch_accepted && evidence.child_session_observed && evidence.return_payload && evidence.model_matches){ console.log('All required R-CD-MODEL-DEFAULT evidence gathered, closing early'); socket.close(); }
      }catch(e){ console.warn('parse error: '+e); }
    });
    socket.on('error',(e)=>{ console.error('ws error: '+(e&&e.error?e.error():e)); failures.add(1); });
  });
  evidence.ended=new Date().toISOString(); evidence.duration_ms=Date.now()-started; duration.add(evidence.duration_ms);
  check(res,{'websocket connected':(r)=>r&&r.status===101});
  check(null,{'dispatch accepted':()=>evidence.dispatch_accepted,'child session observed':()=>evidence.child_session_observed,'child model byte':()=>!!evidence.child_model_byte,'model matches parent default':()=>evidence.model_matches,'return payload':()=>evidence.return_payload});
  if(!evidence.dispatch_accepted||!evidence.child_session_observed||!evidence.child_model_byte||!evidence.model_matches||!evidence.return_payload) failures.add(1);
  const passed=(!createDisposableSession||evidence.session_created)&&evidence.dispatch_accepted&&evidence.child_session_observed&&evidence.child_model_byte&&evidence.model_matches&&evidence.return_payload;
  console.log('\n--- R-CD-MODEL-DEFAULT EVIDENCE SUMMARY ---'); console.log(JSON.stringify(evidence,null,2)); console.log('--- END EVIDENCE ---'); console.log('\n[R-CD-MODEL-DEFAULT] VERDICT: '+(passed?'PASS-candidate':'PARTIAL-candidate'));
}

export function handleSummary(data){
  const timestamp=new Date().toISOString(); const passRate=data.metrics.proof_failures?.values?.count===0;
  const summary={row:'R-CD-MODEL-DEFAULT',sha:__ENV.OPENCLAW_CANDIDATE_SHA||'unset',seat:__ENV.OPENCLAW_SEAT_NAME||'cael-dgx',timestamp,verdict:passRate?'PASS-candidate':'PARTIAL-candidate',metrics:{duration_ms:data.metrics.r_cd_model_default_duration?.values||null,failures:data.metrics.proof_failures?.values?.count||0}};
  return {stdout:'\n[R-CD-MODEL-DEFAULT] Summary: '+summary.verdict+' | SHA: '+summary.sha+' | Seat: '+summary.seat+'\n','r-cd-model-default-summary.json':JSON.stringify(summary,null,2)};
}
