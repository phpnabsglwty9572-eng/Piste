(function () {
  var state = {
    route: "auth",
    tab: "home",
    postFilter: "popular",
    signedIn: false,
    me: {},
    profiles: {},
    rooms: [],
    posts: [],
    comments: [],
    follows: [],
    blocks: [],
    likes: [],
    roomLikes: [],
    people: [],
    lines: {},
    threads: {},
    sheet: null,
    gift: "",
    live: null,
    post: null,
    chat: null,
    profile: null,
    roomLines: [],
    roomSig: "",
    audience: [],
    liveTime: 0,
    pending: [],
    ai: [],
    aiBy: {},
    aiId: "957ee1b2-1f84-450c-9853-12ad290b1f56",
    form: { email: "", password: "", name: "" },
    composeKind: "image",
    giftPick: "Gift01",
    profileTab: "post",
    framePick: -1,
    shopPick: 0,
    tags: [],
    draft: "",
    reportTarget: "",
    eula: "",
    kb: 0,
    preview: null,
    ready: false
  };

  var AI_ROLES = [
    {
      id: "957ee1b2-1f84-450c-9853-12ad290b1f56",
      name: "Pegu",
      handle: "@pegu.skier",
      avatar: "img/Penguin.png",
      preview: "Did you go skiing this weekend?",
      title: "Glide into winter with Pegu",
      blurb: "Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.",
      prompts: [
        "Did you go skiing this weekend?",
        "Do you usually go skiing alone, or hang out with a group of ski buddies?",
        "Have you ever tried night skiing? I heard the lights on the slope look beautiful."
      ],
      reply: "No. You can rent large items such as skis, ski boots and ski poles at the resort. Only buy personal and safety items like a helmet, goggles and base layers."
    },
    {
      id: "d584bdef-394d-441e-86b0-ab252deb058d",
      name: "Yoohoo",
      handle: "@yoohoo.mascot",
      avatar: "img/AuthLogo.png",
      preview: "Yoohoo!",
      title: "Yoohoo!",
      blurb: "",
      prompts: ["Yoohoo!"],
      reply: "Yoohoo!"
    }
  ];

  function aiRole(id) {
    return AI_ROLES.filter(function (role) { return role.id === id; })[0] || null;
  }

  function aiKey() {
    return "yoohoo.ai." + (API.me() || "local");
  }

  function persistAI() {
    try { localStorage.setItem(aiKey(), JSON.stringify(state.aiBy || {})); } catch (err) {}
  }

  function aiLines(id) {
    if (!state.aiBy) state.aiBy = {};
    if (!state.aiBy[id]) state.aiBy[id] = [];
    return state.aiBy[id];
  }
  var stack = [];
  var busy = false;
  var poller = 0;
  var callStream = null;

  function el(html) {
    var box = document.createElement("div");
    box.innerHTML = html.trim();
    return box.firstChild;
  }
  function esc(v) {
    return String(v || "").replace(/[&<>"]/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch];
    });
  }
  function img(src) {
    if (!src) return "";
    return '<img class="avatar" src="' + esc(src) + '" />';
  }
  function cover(src, cls) {
    return src ? '<img class="' + (cls || "cover") + '" src="' + esc(src) + '" />' : '<div class="' + (cls || "cover") + '"></div>';
  }
  function stamp(raw) {
    if (!raw || raw.indexOf("T") < 0) return "";
    return raw.split("T")[1].slice(0, 5);
  }
  function blocked(id) { return state.blocks.indexOf(id) >= 0; }
  function following(id) {
    id = String(id || "").toLowerCase();
    var me = API.me();
    return state.follows.some(function (row) { return row.follower === me && row.followee === id; });
  }
  function rememberFollow(id, on) {
    var me = API.me();
    id = String(id || "").toLowerCase();
    state.follows = state.follows.filter(function (row) { return !(row.follower === me && row.followee === id); });
    if (on) state.follows.push({ follower: me, followee: id });
  }
  function rememberLike(id, on) {
    id = String(id || "").toLowerCase();
    var index = state.likes.indexOf(id);
    if (on && index < 0) state.likes.push(id);
    if (!on && index >= 0) state.likes.splice(index, 1);
  }
  function roomLikeKey() { return "yoohoo.roomLikes." + (API.me() || "anon"); }
  function loadRoomLikes() {
    try { state.roomLikes = JSON.parse(localStorage.getItem(roomLikeKey()) || "[]"); }
    catch (err) { state.roomLikes = []; }
    if (!Array.isArray(state.roomLikes)) state.roomLikes = [];
    state.roomLikes = state.roomLikes.map(function (id) { return String(id || "").toLowerCase(); });
  }
  function saveRoomLikes() {
    try { localStorage.setItem(roomLikeKey(), JSON.stringify(state.roomLikes)); } catch (err) {}
  }
  function roomLiked(id) { return state.roomLikes.indexOf(String(id || "").toLowerCase()) >= 0; }
  function alreadyThere(err) {
    var msg = (err && err.message) || "";
    return msg.indexOf("duplicate") >= 0 || msg.indexOf("23505") >= 0;
  }

  async function boot() {
    Bridge.onNative(function (body) {
      if (body.type === "session") applyNativeSession(body.payload || {});
      if (body.type === "back") back();
      if (body.type === "keyboard") {
        state.kb = Number((body.payload && body.payload.height) || 0);
        document.documentElement.style.setProperty("--kb", state.kb + "px");
      }
    });
    var env = Bridge.env();
    if (env.accessToken) API.setTokens(env.accessToken, env.refreshToken, "");
    document.getElementById("app").addEventListener("click", onClick);
    bindChatSwipe();
    document.getElementById("app").addEventListener("submit", onSubmit);
    document.getElementById("app").addEventListener("contextmenu", onHold);
    document.getElementById("app").addEventListener("input", onFormInput);
    document.getElementById("app").addEventListener("error", function (event) {
      var img = event.target;
      if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-fallback")) return;
      var fallback = img.getAttribute("data-fallback");
      if (!fallback || img.getAttribute("src") === fallback) {
        if (!fallback) img.remove();
        return;
      }
      img.src = fallback;
    }, true);
    document.getElementById("app").dataset.ready = "1";
    var start = env.startRoute || (location.hash || "").replace(/^#/, "");
    if (start === "posts") { state.tab = "post"; state.postFilter = "popular"; go("main"); }
    else if (start === "posts-followed") { state.tab = "post"; state.postFilter = "followed"; go("main"); }
    else if (start === "chats") { state.tab = "chat"; go("main"); }
    else if (start === "live") { go("live"); }
    else if (start === "gift") { go("live"); state.sheet = "gift"; draw(); }
    else if (start === "followed") { go("people", { peopleKind: "follow" }); }
    else if (start === "fans") { go("people", { peopleKind: "fans" }); }
    else if (start === "block") { go("people", { peopleKind: "block" }); }
    else if (start === "feedback") { go("settings"); state.sheet = "feedback"; draw(); }
    else if (start === "logout") { go("settings"); state.sheet = "logout"; draw(); }
    else if (start === "erase") { go("settings"); state.sheet = "erase"; draw(); }
    else if (start === "about") { go("live"); state.sheet = "about"; draw(); }
    else if (start === "audience") { go("live"); state.sheet = "audience"; draw(); }
    else if (start === "report") { go("live"); state.sheet = "report"; draw(); }
    else if (start === "tag") { go("compose"); state.sheet = "tag"; draw(); }
    else if (start === "giftfx") { go("live"); state.gift = "Gift01"; draw(); }
    else if (start === "about-post") { go("post"); state.aboutKind = "post"; state.sheet = "about"; draw(); }
    else if (start === "about-chat") { go("chat"); state.aboutKind = "chat"; state.sheet = "about"; draw(); }
    else if (start === "video") { go("compose"); state.composeKind = "video"; draw(); }
    else if (start === "delete-post") { go("post"); state.sheet = "delete-post"; draw(); }
    else if (start === "delete-chat") { go("chat"); state.sheet = "delete-chat"; draw(); }
    else if (start === "live-block") { go("live"); state.sheet = "blacklist"; draw(); }
    else if (env.accessToken && start !== "auth" && start !== "signin" && start !== "register" && start !== "register2") {
      go("main");
    } else if (start) {
      go(start);
    } else {
      state.route = "boot";
      draw();
    }
    Bridge.post("ready");
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { Bridge.post("settled"); });
      });
    }
    window.__settle = settle;
    var keepAuth = ["auth", "signin", "register", "register2"].indexOf(start) >= 0;
    if (env.accessToken) {
      try {
        await reload();
        if (["posts","posts-followed","chats","live","gift","post","compose","chat","profile","settings","shop","followed","fans","block","edit","feedback","logout","erase","about","audience","report","tag","ai","call","giftfx","about-post","about-chat","video","delete-post","delete-chat","live-block","register2","other","detail"].indexOf(start) >= 0) window.goTo(start);
        else if (!keepAuth) go("main");
      } catch (err) { if (!keepAuth) go("auth"); }
      settle();
    } else if (state.route === "boot") {
      state.holdSplash = true;
      setTimeout(function () {
        if (!state.holdSplash) return;
        state.holdSplash = false;
        if (state.route === "boot") go("auth");
        settle();
      }, 700);
    } else {
      settle();
    }
  }

  function applyNativeSession(payload) {
    if (payload.accessToken) API.setTokens(payload.accessToken, payload.refreshToken, payload.meID);
    state.signedIn = !!payload.signedIn;
    state.holdSplash = false;
    if (state.route === "boot") {
      var start = (Bridge.env().startRoute || "");
      var keepAuth = ["auth", "signin", "register", "register2"].indexOf(start) >= 0;
      if (payload.signedIn && !keepAuth) {
        stack = [];
        reload().then(function () {
          go("main");
          if (window.__settle) window.__settle();
        }).catch(function () {
          go("auth");
          if (window.__settle) window.__settle();
        });
      } else {
        go(keepAuth ? start : "auth");
        if (window.__settle) window.__settle();
      }
      return;
    }
    state.me.name = payload.meName || state.me.name;
    state.me.gems = payload.coins || 0;
    var pinned = (Bridge.env().startRoute || "");
    var keepAuth = ["auth", "signin", "register", "register2"].indexOf(pinned) >= 0;
    var onAuth = state.route === "auth" || state.route === "signin" || state.route === "register" || state.route === "register2";
    if (payload.signedIn && !keepAuth && onAuth) {
      reload().then(function () { stack = []; go("main"); }).catch(function () {});
    } else if (payload.signedIn && !state.ready && !onAuth) {
      reload().then(function () { if (pinned) window.goTo(pinned); }).catch(function () {});
    }
    if (payload.signedIn === false && state.route !== "auth" && state.route !== "signin" && state.route !== "register" && state.route !== "register2") {
      stack = [];
      go("auth");
    }
  }

  async function reload() {
    try {
      await loadFeed();
    } finally {
      state.ready = true;
      applyRemembered();
      draw();
    }
  }

  async function loadFeed() {
    var profiles = await API.profiles();
    var map = {};
    profiles.forEach(function (row) {
      row.id = String(row.id || "").toLowerCase();
      map[row.id] = row;
    });
    AI_ROLES.forEach(function (role) {
      var row = map[role.id] || { id: role.id, name: role.name, handle: role.handle.replace(/^@/, ""), gems: 0 };
      if (!row.avatar_url) row.avatar_url = role.avatar;
      if (!row.name) row.name = role.name;
      if (!row.handle) row.handle = role.handle.replace(/^@/, "");
      map[role.id] = row;
    });
    var ids = Object.keys(map);
    state.profiles = map;
    state.me = map[API.me()] || state.me;
    loadRoomLikes();
    if (API.me() && map[API.me()]) {
      API.setTokens(API.tokens().access, API.tokens().refresh, API.me());
    } else if (profiles.length && !API.me()) {
      var mine = profiles[0];
      state.me = mine;
    }
    var me = API.me();
    var posts = await API.posts(ids);
    var rooms = await API.rooms(ids);
    var comments = await API.comments(posts.map(function (p) { return p.id; }));
    state.follows = (await API.follows() || []).map(function (row) {
      row.follower = String(row.follower || "").toLowerCase();
      row.followee = String(row.followee || "").toLowerCase();
      return row;
    });
    state.blocks = (await API.blocks()).map(function (row) { return row.blocked; });
    state.likes = (await API.likes()).map(function (row) { return row.post_id; });
    var threads = await API.threads();
    var hidden = (await API.hides()).map(function (row) { return String(row.thread_id || "").toLowerCase(); });
    threads = threads.filter(function (row) { return hidden.indexOf(String(row.id || "").toLowerCase()) < 0; });
    var messages = await API.messages(threads.map(function (row) { return row.id; }));
    function lower(row, key) { if (row[key]) row[key] = String(row[key]).toLowerCase(); }
    posts.forEach(function (row) { lower(row, "author_id"); lower(row, "id"); });
    rooms.forEach(function (row) { lower(row, "owner_id"); lower(row, "id"); });
    comments.forEach(function (row) { lower(row, "author_id"); lower(row, "id"); lower(row, "post_id"); });
    threads.forEach(function (row) { lower(row, "id"); lower(row, "user_low"); lower(row, "user_high"); });
    messages.forEach(function (row) { lower(row, "thread_id"); lower(row, "sender_id"); });
    state.blocks = state.blocks.map(function (id) { return String(id).toLowerCase(); });
    state.likes = state.likes.map(function (id) { return String(id).toLowerCase(); });
    state.posts = posts.filter(function (row) { return !blocked(row.author_id); });
    state.rooms = rooms.filter(function (row) { return !blocked(row.owner_id); });
    ensureCatalog();
    state.comments = comments.filter(function (row) { return !blocked(row.author_id); });
    state.threads = {};
    state.people = [];
    state.lines = {};
    if (me) {
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem("yoohoo.ai." + me) || "{}"); } catch (err) { saved = {}; }
      var server = [];
      try {
        server = (await API.aiLines() || []).map(function (row) { return { mine: row.mine, body: row.body }; });
      } catch (err) { server = []; }
      state.aiBy = {};
      AI_ROLES.forEach(function (role, index) {
        var legacy = index === 0 ? "ai:pegu" : "ai:yoohoo";
        state.aiBy[role.id] = saved[role.id] || saved[legacy] || (index === 0 ? server : []);
      });
      persistAI();
      if (state.aiId) state.ai = aiLines(state.aiId);
    }
    threads.forEach(function (thread) {
      var other = thread.user_low === me ? thread.user_high : thread.user_low;
      if (blocked(other) || !map[other]) return;
      state.threads[other] = thread.id;
      var rows = messages.filter(function (item) { return item.thread_id === thread.id; });
      state.lines[other] = rows;
      var last = rows[rows.length - 1];
      state.people.push({
        id: other,
        name: map[other].name,
        avatar: map[other].avatar_url,
        preview: last ? last.body : "",
        time: stamp(last && last.created_at)
      });
    });
    applyPending();
  }

  window.goTo = function (route) {
    if (route === "posts") { state.tab = "post"; state.postFilter = "popular"; go("main"); }
    else if (route === "posts-followed") { state.tab = "post"; state.postFilter = "followed"; go("main"); }
    else if (route === "chats") { state.tab = "chat"; go("main"); }
    else if (route === "gift") { go("live"); state.sheet = "gift"; draw(); }
    else if (route === "followed") { go("people", { peopleKind: "follow" }); }
    else if (route === "fans") { go("people", { peopleKind: "fans" }); }
    else if (route === "block") { go("people", { peopleKind: "block" }); }
    else if (route === "feedback") { go("settings"); state.sheet = "feedback"; draw(); }
    else if (route === "logout") { go("settings"); state.sheet = "logout"; draw(); }
    else if (route === "erase") { go("settings"); state.sheet = "erase"; draw(); }
    else if (route === "about") { go("live"); state.sheet = "about"; draw(); }
    else if (route === "audience") { go("live"); state.sheet = "audience"; draw(); }
    else if (route === "report") { go("live"); state.sheet = "report"; draw(); }
    else if (route === "tag") { go("compose"); state.sheet = "tag"; draw(); }
    else if (route === "giftfx") { go("live"); state.gift = "Gift01"; draw(); }
    else if (route === "about-post") { go("post"); state.aboutKind = "post"; state.sheet = "about"; draw(); }
    else if (route === "about-chat") { go("chat"); state.aboutKind = "chat"; state.sheet = "about"; draw(); }
    else if (route === "video") { go("compose"); state.composeKind = "video"; draw(); }
    else if (route === "delete-post") { go("post"); state.sheet = "delete-post"; draw(); }
    else if (route === "delete-chat") { go("chat"); state.sheet = "delete-chat"; draw(); }
    else if (route === "live-block") { go("live"); state.sheet = "blacklist"; draw(); }
    else if (route === "home") { state.tab = "home"; go("main"); }
    else if (route === "home-about") { state.tab = "home"; go("main"); state.sheet = "logout"; draw(); }
    else if (route === "other") {
      var otherId = Object.keys(state.profiles).filter(function (key) { return key && key !== API.me(); })[0];
      if (otherId) go("profile", { profile: otherId });
    }
    else if (route === "detail") {
      if (state.posts[0]) go("post", { post: state.posts[0].id });
    }
  };
  function snap() {
    return {
      route: state.route,
      tab: state.tab,
      live: state.live,
      post: state.post,
      chat: state.chat,
      profile: state.profile,
      peopleKind: state.peopleKind,
      composeKind: state.composeKind,
      profileTab: state.profileTab,
      postFilter: state.postFilter,
      aboutKind: state.aboutKind,
      aboutId: state.aboutId
    };
  }

  var motion = "replace";
  function go(route, extra) {
    var from = state.route;
    var fromAuth = ["auth", "signin", "register", "register2"].indexOf(state.route) >= 0;
    var toAuth = ["auth", "signin", "register", "register2"].indexOf(route) >= 0;
    if (route === "auth" || (route === "main" && fromAuth)) stack = [];
    else if (state.route !== route || extra) {
      if (!(state.route === "main" && route === "main") && !toAuth) stack.push(snap());
    }
    if (state.route === "call" && route !== "call") {
      Bridge.ring(false);
      stopCamera();
    }
    state.route = route;
    state.sheet = null;
    state.preview = null;
    if (extra) Object.keys(extra).forEach(function (key) { state[key] = extra[key]; });
    if (route === "call") Bridge.ring(true);
    if (from === "boot" || from === route) motion = extra && from === route ? "push" : "replace";
    else if (toAuth || fromAuth) motion = "fade";
    else motion = "push";
    draw();
  }

  function back() {
    var active = document.activeElement;
    if (active && active.blur) active.blur();
    if (state.preview) { state.preview = null; motion = "fade"; draw(); return; }
    if (state.sheet) { closeSheet(); return; }
    if (state.route === "call") { Bridge.ring(false); stopCamera(); }
    if (stack.length) {
      var prev = stack.pop();
      Object.keys(prev).forEach(function (key) { state[key] = prev[key]; });
      state.sheet = null;
      state.preview = null;
      motion = "pop";
      draw();
      return;
    }
    if (state.route !== "main" && state.route !== "auth") {
      state.route = API.me() ? "main" : "auth";
      motion = "pop";
      draw();
    }
  }

  function closeSheet() {
    var layer = document.querySelector(".sheet-layer");
    if (!layer || layer.getAttribute("data-closing") === "1") {
      state.sheet = null;
      motion = "replace";
      draw();
      return;
    }
    layer.setAttribute("data-closing", "1");
    var card = layer.querySelector(".snow-sheet, .gift-shop");
    var dim = layer.querySelector(".dim");
    if (card) {
      card.style.animation = "none";
      card.style.transition = "transform .28s cubic-bezier(0.32, 0.72, 0, 1)";
      card.style.transform = "translateY(110%)";
    }
    if (dim) {
      dim.style.transition = "opacity .28s ease";
      dim.style.opacity = "0";
    }
    setTimeout(function () {
      state.sheet = null;
      motion = "replace";
      draw();
    }, 270);
  }

  function needAuth() {
    if (API.me()) return true;
    go("signin");
    return false;
  }

  function pageView() {
    if (state.route === "boot") return el('<div class="auth"></div>');
    if (state.route === "auth") return authView();
    if (state.route === "register" || state.route === "signin") return formView();
    if (state.route === "register2") return registerPhotosView();
    if (state.route === "eula") return eulaView();
    if (state.route === "live") return liveView();
    if (state.route === "post") return postView();
    if (state.route === "compose") return composeView();
    if (state.route === "chat") return chatView();
    if (state.route === "ai") return aiView();
    if (state.route === "profile") return profileView();
    if (state.route === "settings") return settingsView();
    if (state.route === "shop") return shopView();
    if (state.route === "edit") return editView();
    if (state.route === "call") return callView();
    if (state.route === "people") return peopleView();
    return mainView();
  }

  function adoptStage(next) {
    var fresh = next.querySelector(".stage-stack");
    var kept = document.querySelector(".stage-stack");
    if (!fresh || !kept || kept === fresh) return;
    if (kept.getAttribute("data-clip") !== fresh.getAttribute("data-clip")) return;
    fresh.replaceWith(kept);
  }

  function draw() {
    var root = document.getElementById("app");
    var kind = motion || "replace";
    motion = "replace";
    document.documentElement.style.setProperty("--kb", (state.kb || 0) + "px");
    var previous = root.querySelector(":scope > .page");
    var hadSheet = !!root.querySelector(":scope > .sheet-layer");
    var keptScroll = 0;
    if (previous && kind === "replace") {
      var oldScroll = previous.querySelector('.tab-pane[data-pane="' + state.tab + '"] .scroll') || previous.querySelector(".scroll");
      if (oldScroll) keptScroll = oldScroll.scrollTop;
    }
    var next = pageView();
    next.classList.add("page");
    if (!previous || kind === "replace") {
      if (previous && state.route === "live") {
        root.appendChild(next);
        adoptStage(next);
        previous.remove();
      } else root.replaceChildren(next);
    } else {
      if (kind === "pop") {
        next.classList.add("motion", "back");
        previous.classList.add("motion", "pop");
        root.insertBefore(next, previous);
      } else if (kind === "fade") {
        next.classList.add("motion", "fade");
        root.appendChild(next);
      } else if (kind === "tab-next" || kind === "tab-prev") {
        next.classList.add("motion", kind === "tab-next" ? "tab-in" : "tab-in-left");
        previous.classList.add("motion", kind === "tab-next" ? "tab-out" : "tab-out-right");
        root.appendChild(next);
      } else {
        next.classList.add("motion", "push");
        previous.classList.add("motion", "under");
        root.appendChild(next);
      }
      var finished = false;
      function finish(event) {
        if (finished) return;
        if (event && event.target !== next && kind !== "pop") return;
        if (event && kind === "pop" && event.target !== previous) return;
        finished = true;
        if (previous.parentNode) previous.remove();
        next.classList.remove("motion", "push", "back", "fade", "tab-in", "tab-in-left");
      }
      var animated = kind === "pop" ? previous : next;
      animated.addEventListener("animationend", finish);
      setTimeout(function () { finish(); }, 460);
    }
    if (keptScroll) {
      var scroller = next.querySelector('.tab-pane[data-pane="' + state.tab + '"] .scroll') || next.querySelector(".scroll");
      if (scroller) scroller.scrollTop = keptScroll;
    }
    var shopFrame = next.querySelector(".shop-frame");
    var shopOn = next.querySelector(".pack.on");
    if (shopFrame && shopOn) {
      shopFrame.style.transition = "none";
      shopFrame.style.transform = "translate(" + shopOn.offsetLeft + "px," + shopOn.offsetTop + "px)";
      shopFrame.getBoundingClientRect();
      shopFrame.style.transition = "";
    }
    root.querySelectorAll(":scope > .sheet-layer, :scope > .preview").forEach(function (node) { node.remove(); });
    if (state.sheet) {
      var layer = sheetView();
      if (!hadSheet) layer.classList.add("presenting");
      root.appendChild(layer);
      bindSheetDrag(layer);
      if (!hadSheet) setTimeout(function () { layer.classList.remove("presenting"); }, 460);
    }
    if (state.preview) {
      root.appendChild(el(
        '<div class="preview" data-act="close-preview">' +
          (state.previewVideo
            ? '<video src="' + esc(state.preview) + '" autoplay playsinline controls></video>'
            : '<img src="' + esc(state.preview) + '" alt="" />') +
        "</div>"
      ));
    }
    startPoll();
    if (state.route === "call") startCamera();
    if (state.route === "live") startLive();
    var thread = document.querySelector(".chat-thread");
    var liveBox = document.querySelector(".live-chat");
    if (thread) thread.scrollTop = thread.scrollHeight;
    if (liveBox) liveBox.scrollTop = liveBox.scrollHeight;
  }

  function bindSheetDrag(layer) {
    var card = layer.querySelector(".snow-sheet, .gift-shop");
    if (!card) return;
    var startY = 0;
    var dy = 0;
    var tracking = false;
    layer.addEventListener("touchstart", function (event) {
      if (!event.touches[0] || !card.contains(event.target)) return;
      startY = event.touches[0].clientY;
      dy = 0;
      tracking = true;
      card.style.transition = "none";
    }, { passive: true });
    layer.addEventListener("touchmove", function (event) {
      if (!tracking || !event.touches[0]) return;
      dy = Math.max(0, event.touches[0].clientY - startY);
      card.style.transform = "translateY(" + dy + "px)";
      var dim = layer.querySelector(".dim");
      if (dim) dim.style.opacity = String(Math.max(0.2, 1 - dy / 320));
    }, { passive: true });
    layer.addEventListener("touchend", function () {
      if (!tracking) return;
      tracking = false;
      if (dy > 88) closeSheet();
      else {
        card.style.transition = "transform .32s cubic-bezier(0.32, 0.72, 0, 1)";
        card.style.transform = "";
        var dim = layer.querySelector(".dim");
        if (dim) { dim.style.transition = "opacity .32s ease"; dim.style.opacity = ""; }
      }
    });
  }

  function authView() {
    return el(
      '<div class="auth">' +
        '<img class="auth-sky" src="img/AuthSky.png" alt="" />' +
        '<div class="auth-ui">' +
          '<img class="auth-logo" src="img/AuthLogo.png" alt="" />' +
          '<button class="auth-apple" data-act="apple">' +
            '<img class="bg" src="img/ButtonBlue.svg" alt="" />' +
            '<span class="label"><img src="img/AppleGlyph.svg" alt="" />Sign In With Apple</span>' +
          "</button>" +
          '<button class="auth-outline create" data-act="go" data-to="register">Create Account</button>' +
          '<button class="auth-outline signin" data-act="go" data-to="signin">Sign In</button>' +
          '<div class="auth-legal">By signing up, you agree to the ' +
            '<button data-act="legal" data-id="terms">User Agreement</button> &amp; ' +
            '<button data-act="legal" data-id="privacy">Privacy Policy</button>.</div>' +
        "</div></div>"
    );
  }

  function formChrome(title, back) {
    return '<div class="form-head auth-head">' +
      '<img class="form-sky" src="img/FormSky.png" alt="" />' +
      '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
      '<img class="form-sled" src="img/SledMark.png" alt="" />' +
      '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
      '<div class="form-title">' + title + "</div></div>";
  }

  function formView() {
    var register = state.route === "register";
    return el(
      '<div class="form-page">' +
        formChrome(register ? "Create Account" : "Sign In", "auth") +
        '<form class="form-fields" data-form="' + state.route + '">' +
          fieldBlock("Email", "email", "Your Email", "email") +
          fieldBlock("Password", "password", "Your Password", "password") +
          (register ? fieldBlock("Name", "name", "Your name", "text") : "") +
          '<div class="form-foot"><button class="snow-btn" type="submit">' +
            '<img src="img/ButtonGray.svg" alt="" /><span>' + (register ? "Next" : "Sign In") + "</span></button></div>" +
        "</form></div>"
    );
  }

  function registerPhotosView() {
    var face = state.avatarPick ? '<img src="' + esc(state.avatarPick) + '" alt="" />' : '<img class="cloud" src="img/UploadCloud.svg" alt="" />';
    var cover = state.coverPick
      ? '<img class="photo" src="' + esc(state.coverPick) + '" alt="" />'
      : '<img class="cloud" src="img/UploadCloud.svg" alt="" /><span>Upload Photo</span>';
    return el(
      '<div class="form-page">' +
        formChrome("Create Account", "register") +
        '<form class="form-fields" data-form="register2">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Avatar</div>' +
          '<button class="upload-avatar" type="button" data-act="pick-avatar">' + face + "</button>" +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Background</div>' +
          '<button class="upload-cover" type="button" data-act="pick-cover">' + cover + "</button>" +
          '<div class="form-foot"><button class="snow-btn" type="submit">' +
            '<img src="img/' + (state.avatarPick || state.coverPick ? "ButtonBlue.svg" : "ButtonGray.svg") + '" alt="" /><span>Create</span></button></div>' +
        "</form></div>"
    );
  }

  function fieldBlock(title, name, prompt, type) {
    var extra = name === "name" ? ' maxlength="' + (Bridge.env().nameLimit || 24) + '"' : "";
    return '<div class="form-label"><img src="img/FieldBell.png" alt="" />' + title + "</div>" +
      '<input class="form-input" name="' + name + '" type="' + type + '" placeholder="' + prompt + '"' + extra + " />";
  }

  function eulaView() {
    return el(
      '<div class="screen"><div class="header title">USER AGREEMENT</div>' +
        '<div class="scroll pad"><pre style="white-space:pre-wrap">' + esc(state.eula) + "</pre></div>" +
        '<div class="pad"><button class="btn wide" data-act="agree">Agree</button></div></div>'
    );
  }

  function mainView() {
    var idx = { home: 0, post: 1, chat: 2 }[state.tab] || 0;
    var shift = (-idx * 100 / 3) + "%";
    return el(
      '<div class="screen main-shell">' +
        '<div class="tab-stage"><div class="tab-track" style="transform:translate3d(' + shift + ',0,0)">' +
          '<div class="tab-pane" data-pane="home">' + homeList() + "</div>" +
          '<div class="tab-pane" data-pane="post">' + postList() + "</div>" +
          '<div class="tab-pane" data-pane="chat">' + chatList() + "</div>" +
        "</div></div>" +
        '<div class="tabs">' +
          tabBtn("home", "home", "TabHome.png", "TabHomeOff.png") +
          tabBtn("post", "post", "TabPostOn.png", "TabPost.png") +
          tabBtn("chat", "chat", "TabChatOn.png", "TabChat.png") +
          '<img class="tab-snow" src="img/TabSnow.png" alt="" />' +
        "</div></div>"
    );
  }
  function tabBtn(id, label, on, off) {
    var selected = state.tab === id;
    return '<button class="tab' + (selected ? " on" : "") + '" data-act="tab" data-id="' + id + '" data-on="' + on + '" data-off="' + off + '">' +
      '<span class="icon"><img src="img/' + (selected ? on : off) + '" alt="" /></span>' + label + "</button>";
  }
  function slideTabs(animate) {
    var track = document.querySelector(".tab-track");
    if (!track) return false;
    var idx = { home: 0, post: 1, chat: 2 }[state.tab] || 0;
    track.style.transition = animate ? "transform .34s cubic-bezier(0.32, 0.72, 0, 1)" : "none";
    track.style.transform = "translate3d(" + (-idx * 100 / 3) + "%,0,0)";
    document.querySelectorAll(".tabs .tab").forEach(function (btn) {
      var on = btn.getAttribute("data-id") === state.tab;
      btn.classList.toggle("on", on);
      var img = btn.querySelector("img");
      if (img) img.src = "img/" + btn.getAttribute(on ? "data-on" : "data-off");
    });
    return true;
  }

  function homeList() {
    var me = state.profiles[API.me()] || state.me || {};
    var face = me.avatar_url || fileURL(API.me(), "avatar.jpg") || "img/AIUserFace.png";
    var cards = state.rooms.map(homeCard).join("");
    var empty = emptyPen();
    return '<div class="scroll">' +
      '<div class="home-head">' +
        '<img class="home-sky" src="img/HomeSky.png" alt="" />' +
        '<img class="home-cap" src="img/SnowCap.png" alt="" />' +
        '<img class="home-edge" src="img/SnowHem.png" alt="" />' +
        '<div class="home-marks">' +
          '<img class="home-flake-a" src="img/FlakeA.png" alt="" />' +
          '<img class="home-flake-b" src="img/FlakeB.png" alt="" />' +
          '<img class="home-flake-c" src="img/FlakeA.png" alt="" />' +
          '<button class="home-title" data-act="go" data-to="ai">Glide into winter with Pegu</button>' +
          '<button class="home-blurb" data-act="go" data-to="ai">Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.</button>' +
          '<button class="home-penguin" data-act="go" data-to="ai"><img src="img/Penguin.png" alt="" style="width:150px;height:140px;object-fit:cover" /></button>' +
          '<button class="home-avatar" data-act="go" data-to="profile">' +
            '<img class="face" src="' + esc(face) + '" alt="" data-fallback="img/AIUserFace.png" />' +
            '<img class="frame" src="img/AvatarFrame.png" alt="" />' +
            '<img class="edit" src="img/EditBadge.svg" alt="" />' +
          "</button>" +
        "</div></div>" +
      '<div class="home-feed">' + (cards || empty) + "</div></div>";
  }

  function homeCard(room) {
    var user = state.profiles[room.owner_id] || {};
    var photo = room.cover_url || "img/LiveStage.png";
    var followed = following(room.owner_id);
    var loved = roomLiked(room.id);
    var split = splitTags(room.title || "");
    return '<article class="live-card">' +
      '<div class="live-photo">' +
        '<img class="stage" src="' + esc(photo) + '" alt="" />' +
        '<div class="live-badge"><img src="img/LiveGlyph.svg" alt="" />Live</div>' +
        '<button class="play" data-act="live" data-id="' + room.id + '"><img src="img/PlayButton.svg" alt="" /></button>' +
        '<div class="live-bar">' +
          '<div class="author">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/AIUserFace.png") + '" alt="" data-act="profile" data-id="' + room.owner_id + '" />' +
            '<div class="meta"><div class="nm">' + esc(user.name || "") + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (followed ? "" : '<button class="plus" data-act="follow" data-id="' + room.owner_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" +
          '<button class="icon34" data-act="like-room" data-id="' + room.id + '"><img src="img/' + (loved ? "LikeOnGlyph.svg" : "LikeGlyph.svg") + '" alt="" /></button>' +
          '<button class="icon34" data-act="about-person" data-id="' + room.owner_id + '"><img src="img/MoreGlyph.svg" alt="" /></button>' +
        "</div></div>" +
      '<div class="caption">' + esc(split.caption) + "</div>" +
      '<div class="tags">' + split.tags.map(function (tag) { return '<span class="tag">' + esc(tag) + "</span>"; }).join("") + "</div>" +
      "</article>";
  }

  function fileURL(id, name) {
    var root = (Bridge.env().supabaseURL || "").replace(/\/$/, "");
    if (!root || !id) return "";
    return root + "/storage/v1/object/public/media/" + id + "/" + name + "?v=" + Math.floor(Date.now() / 60000);
  }

  function mediaKey(kind, id) { return "yoohoo." + kind + "." + id; }

  function remembered(kind, id) {
    if (!id) return "";
    try { return localStorage.getItem(mediaKey(kind, id)) || ""; } catch (err) { return ""; }
  }

  function rememberMedia(kind, url) {
    var id = API.me();
    if (!id || !url) return url || "";
    var fresh = String(url).split("?")[0] + "?v=" + Date.now();
    try { localStorage.setItem(mediaKey(kind, id), fresh); } catch (err) {}
    return fresh;
  }

  function applyRemembered() {
    var id = API.me();
    var row = id && state.profiles[id];
    if (!row) return;
    var avatar = remembered("avatar", id);
    var cover = remembered("cover", id);
    if (!row.avatar_url && avatar) row.avatar_url = avatar;
    if (!row.cover_url && cover) row.cover_url = cover;
    state.me = row;
  }

  function plainError(text) {
    var raw = String(text || "");
    try {
      var body = JSON.parse(raw);
      return body.message || body.error || "Could not upload the photo.";
    } catch (err) {
      return raw || "Could not upload the photo.";
    }
  }

  async function uploadPick(item, path) {
    if (item && item.id) {
      var sent = await Bridge.upload(item.id, path);
      if (!sent || sent.ok === false) throw new Error(plainError(sent && sent.message));
      if (!sent.url) throw new Error("Could not upload the photo.");
      return sent.url;
    }
    var uri = (item && item.uri) || (typeof item === "string" ? item : "");
    if (!uri) throw new Error("Choose a photo again.");
    return API.upload(path, uri, (item && item.mime) || "image/jpeg");
  }

  function pickedItems(payload) {
    if (!payload) return [];
    if (payload.items) return payload.items;
    if (payload.payload && payload.payload.items) return payload.payload.items;
    return [];
  }

  function pickedURI(payload) {
    return (pickedItems(payload)[0] || {}).uri || "";
  }

  function splitTags(body) {
    var tags = [];
    var words = [];
    String(body || "").split(/\s+/).forEach(function (piece) {
      if (piece.charAt(0) === "#" && piece.length > 1) {
        if (tags.indexOf(piece) < 0) tags.push(piece);
      } else if (piece) words.push(piece);
    });
    return { caption: words.join(" "), tags: tags };
  }

  function emptyPen(size) {
    var note = state.ready
      ? '<span class="msg">No data</span>'
      : '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    return '<div class="empty-pen' + (size ? " " + size : "") + '"><img class="pen" src="img/Penguin.png" alt="" />' + note + "</div>";
  }

  function snowPill(kind, act, id, label) {
    return '<button class="pill ' + kind + '" type="button" data-act="' + act + '" data-id="' + id + '">' +
      '<img class="hem" src="img/PillHem.svg" alt="" />' +
      '<img class="cap left" src="img/PillCapLeft.svg" alt="" />' +
      '<img class="cap right" src="img/PillCapRight.svg" alt="" />' +
      '<img class="flake" src="img/SnowmanBody.svg" alt="" />' +
      "<span>" + label + "</span>" +
      '<img class="man" src="img/PillSnowman.svg" alt="" /></button>';
  }

  function postList() {
    var mine = API.me();
    var rows = state.posts;
    if (state.postFilter === "followed") {
      rows = rows.filter(function (post) { return following(post.author_id) || post.author_id === mine; });
    }
    var cards = rows.map(postCard).join("");
    var empty = emptyPen();
    return '<div class="feed-page">' +
      '<div class="feed-head">' +
        '<img class="form-sky" src="img/FormSky.png" alt="" />' +
        '<button class="form-back" data-act="tab" data-id="home"><img src="img/BackButton.svg" alt="" /></button>' +
        '<div class="form-title">Post</div>' +
        '<button class="post-chip" data-act="go" data-to="compose"><img class="badge" src="img/PostBadge.png" alt="" /><span>POST</span><img class="pen" src="img/Pencil.svg" alt="" /></button>' +
        '<div class="post-pills">' +
          snowPill("pink" + (state.postFilter === "popular" ? " on" : ""), "post-filter", "popular", "Popular") +
          snowPill("gray" + (state.postFilter === "followed" ? " on" : ""), "post-filter", "followed", "Followed") +
        "</div>" +
        '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
        '<img class="form-sled" src="img/SledMark.png" alt="" />' +
      "</div>" +
      '<div class="scroll home-feed">' + (cards || empty) + "</div></div>";
  }

  function postCard(post) {
    var user = state.profiles[post.author_id] || {};
    var photos = post.media_urls || (post.media_url ? [post.media_url] : []);
    var photo = photos[0] || "img/LiveStage.png";
    var followed = following(post.author_id);
    var split = splitTags(post.body || "");
    var liked = state.likes.indexOf(String(post.id).toLowerCase()) >= 0;
    var onDetail = state.route === "post";
    var poster = String(photo).replace(/\.mp4(\?.*)?$/, ".png$1");
    var stage = post.is_video && onDetail
      ? '<video class="stage" src="' + esc(photo) + '" autoplay muted loop playsinline data-act="preview" data-id="' + post.id + '"></video>'
      : (post.is_video
        ? '<video class="stage" src="' + esc(photo) + '" muted playsinline preload="metadata" poster="' + esc(poster) + '" data-act="open-post" data-id="' + post.id + '"></video>'
        : '<img class="stage' + (photo.indexOf("http") === 0 ? " shine" : "") + '" src="' + esc(photo) + '" alt="" data-act="preview" data-id="' + post.id + '" onload="this.classList.remove(\'shine\')" />');
    return '<article class="live-card post-card">' +
      '<div class="live-photo tall">' +
        stage +
        (post.is_video ? '<button class="play" data-act="play-video" data-id="' + post.id + '"><img src="img/PlayButton.svg" alt="" /></button>' : "") +
        '<div class="live-bar">' +
          '<div class="author">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + post.author_id + '" />' +
            '<div class="meta"><div class="nm">' + esc(user.name || "") + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (followed ? "" : '<button class="plus" data-act="follow" data-id="' + post.author_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" +
          '<button class="icon34" data-act="like" data-id="' + post.id + '"><img src="img/' + (liked ? "LikeOnGlyph.svg" : "LikeGlyph.svg") + '" alt="" /></button>' +
          '<button class="icon34" data-act="open-post" data-id="' + post.id + '"><img src="img/CommentGlyph.svg" alt="" /></button>' +
          '<button class="icon34" data-act="about-post" data-id="' + post.id + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
        "</div></div>" +
      '<div class="caption">' + esc(split.caption) + "</div>" +
      '<div class="tags">' + split.tags.map(function (tag) { return '<span class="tag">' + esc(tag) + "</span>"; }).join("") +
        '<span class="stamp">' + stamp(post.created_at) + "</span></div>" +
      "</article>";
  }

  function listPeople() {
    var bots = AI_ROLES.map(function (role) {
      var rows = aiLines(role.id);
      var last = rows[rows.length - 1];
      return {
        id: role.id,
        name: role.name,
        avatar: role.avatar,
        handle: role.handle,
        preview: last ? last.body : role.preview,
        time: ""
      };
    });
    return bots.concat(state.people.map(function (person) {
      person.handle = (state.profiles[person.id] || {}).handle || "";
      return person;
    }));
  }

  function chatList() {
    var gems = state.me.gems || state.me.coins || 0;
    var listed = listPeople();
    var chips = listed.map(function (person) {
      return '<button class="friend-card" data-act="open-chat" data-id="' + person.id + '">' +
        '<span class="face"><img src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" />' +
        '<img class="tick" src="img/VerifyBadge.png" alt="" /></span>' +
        '<span class="nm">' + esc(person.name) + '</span>' +
        '<span class="hd">' + esc(person.handle || "") + "</span></button>";
    }).join("");
    var rows = listed.map(function (person) {
      return '<div class="chat-swipe">' +
        '<button class="chat-del" type="button" data-act="ask-delete-chat" data-id="' + person.id + '"><img src="img/ChatTrash.svg" alt="" /></button>' +
        '<button class="chat-row" data-act="open-chat" data-id="' + person.id + '">' +
        '<img class="av" src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" />' +
        '<span class="meta"><span class="nm">' + esc(person.name) + '</span>' +
        '<span class="pv">' + esc(person.preview) + "</span></span>" +
        (person.time ? '<span class="tm">' + esc(person.time) + "</span>" : "") + "</button></div>";
    }).join("");
    return '<div class="feed-page">' +
      '<div class="feed-head short">' +
        '<img class="form-sky" src="img/FormSky.png" alt="" />' +
        '<button class="form-back" data-act="tab" data-id="home"><img src="img/BackButton.svg" alt="" /></button>' +
        '<div class="form-title">Chat</div>' +
        '<button class="gem-chip" data-act="go" data-to="shop"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
        '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
        '<img class="form-sled" src="img/SledMark.png" alt="" />' +
      "</div>" +
      '<div class="scroll chat-body">' +
        (chips ? '<div class="friend-row">' + chips + "</div>" : "") +
        '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' +
        (rows || emptyPen()) +
      "</div></div>";
  }

  function liveClips() {
    var root = (Bridge.env().supabaseURL || "").replace(/\/$/, "");
    if (!root) return [];
    return [1, 2, 3].map(function (n) {
      return root + "/storage/v1/object/public/media/yoohoo/live/room-" + n + ".mp4";
    });
  }

  function ensureCatalog() {
    var clips = liveClips();
    if (!clips.length) return;
    clips.forEach(function (url, i) {
      var id = "clip-" + (i + 1);
      if (state.posts.some(function (post) { return post.id === id || post.media_url === url; })) return;
      state.posts.push({
        id: id,
        author_id: AI_ROLES[i % AI_ROLES.length].id,
        body: "",
        is_video: true,
        media_url: url,
        media_urls: [url],
        created_at: new Date(Date.now() - (i + 1) * 3600000).toISOString()
      });
    });
    state.rooms.forEach(function (room, i) {
      if (!room.video_url) room.video_url = clips[i % clips.length];
      if (!room.cover_url) room.cover_url = String(clips[i % clips.length]).replace(".mp4", ".png");
    });
  }

  function roomClip(room) {
    if (room.video_url) return room.video_url;
    var posts = state.posts.filter(function (post) {
      return post.author_id === room.owner_id && String(post.media_url || "").indexOf(".mp4") >= 0;
    });
    if (posts.length) return posts[0].media_url;
    var clips = liveClips();
    if (!clips.length) return "";
    var n = 0;
    String(room.id || "").split("").forEach(function (ch) { n += ch.charCodeAt(0); });
    return clips[n % clips.length];
  }

  function isAI(id) {
    id = String(id || "").toLowerCase();
    return AI_ROLES.some(function (role) { return role.id === id; });
  }

  function roomCrowd(roomId) {
    var pool = Object.keys(state.profiles).filter(function (id) {
      var person = state.profiles[id];
      return person && person.name && !isAI(id);
    });
    var seed = 2166136261;
    String(roomId || "room").split("").forEach(function (ch) {
      seed ^= ch.charCodeAt(0);
      seed = Math.imul(seed, 16777619);
    });
    function rnd() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    var order = pool.slice();
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var swap = order[i];
      order[i] = order[j];
      order[j] = swap;
    }
    var take = order.length ? Math.min(order.length, 3 + Math.floor(rnd() * 5)) : 0;
    var ids = order.slice(0, take);
    var total = ids.length ? Math.max(ids.length, 8 + Math.floor(rnd() * 56)) : 1 + Math.floor(rnd() * 20);
    return { ids: ids, total: total };
  }

  function myId() {
    return String(API.me() || "").toLowerCase();
  }

  function personName(id) {
    var key = String(id || "").toLowerCase();
    var who = state.profiles[key] || {};
    if (who.name) return who.name;
    if (key && key === myId() && state.me && state.me.name) return state.me.name;
    return "Someone";
  }

  function localLine(body) {
    return {
      id: "local-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      sender_id: myId(),
      body: body,
      created_at: new Date().toISOString(),
      local: true
    };
  }

  function giftParts(line) {
    var body = line.body || "";
    var gift = line.gift || "";
    var cut = body.indexOf("|");
    if (cut > 0) {
      if (!gift) gift = body.slice(cut + 1);
      body = body.slice(0, cut);
    }
    if (!/^Gift\d\d$/.test(gift)) gift = "";
    return { body: body, gift: gift };
  }

  function liveLineHTML(line) {
    var parts = giftParts(line);
    var icon = parts.gift ? '<img class="gift-ico" src="img/' + esc(parts.gift) + '.png" alt="" />' : "";
    return '<div class="live-line" data-hold="live" data-local="' + esc(line.id || "") + '"><span class="who">' +
      esc(personName(line.sender_id)) + "</span> " + esc(parts.body) + icon + "</div>";
  }

  function giftFxHTML() {
    return '<div class="gift-fx"><img src="img/' + esc(state.gift) + '.png" alt="" /><span class="word">Send</span><span class="who">' +
      esc((state.me && state.me.name) || "") + "</span></div>";
  }

  function chatLineHTML(row, prev, fresh) {
    var user = state.profiles[state.chat] || {};
    var mine = String(row.sender_id || "").toLowerCase() === myId();
    var stampRow = stamp(row.created_at);
    var showTime = !prev || stamp(prev.created_at) !== stampRow;
    return (showTime && stampRow ? '<div class="chat-time">' + stampRow + "</div>" : "") +
      '<div class="talk' + (fresh ? " fresh" : "") + " " + (mine ? "me" : "you") + '" data-hold="chat" data-local="' + esc(row.id || "") + '">' +
        (mine ? "" : '<img class="face" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(state.chat || "") + '" />') +
        '<div class="bubble">' + esc(row.body) + "</div>" +
        (mine ? '<img class="face" src="' + esc((state.me && state.me.avatar_url) || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(myId()) + '" />' : "") +
      "</div>";
  }

  function applyPending() {
    var used = {};
    var rest = [];
    (state.pending || []).forEach(function (item) {
      var rows = state.lines[item.person] || [];
      var echoed = rows.some(function (line) {
        if (line.local || used[line.id]) return false;
        var same = String(line.sender_id || "").toLowerCase() === item.row.sender_id && line.body === item.row.body;
        if (!same) return false;
        used[line.id] = 1;
        return true;
      });
      if (echoed) return;
      if (!rows.some(function (line) { return line.id === item.row.id; })) rows.push(item.row);
      state.lines[item.person] = rows;
      rest.push(item);
    });
    state.pending = rest;
  }

  function mergeRoom(server) {
    var rows = takeLines(server);
    var used = {};
    (state.roomLines || []).forEach(function (line) {
      if (!line.local) return;
      var echoed = rows.some(function (item) {
        if (used[item.id]) return false;
        if (item.sender_id === line.sender_id && item.body === line.body) {
          used[item.id] = 1;
          return true;
        }
        return false;
      });
      if (!echoed) rows.push(line);
    });
    return rows;
  }

  function liveView() {
    var room = state.rooms.filter(function (row) { return row.id === state.live; })[0] || {};
    var user = state.profiles[room.owner_id] || {};
    var photo = room.cover_url || "img/LiveStage.png";
    var clip = roomClip(room);
    var stage = clip
      ? '<div class="stage-stack" data-clip="' + esc(clip) + '">' +
          '<video class="stage" src="' + esc(clip) + '" playsinline webkit-playsinline muted preload="auto"></video>' +
          '<video class="stage" src="' + esc(clip) + '" playsinline webkit-playsinline muted preload="auto"></video>' +
          '<div class="stage-wait"><i></i></div>' +
        "</div>"
      : '<img class="stage" src="' + esc(photo) + '" alt="" />';
    var crowd = roomCrowd(state.live || room.id);
    var ids = crowd.ids;
    var faces = ids.slice(0, 3).map(function (id) {
      var person = state.profiles[id] || {};
      return person.avatar_url || "img/SampleAvatar.png";
    });
    if (!faces.length) faces = [user.avatar_url || "img/SampleAvatar.png"];
    var welcome = "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.";
    var lines = (state.roomLines || []).map(liveLineHTML).join("");
    var mine = room.owner_id && room.owner_id === API.me();
    return el(
      '<div class="live-room">' +
        stage +
        '<div class="live-badge"><img src="img/LiveGlyph.svg" alt="" />Live</div>' +
        '<button class="viewers" data-act="audience">' + faces.map(function (src) { return '<img src="' + src + '" alt="" />'; }).join("") +
          '<span class="count">' + crowd.total + '</span></button>' +
        (user.name ? '<div class="host">' +
          '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
          '<div class="meta"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
          (mine || following(room.owner_id) ? "" : '<button class="plus" data-act="follow" data-id="' + room.owner_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
        "</div>" : "") +
        '<div class="live-chat"><div class="welcome">' + welcome + "</div>" + lines + "</div>" +
        '<div class="live-scrim"></div>' +
        '<form class="live-bar-form" data-form="live">' +
          '<label class="say"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></label>' +
          '<button class="sq gift-btn" type="button" data-act="gift"><img src="img/LiveGift.png" alt="" /></button>' +
          '<button class="sq" type="button" data-act="about-person" data-id="' + room.owner_id + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<button class="sq" type="button" data-act="back"><img src="img/LiveShare.svg" alt="" /></button>' +
        "</form>" +
        (state.gift ? giftFxHTML() : "") +
      "</div>"
    );
  }

  function postView() {
    var post = state.posts.filter(function (row) { return row.id === state.post; })[0];
    var comments = state.comments.filter(function (row) { return post && row.post_id === post.id; }).map(function (row) {
      var user = state.profiles[row.author_id] || {};
      return '<div class="cmt" data-hold="comment" data-id="' + row.id + '"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + row.author_id + '" />' +
        '<div class="cmt-body"><div class="cmt-top"><b>' + esc(user.name || "") + ":</b><span>" + stamp(row.created_at) + "</span></div>" +
        "<p>" + esc(row.body) + "</p></div></div>";
    }).join("");
    var empty = emptyPen("small");
    return el(
      '<div class="form-page">' +
        '<div class="form-head">' +
          '<img class="form-sky" src="img/FormSky.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Detail</div>' +
          (post ? '<button class="head-icon like" data-act="like" data-id="' + post.id + '"><img src="img/' + (state.likes.indexOf(String(post.id).toLowerCase()) >= 0 ? "LikeOnGlyph.svg" : "LikeGlyph.svg") + '" alt="" /></button>' : "") +
          (post ? '<button class="head-icon more" data-act="about-post" data-id="' + post.id + '"><img src="img/MoreCircle.svg" alt="" /></button>' : "") +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
        "</div>" +
        '<div class="scroll detail-body">' +
          (post ? postCard(post) : "") +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Comment</div>' +
          (comments || empty) +
        "</div>" +
        '<form class="pink-enter" data-form="comment"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." enterkeyhint="send" /></form>' +
      "</div>"
    );
  }

  function composeView() {
    var photo = (state.picked && state.picked[0] && (state.picked[0].uri || state.picked[0])) || "";
    var imageTab = state.composeKind !== "video";
    var tile = photo
      ? '<img class="photo" src="' + esc(photo) + '" alt="" />'
      : '<img class="cloud" src="img/UploadCloud.svg" alt="" /><span>Upload Photo</span>';
    return el(
      '<div class="form-page">' +
        '<div class="feed-head compose-head">' +
          '<img class="form-sky" src="img/FormSky.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Create post</div>' +
          '<div class="post-pills compose-pills">' +
            snowPill("pink" + (imageTab ? " on" : ""), "compose-kind", "image", "Image") +
            snowPill("gray" + (imageTab ? "" : " on"), "compose-kind", "video", "Video") +
          "</div>" +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
        "</div>" +
        '<form class="form-fields compose-fields" data-form="compose">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />' + (imageTab ? "Image" : "Video") + "</div>" +
          '<button class="upload-cover compose-tile" type="button" data-act="pick">' + tile + "</button>" +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Content</div>' +
          '<textarea class="form-area" name="body" placeholder="Please enter..."></textarea>' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Label</div>' +
          '<div class="tag-row"><button class="tag add" type="button" data-act="add-tag"><img src="img/TagPlus.svg" alt="" />Add tags</button>' +
            (state.tags || []).map(function (tag) { return '<span class="tag">#' + esc(tag) + "</span>"; }).join("") +
          "</div>" +
          '<div class="form-foot"><button class="snow-btn" type="submit"><img src="img/' + (photo ? "ButtonBlue.svg" : "ButtonGray.svg") + '" alt="" /><span>Release</span></button></div>' +
        "</form></div>"
    );
  }

  function chatView() {
    var user = state.profiles[state.chat] || {};
    var lines = (state.lines[state.chat] || []).map(function (row, i, all) {
      return chatLineHTML(row, all[i - 1], i === all.length - 1);
    }).join("");
    return el(
      '<div class="form-page">' +
        '<div class="form-head">' +
          '<img class="form-sky" src="img/FormSky.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">' + esc(user.name || "Chat") + "</div>" +
          (user.name ? '<div class="head-host">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
            '<div class="meta"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (following(state.chat) ? "" : '<button class="plus" data-act="follow" data-id="' + state.chat + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" : "") +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
        "</div>" +
        '<div class="scroll chat-thread">' + (lines || emptyPen()) + "</div>" +
        '<form class="chat-enter" data-form="chat">' +
          '<label class="pink-enter tight"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></label>' +
          '<button class="sq blue" type="button" data-act="call"><img src="img/ChatNow.png" alt="" /></button>' +
          '<button class="sq" type="button" data-act="about-chat" data-id="' + esc(state.chat || "") + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
        "</form></div>"
    );
  }

  function aiView() {
    var role = aiRole(state.aiId) || AI_ROLES[0];
    var lines = aiLines(role.id);
    var body;
    if (lines.length) {
      body = lines.map(function (row) {
        var text = row.thinking ? "..." : esc(row.body) + (row.typing ? '<span class="ai-caret"></span>' : "");
        return '<div class="talk ' + (row.mine ? "me" : "you") + '">' +
          (row.mine ? "" : '<img class="face" src="' + esc(role.avatar) + '" alt="" />') +
          '<div class="bubble">' + text + "</div>" +
          (row.mine ? '<img class="face" src="' + esc((state.me && state.me.avatar_url) || "img/AIUserFace.png") + '" alt="" />' : "") +
        "</div>";
      }).join("");
    } else {
      body = role.prompts.map(function (text) {
        return '<button class="ai-prompt" type="button" data-act="ai-prompt" data-id="' + esc(text) + '">' +
          '<span class="q"><img src="img/AIPromptIcon.svg" alt="" /></span>' + esc(text) + "</button>";
      }).join("");
    }
    return el(
      '<div class="form-page ai-page">' +
        '<div class="home-head ai-head">' +
          '<img class="home-sky" src="img/HomeSky.png" alt="" />' +
          '<img class="home-cap" src="img/SnowCap.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="pegu-chip"><img src="' + esc(role.avatar) + '" alt="" /><div><b>' + esc(role.name) + '</b><span>5 /Message</span></div></div>' +
          '<button class="head-icon more" data-act="about-ai"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<div class="home-marks">' +
            '<img class="home-flake-a" src="img/FlakeA.png" alt="" />' +
            '<img class="home-flake-b" src="img/FlakeB.png" alt="" />' +
            '<img class="home-flake-c" src="img/FlakeA.png" alt="" />' +
            '<div class="home-title">' + esc(role.title) + "</div>" +
            (role.blurb ? '<div class="home-blurb">' + esc(role.blurb) + "</div>" : "") +
            '<div class="home-penguin"><img src="' + esc(role.avatar) + '" alt="" /></div>' +
          "</div>" +
          '<img class="home-edge" src="img/SnowHem.png" alt="" />' +
        "</div>" +
        '<div class="scroll ai-body">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' + body +
        "</div>" +
        '<form class="pink-enter" data-form="ai"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></form>' +
      "</div>"
    );
  }

  function callView() {
    var role = aiRole(state.chat);
    var user = role || state.profiles[state.chat] || {};
    var photo = role ? role.avatar : (user.avatar_url || remembered("avatar", state.chat) || "img/SampleAvatar.png");
    return el(
      '<div class="call-room">' +
        '<img class="bg" src="' + esc(photo) + '" alt="" />' +
        '<div class="veil"></div>' +
        '<video class="local" autoplay playsinline muted></video>' +
        '<div class="call-stack">' +
          '<div class="call-meta"><b>' + esc(user.name || role && role.name || "") + "</b><span>Video Call...</span></div>" +
          '<button class="hang" data-act="back"><img src="img/CallEnd.svg" alt="" /></button>' +
        "</div></div>"
    );
  }

  function profileView() {
    var id = state.profile || API.me();
    var user = state.profiles[id] || state.me || {};
    var mine = id && id === API.me();
    var face = user.avatar_url || remembered("avatar", id) || fileURL(id, "avatar.jpg");
    var coverURL = user.cover_url || remembered("cover", id) || fileURL(id, "cover.jpg") || "img/AuthSky.png";
    var posts = state.posts.filter(function (row) {
      if (state.profileTab === "like") return state.likes.indexOf(row.id) >= 0;
      return row.author_id === id;
    });
    var cards = posts.map(postCard).join("");
    var empty = emptyPen();
    return el(
      '<div class="form-page profile-page">' +
        '<div class="prof-bar">' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          (mine
            ? '<button class="head-icon more" data-act="go" data-to="settings"><img src="img/SettingsIcon.svg" alt="" /></button>'
            : '<button class="head-icon more" data-act="about-person" data-id="' + esc(id || "") + '"><img src="img/MoreCircle.svg" alt="" /></button>') +
        "</div>" +
        '<div class="scroll prof-scroll">' +
        '<div class="prof-head">' +
          '<img class="prof-cover" src="' + esc(coverURL) + '" alt="" data-fallback="img/AuthSky.png" />' +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
          '<div class="prof-av">' +
            (face ? '<img class="face" src="' + esc(face) + '" alt="" data-fallback="" />' : "") +
            '<img class="frame" src="img/AvatarFrame.png" alt="" />' +
            (mine
              ? '<button class="edit" data-act="go" data-to="edit"><img src="img/ProfileEdit.svg" alt="" /></button>'
              : (id ? '<button class="edit plus' + (following(id) ? " on" : "") + '" data-act="follow" data-id="' + esc(id) + '"><img src="img/' + (following(id) ? "FollowedGlyph.svg" : "BadgePlus.png") + '" alt="" /></button>' : "")) +
          "</div>" +
        "</div>" +
        '<div class="prof-body">' +
          '<div class="prof-id">' +
            '<div class="prof-name">' + esc(user.name || "") + "</div>" +
            '<div class="prof-handle">' + esc(user.handle || "") + "</div>" +
            (user.name
              ? (mine
                ? '<button class="shop-chip" data-act="go" data-to="shop"><span class="coin"><img src="img/CoinShopBadge.png" alt="" /></span><span>Coin Shop</span></button>'
                : '<button class="shop-chip chat" data-act="open-chat" data-id="' + esc(id || "") + '"><img src="img/ChatNow.png" alt="" /><span>Chat Now</span></button>')
              : "") +
          "</div>" +
          '<div class="prof-stats">' +
            '<button data-act="people" data-id="follow"><b>' + followCount(id, true) + "</b><span>Followed</span></button>" +
            '<button data-act="people" data-id="fans"><b>' + followCount(id, false) + "</b><span>Fans</span></button>" +
            '<button data-act="people" data-id="block"><b>' + (mine ? state.blocks.length : 0) + "</b><span>Blacklist</span></button>" +
          "</div>" +
          '<div class="post-pills prof-pills">' +
            '<button class="pill pink' + (state.profileTab === "post" ? " on" : "") + '" data-act="profile-tab" data-id="post"><img class="flake" src="img/SnowmanBody.svg" alt="" /><span>Post</span><img class="man" src="img/PillSnowman.svg" alt="" /></button>' +
            '<button class="pill gray' + (state.profileTab === "like" ? " on" : "") + '" data-act="profile-tab" data-id="like"><img class="flake" src="img/SnowmanBody.svg" alt="" /><span>Like</span><img class="man" src="img/PillSnowman.svg" alt="" /></button>' +
          "</div>" +
          (cards || empty) +
        "</div></div></div>"
    );
  }

  function followCount(id, followingFlag) {
    id = String(id || "").toLowerCase();
    return state.follows.filter(function (row) {
      var follower = String(row.follower || "").toLowerCase();
      var followee = String(row.followee || "").toLowerCase();
      return followingFlag ? follower === id : followee === id;
    }).length;
  }

  function settingsView() {
    return el(
      '<div class="form-page">' + formChrome("Settings", "profile") +
        '<div class="scroll set-list">' +
          setRow("SetFollow.svg", "Follow", "people", "follow") +
          setRow("SetFans.svg", "Fans", "people", "fans") +
          setRow("SetBlack.svg", "Blacklist", "people", "block") +
          setRow("SetFeedback.svg", "Feedback", "feedback") +
          setRow("SetTerms.svg", "Terms Of Use", "legal", "terms") +
          setRow("SetPrivacy.svg", "Privacy Policy", "legal", "privacy") +
          '<button class="set-row" type="button"><img src="img/SetVersion.svg" alt="" /><span>Version</span><em>V1.1</em></button>' +
          '<button class="set-row" type="button" data-act="clean-cache"><img src="img/SetCache.svg" alt="" /><span>Clean Cache</span></button>' +
          setRow("SetTrash.svg", "Delete Account", "erase") +
          '<div class="form-foot"><button class="snow-btn" data-act="logout"><img src="img/ButtonBlue.svg" alt="" /><span>Log Out</span></button></div>' +
        "</div></div>"
    );
  }

  function setRow(icon, label, act, id) {
    return '<button class="set-row" data-act="' + act + '"' + (id ? ' data-id="' + id + '"' : "") + ">" +
      '<img src="img/' + icon + '" alt="" /><span>' + label + "</span></button>";
  }

  function shopView() {
    var arts = ["Coin5.png", "Coin10.png", "Coin15.png", "Coin20.png", "Coin25.png", "Coin30.png", "Coin35.png"];
    var picked = state.shopPick || 0;
    var packs = (Bridge.env().packs || []).map(function (pack, i) {
      return '<button class="pack' + (i === picked ? " on" : "") + '" data-act="buy" data-id="' + esc(pack.id) + '">' +
        '<img class="art" src="img/' + arts[i] + '" alt="" />' +
        '<div class="meta"><img src="img/Coin5.png" alt="" /><span>' + pack.amount + "</span></div>" +
        '<span class="price">' + esc(pack.price) + "</span></button>";
    }).join("");
    packs = '<div class="shop-frame"></div>' + packs;
    return el(
      '<div class="form-page shop-page">' +
        '<div class="shop-head">' +
          '<img class="banner" src="img/CoinBanner.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Coin Shop</div>' +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
        "</div>" +
        '<div class="scroll shop-grid">' + (packs || emptyPen()) + "</div></div>"
    );
  }

  function editView() {
    var name = (state.me && state.me.name) || "";
    var face = state.avatarPick || (state.me && state.me.avatar_url) || remembered("avatar", API.me()) || fileURL(API.me(), "avatar.jpg");
    var coverURL = state.coverPick || (state.me && state.me.cover_url) || remembered("cover", API.me());
    var frames = ["AvatarFrame.png", "FrameSnow.png", "FrameSki.png", "FrameSnowman.png", "FrameCable.png", "FrameTrophy.png"];
    var frameCells = frames.map(function (src, i) {
      return '<button class="frame-cell' + (state.framePick === i ? " on" : "") + '" type="button" data-act="pick-frame" data-id="' + i + '">' +
        '<img src="img/' + src + '" alt="" /></button>';
    }).join("");
    var avatar = face ? '<img src="' + esc(face) + '" alt="" data-fallback="img/UploadCloud.svg" />' : '<img class="cloud" src="img/UploadCloud.svg" alt="" />';
    var bg = coverURL
      ? '<img class="photo" src="' + esc(coverURL) + '" alt="" data-fallback="img/UploadCloud.svg" />'
      : '<img class="cloud" src="img/UploadCloud.svg" alt="" /><span>Upload Photo</span>';
    return el(
      '<div class="form-page edit">' + formChrome("Edit Profile", "profile") +
        '<form id="edit-form" class="form-fields edit-fields" data-form="edit">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Avatar</div>' +
          '<button class="upload-avatar" type="button" data-act="pick-avatar">' + avatar + "</button>" +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Background</div>' +
          '<button class="upload-cover" type="button" data-act="pick-cover">' + bg + "</button>" +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Frame</div>' +
          '<div class="frame-grid">' + frameCells + "</div>" +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Name</div>' +
          '<input class="form-input" name="name" maxlength="24" placeholder="Your name" value="' + esc(name) + '" />' +
        "</form>" +
        '<div class="form-foot"><button class="snow-btn" type="submit" form="edit-form">' +
          '<img src="img/' + (name ? "ButtonBlue.svg" : "ButtonGray.svg") + '" alt="" /><span>' + (name ? "Create" : "Save") + "</span></button></div>" +
      "</div>"
    );
  }

  function peopleView() {
    var kind = state.peopleKind;
    var ids = [];
    if (kind === "block") ids = state.blocks;
    else if (kind === "fans") ids = state.follows.filter(function (row) { return row.followee === API.me(); }).map(function (row) { return row.follower; });
    else ids = state.follows.filter(function (row) { return row.follower === API.me(); }).map(function (row) { return row.followee; });
    var aiIds = AI_ROLES.map(function (role) { return role.id; });
    ids = ids.filter(function (id) { return aiIds.indexOf(String(id).toLowerCase()) < 0; });
    var title = kind === "fans" ? "Fans" : "Followed";
    var back = kind === "block" ? "settings" : "profile";
    var bots = kind === "block" ? "" : AI_ROLES.map(function (role) {
      return '<button class="people-row" data-act="open-chat" data-id="' + role.id + '"><img src="' + esc(role.avatar) + '" alt="" />' +
        '<span class="meta"><b>' + esc(role.name) + "</b><span>" + esc(role.handle) + "</span></span></button>";
    }).join("");
    var rows = bots + ids.map(function (id) {
      var user = state.profiles[id] || { name: id };
      var action = "";
      if (kind === "block") action = '<button class="pill-act gray" data-act="unblock" data-id="' + id + '">Remove</button>';
      else if (kind === "fans" && !following(id)) action = '<button class="pill-act blue" data-act="follow" data-id="' + id + '">Follow<img src="img/BadgePlus.png" alt="" /></button>';
      else action = '<button class="pill-act gray" data-act="follow" data-id="' + id + '">Followed</button>';
      return '<div class="people-row"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + id + '" />' +
        '<div class="meta" data-act="profile" data-id="' + id + '"><b>' + esc(user.name) + "</b><span>" + esc(user.handle || "") + "</span></div>" + action + "</div>";
    }).join("");
    return el(
      '<div class="form-page">' + formChrome(title, back) +
        '<div class="scroll people-list">' + (rows || emptyPen()) + "</div></div>"
    );
  }

  function sheetView() {
    var wrap = el('<div class="dim" data-act="close-sheet"></div>');
    var inner = "";
    if (state.sheet === "about") {
      var rows = "";
      if (state.aboutKind === "post") {
        rows = '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>' +
          '<button class="set-row" data-act="delete-target"><img src="img/SetTrash.svg" alt="" /><span>Delete Post</span></button>' +
          '<button class="set-row" data-act="block-user"><img src="img/MenuSad.svg" alt="" /><span>Add to Blacklist</span></button>';
      } else if (state.aboutKind === "comment") {
        rows = state.aboutMine
          ? '<button class="set-row" data-act="delete-comment"><img src="img/SetTrash.svg" alt="" /><span>Delete</span></button>'
          : '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>' +
            '<button class="set-row" data-act="block-user"><img src="img/MenuSad.svg" alt="" /><span>Add to Blacklist</span></button>';
      } else if (state.aboutKind === "chat") {
        rows = '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>' +
          '<button class="set-row" data-act="delete-target"><img src="img/SetTrash.svg" alt="" /><span>Delete Chat</span></button>';
      } else if (state.aboutKind === "ai") {
        rows = '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>';
      } else {
        rows = '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>' +
          '<button class="set-row" data-act="block-user"><img src="img/MenuSad.svg" alt="" /><span>Add to Blacklist</span></button>';
      }
      inner = snowSheet("About", rows);
    } else if (state.sheet === "tag") {
      inner = snowSheet("Add Tag",
        '<form data-form="tag"><textarea class="form-area" name="body" placeholder="Please enter..."></textarea>' +
        '<button class="snow-btn" type="submit"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button></form>'
      );
    } else if (state.sheet === "delete-post") {
      inner = snowSheet("Delete Post",
        '<p class="sheet-copy center">Once deleted, this post cannot be recovered. Are you sure you want to continue?</p>' +
        '<button class="snow-btn" data-act="confirm-delete-post"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button>'
      );
    } else if (state.sheet === "delete-chat") {
      inner = snowSheet("Delete Chat",
        '<p class="sheet-copy center">Are you sure you want to delete your chat history? Once deleted, this action cannot be reversed!</p>' +
        '<button class="snow-btn" data-act="confirm-delete-chat"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button>'
      );
    } else if (state.sheet === "blacklist") {
      inner = snowSheet("Add to Blacklist",
        '<p class="sheet-copy center">Are you sure you want to blacklist him/her? After joining, you will not receive any messages from him/her!</p>' +
        '<button class="snow-btn" data-act="confirm-block"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button>'
      );
    } else if (state.sheet === "feedback") {
      inner = snowSheet("Feed Back",
        '<form data-form="feedback"><textarea class="form-area" name="body" placeholder="Please enter..."></textarea>' +
        '<button class="snow-btn" type="submit"><img src="img/ButtonBlue.svg" alt="" /><span>Submit</span></button></form>'
      );
    } else if (state.sheet === "report") {
      inner = snowSheet("Report",
        '<form data-form="report"><textarea class="form-area" name="reason" placeholder="Please enter..."></textarea>' +
        '<button class="snow-btn" type="submit"><img src="img/ButtonBlue.svg" alt="" /><span>Submit</span></button></form>'
      );
    } else if (state.sheet === "logout") {
      inner = snowSheet("Log Out",
        '<p class="sheet-copy">Are you sure you want to log out? You will need to sign in again to access your account.</p>' +
        '<button class="snow-btn" data-act="confirm-logout"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button>'
      );
    } else if (state.sheet === "erase") {
      inner = snowSheet("Delete Account",
        '<p class="sheet-copy">Are you sure you want to delete your account? This action cannot be undone, and all your data will be permanently erased.</p>' +
        '<button class="snow-btn" data-act="confirm-erase"><img src="img/ButtonBlue.svg" alt="" /><span>Confirm</span></button>'
      );
    } else if (state.sheet === "audience") {
      inner = snowSheet("Audience List", audienceRows());
    } else if (state.sheet === "gift") {
      wrap.className = "dim soft";
      inner = giftShopHTML();
    }
    var box = el('<div class="sheet-layer"></div>');
    box.appendChild(wrap);
    if (inner) box.appendChild(el(inner));
    return box;
  }

  function giftShopHTML() {
    var costs = [10, 10, 10, 10, 20, 20, 20, 20, 30, 30, 30, 30];
    var gems = (state.me && (state.me.gems || state.me.coins)) || 0;
    var cells = costs.map(function (cost, i) {
      var id = "Gift" + (i < 9 ? "0" : "") + (i + 1);
      return '<button class="gift-cell' + (state.giftPick === id ? " on" : "") + '" data-act="pick-gift" data-id="' + id + '" data-cost="' + cost + '">' +
        '<img src="img/' + id + '.png" alt="" /><span><img src="img/Coin5.png" alt="" />' + cost + "</span></button>";
    }).join("");
    return '<div class="gift-shop">' +
      '<div class="sheet-snow"><img src="img/SheetSnow.png" alt="" /></div>' +
      '<div class="sheet-body">' +
      '<div class="gift-top">' +
        '<button class="gem-chip static" data-act="go" data-to="shop"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
        '<div class="title">Gift Shop</div>' +
        '<button class="x" data-act="close-sheet"><img src="img/CloseBadge.svg" alt="" /></button>' +
      "</div>" +
      '<div class="gift-grid">' + cells + "</div>" +
      '<button class="snow-btn send" data-act="send-gift" data-id="' + state.giftPick + '" data-cost="' + (costs[giftIndex(state.giftPick)] || 10) + '">' +
        '<img src="img/ButtonBlue.svg" alt="" /><span>Send</span></button>' +
      "</div></div>";
  }

  function snowSheet(title, inner) {
    return '<div class="snow-sheet">' +
      '<div class="sheet-snow"><img src="img/SheetSnow.png" alt="" /></div>' +
      '<div class="sheet-body">' +
      '<div class="snow-top"><span class="x-ph"></span><div class="title">' + title + '</div>' +
      '<button class="x" data-act="close-sheet"><img src="img/CloseBadge.svg" alt="" /></button></div>' +
      inner + "</div></div>";
  }

  function audienceRows() {
    var ids = roomCrowd(state.live).ids.filter(function (id) { return !isAI(id); });
    var rows = ids.map(function (id) {
      var user = state.profiles[id] || {};
      var followed = following(id);
      return '<div class="people-row"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
        '<div class="meta"><b>' + esc(user.name || "") + "</b><span>" + esc(user.handle || "") + "</span></div>" +
        (id === API.me() ? "" : followed
          ? '<button class="pill-act gray" data-act="follow" data-id="' + id + '">Followed</button>'
          : '<button class="pill-act blue" data-act="follow" data-id="' + id + '">Follow<img src="img/BadgePlus.png" alt="" /></button>') +
        "</div>";
    }).join("");
    return rows || emptyPen();
  }

  function giftIndex(id) {
    var n = Number(String(id || "").replace("Gift", ""));
    return n ? n - 1 : 0;
  }

  var chatDrag = { row: null, x: 0, y: 0, moved: false };
  function bindChatSwipe() {
    var root = document.getElementById("app");
    root.addEventListener("touchstart", function (event) {
      var row = event.target.closest(".chat-swipe");
      chatDrag.row = row;
      chatDrag.moved = false;
      if (!row || !event.touches[0]) return;
      chatDrag.x = event.touches[0].clientX;
      chatDrag.y = event.touches[0].clientY;
    }, { passive: true });
    root.addEventListener("touchmove", function (event) {
      if (!chatDrag.row || !event.touches[0]) return;
      var dx = event.touches[0].clientX - chatDrag.x;
      var dy = event.touches[0].clientY - chatDrag.y;
      if (Math.abs(dx) < 10 || Math.abs(dy) > Math.abs(dx)) return;
      chatDrag.moved = true;
      chatDrag.row.classList.add("dragging");
      var base = chatDrag.row.classList.contains("open") ? -64 : 0;
      var next = Math.max(-64, Math.min(0, base + dx));
      var face = chatDrag.row.querySelector(".chat-row");
      if (face) face.style.transform = "translateX(" + next + "px)";
    }, { passive: true });
    root.addEventListener("touchend", function () {
      var row = chatDrag.row;
      chatDrag.row = null;
      if (!row) return;
      var face = row.querySelector(".chat-row");
      var x = 0;
      if (face && face.style.transform) {
        var match = /translateX\((-?\d+)/.exec(face.style.transform);
        x = match ? Number(match[1]) : 0;
      }
      row.classList.remove("dragging");
      if (face) face.style.transform = "";
      document.querySelectorAll(".chat-swipe.open").forEach(function (other) {
        if (other !== row) other.classList.remove("open");
      });
      if (x < -32) row.classList.add("open");
      else row.classList.remove("open");
    });
  }

  async function onClick(event) {
    var node = event.target.closest("[data-act]");
    if (!node) return;
    var act = node.getAttribute("data-act");
    var id = node.getAttribute("data-id");
    if (act === "open-chat" && chatDrag.moved) { chatDrag.moved = false; return; }
    var openRow = node.closest(".chat-swipe.open");
    if (act === "open-chat" && openRow) { openRow.classList.remove("open"); return; }
    if (node.closest("button")) Bridge.haptic();
    var gated = ["follow","live","like","like-room","open-chat","buy","gift","send-gift","call","compose","ai-prompt","people","pick"].indexOf(act) >= 0
      || (act === "go" && ["compose","shop","edit","settings","ai"].indexOf(node.getAttribute("data-to")) >= 0);
    if (gated && !needAuth()) return;
    if (busy && ["follow","like","like-room","buy","live","open-chat","confirm-block","confirm-delete-post","confirm-delete-chat","send-gift"].indexOf(act) >= 0) return;
    var locking = act === "follow" || act === "like" || act === "like-room";
    if (locking) busy = true;
    try {
      if (act === "back") back();
      else if (act === "go") {
        var to = node.getAttribute("data-to");
        if (to === "ai") { state.aiId = AI_ROLES[0].id; state.ai = aiLines(AI_ROLES[0].id); }
        go(to, to === "profile" ? { profile: API.me() } : null);
      }
      else if (act === "tab") {
        if (state.tab === id && state.route === "main") return;
        var wasMain = state.route === "main";
        state.tab = id;
        state.route = "main";
        if (wasMain && slideTabs(true)) return;
        motion = "fade";
        draw();
      }
      else if (act === "post-filter") { state.postFilter = id; draw(); }
      else if (act === "apple") await apple();
      else if (act === "agree") { await Bridge.eula(); go("auth"); }
      else if (act === "follow") {
        var who = String(id || "").toLowerCase();
        if (!who || who === API.me()) return;
        var on = !following(who);
        rememberFollow(who, on);
        draw();
        try { await API.setFollow(who, on); }
        catch (err) {
          if (!alreadyThere(err)) { rememberFollow(who, !on); draw(); throw err; }
        }
        Bridge.toast(on ? "Followed." : "Unfollowed.");
      }
      else if (act === "live") {
        var roomId = String(id || "");
        var join = localLine("joined");
        state.roomLines = [join];
        state.roomSig = "";
        state.liveTime = 0;
        state.audience = myId() ? [{ user_id: myId() }] : [];
        go("live", { live: roomId });
        API.joinRoom(roomId).catch(function () {}).then(function () {
          return API.sendRoomMessage(roomId, "joined");
        }).then(function () {
          return API.roomMessages(roomId);
        }).then(function (rows) {
          if (state.route !== "live" || String(state.live) !== roomId) return;
          state.roomLines = mergeRoom(rows);
          state.roomSig = lineSig(state.roomLines);
          draw();
        }).catch(function () {});
        API.roomMembers(roomId).then(function (rows) {
          if (state.route === "live" && String(state.live) === roomId && rows) {
            state.audience = rows;
            draw();
          }
        }).catch(function () {});
      }
      else if (act === "like") {
        var pid = String(id || "").toLowerCase();
        var liked = state.likes.indexOf(pid) < 0;
        rememberLike(pid, liked);
        draw();
        if (pid.indexOf("clip-") !== 0) {
          try { await API.like(pid, liked); }
          catch (err) {
            if (!alreadyThere(err)) { rememberLike(pid, !liked); draw(); throw err; }
          }
        }
        if (liked) Bridge.toast("Liked.");
      }
      else if (act === "like-room") {
        var rid = String(id || "").toLowerCase();
        var loved = roomLiked(rid);
        state.roomLikes = loved
          ? state.roomLikes.filter(function (item) { return item !== rid; })
          : state.roomLikes.concat([rid]);
        saveRoomLikes();
        draw();
        if (!loved) Bridge.toast("Liked.");
      }
      else if (act === "open-post") go("post", { post: id });
      else if (act === "open-chat") {
        if (aiRole(id)) {
          state.aiId = id;
          state.ai = aiLines(id);
          go("ai");
        } else {
          go("chat", { chat: id });
          API.openThread(id).then(function () { return reload(); }).catch(function () {});
        }
      }
      else if (act === "ask-delete-chat") {
        state.chat = id;
        state.sheet = "delete-chat";
        draw();
      }
      else if (act === "profile") go("profile", { profile: id });
      else if (act === "people") go("people", { peopleKind: id });
      else if (act === "legal") await Bridge.legal(id);
      else if (act === "buy") {
        var pack = node.closest(".pack") || node;
        var grid = pack.parentNode;
        var packs = grid ? Array.prototype.slice.call(grid.querySelectorAll(".pack")) : [];
        var index = packs.indexOf(pack);
        if (index < 0) index = state.shopPick || 0;
        state.shopPick = index;
        packs.forEach(function (item, i) { item.classList.toggle("on", i === index); });
        var frame = grid && grid.querySelector(".shop-frame");
        if (frame) frame.style.transform = "translate(" + pack.offsetLeft + "px," + pack.offsetTop + "px)";
        await new Promise(function (resolve) { setTimeout(resolve, 340); });
        var bought = await Bridge.buy(id);
        if (bought && bought.ok) await reload();
      }
      else if (act === "profile-tab") { state.profileTab = id; draw(); }
      else if (act === "clean-cache") { Bridge.toast("Cleaned."); }
      else if (act === "compose-kind") { state.composeKind = id; draw(); }
      else if (act === "pick-gift") { state.giftPick = id; draw(); }
      else if (act === "pick") {
        var media = await Bridge.pick(state.composeKind === "video" ? 1 : 9, state.composeKind === "video");
        state.picked = pickedItems(media);
        draw();
      }
      else if (act === "pick-avatar") {
        var avatarMedia = await Bridge.pick(1, false);
        var one = pickedItems(avatarMedia)[0] || {};
        if (one.uri) { state.avatarPick = one.uri; state.avatarPickId = one.id || ""; }
        else if (avatarMedia && avatarMedia.message) Bridge.toast(plainError(avatarMedia.message));
        draw();
      }
      else if (act === "pick-cover") {
        var coverMedia = await Bridge.pick(1, false);
        var two = pickedItems(coverMedia)[0] || {};
        if (two.uri) { state.coverPick = two.uri; state.coverPickId = two.id || ""; }
        else if (coverMedia && coverMedia.message) Bridge.toast(plainError(coverMedia.message));
        draw();
      }
      else if (act === "gift") { state.sheet = "gift"; draw(); }
      else if (act === "send-gift") {
        var cost = Number(node.getAttribute("data-cost")) || 0;
        var gems = (state.me && state.me.gems) || 0;
        if (gems < cost) {
          Bridge.toast("Not enough coins.");
          go("shop");
          return;
        }
        if (state.me) state.me.gems = gems - cost;
        var giftBody = "sent a gift|" + id;
        var line = localLine(giftBody);
        line.gift = id;
        state.sheet = null;
        state.roomLines = (state.roomLines || []).concat([line]);
        state.gift = id;
        var roomNode = document.querySelector(".live-room");
        if (roomNode) {
          var layer = document.querySelector("#app > .sheet-layer");
          if (layer) layer.remove();
          var box = roomNode.querySelector(".live-chat");
          if (box) {
            box.insertAdjacentHTML("beforeend", liveLineHTML(line));
            box.scrollTop = box.scrollHeight;
          }
          var oldFx = roomNode.querySelector(".gift-fx");
          if (oldFx) oldFx.remove();
          roomNode.insertAdjacentHTML("beforeend", giftFxHTML());
        } else draw();
        dismissGift();
        var roomId = state.live;
        var giftId = id;
        API.joinRoom(roomId).catch(function () {}).then(function () {
          return API.sendGift(roomId, cost, giftId);
        }).then(function (left) {
          if (state.me && typeof left === "number") state.me.gems = left;
          return API.sendRoomMessage(roomId, giftBody);
        }).then(function () {
          return API.roomMessages(roomId);
        }).then(function (rows) {
          if (state.route !== "live" || state.live !== roomId) return;
          state.roomLines = mergeRoom(rows);
          state.roomSig = lineSig(state.roomLines);
        }).catch(function (err) {
          if (state.me) state.me.gems = gems;
          Bridge.toast(err.message || String(err));
        });
      }
      else if (act === "about-post") openAbout("post", id);
      else if (act === "about-chat") openAbout("chat", id);
      else if (act === "about-person") openAbout("live", id);
      else if (act === "about-ai") openAbout("ai", "pegu");
      else if (act === "add-tag") { state.sheet = "tag"; draw(); }
      else if (act === "call") go("call");
      else if (act === "ai-prompt") { await sendAI(id); }
      else if (act === "close-sheet") closeSheet();
      else if (act === "close-preview") { state.preview = null; state.previewVideo = false; draw(); }
      else if (act === "preview") {
        var post = state.posts.filter(function (row) { return row.id === id; })[0];
        var photos = post && (post.media_urls || (post.media_url ? [post.media_url] : []));
        state.preview = (photos && photos[0]) || node.getAttribute("src") || "";
        state.previewVideo = !!(post && post.is_video);
        draw();
      }
      else if (act === "play-video") {
        var clip = state.posts.filter(function (row) { return row.id === id; })[0];
        var urls = clip && (clip.media_urls || (clip.media_url ? [clip.media_url] : []));
        state.preview = (urls && urls[0]) || "";
        state.previewVideo = true;
        draw();
      }
      else if (act === "report") { state.sheet = "report"; draw(); }
      else if (act === "feedback") { state.sheet = "feedback"; draw(); }
      else if (act === "audience") {
        if (state.live) state.audience = await API.roomMembers(state.live).catch(function () { return state.audience; });
        state.sheet = "audience";
        draw();
      }
      else if (act === "pick-frame") { state.framePick = Number(id); draw(); }
      else if (act === "confirm-logout") { stack = []; await Bridge.signOut(); go("auth"); }
      else if (act === "confirm-erase") { stack = []; await API.deleteAccount(); await Bridge.signOut(); go("auth"); }
      else if (act === "block-user") { state.sheet = "blacklist"; draw(); }
      else if (act === "delete-target") {
        state.sheet = state.aboutKind === "chat" ? "delete-chat" : "delete-post";
        draw();
      }
      else if (act === "delete-comment") {
        await API.deleteComment(state.aboutId);
        state.sheet = null;
        await reload();
        Bridge.toast("Deleted.");
      }
      else if (act === "confirm-delete-post") {
        if (state.aboutId) await API.deletePost(state.aboutId);
        state.sheet = null; await reload(); Bridge.toast("Deleted."); back();
      }
      else if (act === "confirm-delete-chat") {
        if (aiRole(state.chat)) {
          state.aiBy[state.chat] = [];
          if (state.aiId === state.chat) state.ai = state.aiBy[state.chat];
          persistAI();
          state.sheet = null;
          var stayAI = state.route === "main";
          draw();
          Bridge.toast("Deleted.");
          if (!stayAI) back();
          return;
        }
        if (state.threads[state.chat]) await API.hideThread(state.threads[state.chat]);
        state.sheet = null;
        var stay = state.route === "main";
        await reload();
        Bridge.toast("Deleted.");
        if (!stay) back();
      }
      else if (act === "confirm-block") {
        await API.block(state.reportTarget); state.sheet = null; await reload(); Bridge.toast("Blocked."); back();
      }
      else if (act === "unblock") { await API.unblock(id); await reload(); Bridge.toast("Removed."); }
      else if (act === "logout") { state.sheet = "logout"; draw(); }
      else if (act === "erase") { state.sheet = "erase"; draw(); }
    } catch (err) {
      Bridge.toast(err.message || String(err));
    } finally {
      if (locking) busy = false;
    }
  }

  function openAbout(kind, id) {
    state.aboutKind = kind;
    state.aboutId = id;
    if (kind === "post") {
      var post = state.posts.filter(function (row) { return row.id === id; })[0];
      state.reportTarget = post ? post.author_id : id;
      state.aboutMine = post && post.author_id === API.me();
    } else if (kind === "comment") {
      var comment = state.comments.filter(function (row) { return row.id === id; })[0];
      state.reportTarget = comment ? comment.author_id : id;
      state.aboutMine = comment && comment.author_id === API.me();
    } else {
      state.reportTarget = id === "pegu" ? id : (id || state.chat);
      state.aboutMine = false;
    }
    state.sheet = "about";
    draw();
  }

  function onHold(event) {
    var node = event.target.closest("[data-hold]");
    if (!node) return;
    event.preventDefault();
    var kind = node.getAttribute("data-hold");
    var id = node.getAttribute("data-id");
    if (kind === "comment") openAbout("comment", id);
    else if (kind === "chat") openAbout("chat", state.chat);
    else if (kind === "live") openAbout("live", id);
  }

  function onFormInput(event) {
    var form = event.target.closest("form");
    if (!form) return;
    var kind = form.getAttribute("data-form");
    if (kind === "signin" || kind === "register" || kind === "compose" || kind === "edit") {
      var btn = form.querySelector(".snow-btn img") || document.querySelector(".form-foot .snow-btn img");
      if (!btn) return;
      var filled = false;
      if (kind === "compose") filled = !!(state.picked && state.picked.length);
      else if (kind === "edit") filled = !!(event.target.value || "").trim();
      else filled = Array.prototype.every.call(form.querySelectorAll("input[required], input[name]"), function (input) {
        return String(input.value || "").trim();
      });
      btn.src = filled ? "img/ButtonBlue.svg" : "img/ButtonGray.svg";
    }
  }

  async function apple() {
    await Bridge.eula();
    var result = await Bridge.apple();
    if (result && result.ok === false && result.cancelled) return;
    await reload();
    go("main");
  }

  async function onSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var kind = form.getAttribute("data-form");
    var data = new FormData(form);
    var body = String(data.get("body") || "").trim();
    if (busy) return;
    try {
      if (kind === "register") {
        state.form.email = String(data.get("email") || "").trim();
        state.form.password = String(data.get("password") || "");
        state.form.name = String(data.get("name") || "").trim();
        if (!state.form.email || !state.form.password || !state.form.name) {
          Bridge.toast("Please enter...");
          return;
        }
        go("register2");
        return;
      }
      if (kind === "comment" && !needAuth()) return;
      if (kind === "ai" && !needAuth()) return;
      if (kind === "compose" && !needAuth()) return;
      if (kind === "chat" || kind === "live") {
        if (!body) return;
        if (!needAuth()) return;
        quietSend(kind, body, form);
        return;
      }
      busy = true;
      await Bridge.wait(true);
      if (kind === "signin") {
        await Bridge.eula();
        await API.signIn(String(data.get("email") || ""), String(data.get("password") || ""));
        await Bridge.setSession(API.tokens().access, API.tokens().refresh);
        await reload();
        stack = [];
        go("main");
      } else if (kind === "register2") {
        await Bridge.eula();
        await API.signUp(state.form.email, state.form.password, state.form.name);
        if (!API.tokens().access) throw new Error("Sign in failed");
        await Bridge.setSession(API.tokens().access, API.tokens().refresh);
        var avatar = state.avatarPickId || state.avatarPick ? rememberMedia("avatar", await uploadPick({ id: state.avatarPickId, uri: state.avatarPick }, API.me() + "/avatar.jpg")) : "";
        var coverURL = state.coverPickId || state.coverPick ? rememberMedia("cover", await uploadPick({ id: state.coverPickId, uri: state.coverPick }, API.me() + "/cover.jpg")) : "";
        try { await API.saveProfile(state.form.name, avatar, coverURL); } catch (err) {}
        state.avatarPick = ""; state.avatarPickId = ""; state.coverPick = ""; state.coverPickId = "";
        try { await reload(); } catch (err) {}
        stack = [];
        go("main");
      } else if (kind === "comment") {
        if (!body) return;
        await API.addComment(state.post, body);
        await reload();
      } else if (kind === "ai") { await sendAI(body); }
      else if (kind === "tag") {
        var tag = body.replace(/^#/, "").trim();
        if (tag && (state.tags || []).indexOf(tag) < 0) state.tags.push(tag);
        state.sheet = null;
        draw();
      } else if (kind === "compose") {
        var items = state.picked || [];
        if (!items.length) { Bridge.toast("Please enter..."); return; }
        var urls = [];
        for (var i = 0; i < items.length; i++) {
          urls.push(await uploadPick(items[i], API.me() + "/posts/" + Date.now() + "-" + i + ".jpg"));
        }
        var caption = body;
        (state.tags || []).forEach(function (tag) { caption += (caption ? " " : "") + "#" + tag; });
        await API.publish(caption, urls, state.composeKind === "video");
        state.picked = [];
        state.tags = [];
        await reload();
        Bridge.toast("Released.");
        stack = [];
        state.tab = "post";
        go("main");
      } else if (kind === "edit") {
        var avatar = (state.me && state.me.avatar_url) || remembered("avatar", API.me());
        var coverURL = (state.me && state.me.cover_url) || remembered("cover", API.me());
        if (state.avatarPickId || state.avatarPick) avatar = rememberMedia("avatar", await uploadPick({ id: state.avatarPickId, uri: state.avatarPick }, API.me() + "/avatar.jpg"));
        if (state.coverPickId || state.coverPick) coverURL = rememberMedia("cover", await uploadPick({ id: state.coverPickId, uri: state.coverPick }, API.me() + "/cover.jpg"));
        try { await API.saveProfile(String(data.get("name") || state.me.name), avatar, coverURL); } catch (err) {}
        state.avatarPick = ""; state.avatarPickId = ""; state.coverPick = ""; state.coverPickId = "";
        await reload();
        Bridge.toast("Saved.");
        go("profile", { profile: API.me() });
      } else if (kind === "feedback") { await API.feedback(body); state.sheet = null; Bridge.toast("Sent."); draw(); }
      else if (kind === "report") { await API.report(state.reportTarget, String(data.get("reason") || body)); state.sheet = null; Bridge.toast("Reported."); draw(); }
    } catch (err) {
      Bridge.toast(err.message || String(err));
    } finally {
      busy = false;
      await Bridge.wait(false);
    }
  }

  async function sendAI(text) {
    var body = String(text || "").trim();
    if (!body) return;
    var role = aiRole(state.aiId) || AI_ROLES[0];
    state.aiId = role.id;
    var lines = aiLines(role.id);
    state.ai = lines;
    lines.push({ mine: true, body: body });
    var think = { mine: false, body: "", thinking: true };
    lines.push(think);
    draw();
    try {
      if (role.id === AI_ROLES[0].id) {
        try { await API.addAI(true, body); } catch (err) {}
      }
      var left = await API.spendGems(5);
      if (state.me && typeof left === "number") state.me.gems = left;
    } catch (err) {
      var msg = String((err && err.message) || err);
      if (/not enough/i.test(msg)) {
        lines.pop();
        lines.pop();
        persistAI();
        draw();
        Bridge.toast("Not enough coins.");
        go("shop");
        return;
      }
    }
    if (state.route !== "ai") { persistAI(); return; }
    await typeAI(think, role.reply);
    persistAI();
    if (role.id === AI_ROLES[0].id) { try { await API.addAI(false, role.reply); } catch (err) {} }
  }

  async function typeAI(item, text) {
    item.thinking = false;
    item.body = "";
    item.typing = true;
    if (state.route !== "ai") return;
    draw();
    var bubble = document.querySelector(".ai-body .talk.you:last-child .bubble");
    for (var i = 0; i < text.length; i++) {
      if (state.route !== "ai") return;
      item.body += text[i];
      if (bubble) bubble.innerHTML = esc(item.body) + '<span class="ai-caret"></span>';
      await new Promise(function (resolve) { setTimeout(resolve, 16); });
    }
    item.typing = false;
    if (bubble && state.route === "ai") bubble.textContent = item.body;
  }

  function startPoll() {
    clearInterval(poller);
    if (state.route !== "live" && state.route !== "chat") return;
    poller = setInterval(function () {
      var typing = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
      if (typing) return;
      if (state.route === "live" && state.live) {
        var roomId = state.live;
        API.roomMessages(roomId).then(function (rows) {
          if (state.route !== "live" || state.live !== roomId) return;
          var merged = mergeRoom(rows);
          var next = lineSig(merged);
          if (next === state.roomSig) return;
          state.roomSig = next;
          state.roomLines = merged;
          draw();
        }).catch(function () {});
      } else if (state.route === "chat" && state.chat) {
        reload().catch(function () {});
      }
    }, 4000);
  }

  function lineSig(rows) {
    return (rows || []).map(function (row) { return row.id; }).join();
  }

  function takeLines(rows) {
    return (rows || []).map(function (row) {
      row.sender_id = String(row.sender_id || "").toLowerCase();
      return row;
    });
  }

  function startLive() {
    var stack = document.querySelector(".live-room .stage-stack");
    if (!stack || stack.getAttribute("data-armed") === "1") return;
    var clips = stack.querySelectorAll("video");
    if (clips.length < 2) return;
    stack.setAttribute("data-armed", "1");
    var lead = clips[0];
    var next = clips[1];
    [lead, next].forEach(function (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = false;
      video.playsInline = true;
      video.preload = "auto";
    });
    lead.style.opacity = "1";
    next.style.opacity = "0";
    lead.style.zIndex = "1";
    next.style.zIndex = "0";
    function play(video) {
      var pending = video.play();
      if (pending && pending.catch) pending.catch(function () {});
      return pending;
    }
    var warmed = play(next);
    if (warmed && warmed.then) warmed.then(function () {
      next.pause();
      try { next.currentTime = 0; } catch (err) {}
    }).catch(function () {});
    play(lead);
    function markPlaying() { stack.classList.add("ready"); }
    lead.addEventListener("playing", markPlaying);
    if (!lead.paused && lead.currentTime > 0) markPlaying();
    var handoff = false;
    function pump() {
      if (!stack.isConnected) return;
      if (lead.duration && isFinite(lead.duration)) {
        var remain = lead.duration - lead.currentTime;
        if (!handoff && lead.currentTime > 0.3 && remain < 0.12 && remain > 0) {
          handoff = true;
          try { next.currentTime = 0; } catch (err) {}
          play(next);
          next.style.opacity = "1";
          lead.style.opacity = "0";
          var done = lead;
          lead = next;
          next = done;
          lead.style.zIndex = "1";
          next.style.zIndex = "0";
          setTimeout(function () {
            next.pause();
            try { next.currentTime = 0; } catch (err) {}
            handoff = false;
          }, 80);
        }
      }
      requestAnimationFrame(pump);
    }
    requestAnimationFrame(pump);
  }

  function dismissGift() {
    setTimeout(function () {
      var fx = document.querySelector(".gift-fx");
      if (fx) fx.classList.add("out");
    }, 1400);
    setTimeout(function () {
      state.gift = "";
      var fx = document.querySelector(".gift-fx");
      if (fx) fx.remove();
    }, 1680);
  }

  function quietSend(kind, body, form) {
    var input = form.querySelector("input[name=body], textarea[name=body]");
    if (input) input.value = "";
    if (kind === "chat") {
      var person = state.chat;
      var row = localLine(body);
      var previous = (state.lines[person] || []).slice(-1)[0];
      state.lines[person] = (state.lines[person] || []).concat([row]);
      state.pending = (state.pending || []).concat([{ person: person, row: row }]);
      var box = document.querySelector(".chat-thread");
      if (box && state.route === "chat") {
        var empty = box.querySelector(".empty-pen");
        if (empty) empty.remove();
        box.insertAdjacentHTML("beforeend", chatLineHTML(row, previous, true));
        box.scrollTop = box.scrollHeight;
      } else draw();
      var ready = state.threads[person]
        ? Promise.resolve(state.threads[person])
        : API.openThread(person).then(function () { return reload(); }).then(function () { return state.threads[person]; });
      ready.then(function (thread) {
        if (!thread) throw new Error("Could not open chat");
        return API.sendMessage(thread, body);
      }).then(function () {
        return reload();
      }).catch(function (err) {
        state.pending = (state.pending || []).filter(function (item) { return item.row.id !== row.id; });
        if (state.lines[person]) state.lines[person] = state.lines[person].filter(function (line) { return line.id !== row.id; });
        var node = document.querySelector('[data-local="' + row.id + '"]');
        if (node) node.remove();
        Bridge.toast(err.message || String(err));
      });
      return;
    }
    var roomId = state.live;
    var line = localLine(body);
    state.roomLines = (state.roomLines || []).concat([line]);
    var liveBox = document.querySelector(".live-chat");
    if (liveBox && state.route === "live") {
      liveBox.insertAdjacentHTML("beforeend", liveLineHTML(line));
      liveBox.scrollTop = liveBox.scrollHeight;
    } else draw();
    API.joinRoom(roomId).catch(function () {}).then(function () {
      return API.sendRoomMessage(roomId, body);
    }).then(function () {
      return API.roomMessages(roomId);
    }).then(function (rows) {
      if (state.route !== "live" || state.live !== roomId) return;
      state.roomLines = mergeRoom(rows);
      state.roomSig = lineSig(state.roomLines);
    }).catch(function (err) {
      state.roomLines = (state.roomLines || []).filter(function (item) { return item.id !== line.id; });
      var node = document.querySelector('[data-local="' + line.id + '"]');
      if (node) node.remove();
      Bridge.toast(err.message || String(err));
    });
  }

  function startCamera() {
    var video = document.querySelector("video.local");
    if (!video || !navigator.mediaDevices || callStream) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true }).then(function (stream) {
      callStream = stream;
      video.srcObject = stream;
      video.play();
    }).catch(function () {});
  }

  function stopCamera() {
    if (!callStream) return;
    callStream.getTracks().forEach(function (track) { track.stop(); });
    callStream = null;
  }

  try {
    boot();
  } catch (err) {
    document.getElementById("app").textContent = String(err && err.message ? err.message : err);
  }
})();
