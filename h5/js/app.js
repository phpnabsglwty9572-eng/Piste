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
    ai: [],
    form: { email: "", password: "", name: "" },
    composeKind: "image",
    giftPick: "Gift01",
    profileTab: "post",
    framePick: -1,
    tags: [],
    draft: "",
    reportTarget: "",
    eula: ""
  };

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
    return state.follows.some(function (row) { return row.follower === API.me() && row.followee === id; });
  }

  async function boot() {
    Bridge.onNative(function (body) {
      if (body.type === "session") applyNativeSession(body.payload || {});
    });
    var env = Bridge.env();
    if (env.accessToken) API.setTokens(env.accessToken, env.refreshToken, "");
    document.getElementById("app").addEventListener("click", onClick);
    document.getElementById("app").addEventListener("submit", onSubmit);
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
      go("auth");
    }
    Bridge.post("ready");
    if (env.accessToken) {
      try {
        await reload();
        if (["posts","posts-followed","chats","live","gift","post","compose","chat","profile","settings","shop","followed","fans","block","edit","feedback","logout","erase","about","audience","report","tag","ai","call","giftfx","about-post","about-chat","video","delete-post","delete-chat","live-block","register2"].indexOf(start) >= 0) window.goTo(start);
        else go("main");
      } catch (err) { go("auth"); }
    }
  }

  function applyNativeSession(payload) {
    if (payload.accessToken) API.setTokens(payload.accessToken, payload.refreshToken, payload.meID);
    state.me.name = payload.meName || state.me.name;
    state.me.gems = payload.coins || state.me.gems;
    if (payload.signedIn && state.route === "auth") {
      reload().then(function () { go("main"); }).catch(function () {});
    }
    if (payload.signedIn === false && state.route !== "auth") go("auth");
  }

  async function reload() {
    var profiles = await API.profiles();
    var map = {};
    profiles.forEach(function (row) { map[row.id] = row; });
    var ids = Object.keys(map);
    state.profiles = map;
    state.me = map[API.me()] || state.me;
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
    state.follows = await API.follows();
    state.blocks = (await API.blocks()).map(function (row) { return row.blocked; });
    state.likes = (await API.likes()).map(function (row) { return row.post_id; });
    var threads = await API.threads();
    var hidden = (await API.hides()).map(function (row) { return row.thread_id; });
    threads = threads.filter(function (row) { return hidden.indexOf(row.id) < 0; });
    var messages = await API.messages(threads.map(function (row) { return row.id; }));
    state.posts = posts.filter(function (row) { return !blocked(row.author_id); });
    state.rooms = rooms.filter(function (row) { return !blocked(row.owner_id); });
    state.comments = comments.filter(function (row) { return !blocked(row.author_id); });
    state.threads = {};
    state.people = [];
    state.lines = {};
    if (me) {
      try {
        state.ai = (await API.aiLines() || []).map(function (row) { return { mine: row.mine, body: row.body }; });
      } catch (err) { state.ai = state.ai || []; }
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
    draw();
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
    else go(route);
  };
  function go(route, extra) {
    state.route = route;
    state.sheet = null;
    if (extra) Object.keys(extra).forEach(function (key) { state[key] = extra[key]; });
    draw();
  }

  function draw() {
    var root = document.getElementById("app");
    if (state.route === "auth") root.replaceChildren(authView());
    else if (state.route === "register" || state.route === "signin") root.replaceChildren(formView());
    else if (state.route === "register2") root.replaceChildren(registerPhotosView());
    else if (state.route === "eula") root.replaceChildren(eulaView());
    else if (state.route === "live") root.replaceChildren(liveView());
    else if (state.route === "post") root.replaceChildren(postView());
    else if (state.route === "compose") root.replaceChildren(composeView());
    else if (state.route === "chat") root.replaceChildren(chatView());
    else if (state.route === "ai") root.replaceChildren(aiView());
    else if (state.route === "profile") root.replaceChildren(profileView());
    else if (state.route === "settings") root.replaceChildren(settingsView());
    else if (state.route === "shop") root.replaceChildren(shopView());
    else if (state.route === "edit") root.replaceChildren(editView());
    else if (state.route === "call") root.replaceChildren(callView());
    else if (state.route === "people") root.replaceChildren(peopleView());
    else root.replaceChildren(mainView());
    if (state.sheet) root.appendChild(sheetView());
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
    return '<div class="form-head">' +
      '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
      '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
      '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
      '<button class="form-back" data-act="go" data-to="' + back + '"><img src="img/BackButton.svg" alt="" /></button>' +
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
    var body = state.tab === "home" ? homeList() : state.tab === "post" ? postList() : chatList();
    return el(
      '<div class="screen">' + body +
        '<div class="tabs">' +
          tabBtn("home", "home", "TabHome.png", "TabHomeOff.png") +
          tabBtn("post", "post", "TabPostOn.png", "TabPost.png") +
          tabBtn("chat", "chat", "TabChatOn.png", "TabChat.png") +
        "</div></div>"
    );
  }
  function tabBtn(id, label, on, off) {
    var selected = state.tab === id;
    return '<button class="tab' + (selected ? " on" : "") + '" data-act="tab" data-id="' + id + '">' +
      '<span class="icon"><img src="img/' + (selected ? on : off) + '" alt="" /></span>' + label + "</button>";
  }

  function homeList() {
    var me = state.profiles[API.me()] || state.me || {};
    var face = me.avatar_url || "img/AIUserFace.png";
    var cards = state.rooms.map(homeCard).join("");
    var empty = emptyPen();
    return '<div class="scroll">' +
      '<div class="home-head">' +
        '<img class="home-sky" src="img/HomeSky.png" alt="" />' +
        '<img class="home-cap" src="img/SnowCap.png" alt="" />' +
        '<img class="home-edge" src="img/SnowEdge.png" alt="" />' +
        '<div class="home-marks">' +
          '<img class="home-flake-a" src="img/FlakeA.png" alt="" />' +
          '<img class="home-flake-b" src="img/FlakeB.png" alt="" />' +
          '<img class="home-flake-c" src="img/FlakeA.png" alt="" />' +
          '<button class="home-title" data-act="go" data-to="ai">Glide into winter with Pegu</button>' +
          '<button class="home-blurb" data-act="go" data-to="ai">Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.</button>' +
          '<button class="home-penguin" data-act="go" data-to="ai"><img src="img/Penguin.png" alt="" style="width:150px;height:140px;object-fit:cover" /></button>' +
          '<button class="home-avatar" data-act="go" data-to="profile">' +
            '<img class="face" src="' + esc(face) + '" alt="" />' +
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
          '<button class="icon34" data-act="follow" data-id="' + room.owner_id + '"><img src="img/' + (followed ? "FollowedGlyph.svg" : "FollowGlyph.svg") + '" alt="" /></button>' +
          '<button class="icon34" data-act="about-person" data-id="' + room.owner_id + '"><img src="img/MoreGlyph.svg" alt="" /></button>' +
        "</div></div>" +
      '<div class="caption">' + esc(split.caption) + "</div>" +
      '<div class="tags">' + split.tags.map(function (tag) { return '<span class="tag">' + esc(tag) + "</span>"; }).join("") + "</div>" +
      "</article>";
  }

  function pickedURI(payload) {
    var items = (payload && payload.items) || [];
    return (items[0] || {}).uri || "";
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
    return '<div class="empty-pen' + (size ? " " + size : "") + '"><img class="pen" src="img/Penguin.png" alt="" /><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></div>';
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
        '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
        '<button class="form-back" data-act="tab" data-id="home"><img src="img/BackButton.svg" alt="" /></button>' +
        '<div class="form-title">Post</div>' +
        '<button class="post-chip" data-act="go" data-to="compose"><img class="badge" src="img/PostBadge.png" alt="" /><span>POST</span><img class="pen" src="img/Pencil.svg" alt="" /></button>' +
        '<div class="post-pills">' +
          '<button class="pill pink' + (state.postFilter === "popular" ? " on" : "") + '" data-act="post-filter" data-id="popular">Popular</button>' +
          '<button class="pill gray' + (state.postFilter === "followed" ? " on" : "") + '" data-act="post-filter" data-id="followed">Followed</button>' +
        "</div>" +
        '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
        '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
      "</div>" +
      '<div class="scroll home-feed">' + (cards || empty) + "</div></div>";
  }

  function postCard(post) {
    var user = state.profiles[post.author_id] || {};
    var photos = post.media_urls || (post.media_url ? [post.media_url] : []);
    var photo = photos[0] || "img/LiveStage.png";
    var followed = following(post.author_id);
    var split = splitTags(post.body || "");
    var liked = state.likes.indexOf(post.id) >= 0;
    return '<article class="live-card post-card">' +
      '<div class="live-photo tall">' +
        '<img class="stage" src="' + esc(photo) + '" alt="" data-act="open-post" data-id="' + post.id + '" />' +
        (post.is_video ? '<button class="play" data-act="open-post" data-id="' + post.id + '"><img src="img/PlayButton.svg" alt="" /></button>' : "") +
        '<div class="live-bar">' +
          '<div class="author">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" data-act="profile" data-id="' + post.author_id + '" />' +
            '<div class="meta"><div class="nm">' + esc(user.name || "") + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (followed ? "" : '<button class="plus" data-act="follow" data-id="' + post.author_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" +
          '<button class="icon34" data-act="like" data-id="' + post.id + '"><img src="img/' + (liked ? "LikeOnGlyph.svg" : "FollowGlyph.svg") + '" alt="" /></button>' +
          '<button class="icon34" data-act="open-post" data-id="' + post.id + '"><img src="img/CommentGlyph.svg" alt="" /></button>' +
          '<button class="icon34" data-act="about-post" data-id="' + post.id + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
        "</div></div>" +
      '<div class="caption">' + esc(split.caption) + "</div>" +
      '<div class="tags">' + split.tags.map(function (tag) { return '<span class="tag">' + esc(tag) + "</span>"; }).join("") +
        '<span class="stamp">' + stamp(post.created_at) + "</span></div>" +
      "</article>";
  }

  function chatList() {
    var gems = state.me.gems || state.me.coins || 0;
    var chips = state.people.map(function (person) {
      return '<button class="friend-card" data-act="open-chat" data-id="' + person.id + '">' +
        '<span class="face"><img src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" />' +
        '<img class="tick" src="img/VerifyBadge.png" alt="" /></span>' +
        '<span class="nm">' + esc(person.name) + '</span>' +
        '<span class="hd">' + esc((state.profiles[person.id] || {}).handle || "") + "</span></button>";
    }).join("");
    var rows = state.people.map(function (person) {
      return '<button class="chat-row" data-act="open-chat" data-id="' + person.id + '">' +
        '<img class="av" src="' + esc(person.avatar || "img/SampleAvatar.png") + '" alt="" />' +
        '<span class="meta"><span class="nm">' + esc(person.name) + '</span>' +
        '<span class="pv">' + esc(person.preview) + "</span></span>" +
        '<span class="tm">' + esc(person.time) + "</span></button>";
    }).join("");
    return '<div class="feed-page">' +
      '<div class="feed-head short">' +
        '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
        '<button class="form-back" data-act="tab" data-id="home"><img src="img/BackButton.svg" alt="" /></button>' +
        '<div class="form-title">Chat</div>' +
        '<button class="gem-chip" data-act="go" data-to="ai"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
        '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
        '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
      "</div>" +
      '<div class="scroll chat-body">' +
        (chips ? '<div class="friend-row">' + chips + "</div>" : "") +
        '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' +
        (rows || emptyPen()) +
      "</div></div>";
  }

  function liveView() {
    var room = state.rooms.filter(function (row) { return row.id === state.live; })[0] || {};
    var user = state.profiles[room.owner_id] || {};
    var photo = room.cover_url || "img/LiveStage.png";
    var faces = ["img/LiveFace1.png", "img/LiveFace2.png", "img/LiveFace3.png"];
    var welcome = "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.";
    var lines = (state.roomLines || []).map(function (line) {
      var who = state.profiles[line.sender_id] || {};
      return '<div class="live-line"><span class="who">' + esc(who.name || "") + "</span> " + esc(line.body) + "</div>";
    }).join("");
    return el(
      '<div class="live-room">' +
        '<img class="stage" src="' + esc(photo) + '" alt="" />' +
        '<div class="live-badge"><img src="img/LiveGlyph.svg" alt="" />Live</div>' +
        '<button class="viewers" data-act="audience">' + faces.map(function (src) { return '<img src="' + src + '" alt="" />'; }).join("") +
          '<span class="count">40+</span></button>' +
        (user.name ? '<div class="host">' +
          '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
          '<div class="meta"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
          (following(room.owner_id) ? "" : '<button class="plus" data-act="follow" data-id="' + room.owner_id + '"><img src="img/BadgePlus.png" alt="" /></button>') +
        "</div>" : "") +
        '<div class="live-chat"><div class="welcome">' + welcome + "</div>" + lines + "</div>" +
        '<div class="live-scrim"></div>' +
        '<form class="live-bar-form" data-form="live">' +
          '<label class="say"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></label>' +
          '<button class="sq gift-btn" type="button" data-act="gift"><img src="img/LiveGift.png" alt="" /></button>' +
          '<button class="sq" type="button" data-act="about-person" data-id="' + room.owner_id + '"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<button class="sq" type="button" data-act="go" data-to="main"><img src="img/LiveShare.svg" alt="" /></button>' +
        "</form>" +
        (state.gift ? '<div class="gift-fx"><img src="img/' + esc(state.gift) + '.png" alt="" /><span class="word">Send</span><span class="who">' + esc((state.me && state.me.name) || "") + "</span></div>" : "") +
      "</div>"
    );
  }

  function postView() {
    var post = state.posts.filter(function (row) { return row.id === state.post; })[0];
    var comments = state.comments.filter(function (row) { return post && row.post_id === post.id; }).map(function (row) {
      var user = state.profiles[row.author_id] || {};
      return '<div class="cmt"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
        '<div class="cmt-body"><div class="cmt-top"><b>' + esc(user.name || "") + ":</b><span>" + stamp(row.created_at) + "</span></div>" +
        "<p>" + esc(row.body) + "</p></div></div>";
    }).join("");
    var empty = emptyPen("small");
    return el(
      '<div class="form-page">' +
        '<div class="form-head">' +
          '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
          '<button class="form-back" data-act="go" data-to="main"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Detail</div>' +
          (post ? '<button class="head-icon like" data-act="like" data-id="' + post.id + '"><img src="img/' + (state.likes.indexOf(post.id) >= 0 ? "LikeOnGlyph.svg" : "FollowGlyph.svg") + '" alt="" /></button>' : "") +
          (post ? '<button class="head-icon more" data-act="about-post" data-id="' + post.id + '"><img src="img/MoreCircle.svg" alt="" /></button>' : "") +
          '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
          '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
        "</div>" +
        '<div class="scroll detail-body">' +
          (post ? postCard(post) : "") +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />Comment</div>' +
          (comments || empty) +
        "</div>" +
        '<form class="pink-enter" data-form="comment"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></form>' +
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
          '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
          '<button class="form-back" data-act="go" data-to="main"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Create post</div>' +
          '<div class="post-pills compose-pills">' +
            '<button class="pill pink' + (imageTab ? " on" : "") + '" type="button" data-act="compose-kind" data-id="image">Image</button>' +
            '<button class="pill gray' + (imageTab ? "" : " on") + '" type="button" data-act="compose-kind" data-id="video">Video</button>' +
          "</div>" +
          '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
          '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
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
      var mine = row.sender_id === API.me();
      var stampRow = stamp(row.created_at);
      var prev = all[i - 1];
      var showTime = !prev || stamp(prev.created_at) !== stampRow;
      return (showTime && stampRow ? '<div class="chat-time">' + stampRow + "</div>" : "") +
        '<div class="talk ' + (mine ? "me" : "you") + '">' +
          (mine ? "" : '<img class="face" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />') +
          '<div class="bubble">' + esc(row.body) + "</div>" +
          (mine ? '<img class="face" src="' + esc((state.me && state.me.avatar_url) || "img/SampleAvatar.png") + '" alt="" />' : "") +
        "</div>";
    }).join("");
    return el(
      '<div class="form-page">' +
        '<div class="form-head">' +
          '<img class="form-sky" src="img/AuthSky.png" alt="" />' +
          '<button class="form-back" data-act="go" data-to="main"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">' + esc(user.name || "Chat") + "</div>" +
          (user.name ? '<div class="head-host">' +
            '<img class="av" src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
            '<div class="meta"><div class="nm">' + esc(user.name) + '</div><div class="hd">' + esc(user.handle || "") + "</div></div>" +
            (following(state.chat) ? "" : '<button class="plus" data-act="follow" data-id="' + state.chat + '"><img src="img/BadgePlus.png" alt="" /></button>') +
          "</div>" : "") +
          '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
          '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
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
    var prompts = [
      "Did you go skiing this weekend?",
      "Do you usually go skiing alone, or hang out with a group of ski buddies?",
      "Have you ever tried night skiing? I heard the lights on the slope look beautiful."
    ];
    var body;
    if (state.ai.length) {
      body = state.ai.map(function (row) {
        return '<div class="talk ' + (row.mine ? "me" : "you") + '">' +
          (row.mine ? "" : '<img class="face" src="img/Penguin.png" alt="" />') +
          '<div class="bubble">' + esc(row.body) + "</div>" +
          (row.mine ? '<img class="face" src="' + esc((state.me && state.me.avatar_url) || "img/AIUserFace.png") + '" alt="" />' : "") +
        "</div>";
      }).join("");
    } else {
      body = prompts.map(function (text) {
        return '<button class="ai-prompt" type="button" data-act="ai-prompt" data-id="' + esc(text) + '">' +
          '<span class="q"><img src="img/AIPromptIcon.svg" alt="" /></span>' + esc(text) + "</button>";
      }).join("");
    }
    return el(
      '<div class="form-page ai-page">' +
        '<div class="home-head ai-head">' +
          '<img class="home-sky" src="img/HomeSky.png" alt="" />' +
          '<img class="home-cap" src="img/SnowCap.png" alt="" />' +
          '<button class="form-back" data-act="go" data-to="main"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="pegu-chip"><img src="img/Penguin.png" alt="" /><div><b>Pegu</b><span>5 /Message</span></div></div>' +
          '<button class="head-icon more" data-act="about-ai"><img src="img/MoreCircle.svg" alt="" /></button>' +
          '<div class="home-marks">' +
            '<img class="home-flake-a" src="img/FlakeA.png" alt="" />' +
            '<img class="home-flake-b" src="img/FlakeB.png" alt="" />' +
            '<img class="home-flake-c" src="img/FlakeA.png" alt="" />' +
            '<div class="home-title">Glide into winter with Pegu</div>' +
            '<div class="home-blurb">Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.</div>' +
            '<div class="home-penguin"><img src="img/Penguin.png" alt="" /></div>' +
          "</div>" +
          '<img class="home-edge" src="img/SnowEdge.png" alt="" />' +
        "</div>" +
        '<div class="scroll ai-body">' +
          '<div class="form-label"><img src="img/FieldBell.png" alt="" />All Chat</div>' + body +
        "</div>" +
        '<form class="pink-enter" data-form="ai"><img src="img/CommentSend.svg" alt="" /><input name="body" placeholder="Please enter..." /></form>' +
      "</div>"
    );
  }

  function callView() {
    var user = state.profiles[state.chat] || {};
    var photo = user.cover_url || user.avatar_url || "img/LiveStage.png";
    return el(
      '<div class="call-room">' +
        '<img class="bg" src="' + esc(photo) + '" alt="" />' +
        '<div class="veil"></div>' +
        '<div class="call-meta"><b>' + esc(user.name || "") + "</b><span>Video Call...</span></div>" +
        '<button class="hang" data-act="go" data-to="chat"><img src="img/CallEnd.svg" alt="" /></button>' +
      "</div>"
    );
  }

  function profileView() {
    var id = state.profile || API.me();
    var user = state.profiles[id] || state.me || {};
    var mine = id && id === API.me();
    var face = user.avatar_url || "";
    var coverURL = user.cover_url || "img/AuthSky.png";
    var posts = state.posts.filter(function (row) {
      if (state.profileTab === "like") return state.likes.indexOf(row.id) >= 0;
      return row.author_id === id;
    });
    var cards = posts.map(postCard).join("");
    var empty = emptyPen();
    return el(
      '<div class="form-page">' +
        '<div class="prof-head">' +
          '<img class="prof-cover" src="' + esc(coverURL) + '" alt="" />' +
          '<button class="form-back" data-act="go" data-to="main"><img src="img/BackButton.svg" alt="" /></button>' +
          (mine
            ? '<button class="head-icon more" data-act="go" data-to="settings"><img src="img/SettingsIcon.svg" alt="" /></button>'
            : '<button class="head-icon more" data-act="about-person" data-id="' + esc(id || "") + '"><img src="img/MoreCircle.svg" alt="" /></button>') +
          '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
          '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
          '<div class="prof-av">' +
            (face ? '<img class="face" src="' + esc(face) + '" alt="" />' : "") +
            '<img class="frame" src="img/AvatarFrame.png" alt="" />' +
            (mine
              ? '<button class="edit" data-act="go" data-to="edit"><img src="img/EditBadge.svg" alt="" /></button>'
              : (id ? '<button class="edit plus" data-act="follow" data-id="' + esc(id) + '"><img src="img/BadgePlus.png" alt="" /></button>' : "")) +
          "</div>" +
        "</div>" +
        '<div class="scroll prof-body">' +
          '<div class="prof-id">' +
            '<div class="prof-name">' + esc(user.name || "") + "</div>" +
            '<div class="prof-handle">' + esc(user.handle || "") + "</div>" +
            (user.name
              ? (mine
                ? '<button class="shop-chip" data-act="go" data-to="shop"><img src="img/CoinBadge.png" alt="" /><span>Coin Shop</span></button>'
                : '<button class="shop-chip chat" data-act="open-chat" data-id="' + esc(id || "") + '"><img src="img/ChatNow.png" alt="" /><span>Chat Now</span></button>')
              : "") +
          "</div>" +
          '<div class="prof-stats">' +
            '<button data-act="people" data-id="follow"><b>' + followCount(id, true) + "</b><span>Followed</span></button>" +
            '<button data-act="people" data-id="fans"><b>' + followCount(id, false) + "</b><span>Fans</span></button>" +
            '<button data-act="people" data-id="block"><b>' + (mine ? state.blocks.length : 0) + "</b><span>Blacklist</span></button>" +
          "</div>" +
          '<div class="post-pills prof-pills">' +
            '<button class="pill pink' + (state.profileTab === "post" ? " on" : "") + '" data-act="profile-tab" data-id="post">Post</button>' +
            '<button class="pill gray' + (state.profileTab === "like" ? " on" : "") + '" data-act="profile-tab" data-id="like">Like</button>' +
          "</div>" +
          (cards || empty) +
        "</div></div>"
    );
  }

  function followCount(id, followingFlag) {
    return state.follows.filter(function (row) {
      return followingFlag ? row.follower === id : row.followee === id;
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
    var gems = (state.me && (state.me.gems || state.me.coins)) || 0;
    var arts = ["Coin5.png", "Coin10.png", "Coin15.png", "Coin20.png", "Coin25.png", "Coin30.png", "Coin35.png"];
    var packs = (Bridge.env().packs || []).map(function (pack, i) {
      return '<button class="pack' + (i === 0 ? " on" : "") + '" data-act="buy" data-id="' + esc(pack.id) + '">' +
        '<img class="art" src="img/' + arts[i] + '" alt="" />' +
        '<div class="meta"><img src="img/Coin5.png" alt="" /><span>' + pack.amount + "</span></div>" +
        '<span class="price">' + esc(pack.price) + "</span></button>";
    }).join("");
    return el(
      '<div class="form-page shop-page">' +
        '<div class="shop-head">' +
          '<img class="banner" src="img/CoinShop.png" alt="" />' +
          '<button class="form-back" data-act="go" data-to="profile"><img src="img/BackButton.svg" alt="" /></button>' +
          '<div class="form-title">Coin Shop</div>' +
          '<button class="gem-chip"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
          '<img class="form-snow" src="img/SnowEdge.png" alt="" />' +
          '<img class="form-sled" src="img/AuthSled.png" alt="" />' +
        "</div>" +
        '<div class="scroll shop-grid">' + (packs || emptyPen()) + "</div></div>"
    );
  }

  function editView() {
    var name = (state.me && state.me.name) || "";
    var face = state.avatarPick || (state.me && state.me.avatar_url) || "";
    var coverURL = state.coverPick || (state.me && state.me.cover_url) || "";
    var frames = ["AvatarFrame.png", "FrameSnow.png", "FrameSki.png", "FrameSnowman.png", "FrameCable.png", "FrameTrophy.png"];
    var frameCells = frames.map(function (src, i) {
      return '<button class="frame-cell' + (state.framePick === i ? " on" : "") + '" type="button" data-act="pick-frame" data-id="' + i + '">' +
        '<img src="img/' + src + '" alt="" /></button>';
    }).join("");
    var avatar = face ? '<img src="' + esc(face) + '" alt="" />' : '<img class="cloud" src="img/UploadCloud.svg" alt="" />';
    var bg = coverURL
      ? '<img class="photo" src="' + esc(coverURL) + '" alt="" />'
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
    var title = kind === "fans" ? "Fans" : "Followed";
    var back = kind === "block" ? "settings" : "profile";
    var rows = ids.map(function (id) {
      var user = state.profiles[id] || { name: id };
      var action = "";
      if (kind === "block") action = '<button class="pill-act gray" data-act="unblock" data-id="' + id + '">Remove</button>';
      else if (kind === "fans" && !following(id)) action = '<button class="pill-act blue" data-act="follow" data-id="' + id + '">Follow<img src="img/BadgePlus.png" alt="" /></button>';
      else action = '<button class="pill-act gray" data-act="follow" data-id="' + id + '">Followed</button>';
      return '<div class="people-row"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
        '<div class="meta"><b>' + esc(user.name) + "</b><span>" + esc(user.handle || "") + "</span></div>" + action + "</div>";
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
    var box = el("<div></div>");
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
      '<img class="cap" src="img/SnowCap.png" alt="" />' +
      '<div class="gift-top">' +
        '<button class="gem-chip static"><img src="img/Coin5.png" alt="" /><span>' + gems + '</span><img class="plus" src="img/CoinPlus.svg" alt="" /></button>' +
        '<div class="title">Gift Shop</div>' +
        '<button class="x" data-act="close-sheet"><img src="img/CloseBadge.svg" alt="" /></button>' +
      "</div>" +
      '<div class="gift-grid">' + cells + "</div>" +
      '<button class="snow-btn send" data-act="send-gift" data-id="' + state.giftPick + '" data-cost="' + (costs[giftIndex(state.giftPick)] || 10) + '">' +
        '<img src="img/ButtonBlue.svg" alt="" /><span>Send</span></button>' +
    "</div>";
  }

  function snowSheet(title, inner) {
    return '<div class="snow-sheet">' +
      '<img class="cap" src="img/SnowCap.png" alt="" />' +
      '<div class="snow-top"><span class="x-ph"></span><div class="title">' + title + '</div>' +
      '<button class="x" data-act="close-sheet"><img src="img/CloseBadge.svg" alt="" /></button></div>' +
      inner + "</div>";
  }

  function audienceRows() {
    var seen = {};
    var ids = [];
    (state.roomLines || []).forEach(function (line) {
      if (line.sender_id && !seen[line.sender_id]) { seen[line.sender_id] = 1; ids.push(line.sender_id); }
    });
    var rows = ids.map(function (id) {
      var user = state.profiles[id] || {};
      var followed = following(id);
      return '<div class="people-row"><img src="' + esc(user.avatar_url || "img/SampleAvatar.png") + '" alt="" />' +
        '<div class="meta"><b>' + esc(user.name || "") + "</b><span>" + esc(user.handle || "") + "</span></div>" +
        (followed
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

  async function onClick(event) {
    var node = event.target.closest("[data-act]");
    if (!node) return;
    var act = node.getAttribute("data-act");
    var id = node.getAttribute("data-id");
    try {
      if (act === "go") go(node.getAttribute("data-to"), node.getAttribute("data-to") === "profile" ? { profile: API.me() } : null);
      else if (act === "tab") { state.tab = id; state.route = "main"; draw(); }
      else if (act === "post-filter") { state.postFilter = id; draw(); }
      else if (act === "apple") await apple();
      else if (act === "agree") { await Bridge.eula(); go("auth"); }
      else if (act === "follow") { await API.setFollow(id, !following(id)); await reload(); }
      else if (act === "live") { state.live = id; await API.joinRoom(id); state.roomLines = await API.roomMessages(id); go("live"); }
      else if (act === "like") { await API.like(id, state.likes.indexOf(id) < 0); await reload(); }
      else if (act === "open-post") go("post", { post: id });
      else if (act === "open-chat") { await API.openThread(id); await reload(); go("chat", { chat: id }); }
      else if (act === "profile") go("profile", { profile: id });
      else if (act === "people") go("people", { peopleKind: id });
      else if (act === "legal") await Bridge.legal(id);
      else if (act === "buy") { await Bridge.buy(id); await reload(); }
      else if (act === "profile-tab") { state.profileTab = id; draw(); }
      else if (act === "clean-cache") { Bridge.toast("Cleaned."); }
      else if (act === "compose-kind") { state.composeKind = id; draw(); }
      else if (act === "pick-gift") { state.giftPick = id; draw(); }
      else if (act === "pick") {
        var media = await Bridge.pick(state.composeKind === "video" ? 1 : 9, state.composeKind === "video");
        state.picked = (media.items || (media.payload && media.payload.items) || []) || [];
        draw();
      }
      else if (act === "pick-avatar") { var one = await Bridge.pick(1, false); state.avatarPick = pickedURI(one); draw(); }
      else if (act === "pick-cover") { var two = await Bridge.pick(1, false); state.coverPick = pickedURI(two); draw(); }
      else if (act === "gift") { state.sheet = "gift"; draw(); }
      else if (act === "send-gift") {
        state.gift = id; state.sheet = null; draw();
        API.sendGift(state.live, Number(node.getAttribute("data-cost")), id).catch(function (err) { Bridge.toast(err.message || String(err)); });
        setTimeout(function () { state.gift = ""; draw(); }, 1800);
      }
      else if (act === "about-post") openAbout("post", id);
      else if (act === "about-chat") openAbout("chat", id);
      else if (act === "about-person") openAbout("live", id);
      else if (act === "about-ai") openAbout("ai", "pegu");
      else if (act === "add-tag") { state.sheet = "tag"; draw(); }
      else if (act === "call") go("call");
      else if (act === "ai-prompt") { await sendAI(id); }
      else if (act === "close-sheet") { state.sheet = null; draw(); }
      else if (act === "report") { state.sheet = "report"; draw(); }
      else if (act === "feedback") { state.sheet = "feedback"; draw(); }
      else if (act === "audience") { state.sheet = "audience"; draw(); }
      else if (act === "pick-frame") { state.framePick = Number(id); draw(); }
      else if (act === "confirm-logout") { await Bridge.signOut(); go("auth"); }
      else if (act === "confirm-erase") { await API.deleteAccount(); await Bridge.signOut(); go("auth"); }
      else if (act === "block-user") { state.sheet = "blacklist"; draw(); }
      else if (act === "delete-target") {
        state.sheet = state.aboutKind === "chat" ? "delete-chat" : "delete-post";
        draw();
      }
      else if (act === "confirm-delete-post") {
        if (state.aboutId) await API.deletePost(state.aboutId);
        state.sheet = null; await reload(); go("main");
      }
      else if (act === "confirm-delete-chat") {
        if (state.threads[state.chat]) await API.hideThread(state.threads[state.chat]);
        state.sheet = null; await reload(); go("main");
      }
      else if (act === "confirm-block") {
        await API.block(state.reportTarget); state.sheet = null; await reload(); go("main");
      }
      else if (act === "unblock") { await API.unblock(id); await reload(); }
      else if (act === "logout") { state.sheet = "logout"; draw(); }
      else if (act === "erase") { state.sheet = "erase"; draw(); }
    } catch (err) {
      Bridge.toast(err.message || String(err));
    }
  }

  function openAbout(kind, id) {
    state.aboutKind = kind;
    state.aboutId = id;
    if (kind === "post") {
      var post = state.posts.filter(function (row) { return row.id === id; })[0];
      state.reportTarget = post ? post.author_id : id;
      state.aboutMine = post && post.author_id === API.me();
    } else {
      state.reportTarget = id;
      state.aboutMine = false;
    }
    state.sheet = "about";
    draw();
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
    try {
      await Bridge.wait(true);
      if (kind === "register") {
        state.form.email = String(data.get("email") || "");
        state.form.password = String(data.get("password") || "");
        state.form.name = String(data.get("name") || "");
        go("register2");
      } else if (kind === "signin") {
        await Bridge.eula();
        await API.signIn(String(data.get("email") || ""), String(data.get("password") || ""));
        await Bridge.setSession(API.tokens().access, API.tokens().refresh);
        await reload();
        go("main");
      } else if (kind === "register2") {
        await Bridge.eula();
        await API.signUp(state.form.email, state.form.password, state.form.name);
        await Bridge.setSession(API.tokens().access, API.tokens().refresh);
        var avatar = null;
        var coverURL = null;
        if (state.avatarPick) avatar = await API.upload(API.me() + "/avatar.jpg", state.avatarPick, "image/jpeg");
        if (state.coverPick) coverURL = await API.upload(API.me() + "/cover.jpg", state.coverPick, "image/jpeg");
        await API.saveProfile(state.form.name, avatar, coverURL);
        await reload();
        go("main");
      } else if (kind === "comment") { await API.addComment(state.post, body); await reload(); }
      else if (kind === "chat") { await API.sendMessage(state.threads[state.chat], body); await reload(); }
      else if (kind === "live") { await API.sendRoomMessage(state.live, body); state.roomLines = await API.roomMessages(state.live); draw(); }
      else if (kind === "ai") { await sendAI(body); }
      else if (kind === "tag") {
        var tag = body.replace(/^#/, "").trim();
        if (tag && (state.tags || []).indexOf(tag) < 0) state.tags.push(tag);
        state.sheet = null;
        draw();
      } else if (kind === "compose") {
        var urls = [];
        var items = state.picked || [];
        for (var i = 0; i < items.length; i++) {
          urls.push(await API.upload("yoohoo/posts/" + Date.now() + "-" + i + ".jpg", items[i].uri, "image/jpeg"));
        }
        var caption = body;
        (state.tags || []).forEach(function (tag) { caption += (caption ? " " : "") + "#" + tag; });
        await API.publish(caption, urls, state.composeKind === "video");
        state.picked = [];
        state.tags = [];
        await reload();
        go("main");
      } else if (kind === "edit") {
        var avatar = state.me.avatar_url;
        var coverURL = state.me.cover_url;
        if (state.avatarPick) avatar = await API.upload("yoohoo/profiles/" + API.me() + "-avatar.jpg", state.avatarPick, "image/jpeg");
        if (state.coverPick) coverURL = await API.upload("yoohoo/profiles/" + API.me() + "-cover.jpg", state.coverPick, "image/jpeg");
        await API.saveProfile(String(data.get("name") || state.me.name), avatar, coverURL);
        await reload();
        go("profile", { profile: API.me() });
      } else if (kind === "feedback") { await API.feedback(body); state.sheet = null; Bridge.toast("Sent."); draw(); }
      else if (kind === "report") { await API.report(state.reportTarget, String(data.get("reason") || body)); state.sheet = null; Bridge.toast("Reported."); draw(); }
    } catch (err) {
      Bridge.toast(err.message || String(err));
    } finally {
      await Bridge.wait(false);
    }
  }

  async function sendAI(text) {
    var body = String(text || "").trim();
    if (!body) return;
    state.ai.push({ mine: true, body: body });
    draw();
    try {
      await API.addAI(true, body);
      await API.spendGems(5);
    } catch (err) {}
    var reply = "The snow looks good today.";
    await typeAI(reply);
    try { await API.addAI(false, reply); } catch (err) {}
  }

  async function typeAI(text) {
    var item = { mine: false, body: "" };
    state.ai.push(item);
    for (var i = 0; i < text.length; i++) {
      item.body += text[i];
      draw();
      await new Promise(function (resolve) { setTimeout(resolve, 28); });
    }
  }

  try {
    boot();
  } catch (err) {
    document.getElementById("app").textContent = String(err && err.message ? err.message : err);
  }
})();
