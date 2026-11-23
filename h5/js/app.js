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
    blockRows: [],
    blockOwners: {},
    likes: [],
    roomLikes: [],
    peopleOwner: "",
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
    }
  ];
  var REMOVED_IDS = { "d584bdef-394d-441e-86b0-ab252deb058d": 1 };
  function goneUser(id) { return !!REMOVED_IDS[String(id || "").toLowerCase()]; }

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
  var appleBusy = false;
  var authLocked = false;
  var poller = 0;
  var callStream = null;
  var lastViewportW = 0;
  function syncViewport() {
    var port = window.visualViewport;
    var w = Math.round((port && port.width) || window.innerWidth || 0);
    var h = Math.round((port && port.height) || window.innerHeight || 0);
    document.documentElement.style.setProperty("--app-w", w + "px");
    document.documentElement.style.setProperty("--app-h", h + "px");
    if (lastViewportW && Math.abs(w - lastViewportW) > 48) {
      stack.forEach(function (item) { item.node = null; });
    }
    lastViewportW = w;
  }
  syncViewport();
  window.addEventListener("resize", syncViewport);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncViewport);

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
    raw = String(raw || "");
    if (!raw || raw.indexOf("T") < 0) return "";
    return raw.split("T")[1].slice(0, 5);
  }
  function blocked(id) { return state.blocks.indexOf(String(id || "").toLowerCase()) >= 0; }
  function following(id) {
    id = String(id || "").toLowerCase();
    var me = String(API.me() || "").toLowerCase();
    return state.follows.some(function (row) { return row.follower === me && row.followee === id; });
  }
  function rememberFollow(id, on) {
    var me = String(API.me() || "").toLowerCase();
    id = String(id || "").toLowerCase();
    state.follows = state.follows.filter(function (row) { return !(row.follower === me && row.followee === id); });
    if (on) state.follows.push({ follower: me, followee: id });
  }
  function extraFollowKey() { return "yoohoo.follow.ai." + (API.me() || "anon"); }
  function loadExtraFollows() {
    var ids = [];
    try { ids = JSON.parse(localStorage.getItem(extraFollowKey()) || "[]"); } catch (err) { ids = []; }
    if (!Array.isArray(ids)) ids = [];
    ids.forEach(function (id) { rememberFollow(id, true); });
  }
  function saveExtraFollows() {
    var me = String(API.me() || "").toLowerCase();
    var ids = state.follows.filter(function (row) {
      return row.follower === me && isAI(row.followee);
    }).map(function (row) { return row.followee; });
    try { localStorage.setItem(extraFollowKey(), JSON.stringify(ids)); } catch (err) {}
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
      if (body.type === "edge") onEdge(body.payload || {});
      if (body.type === "keyboard") {
        state.kb = Number((body.payload && body.payload.height) || 0);
        document.documentElement.style.setProperty("--kb", state.kb + "px");
        window.scrollTo(0, 0);
        if (document.body) document.body.scrollTop = 0;
        var app = document.getElementById("app");
        if (app) app.scrollTop = 0;
        var scroller = document.querySelector(".detail-body, .ai-body, .chat-thread");
        if (scroller && state.kb > 0) scroller.scrollTop = scroller.scrollHeight;
      }
    });
    var env = Bridge.env();
    if (env.accessToken) API.setTokens(env.accessToken, env.refreshToken, "");
    document.getElementById("app").addEventListener("click", onClick);
    bindChatSwipe();
    bindPullRefresh();
    bindPostSwipe();
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
    var onAuth = state.route === "auth" || state.route === "signin" || state.route === "register" || state.route === "register2" || state.route === "boot";
    if (payload.signedIn && payload.accessToken) {
      API.setTokens(payload.accessToken, payload.refreshToken, payload.meID);
    } else if (payload.signedIn === false && !authLocked && !appleBusy) {
      API.setTokens("", "", "");
    }
    state.signedIn = !!payload.signedIn;
    state.holdSplash = false;
    if (state.route === "boot") {
      var start = (Bridge.env().startRoute || "");
      var keepAuth = ["auth", "signin", "register", "register2"].indexOf(start) >= 0;
      if (payload.signedIn && payload.accessToken && !keepAuth) {
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
    if (appleBusy || authLocked) return;
    if (payload.signedIn && payload.accessToken && !keepAuth && onAuth) {
      reload().then(function () { stack = []; go("main"); }).catch(function () {});
    } else if (payload.signedIn && payload.accessToken && !state.ready && !onAuth) {
      reload().then(function () { if (pinned) window.goTo(pinned); }).catch(function () {});
    }
    if (payload.signedIn === false && state.route !== "auth" && state.route !== "signin" && state.route !== "register" && state.route !== "register2") {
      stack = [];
      go("auth");
    }
  }

  var feedJob = null;
  var feedGen = 0;
  async function reload(force) {
    if (feedJob && !force) return feedJob;
    var gen = ++feedGen;
    var job = (async function () {
      try {
        await loadFeed();
      } catch (err) {
      } finally {
        if (gen !== feedGen) return;
        state.ready = true;
        applyRemembered();
        draw();
      }
    })();
    feedJob = job;
    try { await job; }
    finally { if (feedJob === job) feedJob = null; }
  }

  function settleList(err) { return []; }

  function takeBlocks(rows, owner) {
    owner = String(owner || "").toLowerCase();
    return (rows || []).map(function (row) {
      return {
        blocker: String(row.blocker || row.blocker_id || "").toLowerCase(),
        blocked: String(row.blocked || row.blocked_id || "").toLowerCase()
      };
    }).filter(function (row) { return row.blocker && row.blocked && !goneUser(row.blocked) && (!owner || row.blocker === owner); });
  }

  async function ensureBlocks(owner) {
    owner = String(owner || "").toLowerCase();
    if (!owner || state.blockOwners[owner]) return;
    state.blockOwners[owner] = 1;
    var rows = [];
    try { rows = await API.blocks(owner); } catch (err) { rows = []; }
    var mine = String(API.me() || "").toLowerCase();
    takeBlocks(rows, owner).forEach(function (row) {
      var exists = state.blockRows.some(function (item) { return item.blocker === row.blocker && item.blocked === row.blocked; });
      if (!exists) state.blockRows.push(row);
    });
    state.blocks = state.blockRows.filter(function (row) { return row.blocker === mine; }).map(function (row) { return row.blocked; });
  }

  async function loadFeed() {
    var me = API.me();
    var first = await Promise.all([
      API.profiles().catch(settleList),
      API.posts().catch(settleList),
      API.rooms().catch(settleList),
      API.follows().catch(settleList),
      API.blocks(me).catch(settleList),
      API.likes().catch(settleList),
      API.threads().catch(settleList),
      API.hides().catch(settleList),
      me ? API.aiLines().catch(settleList) : Promise.resolve([])
    ]);
    function asList(rows) { return Array.isArray(rows) ? rows : []; }
    var profiles = asList(first[0]);
    var posts = asList(first[1]);
    var rooms = asList(first[2]);
    if (!rooms.length) rooms = asList(await API.rooms().catch(settleList));
    if (!posts.length) posts = asList(await API.posts().catch(settleList));
    if (!profiles.length) profiles = asList(await API.profiles().catch(settleList));
    state.posts = posts.slice();
    state.rooms = rooms.slice();
    var map = {};
    profiles.forEach(function (row) {
      row.id = String(row.id || "").toLowerCase();
      if (goneUser(row.id)) return;
      map[row.id] = row;
    });
    AI_ROLES.forEach(function (role) {
      var row = map[role.id] || { id: role.id, name: role.name, handle: role.handle.replace(/^@/, ""), gems: 0 };
      if (!row.avatar_url) row.avatar_url = role.avatar;
      if (!row.name) row.name = role.name;
      if (!row.handle) row.handle = role.handle.replace(/^@/, "");
      map[role.id] = row;
    });
    state.profiles = map;
    state.me = map[API.me()] || state.me;
    loadRoomLikes();
    if (API.me() && map[API.me()]) {
      API.setTokens(API.tokens().access, API.tokens().refresh, API.me());
    } else if (profiles.length && !API.me()) {
      var mine = profiles[0];
      state.me = mine;
    }
    me = API.me();
    var bag = [posts, rooms, first[3], first[4], first[5], first[6], first[7], first[8]];
    var hidden = (bag[6] || []).map(function (row) { return String(row.thread_id || "").toLowerCase(); });
    var threads = (bag[5] || []).filter(function (row) { return hidden.indexOf(String(row.id || "").toLowerCase()) < 0; });
    var extra = await Promise.all([
      API.comments(posts.map(function (p) { return p.id; })).catch(settleList),
      API.messages(threads.map(function (row) { return row.id; })).catch(settleList)
    ]);
    var comments = extra[0] || [];
    var messages = extra[1] || [];
    state.follows = (bag[2] || []).map(function (row) {
      row.follower = String(row.follower || "").toLowerCase();
      row.followee = String(row.followee || "").toLowerCase();
      return row;
    }).filter(function (row) { return !goneUser(row.follower) && !goneUser(row.followee); });
    state.blockRows = takeBlocks(bag[3], me);
    state.blockOwners = {};
    if (me) state.blockOwners[String(me).toLowerCase()] = 1;
    state.blocks = state.blockRows.map(function (row) { return row.blocked; });
    loadExtraFollows();
    state.likes = (bag[4] || []).map(function (row) { return row.post_id; });
    function lower(row, key) { if (row[key]) row[key] = String(row[key]).toLowerCase(); }
    posts.forEach(function (row) { lower(row, "author_id"); lower(row, "id"); });
    rooms.forEach(function (row) { lower(row, "owner_id"); lower(row, "id"); });
    comments.forEach(function (row) { lower(row, "author_id"); lower(row, "id"); lower(row, "post_id"); });
    threads.forEach(function (row) { lower(row, "id"); lower(row, "user_low"); lower(row, "user_high"); });
    messages.forEach(function (row) { lower(row, "thread_id"); lower(row, "sender_id"); });
    state.blocks = state.blocks.map(function (id) { return String(id).toLowerCase(); });
    state.likes = state.likes.map(function (id) { return String(id).toLowerCase(); });
    state.posts = posts.filter(function (row) { return !blocked(row.author_id) && !goneUser(row.author_id); });
    state.rooms = rooms.filter(function (row) { return !blocked(row.owner_id) && !goneUser(row.owner_id); });
    ensureCatalog();
    state.comments = comments.filter(function (row) { return !blocked(row.author_id) && !goneUser(row.author_id); });
    state.threads = {};
    state.people = [];
    state.lines = {};
    if (me) {
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem("yoohoo.ai." + me) || "{}"); } catch (err) { saved = {}; }
      var server = (bag[7] || []).map(function (row) { return { mine: row.mine, body: row.body }; });
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
      if (blocked(other) || goneUser(other) || !map[other]) return;
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
      peopleOwner: state.peopleOwner,
      composeKind: state.composeKind,
      profileTab: state.profileTab,
      postFilter: state.postFilter,
      aboutKind: state.aboutKind,
      aboutId: state.aboutId
    };
  }

  var motion = "replace";
  var incomingPage = null;
  function stashPage() {
    var item = snap();
    var root = document.getElementById("app");
    var current = root && root.querySelector(":scope > .page");
    if (current) item.node = current;
    stack.push(item);
  }
  function applySnap(item) {
    Object.keys(item || {}).forEach(function (key) {
      if (key === "node") return;
      state[key] = item[key];
    });
  }
  function cleanPage(node) {
    if (!node) return node;
    node.classList.remove("edge-under", "edge-top", "motion", "push", "back", "fade", "tab-in", "tab-in-left", "under", "pop", "tab-out", "tab-out-right");
    node.style.transition = "";
    node.style.transform = "";
    return node;
  }
  function go(route, extra) {
    var from = state.route;
    var fromAuth = ["auth", "signin", "register", "register2"].indexOf(state.route) >= 0;
    var toAuth = ["auth", "signin", "register", "register2"].indexOf(route) >= 0;
    if (route === "auth" || (route === "main" && fromAuth)) stack = [];
    else if (state.route !== route || extra) {
      if (!(state.route === "main" && route === "main") && !toAuth) stashPage();
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
    var owner = route === "profile" ? state.profile : (route === "people" ? state.peopleOwner : "");
    if (owner && String(owner).toLowerCase() !== String(API.me() || "").toLowerCase()) {
      ensureBlocks(owner).then(function () {
        if (state.route !== route) return;
        if (route === "profile") paintFollowCounts(owner);
        else draw();
      }).catch(function () {});
    }
  }

  var edgeDrag = null;
  function canEdgeBack() {
    if (state.preview || state.sheet) return false;
    if (state.route === "main" || state.route === "auth" || state.route === "boot") return false;
    return true;
  }
  function edgeBackup() {
    var saved = snap();
    saved.sheet = state.sheet;
    saved.preview = state.preview;
    saved.aiFaq = state.aiFaq;
    return saved;
  }
  function edgeRestore(saved) {
    applySnap(saved);
  }
  function beginEdge() {
    if (edgeDrag || !canEdgeBack()) return false;
    var root = document.getElementById("app");
    var current = root.querySelector(":scope > .page");
    if (!current) return false;
    var prev = stack.length ? stack[stack.length - 1] : null;
    var under = prev && prev.node;
    if (!under) {
      var saved = edgeBackup();
      if (prev) edgeRestore(prev);
      else state.route = API.me() ? "main" : "auth";
      state.sheet = null;
      state.preview = null;
      under = pageView();
      edgeRestore(saved);
    }
    cleanPage(under);
    under.classList.add("page", "edge-under");
    current.classList.add("edge-top");
    under.style.transform = "translate3d(-28%,0,0)";
    root.insertBefore(under, current);
    edgeDrag = { under: under, top: current };
    return true;
  }
  function moveEdge(progress) {
    if (!edgeDrag && !beginEdge()) return;
    var amount = Math.max(0, Math.min(1, Number(progress) || 0));
    edgeDrag.top.style.transition = "none";
    edgeDrag.under.style.transition = "none";
    edgeDrag.top.style.transform = "translate3d(" + (amount * 100) + "%,0,0)";
    edgeDrag.under.style.transform = "translate3d(" + (-28 * (1 - amount)) + "%,0,0)";
  }
  function endEdge(commit) {
    if (!edgeDrag) return;
    var drag = edgeDrag;
    var top = drag.top;
    var under = drag.under;
    top.style.transition = "transform .32s cubic-bezier(0.32, 0.72, 0, 1)";
    under.style.transition = "transform .32s cubic-bezier(0.32, 0.72, 0, 1)";
    top.style.transform = commit ? "translate3d(100%,0,0)" : "translate3d(0,0,0)";
    under.style.transform = commit ? "translate3d(0,0,0)" : "translate3d(-28%,0,0)";
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      edgeDrag = null;
      if (commit) {
        if (state.route === "call") { Bridge.ring(false); stopCamera(); }
        var reused = false;
        if (stack.length) {
          var prev = stack.pop();
          applySnap(prev);
          if (prev.node) syncTabs(prev.node);
          syncTabs(under);
          reused = prev.node === under;
        } else if (state.route !== "main" && state.route !== "auth") {
          state.route = API.me() ? "main" : "auth";
        }
        state.sheet = null;
        state.preview = null;
        incomingPage = null;
        cleanPage(under);
        under.classList.add("page");
        if (top.parentNode) top.remove();
        if (reused) settlePage(true);
        else {
          motion = "replace";
          draw();
        }
        return;
      }
      cleanPage(under);
      if (under.parentNode) under.remove();
      top.style.transition = "";
      top.style.transform = "";
      top.classList.remove("edge-top");
    }
    top.addEventListener("transitionend", finish);
    setTimeout(finish, 380);
  }
  function onEdge(payload) {
    var phase = payload.phase || "";
    var progress = Number(payload.progress || 0);
    if (state.route === "ai" && state.aiFaq && aiLines(state.aiId).length) {
      if (phase === "end" && progress > 0.25) {
        state.aiFaq = false;
        motion = "replace";
        draw();
      }
      return;
    }
    if (state.sheet || state.preview) {
      if (phase === "end") back();
      return;
    }
    if (phase === "move") moveEdge(progress);
    else if (phase === "end") endEdge(true);
    else endEdge(false);
  }

  function back() {
    var active = document.activeElement;
    if (active && active.blur) active.blur();
    if (state.preview) { state.preview = null; motion = "fade"; draw(); return; }
    if (state.sheet) { closeSheet(); return; }
    if (state.route === "call") { Bridge.ring(false); stopCamera(); }
    if (state.route === "register2") {
      dropAuth();
      go("register");
      return;
    }
    if (state.route === "register" || state.route === "signin") {
      dropAuth();
      go("auth");
      return;
    }
        if (stack.length) {
          var prev = stack.pop();
          applySnap(prev);
          if (prev.node) syncTabs(prev.node);
          incomingPage = prev.node || null;
      state.sheet = null;
      state.preview = null;
      motion = "pop";
      draw();
      return;
    }
    if (state.route !== "main" && state.route !== "auth") {
      state.route = API.tokens().access && !authLocked ? "main" : "auth";
      motion = "pop";
      draw();
    }
  }

  function closeSheet() {
    var layer = document.querySelector(".sheet-layer");
    if (!layer || layer.getAttribute("data-closing") === "1") {
      state.sheet = null;
      motion = "replace";
      drawSheet();
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
      drawSheet();
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

  var paintMode = "page";
  function drawSheet() {
    paintMode = "sheet";
    draw();
  }

  function draw() {
    if (edgeDrag) return;
    var root = document.getElementById("app");
    var kind = motion || "replace";
    var mode = paintMode;
    paintMode = "page";
    motion = "replace";
    document.documentElement.style.setProperty("--kb", (state.kb || 0) + "px");
    var previous = root.querySelector(":scope > .page");
    var hadSheet = !!root.querySelector(":scope > .sheet-layer");
    var keptScroll = 0;
    if (previous && kind === "replace") {
      var oldScroll = previous.querySelector('.tab-pane[data-pane="' + state.tab + '"] .scroll') || previous.querySelector(".scroll");
      if (oldScroll) keptScroll = oldScroll.scrollTop;
    }
    var keepPage = mode === "sheet" && previous && kind === "replace";
    var reused = false;
    var next;
    if (keepPage) next = previous;
    else if (incomingPage) {
      next = cleanPage(incomingPage);
      incomingPage = null;
      reused = true;
    } else next = pageView();
    if (!keepPage) next.classList.add("page");
    if (keepPage) {
      /* The list stays mounted so opening a sheet does not replay skeletons. */
    } else if (!previous || kind === "replace") {
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
    settlePage(reused);
  }

  function settlePage(reused) {
    var root = document.getElementById("app");
    startPoll();
    if (state.route === "call") startCamera();
    if (state.route === "live") startLive();
    if (!reused) {
      var thread = document.querySelector(".chat-thread");
      var liveBox = document.querySelector(".live-chat");
      if (thread) thread.scrollTop = thread.scrollHeight;
      if (liveBox) liveBox.scrollTop = liveBox.scrollHeight;
      watchPhotos(root);
    }
    startPostVideos(root);
    syncChrome();
    finishPull();
  }

  function syncChrome() {
    var keepLight = state.route === "boot" || state.route === "auth" || state.route === "live";
    Bridge.post("chrome", { dark: !keepLight });
  }

  function markPostVideo(video, playing) {
    var button = video.parentElement && video.parentElement.querySelector(".play");
    if (!button) return;
    var icon = button.querySelector("img");
    if (icon) icon.src = playing ? "img/PauseButton.svg" : "img/PlayButton.svg";
    button.classList.toggle("on", !!playing);
  }

  function playPostVideo(video) {
    document.querySelectorAll(".post-card video.stage").forEach(function (other) {
      if (other !== video && !other.paused) other.pause();
    });
    video.muted = false;
    var pending = video.play();
    if (pending && pending.catch) {
      pending.catch(function () {
        video.muted = true;
        var again = video.play();
        if (again && again.catch) again.catch(function () { markPostVideo(video, false); });
      });
    }
  }

  function startPostVideos(root) {
    root.querySelectorAll(".post-card video.stage").forEach(function (video) {
      if (video.dataset.bound === "1") return;
      video.dataset.bound = "1";
      video.playsInline = true;
      video.addEventListener("play", function () { markPostVideo(video, true); });
      video.addEventListener("pause", function () { markPostVideo(video, false); });
      video.addEventListener("ended", function () { markPostVideo(video, false); });
      if (video.autoplay || video.hasAttribute("autoplay")) playPostVideo(video);
    });
  }

  function watchPhotos(root) {
    root.querySelectorAll("img").forEach(function (img) {
      if (img.dataset.wait === "1") return;
      if (img.classList.contains("frame") || img.classList.contains("tick") || img.classList.contains("edit")) return;
      var src = img.getAttribute("src") || "";
      var avatar = !img.closest(".pill-act") && (img.classList.contains("av") || img.classList.contains("face") || !!img.closest(".people-row, .pegu-chip, .viewers"));
      var remote = src.indexOf("/storage/") >= 0 || src.indexOf("supabase.co") >= 0;
      if (!avatar && !remote) return;
      if (img.complete && img.naturalWidth) {
        img.dataset.wait = "1";
        return;
      }
      img.dataset.wait = "1";
      img.classList.add("pending");
      var parent = img.parentElement;
      var style = window.getComputedStyle(img);
      var hostStyle = parent ? window.getComputedStyle(parent) : null;
      var box = null;
      if (avatar) {
        img.classList.add("avatar-wait");
        if (style.position === "absolute" && parent) {
          parent.classList.add("wait-avatar");
          box = parent;
        } else if (parent) {
          box = document.createElement("span");
          box.className = "wait-avatar";
          parent.insertBefore(box, img);
          box.appendChild(img);
        }
      } else {
        var fills = hostStyle && style.display === "block" && img.offsetWidth > 48 && Math.abs(img.offsetWidth - parent.clientWidth) < 2;
        if ((style.position === "absolute" || fills) && parent) {
          parent.classList.add("wait-host");
          if (hostStyle.position === "static") parent.classList.add("pin");
          box = parent;
        } else if (parent) {
          box = document.createElement("span");
          box.className = "wait-photo";
          parent.insertBefore(box, img);
          box.appendChild(img);
        }
      }
      function done() {
        img.classList.remove("pending");
        if (box) box.classList.add("ready");
      }
      if (img.complete && img.naturalWidth) done();
      else {
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      }
    });
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
    return el(
      '<div class="screen main-shell">' +
        '<div class="tab-stage">' +
          '<div class="tab-pane' + (state.tab === "home" ? " on" : "") + '" data-pane="home">' + homeList() + "</div>" +
          '<div class="tab-pane' + (state.tab === "post" ? " on" : "") + '" data-pane="post">' + postList() + "</div>" +
          '<div class="tab-pane' + (state.tab === "chat" ? " on" : "") + '" data-pane="chat">' + chatList() + "</div>" +
        "</div>" +
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
    return '<button type="button" class="tab' + (selected ? " on" : "") + '" data-act="tab" data-id="' + id + '" data-on="' + on + '" data-off="' + off + '">' +
      '<span class="icon"><img src="img/' + (selected ? on : off) + '" alt="" /></span>' + label + "</button>";
  }
  function syncTabs(root) {
    var scope = root && root.querySelector ? root : document.querySelector(".main-shell");
    if (!scope) return false;
    var panes = scope.querySelectorAll(".tab-pane");
    if (!panes.length) return false;
    panes.forEach(function (pane) {
      var on = pane.getAttribute("data-pane") === state.tab;
      pane.classList.toggle("on", on);
      if (on) pane.removeAttribute("hidden");
      else pane.setAttribute("hidden", "");
    });
    scope.querySelectorAll(".tabs .tab").forEach(function (btn) {
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
    var cards = !state.ready ? skeletonCards("live") : (state.rooms.map(homeCard).join("") || emptyPen());
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
      '<div class="home-feed home-list">' + cards + "</div></div>";
  }

  function liveBadge() {
    return '<div class="live-badge"><svg class="live-glyph" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">' +
      '<path fill="#FFE412" d="M15.6667 3.11111C15.8855 3.11111 16.1023 3.15422 16.3045 3.23798C16.5067 3.32174 16.6904 3.4445 16.8452 3.59927C16.9999 3.75403 17.1227 3.93776 17.2065 4.13997C17.2902 4.34218 17.3333 4.55891 17.3333 4.77778V12.4444C17.3333 12.6633 17.2902 12.88 17.2065 13.0823C17.1227 13.2845 16.9999 13.4682 16.8452 13.623C16.6904 13.7777 16.5067 13.9005 16.3045 13.9842C16.1023 14.068 15.8855 14.1111 15.6667 14.1111H11.28L14.0656 16.8911C14.1653 16.9913 14.2231 17.1258 14.2271 17.2671C14.2311 17.4085 14.1812 17.546 14.0873 17.6518C13.9934 17.7575 13.8628 17.8235 13.722 17.8363C13.5812 17.8491 13.4408 17.8077 13.3294 17.7206L13.2811 17.6778L9.99944 14.4028L6.71889 17.6778C6.62252 17.7739 6.49421 17.8313 6.35831 17.8391C6.22241 17.8469 6.08838 17.8045 5.98167 17.72L5.93333 17.6767C5.8372 17.5803 5.7798 17.452 5.77201 17.3161C5.76423 17.1802 5.80661 17.0462 5.89111 16.9394L5.93444 16.8911L8.71944 14.1111H4.33333C3.90822 14.1111 3.49916 13.9487 3.18986 13.6571C2.88055 13.3654 2.69438 12.9666 2.66944 12.5422L2.66667 12.4444V4.77778C2.66667 4.55891 2.70978 4.34218 2.79353 4.13997C2.87729 3.93776 3.00006 3.75403 3.15482 3.59927C3.30959 3.4445 3.49332 3.32174 3.69553 3.23798C3.89774 3.15422 4.11446 3.11111 4.33333 3.11111H15.6667ZM15.6667 4.22222H4.33333C4.26038 4.22222 4.18813 4.23659 4.12073 4.26451C4.05333 4.29243 3.99208 4.33335 3.9405 4.38494C3.88891 4.43653 3.84799 4.49777 3.82007 4.56518C3.79215 4.63258 3.77778 4.70482 3.77778 4.77778V12.4444C3.77778 12.5174 3.79215 12.5896 3.82007 12.657C3.84799 12.7244 3.88891 12.7857 3.9405 12.8373C3.99208 12.8889 4.05333 12.9298 4.12073 12.9577C4.18813 12.9856 4.26038 13 4.33333 13H15.6667C15.7396 13 15.8119 12.9856 15.8793 12.9577C15.9467 12.9298 16.0079 12.8889 16.0595 12.8373C16.1111 12.7857 16.152 12.7244 16.1799 12.657C16.2079 12.5896 16.2222 12.5174 16.2222 12.4444V4.77778C16.2222 4.70482 16.2079 4.63258 16.1799 4.56518C16.152 4.49777 16.1111 4.43653 16.0595 4.38494C16.0079 4.33335 15.9467 4.29243 15.8793 4.26451C15.8119 4.23659 15.7396 4.22222 15.6667 4.22222Z"/>' +
      '<path class="bar b1" fill="#FFE412" d="M6.66556 7.72556C6.80172 7.72559 6.93312 7.77562 7.03482 7.86616C7.13652 7.9567 7.20143 8.08143 7.21722 8.21667L7.22111 8.28111V10.5033C7.22095 10.6449 7.16673 10.7811 7.06953 10.8841C6.97232 10.9871 6.83947 11.049 6.69811 11.0573C6.55676 11.0656 6.41757 11.0196 6.30898 10.9287C6.2004 10.8379 6.13061 10.7089 6.11389 10.5683L6.11 10.5033V8.28111C6.11 8.20815 6.12437 8.13591 6.15229 8.06851C6.18021 8.00111 6.22113 7.93986 6.27272 7.88827C6.32431 7.83669 6.38555 7.79576 6.45295 7.76784C6.52036 7.73993 6.5926 7.72556 6.66556 7.72556Z"/>' +
      '<path class="bar b2" fill="#FFE412" d="M8.88778 6.05889C9.02394 6.05892 9.15534 6.10896 9.25704 6.19949C9.35874 6.29003 9.42365 6.41476 9.43944 6.55L9.44333 6.61444V10.5033C9.44318 10.6449 9.38896 10.7811 9.29175 10.8841C9.19455 10.9871 9.06169 11.049 8.92034 11.0573C8.77898 11.0656 8.63979 11.0196 8.5312 10.9287C8.42262 10.8379 8.35284 10.7089 8.33611 10.5683L8.33222 10.5033V6.61444C8.33222 6.54149 8.34659 6.46925 8.37451 6.40184C8.40243 6.33444 8.44335 6.2732 8.49494 6.22161C8.54653 6.17002 8.60777 6.1291 8.67518 6.10118C8.74258 6.07326 8.81482 6.05889 8.88778 6.05889Z"/>' +
      '<path class="bar b3" fill="#FFE412" d="M11.11 7.17C11.2462 7.17003 11.3776 7.22007 11.4793 7.31061C11.581 7.40114 11.6459 7.52587 11.6617 7.66111L11.6656 7.72556V10.5033C11.6654 10.6449 11.6112 10.7811 11.514 10.8841C11.4168 10.9871 11.2839 11.049 11.1426 11.0573C11.0012 11.0656 10.862 11.0196 10.7534 10.9287C10.6448 10.8379 10.5751 10.7089 10.5583 10.5683L10.5544 10.5033V7.72556C10.5544 7.57821 10.613 7.43691 10.7172 7.33272C10.8213 7.22853 10.9627 7.17 11.11 7.17Z"/>' +
      '<path class="bar b4" fill="#FFE412" d="M13.3333 6.61444C13.4695 6.61448 13.6009 6.66451 13.7026 6.75505C13.8043 6.84558 13.8692 6.97032 13.885 7.10556L13.8889 7.17056L13.8867 10.5039C13.8862 10.6454 13.8318 10.7814 13.7345 10.8842C13.6372 10.9869 13.5044 11.0487 13.3631 11.0568C13.2218 11.065 13.0828 11.0189 12.9743 10.928C12.8659 10.8371 12.7962 10.7083 12.7794 10.5678L12.7756 10.5033L12.7778 7.17C12.7778 7.09704 12.7921 7.0248 12.8201 6.9574C12.848 6.89 12.8889 6.82875 12.9405 6.77716C12.9921 6.72558 13.0533 6.68465 13.1207 6.65673C13.1881 6.62881 13.2604 6.61444 13.3333 6.61444Z"/>' +
    "</svg>Live</div>";
  }

  function homeCard(room) {
    var user = state.profiles[room.owner_id] || {};
    var photo = room.cover_url || "img/LiveStage.png";
    var followed = following(room.owner_id);
    var mineRoom = String(room.owner_id || "").toLowerCase() === myId();
    var loved = roomLiked(room.id);
    var split = splitTags(room.title || "");
    return '<article class="live-card">' +
      '<div class="live-photo" data-act="live" data-id="' + room.id + '">' +
        '<img class="stage" src="' + esc(photo) + '" alt="" data-fallback="img/LiveStage.png" />' +
        liveBadge() +
        '<button class="play" data-act="live" data-id="' + room.id + '"><img src="img/PlayButton.svg" alt="" /></button>' +
        '<div class="live-bar">' +
          '<div class="author">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/AIUserFace.png") + '" alt="" data-act="profile" data-id="' + room.owner_id + '" />' +
            '<div class="meta"><div class="nm">' + esc(user.name || "") + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (mineRoom || followed ? "" : '<button class="plus" data-act="follow" data-id="' + room.owner_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
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
    var last = "";
    if (item && item.id) {
      try {
        var sent = await Bridge.upload(item.id, path);
        if (sent && sent.ok !== false && sent.url) return sent.url;
        last = plainError(sent && sent.message);
      } catch (err) {
        last = (err && err.message) || String(err);
      }
    }
    var uri = (item && item.uri) || (typeof item === "string" ? item : "");
    if (uri) {
      try { return await API.upload(path, uri, (item && item.mime) || "image/jpeg"); }
      catch (err) { last = (err && err.message) || String(err); }
    }
    throw new Error(plainError(last) || "Could not upload the photo.");
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

  function skeletonCards(kind) {
    var photo = kind === "post" ? " tall" : "";
    var card = '<article class="live-card skel"><div class="live-photo' + photo + ' skel-block"></div><div class="skel-line"></div><div class="skel-tags"><i></i><i></i></div></article>';
    return card + card;
  }

  function skeletonRows() {
    return '<div class="skel-row"><i></i><span><b class="wide"></b><b class="short"></b></span></div>' +
      '<div class="skel-row"><i></i><span><b class="wide"></b><b class="short"></b></span></div>' +
      '<div class="skel-row"><i></i><span><b class="wide"></b><b class="short"></b></span></div>';
  }

  function skeletonFriends() {
    return '<div class="friend-row skel-friends"><i></i><i></i><i></i><i></i></div>';
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

  function postRows(filter) {
    if (!state.ready) return skeletonCards("post");
    var mine = API.me();
    var rows = state.posts.filter(function (post) {
      if (filter !== "followed") return true;
      return following(post.author_id) || post.author_id === mine;
    });
    return rows.map(postCard).join("") || emptyPen();
  }

  function postList() {
    var shift = state.postFilter === "followed" ? "-50%" : "0";
    return '<div class="feed-page">' +
      '<div class="feed-head">' +
        '<img class="form-sky" src="img/FormSky.png" alt="" />' +
        '<div class="form-title">Post</div>' +
        '<button class="post-chip" data-act="go" data-to="compose"><img class="badge" src="img/PostBadge.png" alt="" /><span>POST</span><img class="pen" src="img/Pencil.svg" alt="" /></button>' +
        '<div class="post-pills">' +
          snowPill("pink" + (state.postFilter === "popular" ? " on" : ""), "post-filter", "popular", "Popular") +
          snowPill("gray" + (state.postFilter === "followed" ? " on" : ""), "post-filter", "followed", "Followed") +
        "</div>" +
        '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
        '<img class="form-sled" src="img/SledMark.png" alt="" />' +
      "</div>" +
      '<div class="post-stage"><div class="post-track" style="transform:translate3d(' + shift + ',0,0)">' +
        '<div class="post-pane scroll"><div class="home-feed">' + postRows("popular") + "</div></div>" +
        '<div class="post-pane scroll"><div class="home-feed">' + postRows("followed") + "</div></div>" +
      "</div></div></div>";
  }

  function postCard(post) {
    var user = state.profiles[post.author_id] || {};
    var photos = post.media_urls || (post.media_url ? [post.media_url] : []);
    var photo = photos[0] || "img/LiveStage.png";
    var followed = following(post.author_id);
    var minePost = String(post.author_id || "").toLowerCase() === myId();
    var split = splitTags(post.body || "");
    var liked = state.likes.indexOf(String(post.id).toLowerCase()) >= 0;
    var onDetail = state.route === "post";
    var poster = String(photo).replace(/\.mp4(\?.*)?$/, ".png$1");
    var stage = post.is_video
      ? '<video class="stage" src="' + esc(photo) + '"' +
        (onDetail ? " autoplay loop" : ' poster="' + esc(poster) + '"') +
        ' playsinline webkit-playsinline preload="' + (onDetail ? "auto" : "metadata") + '"' +
        ' data-act="' + (onDetail ? "toggle-video" : "open-post") + '" data-id="' + post.id + '"></video>'
      : '<img class="stage" src="' + esc(photo) + '" alt="" data-act="preview" data-id="' + post.id + '" />';
    var actions = onDetail ? "" :
      '<button class="icon34" data-act="like" data-id="' + post.id + '"><img src="img/' + (liked ? "LikeOnGlyph.svg" : "LikeGlyph.svg") + '" alt="" /></button>' +
      '<button class="icon34" data-act="open-post" data-id="' + post.id + '"><img src="img/CommentGlyph.svg" alt="" /></button>' +
      '<button class="icon34" data-act="about-post" data-id="' + post.id + '"><img src="img/MoreCircle.svg" alt="" /></button>';
    return '<article class="live-card post-card' + (onDetail ? " detail-card" : "") + '"' +
      (onDetail || !post.is_video ? "" : ' data-act="open-post" data-id="' + post.id + '"') + '>' +
      '<div class="live-photo tall">' +
        stage +
        (post.is_video
          ? '<button class="play' + (onDetail ? " on" : "") + '" data-act="toggle-video" data-id="' + post.id + '"><img src="img/' + (onDetail ? "PauseButton.svg" : "PlayButton.svg") + '" alt="" /></button>' +
            '<button class="vid-full" data-act="full-video" data-id="' + post.id + '"><img src="img/FullScreen.svg" alt="" /></button>'
          : "") +
        '<div class="live-bar">' +
          '<div class="author">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + post.author_id + '" />' +
            '<div class="meta"><div class="nm">' + esc(user.name || "") + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (minePost || followed ? "" : '<button class="plus" data-act="follow" data-id="' + post.author_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" +
          actions +
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
    return bots.concat(state.people.filter(function (person) { return !goneUser(person.id); }).map(function (person) {
      person.handle = (state.profiles[person.id] || {}).handle || "";
      return person;
    }));
  }

  function chatList() {
    var gems = state.me.gems || state.me.coins || 0;
    var listed = listPeople();
    var chips = listed.map(function (person) {
      return '<div class="friend-card" data-act="open-chat" data-id="' + person.id + '">' +
        '<span class="face" data-act="profile" data-id="' + person.id + '"><img src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + person.id + '" />' +
        '<img class="tick" src="img/FriendTick.png" alt="" /></span>' +
        '<span class="nm">' + esc(person.name) + '</span>' +
        '<span class="hd">' + esc(person.handle || "") + "</span></div>";
    }).join("");
    var rows = listed.map(function (person) {
      return '<div class="chat-swipe">' +
        '<button class="chat-del" type="button" data-act="ask-delete-chat" data-id="' + person.id + '"><img src="img/ChatTrash.svg" alt="" /></button>' +
        '<div class="chat-row" data-act="open-chat" data-id="' + person.id + '">' +
        '<img class="av" src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + person.id + '" />' +
        '<span class="meta"><span class="nm">' + esc(person.name) + '</span>' +
        '<span class="pv">' + esc(person.preview) + "</span></span>" +
        (person.time ? '<span class="tm">' + esc(person.time) + "</span>" : "") + "</div></div>";
    }).join("");
    return '<div class="feed-page">' +
      '<div class="feed-head short">' +
        '<img class="form-sky" src="img/FormSky.png" alt="" />' +
        '<div class="form-title">Chat</div>' +
        '<button class="gem-chip" data-act="go" data-to="shop"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
        '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
        '<img class="form-sled" src="img/SledMark.png" alt="" />' +
      "</div>" +
      '<div class="scroll chat-body">' +
        (!state.ready && !chips ? skeletonFriends() : (chips ? '<div class="friend-row">' + chips + "</div>" : "")) +
        (!state.ready ? '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' + skeletonRows() : (rows ? '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' + rows : emptyPen())) +
      "</div></div>";
  }

  function liveClips() {
    var root = (Bridge.env().supabaseURL || "").replace(/\/$/, "");
    if (!root) return [];
    return [1, 2, 3].map(function (n) {
      return root + "/storage/v1/object/public/media/yoohoo/rooms/live-" + n + ".mp4";
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
    var faces = ids.slice(0, 3).map(function (personId) {
      var person = state.profiles[personId] || {};
      return '<img src="' + esc(person.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(personId) + '" />';
    }).join("");
    if (!faces) faces = '<img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(room.owner_id || "") + '" />';
    var welcome = "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.";
    var lines = (state.roomLines || []).map(liveLineHTML).join("");
    var mine = room.owner_id && room.owner_id === API.me();
    return el(
      '<div class="live-room">' +
        stage +
        liveBadge() +
        '<div class="viewers">' + faces +
          '<span class="count" data-act="audience">' + crowd.total + "</span></div>" +
        (user.name ? '<div class="host">' +
          '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(room.owner_id || "") + '" />' +
          '<div class="meta" data-act="profile" data-id="' + esc(room.owner_id || "") + '"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
          (mine || following(room.owner_id) ? "" : '<button class="plus" data-act="follow" data-id="' + room.owner_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
        "</div>" : "") +
        '<div class="live-chat"><div class="welcome">' + welcome + "</div>" + lines + "</div>" +
        '<div class="live-scrim"></div>' +
        '<form class="live-bar-form" data-form="live">' +
          '<label class="say"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></label>' +
          '<button class="sq gift-btn" type="button" data-act="gift"><img src="img/LiveGift.png" alt="" /></button>' +
          '<button class="sq" type="button" data-act="about-person" data-id="' + room.owner_id + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<button class="sq" type="button" data-act="back"><img src="img/LiveClose.svg" alt="" /></button>' +
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
          (!state.ready && !post ? skeletonCards("post") : (post ? postCard(post) : "")) +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Comment</div>' +
          (!state.ready ? skeletonRows() : (comments || empty)) +
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
          '<textarea class="form-area" name="body" placeholder="Please enter...">' + esc(state.draft) + "</textarea>" +
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
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + esc(state.chat || "") + '" />' +
            '<div class="meta" data-act="profile" data-id="' + esc(state.chat || "") + '"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (state.chat && state.chat !== myId()
              ? '<button class="plus" data-act="follow" data-id="' + state.chat + '"><img src="img/' + (following(state.chat) ? "FollowedGlyph.svg" : "BadgePlus.png") + '" alt="" /></button>'
              : "") +
          "</div>" : "") +
          '<img class="form-snow" src="img/SnowHem.png" alt="" />' +
          '<img class="form-sled" src="img/SledMark.png" alt="" />' +
        "</div>" +
        '<div class="scroll chat-thread">' + (!state.ready && !lines ? skeletonRows() : (lines || emptyPen())) + "</div>" +
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
    if (state.aiFaq || !lines.length) {
      body = role.prompts.map(function (text) {
        return '<button class="ai-prompt" type="button" data-act="ai-prompt" data-id="' + esc(text) + '">' +
          '<span class="q"><img src="img/AIPromptIcon.svg" alt="" /></span>' + esc(text) + "</button>";
      }).join("");
    } else {
      body = lines.map(function (row) {
        var text = row.recharge
          ? esc(row.body) + '<button type="button" class="recharge" data-act="go" data-to="shop">Click here to recharge</button>'
          : (row.thinking ? "..." : esc(row.body) + (row.typing ? '<span class="ai-caret"></span>' : ""));
        return '<div class="talk ' + (row.mine ? "me" : "you") + '">' +
          (row.mine ? "" : '<img class="face" src="' + esc(role.avatar) + '" alt="" data-act="profile" data-id="' + esc(role.id) + '" />') +
          '<div class="bubble">' + text + "</div>" +
          (row.mine ? '<img class="face" src="' + esc((state.me && state.me.avatar_url) || "img/AIUserFace.png") + '" alt="" data-act="profile" data-id="' + esc(myId()) + '" />' : "") +
        "</div>";
      }).join("");
    }
    return el(
      '<div class="form-page ai-page">' +
        '<div class="home-head ai-head">' +
          '<img class="home-sky" src="img/HomeSky.png" alt="" />' +
          '<img class="home-cap" src="img/SnowCap.png" alt="" />' +
          '<button class="form-back" data-act="back"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="pegu-chip" data-act="profile" data-id="' + esc(role.id) + '"><img src="' + esc(role.avatar) + '" alt="" /><div><b>' + esc(role.name) + '</b><span>5 /Message</span></div></div>' +
          '<button class="head-icon more" data-act="about-ai"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<div class="home-marks">' +
            '<img class="home-flake-a" src="img/FlakeA.png" alt="" />' +
            '<img class="home-flake-b" src="img/FlakeB.png" alt="" />' +
            '<img class="home-flake-c" src="img/FlakeA.png" alt="" />' +
            '<div class="home-title">' + esc(role.title) + "</div>" +
            (role.blurb ? '<div class="home-blurb">' + esc(role.blurb) + "</div>" : "") +
            '<div class="home-penguin" data-act="profile" data-id="' + esc(role.id) + '"><img src="' + esc(role.avatar) + '" alt="" /></div>' +
          "</div>" +
          '<img class="home-edge" src="img/SnowHem.png" alt="" />' +
        "</div>" +
        '<div class="scroll ai-body">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />' + (state.aiFaq && lines.length ? "Common Questions" : "All Chat") + "</div>" + body +
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
        '<img class="bg" src="' + esc(photo) + '" alt="" data-act="profile" data-id="' + esc(state.chat || (role && role.id) || "") + '" />' +
        '<div class="veil" data-act="profile" data-id="' + esc(state.chat || (role && role.id) || "") + '"></div>' +
        '<video class="local" autoplay playsinline muted></video>' +
        '<div class="call-stack">' +
          '<div class="call-meta"><b>' + esc(user.name || role && role.name || "") + "</b><span>Video Call...</span></div>" +
          '<button class="hang" data-act="back"><img src="img/CallEnd.svg" alt="" /></button>' +
        "</div></div>"
    );
  }

  function profileCards(id) {
    id = id || state.profile || API.me();
    var posts = state.posts.filter(function (row) {
      if (state.profileTab === "like") return state.likes.indexOf(String(row.id).toLowerCase()) >= 0;
      return row.author_id === id;
    });
    var rooms = state.profileTab === "like"
      ? state.rooms.filter(function (room) { return roomLiked(room.id); })
      : [];
    var cards = rooms.map(homeCard).join("") + posts.map(postCard).join("");
    return !state.ready ? skeletonCards("post") : (cards || emptyPen());
  }

  function profileView() {
    var id = state.profile || API.me();
    var user = state.profiles[id] || state.me || {};
    var mine = id && id === API.me();
    var face = user.avatar_url || remembered("avatar", id) || fileURL(id, "avatar.jpg");
    var coverURL = user.cover_url || remembered("cover", id) || fileURL(id, "cover.jpg") || "img/AuthSky.png";
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
            '<button data-act="people" data-id="block"><b>' + relationIds(id, "block").length + "</b><span>Blacklist</span></button>" +
          "</div>" +
          '<div class="post-pills prof-pills">' +
            '<button class="pill pink' + (state.profileTab === "post" ? " on" : "") + '" data-act="profile-tab" data-id="post"><img class="flake" src="img/SnowmanBody.svg" alt="" /><span>Post</span><img class="man" src="img/PillSnowman.svg" alt="" /></button>' +
            '<button class="pill gray' + (state.profileTab === "like" ? " on" : "") + '" data-act="profile-tab" data-id="like"><img class="flake" src="img/SnowmanBody.svg" alt="" /><span>Like</span><img class="man" src="img/PillSnowman.svg" alt="" /></button>' +
          "</div>" +
          '<div class="prof-cards">' + profileCards(id) + "</div>" +
        "</div></div></div>"
    );
  }

  function relationIds(owner, kind) {
    owner = String(owner || "").toLowerCase();
    var seen = {};
    var ids = [];
    function add(id) {
      id = String(id || "").toLowerCase();
      if (!id || id === owner || seen[id]) return;
      seen[id] = 1;
      ids.push(id);
    }
    if (kind === "block") {
      (state.blockRows || []).forEach(function (row) {
        if (String(row.blocker || "").toLowerCase() === owner) add(row.blocked);
      });
      return ids;
    }
    state.follows.forEach(function (row) {
      var follower = String(row.follower || "").toLowerCase();
      var followee = String(row.followee || "").toLowerCase();
      if (kind === "fans") { if (followee === owner) add(follower); }
      else if (follower === owner) add(followee);
    });
    return ids;
  }

  function followCount(id, followingFlag) {
    return relationIds(id, followingFlag ? "follow" : "fans").length;
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
    var arts = ["CoinArt1.png", "CoinArt2.png", "CoinArt3.png", "CoinArt4.png", "CoinArt5.png", "CoinArt6.png", "CoinArt7.png", "CoinArt8.png"];
    var picked = state.shopPick || 0;
    var packs = (Bridge.env().packs || []).slice().sort(function (a, b) {
      return Number(a.amount) - Number(b.amount);
    }).map(function (pack, i) {
      var art = i < 8 ? arts[i] : arts[7];
      return '<button class="pack' + (i === picked ? " on" : "") + '" data-act="buy" data-id="' + esc(pack.id) + '">' +
        '<img class="art" src="img/' + art + '" alt="" />' +
        '<div class="meta"><img src="img/Coin5.png" alt="" /><span>' + pack.amount + "</span></div>" +
        '<span class="price">' + esc(pack.price) + "</span></button>";
    }).join("");
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

  function personLabel(id, user, role) {
    if (role) return { name: role.name || "User", handle: role.handle || "", face: role.avatar || "img/SampleAvatar.png" };
    var row = user || {};
    var name = String(row.name || "").trim();
    var handle = String(row.handle || "").trim();
    if (!name || name.toLowerCase() === String(id || "").toLowerCase() || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(name)) name = "User";
    if (handle && handle.charAt(0) !== "@") handle = "@" + handle;
    if (handle.toLowerCase() === "@" + String(id || "").toLowerCase()) handle = "";
    return { name: name, handle: handle, face: row.avatar_url || "img/SampleAvatar.png" };
  }

  function peopleView() {
    var kind = state.peopleKind;
    var owner = String(state.peopleOwner || API.me() || "").toLowerCase();
    var ids = relationIds(owner, kind);
    var mineList = owner === String(API.me() || "").toLowerCase();
    var title = kind === "fans" ? "Fans" : "Followed";
    var back = kind === "block" && mineList ? "settings" : "profile";
    var rows = ids.map(function (id) {
      var role = aiRole(id);
      var label = personLabel(id, state.profiles[id], role);
      var action = "";
      if (kind === "block") action = mineList ? '<button class="pill-act gray" type="button" data-act="unblock" data-id="' + id + '"><span>Remove</span></button>' : "";
      else action = followButton(id, following(id));
      var open = role ? "open-chat" : "profile";
      return '<div class="people-row"><img src="' + esc(label.face) + '" alt="" data-act="profile" data-id="' + id + '" />' +
        '<div class="meta" data-act="' + open + '" data-id="' + id + '"><b>' + esc(label.name) + "</b><span>" + esc(label.handle) + "</span></div>" + action + "</div>";
    }).join("");
    return el(
      '<div class="form-page">' + formChrome(title, back) +
        '<div class="scroll people-list">' + (!state.ready ? skeletonRows() : (rows || emptyPen())) + "</div></div>"
    );
  }

  function sheetView() {
    var wrap = el('<div class="dim" data-act="close-sheet"></div>');
    var inner = "";
    if (state.sheet === "about") {
      var rows = "";
      if (state.aboutKind === "post") {
        rows = state.aboutMine
          ? '<button class="set-row" data-act="delete-target"><img src="img/SetTrash.svg" alt="" /><span>Delete Post</span></button>'
          : '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>' +
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
        rows = '<button class="set-row" data-act="ai-faq"><img src="img/AIPromptIcon.svg" alt="" /><span>Common Questions</span></button>' +
          '<button class="set-row" data-act="report"><img src="img/MenuReport.svg" alt="" /><span>Report</span></button>';
      } else if (state.aboutMine) {
        rows = "";
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
      var label = personLabel(id, state.profiles[id], aiRole(id));
      var followed = following(id);
      return '<div class="people-row"><img src="' + esc(label.face) + '" alt="" data-act="profile" data-id="' + id + '" />' +
        '<div class="meta" data-act="profile" data-id="' + id + '"><b>' + esc(label.name) + "</b><span>" + esc(label.handle) + "</span></div>" +
        (id === API.me() ? "" : followButton(id, followed)) +
        "</div>";
    }).join("");
    if (state.audienceLoading) return skeletonRows();
    return rows || emptyPen();
  }

  function giftIndex(id) {
    var n = Number(String(id || "").replace("Gift", ""));
    return n ? n - 1 : 0;
  }

  function setPostFilter(id, animate) {
    if (id !== "popular" && id !== "followed") return;
    state.postFilter = id;
    document.querySelectorAll(".post-pills .pill").forEach(function (pill) {
      pill.classList.toggle("on", pill.getAttribute("data-id") === id);
    });
    var track = document.querySelector(".post-track");
    if (!track) return;
    track.style.transition = animate ? "transform .28s cubic-bezier(0.32, 0.72, 0, 1)" : "none";
    track.style.transform = "translate3d(" + (id === "followed" ? "-50%" : "0") + ",0,0)";
  }

  function bindPostSwipe() {
    var drag = { x: 0, y: 0, dx: 0, axis: "", track: null };
    var root = document.getElementById("app");
    root.addEventListener("touchstart", function (event) {
      var stage = event.target.closest(".post-stage");
      var track = stage && stage.querySelector(".post-track");
      if (!track || !event.touches[0] || state.route !== "main" || state.tab !== "post") return;
      drag.track = track;
      drag.x = event.touches[0].clientX;
      drag.y = event.touches[0].clientY;
      drag.dx = 0;
      drag.axis = "";
    }, { passive: true });
    root.addEventListener("touchmove", function (event) {
      if (!drag.track || !event.touches[0]) return;
      var dx = event.touches[0].clientX - drag.x;
      var dy = event.touches[0].clientY - drag.y;
      if (!drag.axis && (Math.abs(dx) >= 12 || Math.abs(dy) >= 12)) drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.axis !== "x") return;
      drag.dx = dx;
      var width = drag.track.parentElement.clientWidth || 1;
      var base = state.postFilter === "followed" ? -width : 0;
      var next = Math.max(-width, Math.min(0, base + dx));
      drag.track.style.transition = "none";
      drag.track.style.transform = "translate3d(" + next + "px,0,0)";
    }, { passive: true });
    root.addEventListener("touchend", function () {
      var axis = drag.axis;
      var dx = drag.dx;
      drag.track = null;
      if (axis !== "x") return;
      var next = state.postFilter;
      if (dx <= -48) next = "followed";
      else if (dx >= 48) next = "popular";
      setPostFilter(next, true);
    });
  }

  var chatDrag = { row: null, x: 0, y: 0, dx: 0, moved: false, axis: "" };
  var pullRefresh = { scroller: null, y: 0, dy: 0, arm: false, loading: false, release: false, hold: 0 };

  function followButton(id, on) {
    return '<button class="pill-act ' + (on ? "gray" : "blue") + '" type="button" data-act="follow" data-id="' + id + '"><span>' +
      (on ? "Followed" : "Follow") +
      (on ? "" : '<img src="img/BadgePlus.png" alt="" />') +
      "</span></button>";
  }

  function sameId(node, id) {
    return String((node && node.getAttribute("data-id")) || "").toLowerCase() === String(id || "").toLowerCase();
  }

  function paintHeart(act, target, on) {
    var src = on ? "img/LikeOnGlyph.svg" : "img/LikeGlyph.svg";
    document.querySelectorAll('[data-act="' + act + '"]').forEach(function (btn) {
      if (!sameId(btn, target)) return;
      var icon = btn.querySelector("img");
      if (icon) icon.src = src;
    });
  }

  function restoreCardFollow(who) {
    document.querySelectorAll(".live-card .author, .host").forEach(function (row) {
      var owner = row.querySelector("[data-id]");
      if (!sameId(owner, who)) return;
      if (row.querySelector('[data-act="follow"]')) return;
      row.appendChild(el('<button class="plus" data-act="follow" data-id="' + who + '"><img src="img/BadgePlus.png" alt="" /></button>'));
    });
  }

  function paintFollow(who, on) {
    document.querySelectorAll('[data-act="follow"]').forEach(function (btn) {
      if (!sameId(btn, who)) return;
      if (btn.classList.contains("pill-act")) {
        btn.className = "pill-act " + (on ? "gray" : "blue");
        btn.innerHTML = "<span>" + (on ? "Followed" : "Follow") + (on ? "" : '<img src="img/BadgePlus.png" alt="" />') + "</span>";
        return;
      }
      if (btn.classList.contains("edit")) {
        btn.classList.toggle("on", on);
        var mark = btn.querySelector("img");
        if (mark) mark.src = on ? "img/FollowedGlyph.svg" : "img/BadgePlus.png";
        return;
      }
      if (btn.closest(".author") || btn.closest(".host")) {
        if (on) btn.remove();
        return;
      }
      var icon = btn.querySelector("img");
      if (icon) icon.src = on ? "img/FollowedGlyph.svg" : "img/BadgePlus.png";
    });
    if (!on) restoreCardFollow(who);
    paintFollowCounts();
  }

  function paintFollowCounts(owner) {
    var stats = document.querySelector(".prof-stats");
    if (!stats) return;
    owner = String(owner || state.profile || API.me() || "").toLowerCase();
    var buttons = stats.querySelectorAll("button");
    var values = [followCount(owner, true), followCount(owner, false), relationIds(owner, "block").length];
    values.forEach(function (value, i) {
      var num = buttons[i] && buttons[i].querySelector("b");
      if (num) num.textContent = value;
    });
  }

  function finishPull() {
    if (!pullRefresh.release) return;
    var height = pullRefresh.hold || 56;
    pullRefresh.release = false;
    pullRefresh.hold = 0;
    pullRefresh.loading = false;
    var panes = document.querySelectorAll(".tab-pane.on .post-pane");
    var host = panes.length
      ? panes[state.postFilter === "followed" ? 1 : 0]
      : document.querySelector(".tab-pane.on .scroll");
    if (!host) return;
    var bounce = document.createElement("div");
    bounce.className = "pull-refresh spin";
    bounce.innerHTML = "<i></i>";
    bounce.style.height = height + "px";
    host.insertBefore(bounce, host.firstChild);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bounce.classList.add("settle");
        bounce.style.height = "0px";
      });
    });
    setTimeout(function () { if (bounce.parentNode) bounce.remove(); }, 720);
  }
  function bindPullRefresh() {
    var root = document.getElementById("app");
    root.addEventListener("touchstart", function (event) {
      if (pullRefresh.loading || state.route !== "main" || !event.touches[0]) return;
      var scroller = event.target.closest(".tab-pane .scroll");
      if (!scroller) {
        var head = event.target.closest(".feed-head");
        if (head && head.parentElement) {
          scroller = head.parentElement.querySelector(":scope > .scroll");
          if (!scroller) {
            var panes = head.parentElement.querySelectorAll(".post-pane");
            scroller = panes[state.postFilter === "followed" ? 1 : 0] || null;
          }
        }
      }
      if (!scroller || scroller.scrollTop > 1) return;
      pullRefresh.scroller = scroller;
      pullRefresh.y = event.touches[0].clientY;
      pullRefresh.dy = 0;
      pullRefresh.arm = false;
    }, { passive: true });
    root.addEventListener("touchmove", function (event) {
      if (!pullRefresh.scroller || !event.touches[0]) return;
      if (pullRefresh.scroller.scrollTop > 1 && pullRefresh.dy <= 0) {
        pullRefresh.scroller = null;
        return;
      }
      var dy = event.touches[0].clientY - pullRefresh.y;
      if (dy <= 0) return;
      pullRefresh.dy = dy;
      pullRefresh.arm = dy > 72;
      var mark = pullRefresh.scroller.querySelector(":scope > .pull-refresh");
      if (!mark) {
        mark = document.createElement("div");
        mark.className = "pull-refresh";
        mark.innerHTML = "<i></i>";
        pullRefresh.scroller.insertBefore(mark, pullRefresh.scroller.firstChild);
      }
      mark.style.height = Math.min(64, dy * 0.45) + "px";
      mark.classList.toggle("ready", pullRefresh.arm);
    }, { passive: true });
    root.addEventListener("touchend", function () {
      var scroller = pullRefresh.scroller;
      var arm = pullRefresh.arm;
      pullRefresh.scroller = null;
      pullRefresh.arm = false;
      if (!scroller) return;
      var mark = scroller.querySelector(":scope > .pull-refresh");
      if (!arm) {
        settlePull(mark);
        return;
      }
      pullRefresh.hold = Math.max(48, mark ? mark.getBoundingClientRect().height : 56);
      pullRefresh.release = true;
      pullRefresh.loading = true;
      reload().catch(function () {
        pullRefresh.release = false;
        pullRefresh.loading = false;
      });
    });
  function settlePull(mark) {
    if (!mark) return;
    var height = mark.getBoundingClientRect().height;
    mark.style.height = height + "px";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        mark.classList.add("settle");
        mark.style.height = "0px";
      });
    });
    setTimeout(function () { if (mark.parentNode) mark.remove(); }, 720);
  }
  }

  function bindChatSwipe() {
    var root = document.getElementById("app");
    root.addEventListener("touchstart", function (event) {
      var row = event.target.closest(".chat-swipe");
      chatDrag.row = row;
      chatDrag.moved = false;
      chatDrag.axis = "";
      chatDrag.dx = 0;
      if (!row || !event.touches[0]) return;
      chatDrag.x = event.touches[0].clientX;
      chatDrag.y = event.touches[0].clientY;
    }, { passive: true });
    root.addEventListener("touchmove", function (event) {
      if (!chatDrag.row || !event.touches[0]) return;
      var dx = event.touches[0].clientX - chatDrag.x;
      var dy = event.touches[0].clientY - chatDrag.y;
      chatDrag.dx = dx;
      if (!chatDrag.axis) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        chatDrag.axis = Math.abs(dx) > Math.abs(dy) && dx < 0 ? "x" : "y";
      }
      if (chatDrag.axis !== "x") return;
      chatDrag.moved = true;
      chatDrag.row.classList.add("dragging");
      var base = chatDrag.row.classList.contains("open") ? -64 : 0;
      var next = Math.max(-64, Math.min(0, base + dx));
      var face = chatDrag.row.querySelector(".chat-row");
      if (face) face.style.transform = "translateX(" + next + "px)";
    }, { passive: true });
    root.addEventListener("touchend", function () {
      var row = chatDrag.row;
      var axis = chatDrag.axis;
      var dx = chatDrag.dx;
      chatDrag.row = null;
      if (!row) return;
      var face = row.querySelector(".chat-row");
      row.classList.remove("dragging");
      if (face) face.style.transform = "";
      document.querySelectorAll(".chat-swipe.open").forEach(function (other) {
        if (other !== row) other.classList.remove("open");
      });
      if (axis === "x" && dx <= -48) row.classList.add("open");
      else row.classList.remove("open");
    });
  }

  function keepDraft() {
    var area = document.querySelector('form[data-form="compose"] textarea[name="body"]');
    if (area) state.draft = area.value;
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
      if (act === "back") {
        if (state.route === "ai" && state.aiFaq && aiLines(state.aiId).length) {
          state.aiFaq = false;
          draw();
        } else back();
      }
      else if (act === "go") {
        var to = node.getAttribute("data-to");
        if (to === "signin" || to === "register" || to === "register2") authLocked = true;
        if (to === "ai") { state.aiId = AI_ROLES[0].id; state.ai = aiLines(AI_ROLES[0].id); }
        go(to, to === "profile" ? { profile: API.me() } : null);
      }
      else if (act === "tab") {
        var shell = node.closest(".main-shell") || document.querySelector(".main-shell");
        var visible = shell && shell.querySelector(".tab-pane.on");
        var visibleId = visible ? visible.getAttribute("data-pane") : "";
        if (id === visibleId && state.tab === id && state.route === "main") {
          var box = shell.querySelector('.tab-pane[data-pane="' + id + '"]');
          var panes = box ? box.querySelectorAll(".post-pane") : [];
          var scroller = panes.length ? panes[state.postFilter === "followed" ? 1 : 0] : (box && box.querySelector(".scroll"));
          if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        var wasMain = state.route === "main" && !!shell;
        state.tab = id;
        state.route = "main";
        if (wasMain && syncTabs(shell)) return;
        motion = "replace";
        draw();
      }
      else if (act === "post-filter") { setPostFilter(id, true); }
      else if (act === "apple") { if (!appleBusy) await apple(); }
      else if (act === "agree") { await Bridge.eula(); go("auth"); }
      else if (act === "follow") {
        var who = String(id || "").toLowerCase();
        if (!who || who === String(API.me() || "").toLowerCase()) return;
        var on = !following(who);
        rememberFollow(who, on);
        if (isAI(who)) saveExtraFollows();
        paintFollow(who, on);
        try { await API.setFollow(who, on); }
        catch (err) {
          if (!alreadyThere(err) && !isAI(who)) {
            rememberFollow(who, !on);
            paintFollow(who, !on);
            throw err;
          }
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
        paintHeart("like", pid, liked);
        if (pid.indexOf("clip-") !== 0) {
          try { await API.like(pid, liked); }
          catch (err) {
            if (!alreadyThere(err)) {
              rememberLike(pid, !liked);
              paintHeart("like", pid, !liked);
              throw err;
            }
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
        paintHeart("like-room", rid, !loved);
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
      else if (act === "profile") { if (id) go("profile", { profile: id }); }
      else if (act === "people") {
        var owner = state.route === "profile" ? (state.profile || API.me()) : API.me();
        go("people", { peopleKind: id, peopleOwner: owner });
      }
      else if (act === "legal") await Bridge.legal(id);
      else if (act === "buy") {
        var pack = node.closest(".pack") || node;
        var grid = pack.parentNode;
        var packs = grid ? Array.prototype.slice.call(grid.querySelectorAll(".pack")) : [];
        var index = packs.indexOf(pack);
        if (index < 0) index = state.shopPick || 0;
        state.shopPick = index;
        packs.forEach(function (item, i) { item.classList.toggle("on", i === index); });
        var bought = await Bridge.buy(id);
        if (bought && bought.ok) await reload();
      }
      else if (act === "profile-tab") {
        if (!id || state.profileTab === id) return;
        state.profileTab = id;
        document.querySelectorAll(".prof-pills .pill").forEach(function (pill) {
          pill.classList.toggle("on", pill.getAttribute("data-id") === id);
        });
        var host = document.querySelector(".prof-cards");
        if (!host) { draw(); return; }
        host.innerHTML = profileCards(state.profile || API.me());
        watchPhotos(host);
        startPostVideos(host);
      }
      else if (act === "clean-cache") { Bridge.toast("Cleaned."); }
      else if (act === "compose-kind") {
        keepDraft();
        if (state.composeKind !== id) {
          state.composeKind = id;
          state.picked = [];
        }
        draw();
      }
      else if (act === "pick-gift") { state.giftPick = id; draw(); }
      else if (act === "pick") {
        keepDraft();
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
      else if (act === "gift") { state.sheet = "gift"; drawSheet(); }
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
      else if (act === "ai-faq") { state.aiFaq = true; state.sheet = null; draw(); }
      else if (act === "add-tag") { keepDraft(); state.sheet = "tag"; drawSheet(); }
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
      else if (act === "toggle-video") {
        var video = node.closest(".live-photo");
        video = video && video.querySelector("video.stage");
        if (!video) return;
        if (video.paused || video.ended) playPostVideo(video);
        else video.pause();
      }
      else if (act === "full-video") {
        var full = node.closest(".live-photo");
        full = full && full.querySelector("video.stage");
        if (!full) return;
        full.playsInline = true;
        if (full.paused || full.ended) playPostVideo(full);
        if (full.webkitEnterFullscreen) full.webkitEnterFullscreen();
        else if (full.requestFullscreen) full.requestFullscreen();
      }
      else if (act === "report") { state.sheet = "report"; drawSheet(); }
      else if (act === "feedback") { state.sheet = "feedback"; drawSheet(); }
      else if (act === "audience") {
        state.sheet = "audience";
        state.audienceLoading = true;
        drawSheet();
        if (state.live) state.audience = await API.roomMembers(state.live).catch(function () { return state.audience; });
        state.audienceLoading = false;
        if (state.sheet === "audience") drawSheet();
      }
      else if (act === "pick-frame") { state.framePick = Number(id); draw(); }
      else if (act === "confirm-logout") { stack = []; await Bridge.signOut(); go("auth"); }
      else if (act === "confirm-erase") { stack = []; await API.deleteAccount(); await Bridge.signOut(); go("auth"); }
      else if (act === "block-user") { state.sheet = "blacklist"; drawSheet(); }
      else if (act === "delete-target") {
        state.sheet = state.aboutKind === "chat" ? "delete-chat" : "delete-post";
        drawSheet();
      }
      else if (act === "delete-comment") {
        await API.deleteComment(state.aboutId);
        state.sheet = null;
        await reload();
        Bridge.toast("Deleted.");
      }
      else if (act === "confirm-delete-post") {
        if (!state.aboutMine) return;
        var postId = String(state.aboutId || "");
        if (postId && postId.indexOf("clip-") !== 0) await API.deletePost(postId);
        state.sheet = null;
        var leavePost = state.route === "post";
        await reload();
        Bridge.toast("Deleted.");
        if (leavePost) back();
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
        var target = String(state.reportTarget || "").toLowerCase();
        if (!target || target === myId()) {
          Bridge.toast("You can't block yourself.");
          return;
        }
        try { await API.block(target); }
        catch (err) { if (!alreadyThere(err)) throw err; }
        state.sheet = null;
        var leave = state.route !== "main";
        motion = "replace";
        draw();
        Bridge.toast("Added to Blacklist.");
        try { await reload(); } catch (err) {}
        if (leave && state.route !== "main") back();
      }
      else if (act === "unblock") { await API.unblock(id); await reload(); Bridge.toast("Removed."); }
      else if (act === "logout") { state.sheet = "logout"; drawSheet(); }
      else if (act === "erase") { state.sheet = "erase"; drawSheet(); }
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
      state.aboutMine = post && String(post.author_id || "").toLowerCase() === myId();
    } else if (kind === "comment") {
      var comment = state.comments.filter(function (row) { return row.id === id; })[0];
      state.reportTarget = comment ? comment.author_id : id;
      state.aboutMine = comment && String(comment.author_id || "").toLowerCase() === myId();
    } else {
      state.reportTarget = id === "pegu" ? AI_ROLES[0].id : (id || state.chat);
      state.aboutMine = String(state.reportTarget || "").toLowerCase() === myId();
    }
    if (kind !== "post" && kind !== "comment" && kind !== "chat" && kind !== "ai" && state.aboutMine) return;
    state.sheet = "about";
    drawSheet();
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
      if (kind === "compose") {
        var area = form.querySelector("textarea[name=body]");
        if (area) state.draft = area.value;
        filled = !!(state.picked && state.picked.length);
      }
      else if (kind === "edit") filled = !!(event.target.value || "").trim();
      else filled = Array.prototype.every.call(form.querySelectorAll("input[required], input[name]"), function (input) {
        return String(input.value || "").trim();
      });
      btn.src = filled ? "img/ButtonBlue.svg" : "img/ButtonGray.svg";
    }
  }

  async function dropAuth() {
    authLocked = true;
    API.setTokens("", "", "");
    state.signedIn = false;
    try { await Bridge.signOut(); } catch (err) {}
  }
  async function apple() {
    if (appleBusy || busy) return;
    appleBusy = true;
    busy = true;
    authLocked = true;
    try {
      await Bridge.eula();
      var result = await Bridge.apple();
      if (!result || result.ok !== true) {
        if (result && !result.cancelled && result.error) Bridge.toast(result.error);
        await dropAuth();
        return;
      }
      await Bridge.wait(true);
      await reload();
      authLocked = false;
      go("main");
    } catch (err) {
      await dropAuth();
      Bridge.toast((err && err.message) || String(err));
    } finally {
      appleBusy = false;
      busy = false;
      await Bridge.wait(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    var form = event.target;
    var kind = form.getAttribute("data-form");
    var data = new FormData(form);
    var body = String(data.get("body") || "").trim();
    if (busy || appleBusy) return;
    var notice = "";
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
        authLocked = true;
        await Bridge.eula();
        await API.signIn(String(data.get("email") || ""), String(data.get("password") || ""));
        try { await Bridge.setSession(API.tokens().access, API.tokens().refresh); } catch (err) {}
        try { await reload(true); } catch (err) {}
        authLocked = false;
        stack = [];
        go("main");
      } else if (kind === "register2") {
        authLocked = true;
        await Bridge.eula();
        if (!API.tokens().access) {
          await API.signUp(state.form.email, state.form.password, state.form.name);
        }
        if (!API.tokens().access) throw new Error("Sign in failed");
        try { await Bridge.setSession(API.tokens().access, API.tokens().refresh); } catch (err) {}
        var avatar = "";
        var coverURL = "";
        if (state.avatarPickId || state.avatarPick) {
          avatar = rememberMedia("avatar", await uploadPick({ id: state.avatarPickId, uri: state.avatarPick }, API.me() + "/avatar.jpg"));
        }
        if (state.coverPickId || state.coverPick) {
          coverURL = rememberMedia("cover", await uploadPick({ id: state.coverPickId, uri: state.coverPick }, API.me() + "/cover.jpg"));
        }
        try { await API.saveProfile(state.form.name, avatar, coverURL); } catch (err) {}
        state.avatarPick = ""; state.avatarPickId = ""; state.coverPick = ""; state.coverPickId = "";
        try { await reload(true); } catch (err) {}
        authLocked = false;
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
        state.draft = "";
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
      } else if (kind === "feedback") {
        if (!body) { Bridge.toast("Please enter..."); return; }
        await API.feedback(body);
        state.sheet = null;
        Bridge.toast("Sent.");
        draw();
      }
      else if (kind === "report") {
        var reason = String(data.get("reason") || body).trim();
        if (!reason) notice = "Please enter...";
        else {
          try { await API.report(state.reportTarget, reason); }
          catch (err) { if (!alreadyThere(err)) throw err; }
          state.sheet = null;
          notice = "Reported.";
          draw();
        }
      }
    } catch (err) {
      notice = "";
      if ((kind === "signin" || kind === "register2") && !API.tokens().access) await dropAuth();
      Bridge.toast(err.message || String(err));
    } finally {
      busy = false;
      await Bridge.wait(false);
      if (notice) Bridge.toast(notice);
    }
  }

  function peguReply(text, lines) {
    var q = String(text || "").trim();
    var low = q.toLowerCase();
    var prev = "";
    for (var i = (lines || []).length - 1; i >= 0; i--) {
      if (!lines[i].mine && lines[i].body && !lines[i].recharge && !lines[i].thinking) {
        prev = String(lines[i].body).toLowerCase();
        break;
      }
    }
    if (/^(yes|yeah|yep|sure|ok|okay)\b/.test(low)) {
      if (prev.indexOf("night") >= 0) return "Then come after dark. The lights on the slope look like stars sitting on the snow.";
      if (prev.indexOf("alone") >= 0 || prev.indexOf("buddies") >= 0) return "Good. I'll keep a seat on the lift. A small group makes the long runs easier.";
      if (prev.indexOf("weekend") >= 0) return "Then let's go. I'll meet you by the beginner lift if the snow is soft.";
      return "Good. Tell me which run you want, and I'll ski it with you.";
    }
    if (/^(no|nope|nah)\b/.test(low)) {
      return "That's all right. We can stay on the easy slope and take it slow.";
    }
    if (low.indexOf("weekend") >= 0) return "I did go. The snow was fresh and the lift line was short. Did you get out too?";
    if (low.indexOf("alone") >= 0 || low.indexOf("buddies") >= 0 || low.indexOf("group") >= 0) {
      return "I like a small group. Skiing alone is quiet, but buddies make the long runs warmer.";
    }
    if (low.indexOf("night") >= 0) return "Yes. Night skiing is my favorite. The slope lights turn the snow blue.";
    if (low.indexOf("rent") >= 0 || low.indexOf("boot") >= 0 || low.indexOf("pole") >= 0 || low.indexOf("helmet") >= 0 || low.indexOf("goggle") >= 0) {
      return "Rent the skis, boots and poles at the resort. Buy your own helmet, goggles and base layers.";
    }
    if (low.indexOf("where") >= 0) return "The easy slope is the one with the wide snow and the short lift. I can wait for you there.";
    if (low.indexOf("fall") >= 0 || low.indexOf("crash") >= 0 || low.indexOf("scared") >= 0 || low.indexOf("afraid") >= 0) {
      return "Falls happen. Bend your knees, look downhill, and stand up when you are ready. I will wait.";
    }
    if (low.indexOf("hello") >= 0 || low.indexOf("hi") === 0 || low.indexOf("hey") === 0) {
      return "Hi. I'm Pegu. Tell me about your last run, or pick a question above.";
    }
    var clip = q.length > 90 ? q.slice(0, 87) + "..." : q;
    return "You said \"" + clip + "\". I picture that on the snow. What happened next on the slope?";
  }

  function askRecharge(lines, body) {
    lines.push({ mine: true, body: body });
    lines.push({ mine: false, recharge: true, body: "You need 5 coins for a reply. " });
    state.aiFaq = false;
    persistAI();
    draw();
  }

  async function sendAI(text) {
    var body = String(text || "").trim();
    if (!body) return;
    var role = aiRole(state.aiId) || AI_ROLES[0];
    state.aiId = role.id;
    state.aiFaq = false;
    var lines = aiLines(role.id);
    state.ai = lines;
    var gems = Number((state.me && (state.me.gems != null ? state.me.gems : state.me.coins)) || 0);
    if (gems < 5) {
      askRecharge(lines, body);
      return;
    }
    lines.push({ mine: true, body: body });
    var think = { mine: false, body: "", thinking: true };
    lines.push(think);
    draw();
    try {
      try { await API.addAI(true, body); } catch (err) {}
      var left = await API.spendGems(5);
      if (state.me && typeof left === "number") state.me.gems = left;
    } catch (err) {
      var msg = String((err && err.message) || err);
      if (/not enough/i.test(msg)) {
        lines.pop();
        lines.pop();
        askRecharge(lines, body);
        return;
      }
      if (state.me) state.me.gems = Math.max(0, gems - 5);
    }
    if (state.route !== "ai") { persistAI(); return; }
    var answer = peguReply(body, lines);
    await typeAI(think, answer);
    persistAI();
    try { await API.addAI(false, answer); } catch (err) {}
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
