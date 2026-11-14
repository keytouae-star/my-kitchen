/* My Kitchen app: UI, storage, online search, import, timers. Needs core.js (window.MK). */
(() => {
  "use strict";
  const MK = window.MK;
  const MEALDB = "https://www.themealdb.com/api/json/v1/1/";
  const QUICK_MIN = 20;
  const APP_VERSION = 9; // shown in Settings so you can tell the tablet has updated
  const EXAMPLE = ["egg", "onion", "garlic", "tomato", "potato", "rice", "pasta", "cheese", "milk", "butter", "lemon", "bread", "cumin", "paprika", "soy_sauce", "chicken", "canned_tomato", "flour", "sugar", "baking_powder"];
  const BASIC_CHOICES = ["salt", "pepper", "oil", "water", "sugar", "flour", "vinegar", "butter", "ghee", "garlic", "onion", "rice", "cumin", "turmeric"];

  // ---------- small helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== "string") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("mk." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("mk." + k, JSON.stringify(v)); } catch (e) {} },
  };
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");

  // ---------- IndexedDB (own recipes + photos) ----------
  let dbp;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("mykitchen", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("recipes", { keyPath: "id" }); r.result.createObjectStore("photos"); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && "result" in req ? req.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }
  const dbAll = (s) => idb(s, "readonly", (st) => st.getAll());
  const dbGet = (s, k) => idb(s, "readonly", (st) => st.get(k));
  const dbPut = (s, v, k) => idb(s, "readwrite", (st) => (k === undefined ? st.put(v) : st.put(v, k)));
  const dbDel = (s, k) => idb(s, "readwrite", (st) => st.delete(k));
  async function askPersist() {
    try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {}
  }

  // ---------- state ----------
  const savedHave = LS.get("have", null);
  const S = {
    builtin: [], mine: [], feed: { version: 0, updated: "" },
    have: new Set(savedHave || EXAMPLE), example: savedHave === null,
    equip: new Set(LS.get("equip", MK.EQUIP_DEFAULT)),
    basics: new Set(LS.get("basics", MK.BASICS_DEFAULT)),
    favs: new Set(LS.get("favs", [])),
    hidden: new Set(LS.get("hidden", [])),
    shop: LS.get("shop", []),
    filters: LS.get("filters", { quick: false, veg: false, vegan: false, fav: false }),
    helper: LS.get("helper", "https://my-kitchen-helper.keytouae.workers.dev"),
    store: LS.get("store", "lulu"),
    openGroups: new Set(LS.get("openGroups", ["meat", "veg", "dairy", "grain"])),
    view: "cook", showMore: false, sheet: null,
  };
  function saveState() {
    if (!S.example) LS.set("have", [...S.have]);
    LS.set("equip", [...S.equip]); LS.set("basics", [...S.basics]); LS.set("favs", [...S.favs]);
    LS.set("hidden", [...S.hidden]); LS.set("shop", S.shop); LS.set("filters", S.filters);
    LS.set("openGroups", [...S.openGroups]);
  }
  function adoptKitchen() { if (S.example) { S.example = false; } }
  // one-time: the owner has a pressure cooker (added Nov 15, 2026), so tick it on devices that saved equipment before it existed
  if (!LS.get("pcAdded", false)) { S.equip.add("pressurecooker"); LS.set("equip", [...S.equip]); LS.set("pcAdded", true); }

  // ---------- recipes and matching ----------
  const prepCache = new WeakMap();
  function prep(r) {
    let p = prepCache.get(r);
    if (!p) {
      const mk = (l) => { const m = MK.matchLine(l); return { line: l, keys: m.keys, custom: m.custom }; };
      p = { need: (r.need || []).map(mk), extra: (r.extra || []).map(mk) };
      prepCache.set(r, p);
    }
    return p;
  }
  function allRecipes(includeHidden) {
    const map = new Map();
    for (const r of S.builtin) map.set(r.id, r);
    for (const r of S.mine) map.set(r.id, r);
    return [...map.values()].filter((r) => includeHidden || !S.hidden.has(r.id));
  }
  const byId = (id) => S.mine.find((r) => r.id === id) || S.builtin.find((r) => r.id === id);
  const isBuiltin = (id) => S.builtin.some((r) => r.id === id);
  const isMine = (id) => S.mine.some((r) => r.id === id);
  function extras() {
    const out = {};
    for (const r of allRecipes(true)) { const p = prep(r); for (const x of p.need.concat(p.extra)) if (x.custom) out[x.custom.key] = x.custom.label; }
    for (const k of S.have) if (k.startsWith("x_") && !out[k]) out[k] = k.slice(2).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
    return out;
  }
  function label(k, ex) {
    return (MK.CATALOG[k] && MK.CATALOG[k].label) || (ex || extras())[k] || k.replace(/^x_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
  // "Missing: …" text with duplicates removed (two kinds of pepper are one shopping item)
  const missText = (miss, ex) => [...new Set(miss.map((x) => x.keys.map((k) => label(k, ex)).join(" or ")))].join(", ");
  const hasKey = (k) => S.have.has(k) || S.basics.has(k);
  const sat = (x) => x.keys.some(hasKey);
  function eqOK(r) { return (r.equipment || []).every((g) => g.split("|").some((k) => S.equip.has(k))); }
  function score(r) {
    const p = prep(r);
    const miss = p.need.filter((x) => !sat(x));
    const have = p.need.length - miss.length;
    return { miss, have, total: p.need.length, frac: p.need.length ? have / p.need.length : 0 };
  }
  function passFilters(r) {
    const f = S.filters;
    if (f.quick && !(r.minutes && r.minutes <= QUICK_MIN)) return false;
    if (f.vegan && r.diet !== "vegan") return false;
    if (f.veg && r.diet === "meat") return false;
    if (f.fav && !S.favs.has(r.id)) return false;
    return true;
  }
  function equipText(r) {
    return (r.equipment || []).map((g) => g.split("|").map((k) => MK.EQUIPMENT[k] || k).join(" or ")).join(" · ");
  }
  function sourceText(r) {
    if (isBuiltin(r.id) && isMine(r.id)) return "Built-in recipe, edited by you";
    return { online: "Saved from the online recipe library", web: "Saved from a website", mine: "Your recipe" }[r.source] || "Built-in recipe";
  }

  // ---------- photos ----------
  const photoUrls = new Map();
  async function photoUrl(r) {
    if (r.photo) {
      if (photoUrls.has(r.id)) return photoUrls.get(r.id);
      try { const b = await dbGet("photos", r.id); if (b) { const u = URL.createObjectURL(b); photoUrls.set(r.id, u); return u; } } catch (e) {}
    }
    return r.imageUrl && navigator.onLine ? r.imageUrl : "";
  }
  function forgetPhoto(id) { if (photoUrls.has(id)) { URL.revokeObjectURL(photoUrls.get(id)); photoUrls.delete(id); } }
  function resizeImage(blob, max = 1200) {
    return new Promise((res) => {
      const img = new Image();
      const u = URL.createObjectURL(blob);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob((b) => res(b || blob), "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(u); res(null); };
      img.src = u;
    });
  }
  function thumbEl(r) {
    // no space is taken until a photo actually loads
    const el = h("span", { hidden: true });
    photoUrl(r).then((u) => {
      if (!u) return;
      const img = h("img", { class: "thumb", src: u, alt: "", loading: "lazy" });
      img.onerror = () => img.remove();
      el.replaceWith(img);
    });
    return el;
  }

  // ---------- views ----------
  function setView(v) {
    S.view = v;
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-current", t.dataset.view === v ? "page" : "false"));
    for (const id of ["cook", "online", "recipes", "shop", "settings"]) $("#view-" + id).hidden = id !== v;
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (S.view === "cook") { renderKitchen(); renderResults(); }
    if (S.view === "recipes") renderRecipeList();
    if (S.view === "shop") renderShop();
    if (S.view === "settings") renderSettings();
    if (S.view === "online") $("#offlineNote").hidden = navigator.onLine;
    const n = S.shop.length;
    $("#shopCount").hidden = !n; $("#shopCount").textContent = n;
  }

  // ---------- kitchen panel ----------
  function chip(text, pressed, onclick, extra) {
    return h("button", Object.assign({ class: "chip", type: "button", "aria-pressed": pressed ? "true" : "false", onclick }, extra || {}), text);
  }
  function toggleHave(k) {
    adoptKitchen();
    S.have.has(k) ? S.have.delete(k) : S.have.add(k);
    saveState(); render();
  }
  function renderKitchen() {
    const ex = extras();
    const realHave = [...S.have];
    $("#haveCount").textContent = plural(realHave.length, "item");
    $("#exampleNote").hidden = !S.example;
    const wrap = $("#groups");
    wrap.replaceChildren();
    for (const [g, glabel] of MK.GROUPS) {
      if (g === "basics") continue;
      let keys = Object.keys(MK.CATALOG).filter((k) => MK.CATALOG[k].group === g);
      if (g === "other") keys = Object.keys(ex).sort((a, b) => ex[a].localeCompare(ex[b]));
      if (!keys.length) continue;
      const n = keys.filter((k) => S.have.has(k)).length;
      const det = h("details", { class: "grp", open: S.openGroups.has(g) },
        h("summary", null, glabel, h("span", { class: "count", text: n ? n + " ticked" : "" })),
        h("div", { class: "chips" }, keys.map((k) => chip(g === "other" ? ex[k] : MK.CATALOG[k].label, S.have.has(k), () => toggleHave(k)))));
      det.addEventListener("toggle", () => { det.open ? S.openGroups.add(g) : S.openGroups.delete(g); LS.set("openGroups", [...S.openGroups]); });
      wrap.append(det);
    }
    const eq = $("#equipChips");
    eq.replaceChildren(...Object.keys(MK.EQUIPMENT).map((k) => chip(MK.EQUIPMENT[k], S.equip.has(k), () => {
      S.equip.has(k) ? S.equip.delete(k) : S.equip.add(k); saveState(); render();
    })));
    $("#equipCount").textContent = [...S.equip].map((k) => MK.EQUIPMENT[k]).join(", ");
    $("#basicsHint").textContent = "Always counted as in your kitchen: " + [...S.basics].map((k) => label(k, ex).toLowerCase()).join(", ") + ". Change this in Settings.";
  }
  // ingredient search
  function findIngredients(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const ex = extras();
    const out = [];
    const consider = (k, words) => {
      let s = -1;
      for (const w of words) {
        if (w === q) s = Math.max(s, 3);
        else if (w.startsWith(q)) s = Math.max(s, 2);
        else if (w.includes(q)) s = Math.max(s, 1);
        else if (q.length > 3 && q.includes(w) && w.length > 2) s = Math.max(s, 0.5);
      }
      if (s >= 0) out.push([s, k]);
    };
    for (const k in MK.CATALOG) consider(k, MK.CATALOG[k].words);
    for (const k in ex) consider(k, [ex[k].toLowerCase()]);
    return out.sort((a, b) => b[0] - a[0]).map((x) => x[1]).slice(0, 8);
  }
  function showSugg() {
    const q = $("#kSearch").value;
    const list = $("#kSugg");
    const keys = findIngredients(q.split(",").pop());
    if (!keys.length) { list.hidden = true; return; }
    const ex = extras();
    list.replaceChildren(...keys.map((k) => h("li", null, h("button", { type: "button", onmousedown: (e) => e.preventDefault(), onclick: () => { addHave([k]); } },
      h("span", { text: label(k, ex) }), h("span", { text: S.have.has(k) ? "✓ have" : "Add" })))));
    list.hidden = false;
  }
  function addHave(keys, unknown) {
    adoptKitchen();
    const ex = extras();
    keys.forEach((k) => S.have.add(k));
    saveState();
    $("#kSearch").value = ""; $("#kSugg").hidden = true;
    let msg = keys.length ? "Added " + keys.map((k) => label(k, ex)).join(", ") + "." : "";
    if (unknown && unknown.length) msg += ` "${unknown.join('", "')}": no recipe uses this yet, but it's saved for recipes you add later.`;
    $("#kMsg").textContent = msg;
    render();
  }
  function submitSearch() {
    const parts = $("#kSearch").value.split(",").map((s) => s.trim()).filter(Boolean);
    const keys = [], unknown = [];
    for (const p of parts) {
      const k = findIngredients(p)[0] || MK.matchOne(p);
      if (k) keys.push(k);
      else {
        const name = MK.cleanName(p) || p;
        const key = "x_" + MK.slug(name.replace(/s$/, ""));
        keys.push(key); unknown.push(name);
      }
    }
    if (keys.length) addHave(keys, unknown);
  }

  // ---------- results ----------
  function card(r, sc, onclick) {
    const fav = S.favs.has(r.id);
    const meta = [r.cuisine, r.minutes ? r.minutes + " min" : "", r.diet === "vegan" ? "Vegan" : r.diet === "veg" ? "Vegetarian" : ""].filter(Boolean).join(" · ");
    const ex = extras();
    return h("button", { class: "card", type: "button", onclick: onclick || (() => openRecipe(r.id)) },
      thumbEl(r),
      fav ? h("span", { class: "star", "aria-label": "Favourite", text: "★" }) : null,
      h("span", { class: "body" },
        h("span", { class: "name", text: r.name }),
        h("span", { class: "meta", text: meta }),
        sc ? h("span", { class: "meter", "aria-hidden": "true" }, h("span", { style: "width:" + Math.round(sc.frac * 100) + "%" })) : null,
        sc ? (sc.miss.length
          ? h("span", { class: "miss", text: "Missing: " + missText(sc.miss, ex) })
          : h("span", { class: "ok", text: "You have everything" })) : null));
  }
  function renderResults() {
    const f = S.filters;
    $("#fQuick").setAttribute("aria-pressed", f.quick); $("#fVeg").setAttribute("aria-pressed", f.veg);
    $("#fVegan").setAttribute("aria-pressed", f.vegan); $("#fFav").setAttribute("aria-pressed", f.fav);
    const out = $("#results");
    out.replaceChildren();
    const pool = allRecipes().filter(passFilters);
    const noEquip = pool.filter((r) => !eqOK(r));
    const scored = pool.filter(eqOK).map((r) => ({ r, sc: score(r) }));
    scored.sort((a, b) => a.sc.miss.length - b.sc.miss.length || (S.favs.has(b.r.id) - S.favs.has(a.r.id)) || b.sc.frac - a.sc.frac || (a.r.minutes || 999) - (b.r.minutes || 999));
    const now = scored.filter((x) => !x.sc.miss.length);
    const near = scored.filter((x) => x.sc.miss.length && x.sc.miss.length <= 2);
    const rest = scored.filter((x) => x.sc.miss.length > 2);
    const sum = $("#summary");
    sum.replaceChildren();
    if (!S.have.size) {
      out.append(h("div", { class: "empty panel" }, h("h3", { text: "Tick what's in your kitchen" }), h("p", { text: "Pick ingredients on the left (or type them), and dishes you can cook will show up here." })));
    } else {
      sum.append(h("strong", { text: now.length ? plural(now.length, "dish", "dishes") : "No dishes" }), " you can cook right now", near.length ? `, and ${near.length} more missing just 1 or 2 things.` : ".");
    }
    const bucket = (title, pill, items) => {
      if (!items.length) return;
      out.append(h("section", { class: "bucket" }, h("h3", null, title, pill), h("div", { class: "grid" }, items.map((x) => card(x.r, x.sc)))));
    };
    if (S.have.size) {
      bucket("Cook now", h("span", { class: "pill good", text: now.length }), now);
      bucket("Missing 1 or 2 things", h("span", { class: "pill warn", text: near.length }), near);
      if (rest.length) {
        if (S.showMore) bucket("Need more shopping", h("span", { class: "pill bad", text: rest.length }), rest);
        else out.append(h("button", { class: "btn", onclick: () => { S.showMore = true; renderResults(); } }, `Show ${plural(rest.length, "more dish", "more dishes")} that need 3+ things`));
      }
      if (noEquip.length) out.append(h("p", { class: "hint", style: "margin-top:14px", text: `${plural(noEquip.length, "dish", "dishes")} hidden because they need equipment you haven't ticked (see My equipment).` }));
      if (!pool.length) out.append(h("p", { class: "empty", text: "No dishes match these filters. Try turning a filter off." }));
    }
  }

  // ---------- sheet ----------
  let lastFocus = null, wakeLock = null;
  function openSheet(build) {
    lastFocus = document.activeElement;
    const panel = $("#sheetPanel");
    panel.replaceChildren();
    build(panel);
    $("#sheet").hidden = false;
    document.body.style.overflow = "hidden";
    panel.scrollTop = 0;
    const c = panel.querySelector(".close"); if (c) c.focus();
  }
  function closeSheet() {
    $("#sheet").hidden = true;
    document.body.style.overflow = "";
    S.sheet = null;
    releaseWake();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function bar(titleText, ...buttons) {
    return h("div", { class: "sheet-bar" }, h("span", { class: "hint", text: titleText || "" }), h("div", { class: "row" }, buttons, h("button", { class: "close", type: "button", "aria-label": "Close", onclick: closeSheet, text: "×" })));
  }
  async function keepAwake() {
    try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); } } catch (e) {}
  }
  function releaseWake() { if (wakeLock && !timers.some((t) => !t.done)) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (S.sheet === "recipe" || timers.some((t) => !t.done))) keepAwake(); });

  // recipe view (also used to preview online results before saving)
  function openRecipe(id, preview) {
    const r = preview || byId(id);
    if (!r) return;
    S.sheet = "recipe";
    keepAwake();
    let serves = r.serves || 2;
    openSheet((panel) => {
      const ex = extras();
      const fav = () => S.favs.has(r.id);
      const favBtn = h("button", { class: "btn small", type: "button", onclick: () => {
        fav() ? S.favs.delete(r.id) : S.favs.add(r.id); saveState(); favBtn.textContent = fav() ? "★ Favourite" : "☆ Favourite"; render();
      } }, fav() ? "★ Favourite" : "☆ Favourite");
      panel.append(bar(preview ? "Preview" : "", preview ? null : favBtn));
      const imgSlot = h("div");
      panel.append(imgSlot);
      photoUrl(r).then((u) => { if (u) { const im = h("img", { class: "hero-img", src: u, alt: "" }); im.onerror = () => im.remove(); imgSlot.append(im); } });
      panel.append(h("h2", { id: "sheetTitle", text: r.name }));
      panel.append(h("p", { class: "meta-line", text: [r.cuisine, r.minutes ? r.minutes + " min" : "time not given", r.diet === "vegan" ? "Vegan" : r.diet === "veg" ? "Vegetarian" : ""].filter(Boolean).join(" · ") }));
      const sc = score(r);
      panel.append(h("p", null, sc.miss.length ? h("span", { class: "pill warn", text: `Missing ${sc.miss.length} of ${sc.total}` }) : h("span", { class: "pill good", text: "You have everything" }),
        !eqOK(r) ? h("span", { class: "pill bad", style: "margin-left:6px", text: "Needs: " + equipText(r) }) : null));
      if (preview) {
        const saved = isMine(r.id);
        panel.append(h("div", { class: "actions" }, h("button", { class: "btn primary", type: "button", disabled: saved, onclick: async (e) => {
          e.target.disabled = true; e.target.textContent = "Saving…";
          await saveImported(r);
          e.target.textContent = "Saved to My recipes ✓";
        } }, saved ? "Already in My recipes ✓" : "Save to My recipes"),
        h("button", { class: "btn", type: "button", onclick: () => openEditor(r, true) }, "Edit before saving")));
      }
      // servings
      const out = h("output", { text: plural(serves, "serving") });
      const ingWrap = h("div");
      const drawIngs = () => {
        const f = serves / (r.serves || serves);
        const p = prep(r);
        const row = (x, opt) => {
          const has = sat(x);
          return h("li", { class: (has ? "have" : "miss") + (opt ? " opt" : "") }, h("span", { class: "mark", "aria-hidden": "true", text: has ? "✓" : opt ? "–" : "!" }),
            h("span", { class: "txt" }, MK.scaleLine(x.line, f), opt ? h("span", { class: "tag", text: "optional" }) : null, h("span", { class: "sr", text: has ? " (you have it)" : " (missing)" })));
        };
        ingWrap.replaceChildren(h("ul", { class: "ings" }, p.need.map((x) => row(x, false)), p.extra.map((x) => row(x, true))));
      };
      const step = (d) => { serves = Math.min(20, Math.max(1, serves + d)); out.textContent = plural(serves, "serving"); drawIngs(); };
      panel.append(h("h3", { text: "Ingredients" }),
        h("div", { class: "row", style: "margin-bottom:10px" }, h("div", { class: "serv" }, h("button", { type: "button", "aria-label": "Fewer servings", onclick: () => step(-1), text: "−" }), out, h("button", { type: "button", "aria-label": "More servings", onclick: () => step(1), text: "+" }))),
        ingWrap);
      drawIngs();
      panel.append(h("p", { class: "hint", style: "margin-top:8px", text: "Basics like " + [...S.basics].slice(0, 3).map((k) => label(k, ex).toLowerCase()).join(", ") + " are assumed." }));
      if (sc.miss.length) {
        const add = h("button", { class: "btn", type: "button", onclick: () => {
          addToShop(sc.miss.map((x) => ({ keys: x.keys, label: x.keys.map((k) => label(k, ex)).join(" or ") })));
          add.disabled = true; add.textContent = "Added to shopping list ✓";
        } }, `Add ${plural(sc.miss.length, "missing item")} to shopping list`);
        panel.append(h("div", { class: "actions" }, add));
      }
      if ((r.equipment || []).length) panel.append(h("p", { class: "hint", text: "Equipment: " + equipText(r) }));
      // steps
      panel.append(h("h3", { text: "Steps" }));
      panel.append(h("ol", { class: "steps" }, (r.steps || []).map((s, i) => {
        const li = h("li");
        const mins = MK.stepMinutes(s);
        const txt = h("div", { class: "step-text", role: "button", tabindex: "0", "aria-pressed": "false", title: "Tap to mark done", text: s });
        const toggle = () => { li.classList.toggle("done"); txt.setAttribute("aria-pressed", li.classList.contains("done")); };
        txt.addEventListener("click", toggle);
        txt.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        li.append(h("div", null, txt, mins ? h("div", { class: "step-tools" }, h("button", { class: "btn small", type: "button", onclick: () => startTimer(mins, r.name + ", step " + (i + 1)) }, "⏱ Start " + fmtMin(mins) + " timer")) : null));
        return li;
      })));
      if (r.pressure) {
        const pm = MK.stepMinutes(r.pressure);
        const has = S.equip.has("pressurecooker");
        panel.append(h("div", { class: "tip pc" }, h("strong", { text: "Pressure cooker way" + (has ? "" : " (if you get one)") + ": " }), r.pressure,
          pm ? h("div", { class: "step-tools" }, h("button", { class: "btn small", type: "button", onclick: () => startTimer(pm, r.name + ", pressure cooker") }, "⏱ Start " + fmtMin(pm) + " timer")) : null));
      }
      if (r.tip) panel.append(h("p", { class: "tip" }, h("strong", { text: "Tip: " }), r.tip));
      // footer actions
      const src = h("p", { class: "src", style: "margin-top:18px" }, sourceText(r));
      if (r.url) src.append(" · ", h("a", { href: outsideLink(r.url), target: "_blank", rel: "noopener", text: "original page" }));
      panel.append(src);
      if (!preview) {
        const acts = h("div", { class: "actions" }, h("button", { class: "btn", type: "button", onclick: () => openEditor(r) }, "Edit recipe"));
        if (isBuiltin(r.id) && isMine(r.id)) acts.append(h("button", { class: "btn", type: "button", onclick: async () => {
          if (!confirm("Go back to the original built-in version? Your changes will be lost.")) return;
          await removeMine(r.id); toast("Original recipe restored"); closeSheet(); render();
        } }, "Restore original"));
        acts.append(h("button", { class: "btn danger", type: "button", onclick: async () => {
          if (isBuiltin(r.id)) {
            if (!confirm(`Hide "${r.name}"? You can bring it back from My recipes.`)) return;
            S.hidden.add(r.id); saveState(); toast("Recipe hidden");
          } else {
            if (!confirm(`Delete "${r.name}"? This can't be undone (unless you have a backup).`)) return;
            await removeMine(r.id); toast("Recipe deleted");
          }
          closeSheet(); render();
        } }, isBuiltin(r.id) ? "Hide recipe" : "Delete recipe"));
        panel.append(acts);
      }
    });
  }

  // ---------- editor ----------
  function equipFromChecks(set) {
    const out = [];
    if (set.has("stove")) out.push("stove");
    const heat = ["oven", "airfryer", "microwave"].filter((k) => set.has(k));
    if (heat.length) out.push(heat.join("|"));
    if (set.has("blender")) out.push("blender");
    return out;
  }
  function openEditor(src, fromPreview) {
    const r = src ? JSON.parse(JSON.stringify(src)) : { id: "", name: "", cuisine: "", minutes: null, serves: 4, diet: "", equipment: ["stove"], need: [], extra: [], steps: [], tip: "", source: "mine" };
    S.sheet = "edit";
    let photoBlob = null, photoRemoved = false;
    openSheet(async (panel) => {
      const isNew = !src || fromPreview || !byId(src.id);
      panel.append(bar(isNew ? "New recipe" : "Edit recipe"));
      panel.append(h("h2", { id: "sheetTitle", text: isNew ? (src ? "Check and save" : "Add a recipe") : "Edit " + r.name }));
      const f = h("form", { class: "form", novalidate: true });
      const fld = (lab, input, hint) => h("div", { class: "field" }, h("label", { for: input.id, text: lab }), input, hint ? h("p", { class: "hint", text: hint }) : null);
      const name = h("input", { class: "input", id: "edName", value: r.name || "", required: true, placeholder: "e.g. Mum's chicken biryani" });
      const cuisines = [...new Set(allRecipes(true).map((x) => x.cuisine).filter(Boolean))];
      const cui = h("input", { class: "input", id: "edCuisine", value: r.cuisine || "", list: "cuiList", placeholder: "e.g. Middle Eastern" });
      const cuiList = h("datalist", { id: "cuiList" }, cuisines.map((c) => h("option", { value: c })));
      const mins = h("input", { class: "input", id: "edMinutes", type: "number", min: "1", max: "600", inputmode: "numeric", value: r.minutes || "" });
      const serv = h("input", { class: "input", id: "edServes", type: "number", min: "1", max: "20", inputmode: "numeric", value: r.serves || 4 });
      const diet = h("select", { class: "input", id: "edDiet" },
        h("option", { value: "", text: "Work it out from the ingredients" }), h("option", { value: "meat", text: "Has meat or fish" }),
        h("option", { value: "veg", text: "Vegetarian" }), h("option", { value: "vegan", text: "Vegan" }));
      diet.value = src ? r.diet || "" : "";
      const eqSet = new Set((r.equipment || []).flatMap((g) => g.split("|")));
      const eqBox = h("div", { class: "checks", id: "edEquip" }, Object.keys(MK.EQUIPMENT).map((k) => h("label", null, h("input", { type: "checkbox", value: k, checked: eqSet.has(k) }), MK.EQUIPMENT[k])));
      const need = h("textarea", { class: "input", id: "edNeed", placeholder: "One per line, e.g.\n500 g chicken thighs\n2 onions, sliced\n1 cup basmati rice", text: (r.need || []).join("\n") });
      const needParsed = h("div", { class: "parsed", "aria-live": "polite" });
      const extra = h("textarea", { class: "input", id: "edExtra", style: "min-height:90px", placeholder: "Nice to have, e.g.\na handful of coriander", text: (r.extra || []).join("\n") });
      const steps = h("textarea", { class: "input", id: "edSteps", style: "min-height:200px", placeholder: "One step per line, e.g.\nFry the onions for 10 minutes until golden.", text: (r.steps || []).join("\n") });
      const tip = h("input", { class: "input", id: "edTip", value: r.tip || "" });
      const pressure = h("textarea", { class: "input", id: "edPressure", style: "min-height:80px", placeholder: "e.g. Cook 8 minutes at high pressure, then let the pressure drop by itself for 10 minutes.", text: r.pressure || "" });
      const url = h("input", { class: "input", id: "edUrl", type: "url", value: r.url || "", placeholder: "https://… (optional)" });
      // photo
      const pPrev = h("div");
      const pInput = h("input", { type: "file", id: "edPhoto", accept: "image/*", hidden: true });
      const pRemove = h("button", { class: "btn quiet small", type: "button", hidden: true, onclick: () => { photoBlob = null; photoRemoved = true; pPrev.replaceChildren(); pRemove.hidden = true; } }, "Remove photo");
      const showPhoto = (u) => { pPrev.replaceChildren(h("img", { src: u, alt: "Recipe photo" })); pRemove.hidden = false; };
      if (src) photoUrl(src).then((u) => u && showPhoto(u));
      pInput.addEventListener("change", async () => {
        const file = pInput.files[0]; if (!file) return;
        const b = await resizeImage(file);
        if (!b) { toast("That file couldn't be read as a picture"); return; }
        photoBlob = b; photoRemoved = false; showPhoto(URL.createObjectURL(b));
      });
      const drawParsed = () => {
        const ex = extras();
        const lines = need.value.split("\n").map((s) => s.trim()).filter(Boolean);
        needParsed.replaceChildren(...lines.map((l) => { const m = MK.matchLine(MK.swapText(l, true)); return h("span", { class: m.custom ? "new" : "", text: m.custom ? "new: " + m.custom.label : m.keys.map((k) => label(k, ex)).join(" or ") }); }));
      };
      need.addEventListener("input", drawParsed); drawParsed();
      const err = h("p", { class: "hint", style: "color:var(--tomato)", "aria-live": "assertive" });
      f.append(
        fld("Recipe name", name),
        h("div", { class: "two" }, fld("Cuisine", cui), fld("Total time (minutes)", mins), fld("Serves", serv), fld("Diet", diet)), cuiList,
        h("div", { class: "field" }, h("span", { class: "lbl", text: "Equipment needed" }), eqBox, h("p", { class: "hint", text: "If you tick oven and air fryer, either one will do." })),
        h("div", { class: "field" }, h("span", { class: "lbl", text: "Photo" }), h("div", { class: "photo-pick" }, pPrev, h("label", { class: "btn", for: "edPhoto", text: "Take or choose a photo" }), pRemove, pInput)),
        fld("Ingredients", need, "One per line, with the amount first. The coloured tags show which kitchen item each line counts as; orange means a new ingredient."), needParsed,
        fld("Optional extras", extra, "Toppings and nice-to-haves. They don't count as missing."),
        fld("Steps", steps, "One step per line. Write times like \"10 minutes\" and a timer button appears."),
        fld("Pressure cooker way (optional)", pressure, "How to make it faster in a pressure cooker. Write the minutes and a timer button appears."),
        fld("Tip (optional)", tip), fld("Original link (optional)", url), err,
        h("div", { class: "actions" }, h("button", { class: "btn primary", type: "submit" }, "Save recipe"), h("button", { class: "btn", type: "button", onclick: closeSheet }, "Cancel")));
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        // strip bullets everywhere, and "1." style numbers only from steps (amounts in ingredients start with numbers)
        const lines = (t) => t.value.split("\n").map((s) => s.trim().replace(t === steps ? /^(\d+[.)]|[-•*])\s*/ : /^[-•*]\s+/, "").trim()).filter(Boolean);
        const out = {
          id: r.id && !fromPreview ? r.id : (src && src.id) || "mine_" + Date.now().toString(36),
          name: name.value.trim(), cuisine: cui.value.trim(), minutes: parseInt(mins.value, 10) || null, serves: Math.min(20, Math.max(1, parseInt(serv.value, 10) || 4)),
          diet: diet.value, equipment: equipFromChecks(new Set([...eqBox.querySelectorAll("input:checked")].map((i) => i.value))),
          need: lines(need), extra: lines(extra), steps: lines(steps), tip: tip.value.trim(), pressure: pressure.value.trim(), url: url.value.trim(),
          source: r.source || "mine", imageUrl: photoRemoved ? "" : r.imageUrl || "", photo: !photoRemoved && !!(photoBlob || r.photo),
        };
        if (!out.name) { err.textContent = "Give the recipe a name."; name.focus(); return; }
        if (!out.need.length) { err.textContent = "Add at least one ingredient."; need.focus(); return; }
        if (!out.steps.length) { err.textContent = "Add at least one step."; steps.focus(); return; }
        if (!out.diet) out.diet = MK.inferDiet(out.need);
        if (!out.equipment.length) out.equipment = MK.inferEquipment(out.steps);
        MK.swapRecipe(out);
        if (photoBlob) { await dbPut("photos", photoBlob, out.id); forgetPhoto(out.id); }
        else if (photoRemoved) { await dbDel("photos", out.id).catch(() => {}); forgetPhoto(out.id); }
        else if (fromPreview && r.imageUrl && !r.photo) await fetchPhoto(out);
        await saveMine(out);
        toast("Recipe saved");
        closeSheet(); render();
        openRecipe(out.id);
      });
      panel.append(f);
      if (!src) name.focus();
    });
  }
  function openPaste() {
    S.sheet = "paste";
    openSheet((panel) => {
      panel.append(bar("Paste a recipe"));
      panel.append(h("h2", { id: "sheetTitle", text: "Paste a recipe" }));
      panel.append(h("p", { class: "hint", style: "margin:8px 0 12px", text: "Copy a recipe from a website, message or note and paste it below. The app splits it into name, ingredients and steps, then you check it before saving." }));
      const ta = h("textarea", { class: "input", id: "pasteText", style: "min-height:320px", placeholder: "Chicken Machboos\n\nIngredients\n1 kg chicken\n2 cups basmati rice\n…\n\nMethod\n1. Fry the onions…" });
      panel.append(ta, h("div", { class: "actions" }, h("button", { class: "btn primary", type: "button", onclick: () => {
        if (!ta.value.trim()) { ta.focus(); return; }
        const draft = MK.fromPaste(ta.value);
        openEditor(draft, true);
      } }, "Split it into a recipe"), h("button", { class: "btn", type: "button", onclick: closeSheet }, "Cancel")));
      ta.focus();
    });
  }

  // ---------- saving ----------
  async function saveMine(r) {
    await dbPut("recipes", r);
    S.mine = S.mine.filter((x) => x.id !== r.id).concat(r);
    S.hidden.delete(r.id);
    saveState(); askPersist();
  }
  async function removeMine(id) {
    await dbDel("recipes", id); await dbDel("photos", id).catch(() => {});
    forgetPhoto(id);
    S.mine = S.mine.filter((x) => x.id !== id);
  }
  async function fetchPhoto(r) {
    if (!r.imageUrl) return;
    try {
      const res = await fetch(r.imageUrl, { mode: "cors" });
      if (!res.ok) return;
      const b = await resizeImage(await res.blob(), 900);
      if (b) { await dbPut("photos", b, r.id); r.photo = true; forgetPhoto(r.id); }
    } catch (e) { /* keep imageUrl only; shows when online */ }
  }
  async function saveImported(r) {
    const copy = JSON.parse(JSON.stringify(r));
    await fetchPhoto(copy);
    await saveMine(copy);
    toast("Saved to My recipes");
    render();
  }

  // ---------- shopping ----------
  function addToShop(items) {
    for (const it of items) {
      const id = (it.keys || []).join("/") || "t_" + it.label.toLowerCase();
      if (!S.shop.some((s) => s.id === id)) S.shop.push({ id, keys: it.keys || [], label: it.label, typed: !!it.typed });
    }
    saveState(); render();
    toast(plural(items.length, "item") + " added to your shopping list");
  }
  function shopText() { return "Shopping list\n" + S.shop.map((s) => "• " + s.label).join("\n"); }
  // WhatsApp message: a checklist you can tick off while ordering
  function whatsAppText() {
    const d = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return `🛒 Shopping list (${d})\n\n` + S.shop.map((s) => "☐ " + s.label).join("\n") + `\n\n${plural(S.shop.length, "item")} · from My Kitchen`;
  }

  // ---------- grocery stores (opens the store's own search; you add to cart and check out there) ----------
  const STORES = {
    lulu: { name: "Lulu", url: (q) => "https://gcc.luluhypermarket.com/en-ae/list/?search_text=" + encodeURIComponent(q) },
    carrefour: { name: "Carrefour", url: (q) => "https://www.carrefouruae.com/mafuae/en/search?keyword=" + encodeURIComponent(q) },
  };
  const SEARCH_WORD = {
    beef_bacon: "beef bacon", turkey_ham: "turkey ham", lemon: "lemon", bell_pepper: "capsicum", green_chili: "green chilli",
    coriander: "coriander leaves", coriander_ground: "coriander powder", chili_flakes: "chilli powder", stock: "stock cubes",
    canned_tomato: "chopped tomatoes", flatbread: "arabic bread", tortilla: "tortilla wraps", baharat: "baharat", juice: "grape juice",
    malt_drink: "malt drink", oil: "cooking oil", sausage: "beef sausages", fish: "fish fillet", shrimp: "prawns", beef_mince: "minced beef",
    feta: "feta cheese", spring_onion: "spring onion", oregano: "oregano", chocolate: "cocoa powder", nuts: "almonds", vanilla: "vanilla essence",
    pepper: "black pepper", sesame: "sesame seeds", peas: "frozen peas", corn: "sweet corn", beans: "kidney beans", lentils: "red lentils",
  };
  function searchWord(item) {
    if (item.typed) return item.label.trim(); // search exactly what you typed ("laban 1 litre")
    const k = (item.keys || [])[0];
    if (k && SEARCH_WORD[k]) return SEARCH_WORD[k];
    const base = k && MK.CATALOG[k] ? MK.CATALOG[k].label : item.label;
    return base.split(/\s*(?:\/| or |\()\s*/i)[0].trim().toLowerCase();
  }
  const store = () => STORES[S.store] || STORES.lulu;
  // Inside the installed app, Android opens normal links in a window on top of My Kitchen, which traps you there.
  // An Android "intent" link hands the page to the store's own app (if installed) or to Chrome instead,
  // so My Kitchen stays put and the Back button returns to it.
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isInstalled = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || document.referrer.startsWith("android-app://");
  function outsideLink(url) {
    if (!isAndroid || !isInstalled()) return url;
    const u = new URL(url);
    return "intent://" + u.host + u.pathname + u.search + "#Intent;scheme=https;S.browser_fallback_url=" + encodeURIComponent(url) + ";end";
  }
  function storeLink(item, cls, text) {
    return h("a", { class: cls || "btn small", href: outsideLink(store().url(searchWord(item))), target: "_blank", rel: "noopener", onclick: () => { item.opened = true; saveState(); } }, text || "Find at " + store().name);
  }
  function renderShop() {
    // store picker
    $("#storePick").replaceChildren(...Object.keys(STORES).map((k) => chip(STORES[k].name, S.store === k, () => { S.store = k; LS.set("store", k); renderShop(); })));
    const ul = $("#shopList");
    ul.replaceChildren(...S.shop.map((s, i) => h("li", { class: s.inCart ? "in-cart" : "" },
      h("label", { class: "cart-tick" }, h("input", { type: "checkbox", checked: !!s.inCart, "aria-label": s.label + " is in the cart", onchange: (e) => { s.inCart = e.target.checked; saveState(); renderShop(); } })),
      h("span", { class: "grow", text: s.label }),
      storeLink(s),
      h("button", { class: "btn quiet small", type: "button", "aria-label": "Remove " + s.label, onclick: () => { S.shop.splice(i, 1); saveState(); render(); } }, "Remove"))));
    if (!S.shop.length) ul.append(h("li", null, h("span", { class: "hint", text: "Nothing here yet. Open a recipe and tap \"Add missing items to shopping list\", or type something above." })));
    const inCart = S.shop.filter((s) => s.inCart).length;
    $("#cartCount").textContent = S.shop.length ? `${inCart} of ${S.shop.length} in your ${store().name} cart` : "";
    $("#shopActions").hidden = !S.shop.length;
    $("#shopModeBtn").hidden = !S.shop.length;
    $("#shopModeBtn").textContent = `Shop my list at ${store().name}`;
    $("#shopShare").textContent = navigator.share ? "Share list" : "Copy list";
    // wa.me opens WhatsApp with the text ready; you pick the chat (yourself, family, a shop)
    $("#shopWhatsApp").href = outsideLink("https://wa.me/?text=" + encodeURIComponent(whatsAppText()));
    $("#shopWhatsApp").hidden = !S.shop.length;
  }
  // step-by-step: one item at a time
  function openShopMode() {
    S.sheet = "shopmode";
    let i = S.shop.findIndex((s) => !s.inCart);
    if (i < 0) i = 0;
    openSheet((panel) => {
      const draw = () => {
        panel.replaceChildren(bar(`Shopping at ${store().name}`));
        const left = S.shop.filter((s) => !s.inCart).length;
        if (!left) {
          panel.append(h("h2", { id: "sheetTitle", text: "All in the cart" }),
            h("p", { class: "meta-line", text: `Now open the ${store().name} app or website, check the cart and pay there. When the shopping arrives, tap the button below.` }),
            h("div", { class: "actions" },
              h("button", { class: "btn primary", type: "button", onclick: () => { closeSheet(); $("#shopBought").click(); } }, "I bought these: add to my kitchen"),
              h("button", { class: "btn", type: "button", onclick: closeSheet }, "Not yet")));
          return;
        }
        const it = S.shop[i];
        panel.append(
          h("p", { class: "hint", text: `Item ${i + 1} of ${S.shop.length} · ${left} still to add` }),
          h("h2", { id: "sheetTitle", class: "shop-item", text: it.label }),
          h("p", { class: "meta-line", text: `Searches ${store().name} for "${searchWord(it)}". Pick the one you want, tap its add button, then press the tablet's Back button to come back here.` }),
          h("div", { class: "actions" }, storeLink(it, "btn primary big", `Open ${store().name}: ${searchWord(it)}`)),
          h("div", { class: "actions" },
            h("button", { class: "btn", type: "button", onclick: () => { it.inCart = true; saveState(); next(); } }, "✓ Added, next item"),
            h("button", { class: "btn quiet", type: "button", onclick: () => next(true) }, "Skip for now")));
      };
      const next = (skip) => {
        const order = S.shop.map((_, k) => (i + 1 + k) % S.shop.length);
        const n = order.find((k) => !S.shop[k].inCart && (!skip || k !== i));
        if (n != null) i = n;
        renderShop(); draw();
      };
      draw();
    });
  }

  // ---------- recipe list ----------
  function renderRecipeList() {
    const q = $("#rSearch").value.trim().toLowerCase();
    const all = allRecipes(true).filter((r) => !q || (r.name + " " + r.cuisine + " " + (r.need || []).join(" ")).toLowerCase().includes(q));
    const mine = all.filter((r) => isMine(r.id) && !S.hidden.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
    const built = all.filter((r) => !isMine(r.id) && !S.hidden.has(r.id)).sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.name.localeCompare(b.name));
    const hidden = all.filter((r) => S.hidden.has(r.id));
    const wrap = $("#recipeList");
    wrap.replaceChildren();
    const sec = (title, items, extraEl) => {
      wrap.append(h("section", { class: "bucket" }, h("h3", null, title, h("span", { class: "pill good", text: items.length })), extraEl || null,
        items.length ? h("div", { class: "grid" }, items.map((r) => card(r, score(r)))) : h("p", { class: "hint", text: q ? "None match your search." : "None yet." })));
    };
    sec("Mine and saved", mine, !mine.length && !q ? h("p", { class: "hint", style: "margin-bottom:10px", text: "Recipes you add, paste, import or edit show up here." }) : null);
    sec("Built-in", built);
    if (hidden.length) {
      wrap.append(h("section", { class: "bucket" }, h("h3", null, "Hidden", h("span", { class: "pill warn", text: hidden.length })),
        h("ul", { class: "list" }, hidden.map((r) => h("li", null, h("span", { class: "grow", text: r.name }), h("button", { class: "btn small", type: "button", onclick: () => { S.hidden.delete(r.id); saveState(); render(); toast("Recipe is back"); } }, "Bring back"))))));
    }
  }

  // ---------- settings ----------
  function renderSettings() {
    const ex = extras();
    $("#basicsChips").replaceChildren(...BASIC_CHOICES.map((k) => chip(label(k, ex), S.basics.has(k), () => { S.basics.has(k) ? S.basics.delete(k) : S.basics.add(k); saveState(); render(); })));
    $("#helperUrl").value = S.helper;
    const mineN = S.mine.length;
    $("#aboutText").textContent = `App version ${APP_VERSION}. ${allRecipes().length} recipes available (${S.builtin.length} built-in, ${mineN} yours or saved). Built-in recipe list updated ${S.feed.updated || "–"}. Everything is stored on this device and works offline. Online search uses TheMealDB's free recipe library.`;
  }
  async function makeBackup() {
    const photos = {};
    for (const r of S.mine) if (r.photo) {
      const b = await dbGet("photos", r.id).catch(() => null);
      if (b) photos[r.id] = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    }
    const data = { app: "my-kitchen", version: 1, saved: new Date().toISOString(), recipes: S.mine, photos,
      state: { have: [...S.have], equip: [...S.equip], basics: [...S.basics], favs: [...S.favs], hidden: [...S.hidden], shop: S.shop, helper: S.helper } };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const name = "my-kitchen-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    const file = typeof File === "function" ? new File([blob], name, { type: "application/json" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && confirm("Share the backup file (for example to Google Drive)?\nPress Cancel to save it to Downloads instead.")) {
      try { await navigator.share({ files: [file], title: "My Kitchen backup" }); $("#backupMsg").textContent = "Backup shared."; return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $("#backupMsg").textContent = `Saved ${name} (${plural(S.mine.length, "recipe")}) to your Downloads.`;
  }
  async function restoreBackup(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== "my-kitchen" || !Array.isArray(data.recipes)) throw new Error("not a My Kitchen backup");
      if (!confirm(`Restore ${plural(data.recipes.length, "recipe")} from ${String(data.saved || "").slice(0, 10)}? Recipes with the same name are replaced; others stay.`)) return;
      for (const r of data.recipes) await dbPut("recipes", r);
      for (const id in data.photos || {}) { const b = await (await fetch(data.photos[id])).blob(); await dbPut("photos", b, id); forgetPhoto(id); }
      const st = data.state || {};
      if (st.have) { S.have = new Set(st.have); S.example = false; }
      if (st.equip) S.equip = new Set(st.equip);
      if (st.basics) S.basics = new Set(st.basics);
      if (st.favs) S.favs = new Set(st.favs);
      if (st.hidden) S.hidden = new Set(st.hidden);
      if (st.shop) S.shop = st.shop;
      if (st.helper) { S.helper = st.helper; LS.set("helper", S.helper); }
      S.mine = await dbAll("recipes");
      saveState(); render();
      $("#backupMsg").textContent = "Backup restored.";
    } catch (e) {
      $("#backupMsg").textContent = "That file couldn't be restored: " + e.message + ".";
    }
  }

  // ---------- online library (TheMealDB) ----------
  const MEALDB_NAME = { beef_mince: "minced beef", fish: "salmon", shrimp: "prawns", canned_tomato: "chopped tomatoes", green_chili: "green chilli", bell_pepper: "red pepper", spring_onion: "spring onions", lentils: "lentils", flatbread: "pita bread" };
  async function getJSON(u) {
    const r = await fetch(u);
    if (!r.ok) throw new Error("server said " + r.status);
    return r.json();
  }
  const mealCache = new Map();
  async function lookupMeal(id) {
    if (mealCache.has(id)) return mealCache.get(id);
    const j = await getJSON(MEALDB + "lookup.php?i=" + encodeURIComponent(id));
    const m = j.meals && j.meals[0];
    if (!m) throw new Error("recipe not found");
    const r = MK.fromMealDB(m);
    mealCache.set(id, r);
    return r;
  }
  function onlineCard(item) {
    const r = item.recipe || { id: "mdb_" + item.idMeal, name: item.strMeal, cuisine: "", imageUrl: item.strMealThumb };
    const sc = item.recipe ? score(item.recipe) : null;
    return card(r, sc, async () => {
      try {
        $("#onlineMsg").textContent = "Opening…";
        const full = item.recipe || await lookupMeal(item.idMeal);
        $("#onlineMsg").textContent = "";
        openRecipe(full.id, isMine(full.id) ? byId(full.id) : full);
      } catch (e) { $("#onlineMsg").textContent = "Couldn't open that recipe: " + e.message + ". Check your internet."; }
    });
  }
  async function onlineSearch(q) {
    const msg = $("#onlineMsg"), out = $("#onlineResults");
    if (!navigator.onLine) { msg.textContent = "You're offline. Connect to the internet to search online."; return; }
    msg.textContent = "Searching…"; out.replaceChildren();
    try {
      const ing = q.trim().toLowerCase().replace(/\s+/g, "_");
      const [byName, byIng] = await Promise.all([
        getJSON(MEALDB + "search.php?s=" + encodeURIComponent(q)).catch(() => ({ meals: null })),
        getJSON(MEALDB + "filter.php?i=" + encodeURIComponent(ing)).catch(() => ({ meals: null })),
      ]);
      const seen = new Set(), items = [];
      for (const m of (byName.meals || [])) if (!seen.has(m.idMeal)) { seen.add(m.idMeal); items.push({ idMeal: m.idMeal, strMeal: MK.swapText(m.strMeal), strMealThumb: m.strMealThumb, recipe: MK.fromMealDB(m) }); }
      for (const m of (byIng.meals || [])) if (!seen.has(m.idMeal)) { seen.add(m.idMeal); items.push({ idMeal: m.idMeal, strMeal: MK.swapText(m.strMeal), strMealThumb: m.strMealThumb }); }
      msg.textContent = items.length ? `${plural(items.length, "recipe")} found. Tap one to see it, then save it if you like it.` : `Nothing found for "${q}". Try one ingredient (like "lamb") or a dish name (like "biryani").`;
      out.replaceChildren(...items.slice(0, 40).map(onlineCard));
    } catch (e) { msg.textContent = "Search failed: " + e.message + "."; }
  }
  async function kitchenIdeas() {
    const msg = $("#onlineMsg"), out = $("#onlineResults");
    if (!navigator.onLine) { msg.textContent = "You're offline. Connect to the internet to search online."; return; }
    const prio = ["meat", "veg", "pulse", "grain", "dairy"];
    const mains = [...S.have].filter((k) => MK.CATALOG[k] && prio.includes(MK.CATALOG[k].group))
      .sort((a, b) => prio.indexOf(MK.CATALOG[a].group) - prio.indexOf(MK.CATALOG[b].group)).slice(0, 4);
    if (!mains.length) { msg.textContent = "Tick a few main ingredients first (meat, vegetables, rice, beans…) on the What can I cook? page."; return; }
    msg.textContent = "Looking for dishes with " + mains.map((k) => label(k).toLowerCase()).join(", ") + "…";
    out.replaceChildren();
    try {
      const lists = await Promise.all(mains.map((k) => getJSON(MEALDB + "filter.php?i=" + encodeURIComponent((MEALDB_NAME[k] || MK.CATALOG[k].label.split(/[ /]/)[0].toLowerCase()).replace(/\s+/g, "_"))).catch(() => ({ meals: null }))));
      const count = new Map();
      lists.forEach((l) => (l.meals || []).forEach((m) => count.set(m.idMeal, (count.get(m.idMeal) || 0) + 1)));
      const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((x) => x[0]);
      if (!top.length) { msg.textContent = "The online library had no matches for those ingredients. Try the search box instead."; return; }
      const recipes = [];
      for (let i = 0; i < top.length; i += 5) recipes.push(...(await Promise.all(top.slice(i, i + 5).map((id) => lookupMeal(id).catch(() => null)))));
      const items = recipes.filter(Boolean).map((r) => ({ recipe: r, sc: score(r) })).sort((a, b) => a.sc.miss.length - b.sc.miss.length);
      msg.textContent = `${plural(items.length, "idea")} from the online library, best match first. Tap one to see it and save it.`;
      out.replaceChildren(...items.map(onlineCard));
    } catch (e) { msg.textContent = "Search failed: " + e.message + "."; }
  }

  // ---------- website import ----------
  async function importLink(link) {
    const msg = $("#linkMsg");
    let u;
    try { u = new URL(link.trim()); if (!/^https?:$/.test(u.protocol)) throw 0; } catch (e) { msg.textContent = "That doesn't look like a web link. It should start with https://"; return; }
    if (!navigator.onLine) { msg.textContent = "You're offline. Connect to the internet to import from a website."; return; }
    if (!S.helper) {
      msg.textContent = "Website import isn't set up yet (it needs the free helper address in Settings). For now, copy the recipe text from the page and use \"Paste recipe text instead\".";
      return;
    }
    msg.textContent = "Reading the recipe from " + u.hostname + "…";
    try {
      const res = await fetch(S.helper.replace(/\/$/, "") + "/?url=" + encodeURIComponent(u.href));
      const j = await res.json();
      if (!j.ok || !j.recipe) throw new Error(j.error || "no recipe found on that page");
      const r = MK.fromSchema(j.recipe, u.href);
      if (!r.need.length || !r.steps.length) throw new Error("the page's recipe data is incomplete");
      msg.textContent = "Found it. Check it and save.";
      openEditor(r, true);
    } catch (e) {
      msg.textContent = "Couldn't read a recipe from that page (" + e.message + "). Copy the recipe text from the page and use \"Paste recipe text instead\".";
    }
  }

  // ---------- built-in recipe feed ----------
  async function loadFeed(force) {
    try {
      const res = await fetch("recipes.json" + (force ? "?t=" + Date.now() : ""), { cache: force ? "no-store" : "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      S.builtin = j.recipes || [];
      S.feed = { version: j.version, updated: j.updated };
      const known = new Set(LS.get("knownIds", []));
      const fresh = S.builtin.filter((r) => !known.has(r.id));
      LS.set("knownIds", S.builtin.map((r) => r.id));
      return known.size ? fresh.length : 0;
    } catch (e) {
      return -1;
    }
  }

  // ---------- timers ----------
  const timers = [];
  let audioCtx = null, tickHandle = null;
  const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + " h " + (m % 60 ? Math.round(m % 60) + " min" : "") : Math.round(m) + " min").trim();
  const fmtClock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0"); };
  function startTimer(mins, name) {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {}
    timers.push({ id: Date.now() + Math.random(), name, end: Date.now() + mins * 60000, done: false, mins });
    keepAwake();
    toast("Timer started: " + fmtMin(mins));
    drawTimers();
    if (!tickHandle) tickHandle = setInterval(tick, 500);
  }
  function beep() {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.3); g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.3 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.22);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + i * 0.3); o.stop(t0 + i * 0.3 + 0.25);
    }
  }
  let lastBeep = 0;
  function tick() {
    const now = Date.now();
    let ringing = false;
    for (const t of timers) {
      if (!t.done && now >= t.end) { t.done = true; try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {} }
      if (t.done) ringing = true;
    }
    if (ringing && now - lastBeep > 1500) { beep(); lastBeep = now; }
    if (!timers.length) { clearInterval(tickHandle); tickHandle = null; }
    drawTimers();
  }
  function drawTimers() {
    const wrap = $("#timers");
    wrap.replaceChildren(...timers.map((t) => h("div", { class: "timer" + (t.done ? " done" : "") },
      h("span", null, h("span", { class: "t", text: t.done ? "Done!" : fmtClock(t.end - Date.now()) }), " ", h("span", { style: "font-size:.85rem;opacity:.85", text: t.name })),
      t.done ? null : h("button", { type: "button", onclick: () => { t.end += 60000; drawTimers(); } }, "+1 min"),
      h("button", { type: "button", onclick: () => { timers.splice(timers.indexOf(t), 1); drawTimers(); if (S.sheet !== "recipe") releaseWake(); } }, t.done ? "Stop" : "Cancel"))));
  }

  // ---------- wiring ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
  $("#kSearch").addEventListener("input", showSugg);
  $("#kSearch").addEventListener("focus", showSugg);
  $("#kSearch").addEventListener("blur", () => setTimeout(() => ($("#kSugg").hidden = true), 150));
  $("#kSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitSearch(); } if (e.key === "Escape") $("#kSugg").hidden = true; });
  $("#clearKitchen").addEventListener("click", () => {
    if (S.have.size && !S.example && !confirm("Untick everything in your kitchen?")) return;
    S.example = false; S.have.clear(); saveState(); $("#kMsg").textContent = ""; render();
  });
  const filt = (id, key, off) => $(id).addEventListener("click", () => { S.filters[key] = !S.filters[key]; if (S.filters[key] && off) S.filters[off] = false; S.showMore = false; saveState(); render(); });
  filt("#fQuick", "quick"); filt("#fVeg", "veg", "vegan"); filt("#fVegan", "vegan", "veg"); filt("#fFav", "fav");
  $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
  $("#addBtn").addEventListener("click", () => openEditor(null));
  $("#pasteBtn").addEventListener("click", openPaste);
  $("#pasteBtn2").addEventListener("click", openPaste);
  $("#rSearch").addEventListener("input", renderRecipeList);
  $("#updateBtn").addEventListener("click", async () => {
    const m = $("#updateMsg");
    if (!navigator.onLine) { m.textContent = "You're offline. Connect to the internet to check for new recipes."; return; }
    m.textContent = "Checking…";
    const n = await loadFeed(true);
    m.textContent = n < 0 ? "Couldn't reach the recipe list. Try again later." : n ? `${plural(n, "new recipe")} added.` : "You have the latest recipe list (updated " + (S.feed.updated || "–") + ").";
    render();
  });
  $("#onlineForm").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#onlineQ").value.trim(); if (q) onlineSearch(q); });
  $("#ideasBtn").addEventListener("click", kitchenIdeas);
  $("#linkForm").addEventListener("submit", (e) => { e.preventDefault(); importLink($("#linkUrl").value); });
  $("#shopForm").addEventListener("submit", (e) => {
    e.preventDefault(); const v = $("#shopAdd").value.trim(); if (!v) return;
    const m = MK.matchLine(v); addToShop([{ keys: m.custom ? [] : m.keys, label: v, typed: true }]); $("#shopAdd").value = "";
  });
  $("#shopBought").addEventListener("click", () => {
    adoptKitchen();
    let n = 0;
    for (const s of S.shop) if (s.keys && s.keys[0]) { S.have.add(s.keys[0]); n++; }
    S.shop = []; saveState(); render(); toast(n ? plural(n, "item") + " added to your kitchen" : "List cleared");
  });
  $("#shopShare").addEventListener("click", async () => {
    const text = shopText();
    if (navigator.share) { try { await navigator.share({ title: "Shopping list", text }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text); toast("List copied"); }
    catch (e) { const ta = $("#shopCopy"); ta.hidden = false; ta.value = text; ta.select(); toast("Select the text below and copy it"); }
  });
  $("#shopModeBtn").addEventListener("click", openShopMode);
  $("#shopClear").addEventListener("click", () => { if (!confirm("Clear the whole shopping list?")) return; S.shop = []; saveState(); render(); });
  $("#backupBtn").addEventListener("click", makeBackup);
  $("#restoreFile").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) restoreBackup(f); e.target.value = ""; });
  $("#helperForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#helperUrl").value.trim();
    S.helper = v; LS.set("helper", v);
    const m = $("#helperMsg");
    if (!v) { m.textContent = "Helper removed."; return; }
    m.textContent = "Saved. Testing…";
    try { const j = await (await fetch(v.replace(/\/$/, "") + "/?ping=1")).json(); m.textContent = j.ok ? "Helper works. You can now import recipes from websites." : "Saved, but the helper didn't answer as expected."; }
    catch (err) { m.textContent = "Saved, but the helper couldn't be reached. Check the address."; }
  });
  function netStatus() {
    const on = navigator.onLine;
    $("#netStatus").replaceChildren(h("span", { class: "dot" + (on ? "" : " off") }), h("span", { text: on ? "Online" : "Offline: saved recipes still work" }));
    if (S.view === "online") $("#offlineNote").hidden = on;
  }
  window.addEventListener("online", netStatus); window.addEventListener("offline", netStatus);
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("#installBtn").hidden = false; });
  $("#installBtn").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $("#installBtn").hidden = true; });
  window.addEventListener("appinstalled", () => { $("#installBtn").hidden = true; toast("My Kitchen is installed"); });

  // ---------- start ----------
  (async function start() {
    netStatus();
    render();
    // draw as soon as each source answers; never wait on one before showing the other
    dbAll("recipes").then((m) => { S.mine = m || []; render(); }).catch(() => {});
    const n = await loadFeed(false);
    render();
    if (n > 0) toast(plural(n, "new recipe") + " added to your list");
    // shared from another app (Android Share -> My Kitchen)
    const p = new URLSearchParams(location.search);
    const shared = p.get("url") || ((p.get("text") || "").match(/https?:\/\/\S+/) || [])[0];
    if (shared || p.get("text")) {
      history.replaceState(null, "", location.pathname);
      setView("online");
      if (shared) { $("#linkUrl").value = shared; importLink(shared); }
      else { openPaste(); $("#pasteText").value = p.get("text"); }
    }
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  })();
})();
