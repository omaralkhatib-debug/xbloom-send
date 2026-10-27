/* Omar's xBloom sender: talks to xBloom's cloud straight from this browser. Nothing is sent anywhere else. */
(function (g) {
  "use strict";
  var BASE = "https://client-api.xbloom.com/";
  var KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4LF40GZ72SdhMyl765K/i4nY5CPcHz2Q1IKWKZ9S79xmK7G8pUhbVf4EZLvnNF1+9IvOFQUKV5Z7ZNNviqSpnql9tAT+8+J/He0R7pcirvVSxgdr2i9V/C/gmqAEZ5qVTzRnd3uWdFoKzPdEBxP0IporJ1VBbCv90yBSOhVxO+QIDAQAB";
  function b2a(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function a2b(a) { var s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function toBig(a) { var h = ""; for (var i = 0; i < a.length; i++) h += a[i].toString(16).padStart(2, "0"); return BigInt("0x" + (h || "0")); }
  function powmod(b, e, m) { var r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
  function readLen(b, p) { var l = b[p++]; if (l & 0x80) { var n = l & 0x7f; l = 0; while (n--) l = l * 256 + b[p++]; } return [l, p]; }
  function parseKey(k) {
    var b = b2a(k), p = 0, t;
    p++; t = readLen(b, p); p = t[1];           // SEQUENCE
    p++; t = readLen(b, p); p = t[1] + t[0];    // AlgorithmIdentifier (skip)
    p++; t = readLen(b, p); p = t[1] + 1;       // BIT STRING + unused-bits byte
    p++; t = readLen(b, p); p = t[1];           // inner SEQUENCE
    p++; t = readLen(b, p); var n = b.subarray(t[1], t[1] + t[0]); p = t[1] + t[0];
    p++; t = readLen(b, p); var e = b.subarray(t[1], t[1] + t[0]);
    if (n[0] === 0) n = n.subarray(1);
    return { n: toBig(n), e: toBig(e), k: n.length };
  }
  var PK = null;
  function rnd(len) { var a = new Uint8Array(len), o = new Uint8Array(1); crypto.getRandomValues(a); for (var i = 0; i < len; i++) while (a[i] === 0) { crypto.getRandomValues(o); a[i] = o[0]; } return a; }
  function encrypt(obj) {
    PK = PK || parseKey(KEY);
    var k = PK.k, msg = new TextEncoder().encode(JSON.stringify(obj));
    var nb = Math.ceil(msg.length / 117), out = new Uint8Array(nb * k);
    for (var i = 0; i < nb; i++) {
      var c = msg.subarray(i * 117, i * 117 + 117), em = new Uint8Array(k);
      em[1] = 2; em.set(rnd(k - 3 - c.length), 2); em.set(c, k - c.length);
      var h = powmod(toBig(em), PK.e, PK.n).toString(16).padStart(k * 2, "0");
      for (var j = 0; j < k; j++) out[i * k + j] = parseInt(h.substr(j * 2, 2), 16);
    }
    return a2b(out);
  }
  function post(ep, body) {
    return fetch(BASE + ep, { method: "POST", headers: { "content-type": "application/json" }, body: body })
      .then(function (r) { if (!r.ok) throw new Error("xBloom answered HTTP " + r.status + (r.status === 500 ? " (sign-in may have expired: sign in again)" : "")); return r.json(); });
  }
  function env(a) { return { interfaceVersion: 20240918, skey: "testskey", phoneType: "Android", memberId: a.memberId, clientType: 2, languageType: 0, token: a.token }; }
  var X = {
    encrypt: encrypt,
    login: function (email, password) {
      return post("tMemberLogin.thtml", JSON.stringify({ interfaceVersion: 20240918, skey: "testskey", clientType: 2, phoneType: "Android", languageType: 0, email: email, password: password }))
        .then(function (j) {
          if (j.result !== "success" || !j.member || !j.token) throw new Error(j.info || "Sign-in failed");
          return { memberId: j.member.tableId, token: j.token, name: j.member.theName || j.member.nickName || "" };
        });
    },
    create: function (auth, vo) {
      var body = env(auth);
      for (var k in vo) if (k !== "pourList") body[k] = vo[k];
      body.pourDataJSONStr = JSON.stringify(vo.pourList);
      return post("tuRecipeAdd.tuhtml", JSON.stringify(encrypt(body))).then(function (j) {
        if (j.result !== "success" || j.tableId == null) throw new Error(j.info || "xBloom did not accept the recipe");
        return j.tableId;
      });
    },
    detailById: function (id) {
      return post("tRecipeDetail.thtml", JSON.stringify({ tableId: Number(id), interfaceVersion: 19700101, skey: "testskey" }))
        .then(function (j) { if (j.result !== "success") throw new Error(j.info || "Recipe not found"); return j.recipeVo; });
    },
    detailByShare: function (url) {
      var m = String(url).match(/[?&]id=([^&#\s]+)/), id = m ? decodeURIComponent(m[1]) : String(url).trim();
      return post("RecipeDetail.html", JSON.stringify({ tableIdOfRSA: id, interfaceVersion: 19700101, skey: "testskey" }))
        .then(function (j) { if (j.result !== "success") throw new Error(j.info || "Share link not readable"); return { vo: j.recipeVo, by: j.shareMemberName }; });
    }
  };
  g.XCLOUD = X;
  if (typeof module !== "undefined") module.exports = X;
})(typeof globalThis !== "undefined" ? globalThis : this);
