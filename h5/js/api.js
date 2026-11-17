(function (global) {
  var tokens = { access: "", refresh: "" };
  var me = "";

  function env() { return (global.__YOOHOO__ || {}); }
  function url() { return env().supabaseURL || ""; }
  function key() { return env().supabaseKey || ""; }

  function headers(json) {
    var h = { apikey: key(), Authorization: "Bearer " + (tokens.access || key()) };
    if (json) h["Content-Type"] = "application/json";
    h.Prefer = "return=representation";
    return h;
  }

  async function req(path, options) {
    var res = await fetch(url() + path, options);
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      var message = (data && (data.message || data.error_description || data.msg)) || text || "Request failed";
      throw new Error(message);
    }
    return data;
  }

  async function auth(path, body) {
    return req("/auth/v1" + path, { method: "POST", headers: headers(true), body: JSON.stringify(body) });
  }

  async function rest(path, method, body) {
    var options = { method: method || "GET", headers: headers(!!body) };
    if (body) options.body = JSON.stringify(body);
    return req("/rest/v1" + path, options);
  }

  async function rpc(name, body) {
    return rest("/rpc/" + name, "POST", body || {});
  }

  function saveTokens(session) {
    if (!session) return;
    tokens.access = session.access_token || session.accessToken || tokens.access;
    tokens.refresh = session.refresh_token || session.refreshToken || tokens.refresh;
    if (session.user && session.user.id) me = session.user.id;
  }

  global.API = {
    me: function () { return me; },
    tokens: function () { return tokens; },
    setTokens: function (access, refresh, userId) {
      tokens.access = access || "";
      tokens.refresh = refresh || "";
      me = String(userId || me || "").toLowerCase();
    },
    signIn: async function (email, password) {
      var data = await auth("/token?grant_type=password", { email: email, password: password });
      saveTokens(data);
      return data;
    },
    signUp: async function (email, password, name) {
      var data = await auth("/signup", { email: email, password: password, data: { name: name } });
      saveTokens(data);
      if (!tokens.access) {
        return global.API.signIn(email, password);
      }
      return data;
    },
    profiles: function () {
      var filter = me
        ? "?or=(created_at.gte.\"2026-11-12T00:00:00Z\",id.eq." + me + ")"
        : "?created_at=gte.2026-11-12T00:00:00Z";
      return rest("/profiles" + filter);
    },
    posts: function (ids) {
      if (!ids.length) return [];
      return rest("/posts?author_id=in.(" + ids.join(",") + ")&order=created_at.desc");
    },
    comments: function (ids) {
      if (!ids.length) return [];
      return rest("/comments?post_id=in.(" + ids.join(",") + ")&order=created_at.asc");
    },
    rooms: function (ids) {
      if (!ids.length) return [];
      return rest("/rooms?owner_id=in.(" + ids.join(",") + ")&order=created_at.desc");
    },
    follows: function () { return rest("/follows?select=*"); },
    blocks: function () { return rest("/blocks?blocker=eq." + me); },
    likes: function () { return rest("/post_likes?user_id=eq." + me); },
    threads: function () { return rest("/threads?or=(user_low.eq." + me + ",user_high.eq." + me + ")"); },
    hides: function () { return rest("/thread_hides?user_id=eq." + me); },
    messages: function (ids) {
      if (!ids.length) return [];
      return rest("/messages?thread_id=in.(" + ids.join(",") + ")&order=created_at.asc");
    },
    setFollow: function (other, follow) {
      if (follow) return rest("/follows", "POST", { follower: me, followee: other });
      return rest("/follows?follower=eq." + me + "&followee=eq." + other, "DELETE");
    },
    like: function (post, on) {
      if (on) return rest("/post_likes", "POST", { post_id: post, user_id: me });
      return rest("/post_likes?post_id=eq." + post + "&user_id=eq." + me, "DELETE");
    },
    addComment: function (post, body) {
      return rest("/comments", "POST", { post_id: post, author_id: me, body: body });
    },
    deletePost: function (id) { return rest("/posts?id=eq." + id, "DELETE"); },
    deleteComment: function (id) { return rest("/comments?id=eq." + id, "DELETE"); },
    publish: function (body, urls, video) {
      return rest("/posts", "POST", {
        author_id: me, body: body, is_video: !!video, media_url: urls[0] || null, media_urls: urls
      });
    },
    saveProfile: function (name, avatar, cover) {
      return rest("/profiles?id=eq." + me, "PATCH", { name: name, avatar_url: avatar, cover_url: cover });
    },
    openThread: async function (other) {
      try {
        return await rpc("open_thread", { other: other });
      } catch (err) {
        var low = me < other ? me : other;
        var high = me < other ? other : me;
        var found = await rest("/threads?user_low=eq." + low + "&user_high=eq." + high);
        if (found && found.length) return found[0];
        return rest("/threads", "POST", { user_low: low, user_high: high });
      }
    },
    sendMessage: function (thread, body) {
      return rest("/messages", "POST", { thread_id: thread, sender_id: me, body: body });
    },
    hideThread: function (thread) {
      return rest("/thread_hides", "POST", { thread_id: thread, user_id: me });
    },
    block: function (other) { return rest("/blocks", "POST", { blocker: me, blocked: other }); },
    unblock: function (other) { return rest("/blocks?blocker=eq." + me + "&blocked=eq." + other, "DELETE"); },
    report: function (target, reason) {
      return rest("/reports", "POST", { reporter: me, target: target, reason: reason });
    },
    feedback: function (body) { return rest("/feedback", "POST", { user_id: me, body: body }); },
    joinRoom: function (room) { return rest("/room_members", "POST", { room_id: room, user_id: me }); },
    roomMessages: function (room) { return rest("/room_messages?room_id=eq." + room + "&order=created_at.asc"); },
    sendRoomMessage: function (room, body) {
      return rest("/room_messages", "POST", { room_id: room, sender_id: me, body: body });
    },
    sendGift: function (room, cost, label) { return rpc("send_gift", { p_room: room, p_cost: cost, p_label: label }); },
    spendGems: function (amount) { return rpc("spend_gems", { p_amount: amount }); },
    aiLines: function () { return rest("/ai_messages?user_id=eq." + me + "&order=created_at.asc"); },
    addAI: function (mineFlag, body) { return rest("/ai_messages", "POST", { user_id: me, mine: mineFlag, body: body }); },
    deleteAccount: function () { return rpc("delete_own_account"); },
    upload: async function (path, dataUrl, type) {
      var raw = dataUrl.split(",")[1] || "";
      var bin = atob(raw);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var res = await fetch(url() + "/storage/v1/object/media/" + path, {
        method: "POST",
        headers: {
          apikey: key(),
          Authorization: "Bearer " + tokens.access,
          "Content-Type": type || "image/jpeg",
          "x-upsert": "true"
        },
        body: bytes
      });
      if (!res.ok) throw new Error(await res.text());
      return url() + "/storage/v1/object/public/media/" + path;
    }
  };
})(window);
