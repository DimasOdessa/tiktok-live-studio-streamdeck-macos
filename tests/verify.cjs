/* node tests/verify.cjs [--live]
 * --live permits only join_room/sync_settings against the real local Studio.
 * All action tests run against an in-memory server.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..', 'com.tiktok.livestudio.sdPlugin');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const allowedPorts = [28189,39728,34246,42205,38534,40825,40622];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) {
  for (let i = 0; i < 400; i++) { if (predicate()) return; await delay(20); }
  throw new Error('Timed out waiting for integration');
}
function authTests() {
  for (const scenario of ['token', '403', 'invalid-json', 'timeout', 'error', 'throw']) {
    let calls = 0, result, xhr;
    class XHR {
      constructor() { xhr = this; }
      open(method, url) { assert.equal(method, 'GET'); assert.equal(url, 'http://127.0.0.1:28189/token'); }
      send() {
        if (scenario === 'throw') throw new Error('unavailable');
        if (scenario === 'timeout') return this.ontimeout();
        if (scenario === 'error') return this.onerror();
        this.status = scenario === '403' ? 403 : 200;
        this.responseText = scenario === 'invalid-json' ? '{' : '{"token":"test-token"}';
        this.onload(); this.onerror(); // Completion must be called exactly once.
      }
    }
    const context = { window: {}, XMLHttpRequest: XHR };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'macos-auth.js'), 'utf8'), context);
    context.window.ttlsMacAuth(28189, auth => { calls++; result = JSON.parse(JSON.stringify(auth)); });
    assert.equal(calls, 1);
    assert.deepEqual(result, scenario === 'token' ? {token:'test-token'} : {});
    assert.equal(xhr.timeout, 1200);
    context.window.ttlsMacAuth(80, auth => assert.equal(Object.keys(auth).length, 0));
  }
}
async function integration({ live = false, token = false } = {}) {
  const timers = new Set(), sockets = [], sdMessages = [], actions = [];
  const fixture = {scene:'Test scene',scene_list:[{name:'Test scene',visible_sources:[]}],
    mic_mute:false,audio_mute:false,stream_status:0,recording:false,
    mic_control:{micList:[{id:'test-mic',volume:0.5,isMute:false}]},
    audio_control:{audioList:[]}};
  let sdSocket, tokenRequests = 0, stopping = false;
  class MockSocket {
    constructor(url, protocols) {
      this.url = url; this.readyState = 0; this.listeners = {};
      this.isSD = url === 'ws://127.0.0.1:32100';
      if (this.isSD) sdSocket = this;
      else {
        assert(allowedPorts.includes(Number(new URL(url).port)));
        assert.deepEqual(Array.from(protocols), ['streamdeck_ttls_v1']);
      }
      sockets.push(this);
      queueMicrotask(() => {
        this.readyState = 1; this.emit('open');
        if (!this.isSD) this.message('0'+JSON.stringify({sid:'mock',upgrades:[],pingInterval:25000,pingTimeout:20000,maxPayload:1000000}));
      });
    }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    emit(type, extra={}) {
      const event = {type,...extra};
      this['on'+type]?.(event);
      for (const listener of this.listeners[type] || []) listener(event);
    }
    message(data) { queueMicrotask(() => this.emit('message',{data})); }
    send(data) {
      if (this.isSD) {
        const message = JSON.parse(data); sdMessages.push(message);
        if (message.event === 'getGlobalSettings') this.message(JSON.stringify({event:'didReceiveGlobalSettings',payload:{settings:{}}}));
        return;
      }
      if (data.startsWith('40')) {
        const auth = data.length > 2 ? JSON.parse(data.slice(2)) : {};
        if (token) assert.equal(auth.token, 'test-token');
        this.message('40{"sid":"mock-socket"}');
      } else if (data.startsWith('42')) {
        const [event, payload] = JSON.parse(data.slice(2));
        if (event === 'stream_deck/join_room') this.message('42["stream_deck/join_room"]');
        else if (event === 'stream_deck/sync_settings') this.message('42'+JSON.stringify([event,JSON.stringify(fixture)]));
        else if (event === 'stream_deck/action_emit') {
          const action = JSON.parse(payload); actions.push(action);
          this.message('42'+JSON.stringify(['stream_deck/'+action.context,'{"code":0}']));
        } else assert.equal(event, 'stream_deck/device_status_emit');
      }
    }
    close() { if (this.readyState !== 3) { this.readyState = 3; this.emit('close'); } }
  }
  class ReadOnlySocket extends WebSocket {
    send(data) {
      if (typeof data !== 'string') throw new Error('Unexpected binary write');
      if (data.startsWith('42')) {
        const [event] = JSON.parse(data.slice(2));
        assert(['stream_deck/join_room','stream_deck/sync_settings'].includes(event), 'Blocked non-read-only event');
      } else assert(data.startsWith('40') || data === '3' || data === '41', 'Blocked unexpected packet');
      super.send(data);
    }
  }
  function Transport(url, protocols) {
    if (!live || url === 'ws://127.0.0.1:32100') return new MockSocket(url, protocols);
    assert.equal(new URL(url).hostname, '127.0.0.1');
    assert(allowedPorts.includes(Number(new URL(url).port)));
    const socket = new ReadOnlySocket(url, protocols); sockets.push(socket); return socket;
  }
  class XHR {
    open(method, url) { this.url = url; assert.equal(method,'GET'); }
    send() {
      tokenRequests++;
      if (!live) {
        this.status = token ? 200 : 403; this.responseText = '{"token":"test-token"}';
        queueMicrotask(() => this.onload()); return;
      }
      fetch(this.url, {signal:AbortSignal.timeout(this.timeout)}).then(async response => {
        this.status=response.status; this.responseText=await response.text(); this.onload();
      }).catch(() => this.onerror());
    }
  }
  const context = {
    WebSocket: Transport, XMLHttpRequest: XHR,
    console: {log(){},error(){}},
    setTimeout(fn, ms) {
      if (stopping) return null;
      const id=setTimeout(() => { timers.delete(id); if (!stopping) fn(); },ms);
      timers.add(id);return id;
    },
    clearTimeout(id) { clearTimeout(id);timers.delete(id); },
    TextEncoder,TextDecoder,Blob,ArrayBuffer,Uint8Array,DataView,
  };
  context.window=context;context.self=context;
  vm.createContext(context);
  try {
    for (const file of ['macos-auth.js','plugin.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
    context.connectElgatoStreamDeckSocket('32100','test-plugin','registerPlugin','{}');
    await until(() => sdMessages.some(m => m.event==='setGlobalSettings' && m.payload?.lsStatus==='connected' && m.payload?.lsSettings?.scene_list));
    const settings=sdMessages.findLast(m => m.event==='setGlobalSettings' && m.payload?.lsSettings?.scene_list).payload.lsSettings;
    assert(tokenRequests > 0);
    if (live) {
      console.log('PASS live macOS: real plugin connected; settings received; scene count:',settings.scene_list.length);
      console.log('No action_emit or device_status_emit was allowed to the real Studio.');
      return;
    }
    function event(type, action, payload) {
      sdSocket.message(JSON.stringify({event:type,action:'com.tiktok.livestudio.'+action,context:action+'-context',payload}));
    }
    event('willAppear','scene',{settings:{scene:'Test scene'},controller:'Keypad'});
    await until(() => sdMessages.some(m => m.event==='setState' && m.context==='scene-context' && m.payload.state===1));
    event('keyUp','scene',{settings:{scene:'Test scene'},controller:'Keypad'});
    await until(() => sdMessages.some(m => m.event==='showOk' && m.context==='scene-context'));
    assert.equal(actions[0].payload.settings.scene,'Test scene');
    event('willAppear','miccontrol',{settings:{currentMicId:'test-mic'},controller:'Encoder'});
    await until(() => sdMessages.some(m => m.event==='setFeedback' && m.context==='miccontrol-context'));
    event('dialRotate','miccontrol',{settings:{currentMicId:'test-mic'},controller:'Encoder',ticks:5});
    await until(() => actions.length===2);
    assert.equal(actions[1].payload.mutationValue,0.55);
    console.log('PASS simulated',token?'token auth':'legacy auth',': settings, scene state, key press, microphone dial');
  } finally {
    stopping = true;
    for (const socket of sockets) socket.close();
    for (const timer of timers) clearTimeout(timer);
  }
}
function checkManifest() {
  assert.equal(manifest.UUID, 'com.tiktok.livestudio');
  assert.equal(manifest.OS[0].Platform,'mac');
  assert.equal(manifest.ApplicationsToMonitor.mac[0],'com.tiktok.livestudio.desktop');
  assert.equal(manifest.Actions.length,26);
  const identifiers=new Set();
  for (const action of manifest.Actions) {
    assert.match(action.UUID,/^[a-z0-9.\-]+$/);
    assert(!identifiers.has(action.UUID));identifiers.add(action.UUID);
    for (const image of [action.Icon,...action.States.map(s=>s.Image)]) {
      assert(['.png','.gif','.svg'].some(ext=>fs.existsSync(path.join(root,image+ext))),image);
    }
  }
  for (const file of [manifest.CodePath,manifest.PropertyInspectorPath,'macos-auth.js','plugin.js','pi.js']) assert(fs.existsSync(path.join(root,file)));
  console.log('PASS manifest: 26 unique actions, macOS app monitoring, entry points and image resources');
}
(async()=>{
  checkManifest();authTests();console.log('PASS six authentication error/success cases and loopback port restriction');
  if (process.argv.includes('--live')) await integration({live:true});
  else {await integration();await integration({token:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
