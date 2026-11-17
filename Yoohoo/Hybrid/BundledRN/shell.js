(function () {
  function post(type, payload) {
    if (window.YoohooNative && window.YoohooNative.post) {
      window.YoohooNative.post({ type: type, payload: payload || {} });
    }
  }

  window.addEventListener("yoohoo-native", function (event) {
    var body = event.data || {};
    if (body.type === "session" && window.frames[0]) {
      window.frames[0].postMessage(body, "*");
    }
  });

  post("mountH5");
  post("ready");
})();
