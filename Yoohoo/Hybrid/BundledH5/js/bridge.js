(function (global) {
  var pending = {};
  var seq = 1;
  var listeners = [];

  function post(type, payload) {
    return new Promise(function (resolve) {
      var id = "h5-" + seq++;
      pending[id] = resolve;
      if (global.YoohooNative && global.YoohooNative.post) {
        global.YoohooNative.post({ type: type, id: id, payload: payload || {} });
      } else {
        resolve({ ok: false });
      }
    });
  }

  global.addEventListener("yoohoo-native", function (event) {
    var body = event.data || {};
    if (body.type === "reply") {
      var reply = body.payload || {};
      var replyId = reply.id;
      if (replyId && pending[replyId]) {
        var done = pending[replyId];
        delete pending[replyId];
        done(reply.payload || reply);
        return;
      }
    }
    listeners.forEach(function (fn) { fn(body); });
  });

  global.Bridge = {
    post: post,
    onNative: function (fn) { listeners.push(fn); },
    env: function () { return global.__YOOHOO__ || {}; },
    wait: function (on, block) { return post("wait", { on: !!on, block: block !== false }); },
    toast: function (text) { return post("toast", { text: text }); },
    apple: function () { return post("appleSignIn"); },
    buy: function (productId) { return post("buy", { productId: productId }); },
    pick: function (max, video) { return post("pickMedia", { max: max || 1, video: !!video }); },
    eula: function () { return post("ensureEULA"); },
    eulaText: function () { return post("eulaText"); },
    legal: function (kind) { return post("openLegal", { kind: kind }); },
    setSession: function (accessToken, refreshToken) {
      return post("setSession", { accessToken: accessToken, refreshToken: refreshToken });
    },
    signOut: function () { return post("signOut"); }
  };
})(window);
