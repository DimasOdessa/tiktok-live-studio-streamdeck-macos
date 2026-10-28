/* Unofficial macOS compatibility layer. Tokens stay in memory only. */
(function () {
  "use strict";
  window.ttlsMacAuth = function (port, callback) {
    var completed = false;
    function finish(auth) {
      if (completed) return;
      completed = true;
      callback(auth || {});
    }
    // Use only LIVE Studio's known loopback ports, never an external host.
    if ([28189, 39728, 34246, 42205, 38534, 40825, 40622].indexOf(Number(port)) < 0) {
      finish();
      return;
    }
    try {
      var request = new XMLHttpRequest();
      request.open("GET", "http://127.0.0.1:" + port + "/token", true);
      request.timeout = 1200;
      request.onload = function () {
        try {
          var body = request.status === 200 ? JSON.parse(request.responseText) : null;
          finish(body && typeof body.token === "string" && body.token.length
            ? { token: body.token } : {});
        } catch (_) {
          finish();
        }
      };
      // Older Studio versions use the original WebSocket subprotocol instead.
      // An empty auth object does not bypass an authentication requirement.
      request.onerror = request.ontimeout = request.onabort = function () { finish(); };
      request.send();
    } catch (_) {
      finish();
    }
  };
}());
