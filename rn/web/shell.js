(function () {
  function post(type, payload) {
    if (window.YoohooNative && window.YoohooNative.post) {
      window.YoohooNative.post({ type: type, payload: payload || {} });
    }
  }
  post("mountH5");
  post("ready");
})();
