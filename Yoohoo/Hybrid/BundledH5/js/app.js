(function () {
  var state = {
    route: "auth",
    tab: "home",
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
    await Bridge.post("ready");
    if (env.accessToken) {
      try { await reload(); go("main"); } catch (err) { go("auth"); }
    } else {
      go("auth");
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
    else if (state.route === "people") root.replaceChildren(peopleView());
    else root.replaceChildren(mainView());
    if (state.sheet) root.appendChild(sheetView());
  }

  function authView() {
    return el(
      '<div class="screen sky">' +
        '<div class="scroll pad" style="padding-top:140px;text-align:center">' +
          '<div class="title">Yoohoo</div>' +
          '<p class="sub">Ski with the crew</p>' +
          '<button class="btn wide" data-act="apple" style="margin-top:48px">Continue with Apple</button>' +
          '<button class="btn blue wide" data-act="go" data-to="register" style="margin-top:12px">Register</button>' +
          '<button class="btn ghost wide" data-act="go" data-to="signin" style="margin-top:12px">Sign In</button>' +
        "</div></div>"
    );
  }

  function formView() {
    var register = state.route === "register";
    return el(
      '<div class="screen">' +
        '<div class="header row space"><button class="btn ghost" data-act="go" data-to="auth">Back</button><div class="title">' + (register ? "Register" : "Sign In") + "</div><span></span></div>" +
        '<form class="pad" data-form="' + state.route + '">' +
          (register ? '<input class="field" name="name" placeholder="Name" maxlength="' + (Bridge.env().nameLimit || 24) + '" />' : "") +
          '<input class="field" name="email" type="email" placeholder="Email" />' +
          '<input class="field" name="password" type="password" placeholder="Password" />' +
          '<button class="btn wide" type="submit">' + (register ? "Register" : "Sign In") + "</button>" +
        "</form></div>"
    );
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
          tabBtn("home", "Home") + tabBtn("post", "Posts") + tabBtn("chat", "Chat") +
        "</div></div>"
    );
  }
  function tabBtn(id, label) {
    return '<button class="tab' + (state.tab === id ? " on" : "") + '" data-act="tab" data-id="' + id + '">' + label + "</button>";
  }

  function homeList() {
    var cards = state.rooms.map(function (room) {
      var user = state.profiles[room.owner_id] || {};
      return '<article class="card" data-act="live" data-id="' + room.id + '">' +
        cover(room.cover_url) +
        '<div class="pad"><div class="row gap8">' + img(user.avatar_url) +
        "<div><div>" + esc(user.name) + '</div><div class="sub">' + esc(user.handle) + "</div></div>" +
        '<button class="btn" data-act="follow" data-id="' + room.owner_id + '">' + (following(room.owner_id) ? "Following" : "+") + "</button></div>" +
        "<p>" + esc(room.title) + "</p></div></article>";
    }).join("");
    return '<div class="scroll">' + (cards || '<div class="empty">No more data</div>') + "</div>";
  }

  function postList() {
    var cards = state.posts.map(function (post) {
      var user = state.profiles[post.author_id] || {};
      var photos = post.media_urls || (post.media_url ? [post.media_url] : []);
      return '<article class="card">' +
        (photos[0] ? cover(photos[0]) : "") +
        '<div class="pad"><div class="row space"><div class="row gap8" data-act="profile" data-id="' + post.author_id + '">' +
        img(user.avatar_url) + "<div>" + esc(user.name) + '<div class="sub">' + stamp(post.created_at) + "</div></div></div>" +
        '<button data-act="about-post" data-id="' + post.id + '">···</button></div>' +
        "<p>" + esc(post.body) + "</p>" +
        '<div class="row space"><button data-act="like" data-id="' + post.id + '">' + (state.likes.indexOf(post.id) >= 0 ? "♥" : "♡") + "</button>" +
        '<button data-act="open-post" data-id="' + post.id + '">Comment</button></div></div></article>';
    }).join("");
    return '<div class="header row space"><div class="title">Posts</div><button class="btn" data-act="go" data-to="compose">New</button></div>' +
      '<div class="scroll">' + (cards || '<div class="empty">No more data</div>') + "</div>";
  }

  function chatList() {
    var rows = state.people.map(function (person) {
      return '<div class="row space pad" data-act="open-chat" data-id="' + person.id + '">' +
        '<div class="row gap12">' + img(person.avatar) + "<div>" + esc(person.name) + '<div class="sub">' + esc(person.preview) + "</div></div></div>" +
        '<div class="sub">' + esc(person.time) + "</div></div>";
    }).join("");
    return '<div class="header row space"><div class="title">Chat</div><button class="btn" data-act="go" data-to="ai">AI</button></div>' +
      '<div class="scroll">' + (rows || '<div class="empty">No more data</div>') + "</div>";
  }

  function liveView() {
    var room = state.rooms.filter(function (row) { return row.id === state.live; })[0] || {};
    var user = state.profiles[room.owner_id] || {};
    var lines = state.roomLines.map(function (line) {
      var who = state.profiles[line.sender_id] || {};
      return '<div class="bubble you">' + esc(who.name || "") + ": " + esc(line.body) + "</div>";
    }).join("");
    return el(
      '<div class="live">' + cover(room.cover_url) +
        '<div class="live-ui"><div class="row space"><button class="btn ghost" data-act="go" data-to="main">Back</button>' +
        "<div>" + esc(user.name) + " · 40+</div>" +
        '<button class="btn" data-act="gift" data-id="' + room.id + '">Gift</button></div>' +
        '<div><div class="scroll" style="max-height:220px">' + lines + '</div>' +
        '<form class="composer" data-form="live"><input class="field" name="body" placeholder="Say hi" /><button class="btn" type="submit">Send</button></form></div></div>' +
        (state.gift ? '<div class="gift">' + esc(state.gift) + "</div>" : "") +
      "</div>"
    );
  }

  function postView() {
    var post = state.posts.filter(function (row) { return row.id === state.post; })[0] || {};
    var comments = state.comments.filter(function (row) { return row.post_id === post.id; }).map(function (row) {
      var user = state.profiles[row.author_id] || {};
      return '<div class="row gap8 pad">' + img(user.avatar_url) + "<div><b>" + esc(user.name) + "</b> " + esc(row.body) + "</div></div>";
    }).join("");
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="main">Back</button><div class="title">Post</div><span></span></div>' +
        '<div class="scroll">' + cover((post.media_urls && post.media_urls[0]) || post.media_url) + '<div class="pad">' + esc(post.body) + "</div>" + comments + "</div>" +
        '<form class="composer" data-form="comment"><input class="field" name="body" placeholder="Write a comment" /><button class="btn" type="submit">Send</button></form></div>'
    );
  }

  function composeView() {
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="main">Back</button><div class="title">New post</div><span></span></div>' +
        '<form class="pad" data-form="compose"><textarea class="field" name="body" rows="5" placeholder="Share the snow"></textarea>' +
        '<button class="btn ghost wide" type="button" data-act="pick">Add photos</button>' +
        '<button class="btn wide" type="submit" style="margin-top:12px">Publish</button></form></div>'
    );
  }

  function chatView() {
    var lines = (state.lines[state.chat] || []).map(function (row) {
      var mine = row.sender_id === API.me();
      return '<div class="bubble ' + (mine ? "me" : "you") + '">' + esc(row.body) + "</div>";
    }).join("");
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="main">Back</button><div class="title">' +
        esc((state.profiles[state.chat] || {}).name) + '</div><button data-act="about-chat" data-id="' + state.chat + '">···</button></div>' +
        '<div class="scroll pad">' + lines + "</div>" +
        '<form class="composer" data-form="chat"><input class="field" name="body" /><button class="btn" type="submit">Send</button></form></div>'
    );
  }

  function aiView() {
    var lines = state.ai.map(function (row) {
      return '<div class="bubble ' + (row.mine ? "me" : "you") + '">' + esc(row.body) + "</div>";
    }).join("");
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="main">Back</button><div class="title">AI</div><span></span></div>' +
        '<div class="scroll pad">' + lines + "</div>" +
        '<form class="composer" data-form="ai"><input class="field" name="body" /><button class="btn" type="submit">Send</button></form></div>'
    );
  }

  function profileView() {
    var id = state.profile || API.me();
    var user = state.profiles[id] || {};
    var mine = id === API.me();
    return el(
      '<div class="screen"><div class="scroll">' + cover(user.cover_url) +
        '<div class="pad"><div class="row space">' + img(user.avatar_url).replace('class="avatar"', 'class="avatar lg"') +
        (mine
          ? '<button class="btn" data-act="go" data-to="settings">Settings</button>'
          : '<button class="btn" data-act="follow" data-id="' + id + '">' + (following(id) ? "Following" : "Follow") + "</button>") +
        "</div><div class="title">' + esc(user.name) + '</div><div class="sub">' + esc(user.handle) + "</div>" +
        '<div class="row space" style="margin-top:12px"><div data-act="people" data-id="follow">Follow ' + followCount(id, true) + "</div>" +
        "<div data-act=\"people\" data-id=\"fans\">Fans " + followCount(id, false) + "</div>" +
        "<div>Coins " + (mine ? (user.gems || 0) : "") + "</div></div>" +
        (mine ? '<button class="btn wide" data-act="go" data-to="edit" style="margin-top:16px">Edit profile</button><button class="btn blue wide" data-act="go" data-to="shop" style="margin-top:12px">Coin shop</button>' : "") +
        "</div></div></div>"
    );
  }

  function followCount(id, followingFlag) {
    return state.follows.filter(function (row) {
      return followingFlag ? row.follower === id : row.followee === id;
    }).length;
  }

  function settingsView() {
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="profile">Back</button><div class="title">Settings</div><span></span></div>' +
        '<div class="scroll pad">' +
        '<button class="btn ghost wide" data-act="people" data-id="block">Blacklist</button>' +
        '<button class="btn ghost wide" data-act="legal" data-id="terms" style="margin-top:8px">Terms Of Use</button>' +
        '<button class="btn ghost wide" data-act="legal" data-id="privacy" style="margin-top:8px">Privacy Policy</button>' +
        '<button class="btn ghost wide" data-act="feedback" style="margin-top:8px">Feedback</button>' +
        '<button class="btn wide" data-act="logout" style="margin-top:16px">Log Out</button>' +
        '<button class="btn ghost wide" data-act="erase" style="margin-top:8px">Delete Account</button></div></div>'
    );
  }

  function shopView() {
    var packs = (Bridge.env().packs || []).map(function (pack) {
      return '<button class="card pad" data-act="buy" data-id="' + pack.id + '"><div class="title">' + pack.amount + '</div><div class="sub">' + esc(pack.price) + "</div></button>";
    }).join("");
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="profile">Back</button><div class="title">Coin shop</div><span></span></div>' +
        '<div class="scroll pad">' + (packs || '<div class="empty">No packs</div>') + "</div></div>"
    );
  }

  function editView() {
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="profile">Back</button><div class="title">Edit</div><span></span></div>' +
        '<form class="pad" data-form="edit"><input class="field" name="name" maxlength="24" value="' + esc((state.me && state.me.name) || "") + '" />' +
        '<button class="btn ghost wide" type="button" data-act="pick-avatar">Avatar</button>' +
        '<button class="btn ghost wide" type="button" data-act="pick-cover" style="margin-top:8px">Cover</button>' +
        '<button class="btn wide" type="submit" style="margin-top:12px">Save</button></form></div>'
    );
  }

  function peopleView() {
    var kind = state.peopleKind;
    var ids = [];
    if (kind === "block") ids = state.blocks;
    else if (kind === "fans") ids = state.follows.filter(function (row) { return row.followee === API.me(); }).map(function (row) { return row.follower; });
    else ids = state.follows.filter(function (row) { return row.follower === API.me(); }).map(function (row) { return row.followee; });
    var rows = ids.map(function (id) {
      var user = state.profiles[id] || { name: id };
      return '<div class="row space pad"><div class="row gap8">' + img(user.avatar_url) + esc(user.name) + "</div>" +
        (kind === "block" ? '<button class="btn" data-act="unblock" data-id="' + id + '">Remove</button>' : "") + "</div>";
    }).join("");
    return el(
      '<div class="screen"><div class="header row space"><button class="btn ghost" data-act="go" data-to="settings">Back</button><div class="title">People</div><span></span></div>' +
        '<div class="scroll">' + (rows || '<div class="empty">No more data</div>') + "</div></div>"
    );
  }

  function sheetView() {
    var wrap = el('<div class="dim" data-act="close-sheet"></div>');
    var inner = "";
    if (state.sheet === "about") {
      inner = '<div class="sheet"><button class="btn wide" data-act="report">Report</button>' +
        '<button class="btn wide" data-act="block-user" style="margin-top:8px">Add to Blacklist</button>' +
        (state.aboutMine ? '<button class="btn wide" data-act="delete-target" style="margin-top:8px">Delete</button>' : "") +
        '<button class="btn ghost wide" data-act="close-sheet" style="margin-top:8px">Close</button></div>';
    } else if (state.sheet === "feedback") {
      inner = '<form class="sheet" data-form="feedback"><textarea class="field" name="body" rows="4" placeholder="Feedback"></textarea><button class="btn wide">Send</button></form>';
    } else if (state.sheet === "report") {
      inner = '<form class="sheet" data-form="report"><input class="field" name="reason" placeholder="Reason" /><button class="btn wide">Send</button></form>';
    } else if (state.sheet === "gift") {
      inner = '<div class="sheet"><button class="btn wide" data-act="send-gift" data-id="Heart" data-cost="10">Heart · 10</button>' +
        '<button class="btn wide" data-act="send-gift" data-id="Ski" data-cost="50" style="margin-top:8px">Ski · 50</button></div>';
    }
    var box = el("<div></div>");
    box.appendChild(wrap);
    if (inner) box.appendChild(el(inner));
    return box;
  }

  async function onClick(event) {
    var node = event.target.closest("[data-act]");
    if (!node) return;
    var act = node.getAttribute("data-act");
    var id = node.getAttribute("data-id");
    try {
      if (act === "go") go(node.getAttribute("data-to"), node.getAttribute("data-to") === "profile" ? { profile: API.me() } : null);
      else if (act === "tab") { state.tab = id; if (id === "home" || true) { state.route = "main"; } draw(); }
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
      else if (act === "pick") { var media = await Bridge.pick(9, false); state.picked = (media.items || media.payload && media.payload.items) || media.items || []; }
      else if (act === "pick-avatar") { var one = await Bridge.pick(1, false); state.avatarPick = ((one.items || [])[0] || {}).uri; }
      else if (act === "pick-cover") { var two = await Bridge.pick(1, false); state.coverPick = ((two.items || [])[0] || {}).uri; }
      else if (act === "gift") { state.sheet = "gift"; draw(); }
      else if (act === "send-gift") {
        await API.sendGift(state.live, Number(node.getAttribute("data-cost")), id);
        state.gift = id; state.sheet = null; draw();
        setTimeout(function () { state.gift = ""; draw(); }, 1200);
      }
      else if (act === "about-post") openAbout("post", id);
      else if (act === "about-chat") openAbout("chat", id);
      else if (act === "close-sheet") { state.sheet = null; draw(); }
      else if (act === "report") { state.sheet = "report"; draw(); }
      else if (act === "feedback") { state.sheet = "feedback"; draw(); }
      else if (act === "block-user") { await API.block(state.reportTarget); state.sheet = null; await reload(); go("main"); }
      else if (act === "delete-target") {
        if (state.aboutKind === "post") await API.deletePost(state.aboutId);
        state.sheet = null; await reload(); go("main");
      }
      else if (act === "unblock") { await API.unblock(id); await reload(); }
      else if (act === "logout") { await Bridge.signOut(); go("auth"); }
      else if (act === "erase") { await API.deleteAccount(); await Bridge.signOut(); go("auth"); }
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
      if (kind === "register" || kind === "signin") {
        await Bridge.eula();
        var email = String(data.get("email") || "");
        var password = String(data.get("password") || "");
        var name = String(data.get("name") || "");
        var session = kind === "register" ? await API.signUp(email, password, name) : await API.signIn(email, password);
        await Bridge.setSession(API.tokens().access, API.tokens().refresh);
        if (kind === "register" && name) await API.saveProfile(name, null, null);
        await reload();
        go("main");
      } else if (kind === "comment") { await API.addComment(state.post, body); await reload(); }
      else if (kind === "chat") { await API.sendMessage(state.threads[state.chat], body); await reload(); }
      else if (kind === "live") { await API.sendRoomMessage(state.live, body); state.roomLines = await API.roomMessages(state.live); draw(); }
      else if (kind === "ai") {
        state.ai.push({ mine: true, body: body });
        draw();
        await API.addAI(true, body);
        await API.spendGems(5);
        var reply = "The snow looks good today.";
        await typeAI(reply);
        await API.addAI(false, reply);
      } else if (kind === "compose") {
        var urls = [];
        var items = state.picked || [];
        for (var i = 0; i < items.length; i++) {
          urls.push(await API.upload("yoohoo/posts/" + Date.now() + "-" + i + ".jpg", items[i].uri, "image/jpeg"));
        }
        await API.publish(body, urls, false);
        state.picked = [];
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

  async function typeAI(text) {
    var item = { mine: false, body: "" };
    state.ai.push(item);
    for (var i = 0; i < text.length; i++) {
      item.body += text[i];
      draw();
      await new Promise(function (resolve) { setTimeout(resolve, 28); });
    }
  }

  boot();
})();
