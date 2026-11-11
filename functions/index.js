// 초월앱 푸시 알림: Firestore에 새 활동이 생기면, 그 활동과 관련된 사람의 휴대폰으로 알림을 보낸다.
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "asia-northeast3", maxInstances: 3 });
const db = admin.firestore();
const APP_URL = "https://joonchilly.github.io/CHOWOL/";
const STICKERS = { door: "🚪", turtle: "🐢", beer: "🍺", shoe: "👟", fire: "🔥", clap: "👏", pump: "💪", chicken: "🍗", siren: "🚨", gravity: "🏋️", protein: "🥤" };

const clip = (t, n = 60) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const preview = (d) => (d.kind === "image" ? "사진" : d.kind === "video" ? "동영상" : d.kind === "poll" ? "📊 " + (d.q || "투표") : clip(d.text));
const liked = (v) => v === true || (typeof v === "number" && v > 0);

async function nameOf(uid) {
  const s = await db.doc("members/" + uid).get();
  const d = s.data() || {};
  return d.nick || d.authName || "친구";
}
async function everyoneBut(uid) {
  const s = await db.collection("members").get();
  return s.docs.map((d) => d.id).filter((id) => id !== uid);
}
async function send(uids, title, body, hash, tag) {
  uids = [...new Set(uids)].filter(Boolean);
  if (!uids.length) return;
  const tokens = [];
  for (let i = 0; i < uids.length; i += 10) {
    const s = await db.collection("pushTokens").where("uid", "in", uids.slice(i, i + 10)).get();
    s.forEach((d) => tokens.push(d.id));
  }
  if (!tokens.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { title, body: body || "", url: APP_URL + (hash || ""), tag: tag || "" },
    webpush: { headers: { Urgency: "high", TTL: "86400" } }
  });
  const dead = [];
  res.responses.forEach((r, i) => {
    const c = r.error && r.error.code;
    if (!r.success && (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token" || c === "messaging/invalid-argument")) dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.doc("pushTokens/" + t).delete()));
}

// 새 게시물 → 나머지 모두
exports.onPost = onDocumentCreated("posts/{id}", async (e) => {
  const d = e.data.data();
  if (!d || !d.author || d.author === "guide") return;
  const what = d.sauna ? "🧖 사우나 인증을" : d.run ? "🏃 러닝 인증을" : d.gym ? (d.gym.rpm >= 10 ? "🔥 엔진 과열 오운완을" : "💪 오운완 인증을") : "새 게시물을";
  await send(await everyoneBut(d.author), "초월", (await nameOf(d.author)) + "님이 " + what + " 올렸어요", "#home", "post-" + e.params.id);
});

// 💪·스티커 → 게시물 주인
exports.onPostUpdate = onDocumentUpdated("posts/{id}", async (e) => {
  const b = e.data.before.data() || {}, a = e.data.after.data() || {};
  const owner = a.author; if (!owner) return;
  const bh = (b.reactions && b.reactions.heart) || {}, ah = (a.reactions && a.reactions.heart) || {};
  for (const [u, v] of Object.entries(ah)) {
    if (u !== owner && liked(v) && !liked(bh[u])) await send([owner], "초월", (await nameOf(u)) + "님이 내 게시물에 💪를 보냈어요", "#home", "like-" + e.params.id);
  }
  const bs = b.stickers || {}, as = a.stickers || {};
  for (const [sid, v] of Object.entries(as)) {
    if (v && !bs[sid] && v.by && v.by !== owner) await send([owner], "초월", (await nameOf(v.by)) + "님이 내 " + (a.gym ? "운동 인증" : "러닝") + "에 스티커를 붙였어요 " + (STICKERS[v.s] || ""), "#home", "stk-" + e.params.id);
  }
});

// 댓글 → 게시물 주인 + 같은 글에 댓글 단 사람
exports.onComment = onDocumentCreated("comments/{id}", async (e) => {
  const c = e.data.data(); if (!c || !c.postId) return;
  const post = (await db.doc("posts/" + c.postId).get()).data(); if (!post) return;
  const who = await nameOf(c.author);
  if (post.author !== c.author) await send([post.author], "초월", who + "님이 내 게시물에 댓글을 남겼어요: " + clip(c.text, 40), "#home", "cm-" + c.postId);
  const others = (await db.collection("comments").where("postId", "==", c.postId).get()).docs.map((d) => d.data().author).filter((u) => u && u !== c.author && u !== post.author);
  await send(others, "초월", who + "님도 같은 게시물에 댓글을 남겼어요: " + clip(c.text, 40), "#home", "cm-" + c.postId);
});

// 1:1 메시지 → 상대방
exports.onDm = onDocumentCreated("dm/{id}", async (e) => {
  const d = e.data.data(); if (!d) return;
  const to = (d.members || []).filter((u) => u !== d.author);
  await send(to, await nameOf(d.author), preview(d), "#dm", "dm-" + d.author);
});

// 단체방 메시지·투표 → 나머지 모두
exports.onChat = onDocumentCreated("chat/{id}", async (e) => {
  const d = e.data.data(); if (!d) return;
  const who = await nameOf(d.author);
  await send(await everyoneBut(d.author), "초월 단체방", d.kind === "poll" ? who + "님이 투표를 올렸어요: " + clip(d.q, 40) : who + ": " + preview(d), "#dm", "group");
});

// 투표 참여 → 투표 올린 사람
exports.onChatUpdate = onDocumentUpdated("chat/{id}", async (e) => {
  const b = e.data.before.data() || {}, a = e.data.after.data() || {};
  if (a.kind !== "poll") return;
  const bv = b.votes || {}, av = a.votes || {};
  for (const [u, v] of Object.entries(av)) {
    if (u !== a.author && v && !bv[u]) await send([a.author], "초월 단체방", (await nameOf(u)) + "님이 내 투표에 참여했어요", "#dm", "vote-" + e.params.id);
  }
});

// 공지 → 나머지 모두
exports.onNotice = onDocumentCreated("notices/{id}", async (e) => {
  const d = e.data.data(); if (!d) return;
  await send(await everyoneBut(d.author), "📢 초월 공지", clip(d.text, 80), "#dm", "notice");
});

// 크루 바디: 이번 주(월요일 0시, 한국 시간) 7부위가 처음으로 다 켜지면 모두에게
const PARTS = ["chest", "back", "shoulder", "arm", "core", "legs", "cardio"];
function weekStartKST(ts) {
  const k = new Date(ts + 9 * 3600000); // 한국 시간 기준 날짜
  const day = (k.getUTCDay() + 6) % 7;
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - day) - 9 * 3600000;
}
exports.onWorkout = onDocumentCreated("workouts/{id}", async (e) => {
  const d = e.data.data(); if (!d || !d.ts) return;
  const ws = weekStartKST(d.ts);
  const docs = (await db.collection("workouts").where("ts", ">=", ws).get()).docs;
  const before = new Set(), after = new Set();
  docs.forEach((x) => { const w = x.data(); if (w.ts >= ws + 7 * 86400000) return; (w.parts || []).forEach((p) => { after.add(p); if (x.id !== e.params.id) before.add(p); }); });
  const full = (set) => PARTS.every((p) => set.has(p));
  if (!full(after) || full(before)) return;
  const all = (await db.collection("members").get()).docs.map((m) => m.id);
  await send(all, "💪 초월 크루 바디 완성!", "이번 주 7부위 전부 점등! 득근 파티 열자! (마지막 퍼즐: " + (await nameOf(d.author)) + "님)", "#log", "crewbody-" + ws);
});
