/* My Kitchen stock: the items you keep a count of, with their unit, quick buy amounts,
   low level, and conversions (cup = grams/ml per cup, pc = grams per piece).
   Works in the browser (window.MKStock) and in Node (module.exports) for checks. */
(function (root) {
  "use strict";

  // core.js is loaded first in the browser; in Node it is required here.
  const MK = root.MK || (typeof require === "function" ? require("./core.js") : null);

  const TRACKED = {
    egg: { unit: "pcs", buy: [6, 12, 30], low: 3 },
    rice: { unit: "g", buy: [1000, 2000, 5000], low: 400, cup: 185 },
    pasta: { unit: "g", buy: [500, 1000], low: 200 },
    flour: { unit: "g", buy: [1000, 2000], low: 300, cup: 125 },
    sugar: { unit: "g", buy: [1000, 2000], low: 200, cup: 200 },
    milk: { unit: "ml", buy: [1000, 2000], low: 300, cup: 240 },
    chicken: { unit: "g", buy: [500, 1000, 2000], low: 300, pc: 200 },
    beef_mince: { unit: "g", buy: [500, 1000], low: 250 },
    lamb: { unit: "g", buy: [500, 1000], low: 250 },
    beef: { unit: "g", buy: [500, 1000], low: 250 },
    fish: { unit: "g", buy: [500, 1000], low: 250, pc: 180 },
    shrimp: { unit: "g", buy: [500, 1000], low: 150 },
    onion: { unit: "pcs", buy: [5, 10], low: 2 },
    potato: { unit: "pcs", buy: [5, 10], low: 2 },
    tomato: { unit: "pcs", buy: [5, 10], low: 2 },
    carrot: { unit: "pcs", buy: [4, 8], low: 1 },
    bell_pepper: { unit: "pcs", buy: [3, 6], low: 1 },
    cucumber: { unit: "pcs", buy: [3, 6], low: 1 },
    lemon: { unit: "pcs", buy: [4, 8], low: 1 },
    banana: { unit: "pcs", buy: [6, 12], low: 1 },
    cheese: { unit: "g", buy: [200, 500], low: 80, cup: 100 },
    yogurt: { unit: "g", buy: [500, 1000], low: 150, cup: 245 },
    butter: { unit: "g", buy: [100, 250], low: 40, cup: 225 },
    cream: { unit: "ml", buy: [200, 500], low: 100, cup: 240 },
    bread: { unit: "pcs", buy: [10, 20], low: 3 },
    tortilla: { unit: "pcs", buy: [8, 16], low: 2 },
    canned_tomato: { unit: "pcs", buy: [2, 4], low: 1 },
    chickpeas: { unit: "pcs", buy: [2, 4], low: 1 },
    beans: { unit: "pcs", buy: [2, 4], low: 1 },
    lentils: { unit: "g", buy: [500, 1000], low: 150, cup: 200 },
    oats: { unit: "g", buy: [500, 1000], low: 100, cup: 90 },
    noodles: { unit: "g", buy: [400, 800], low: 100, pc: 100 },
  };

  // "4" for pcs, "650 g" / "1.2 kg" (>=1000), "300 ml" / "1.5 L" (>=1000)
  function unitLabel(key, qty) {
    const unit = (TRACKED[key] || {}).unit || "pcs";
    if (unit === "pcs") return String(Math.round(qty * 2) / 2);
    if (qty >= 1000) return Math.round((qty / 1000) * 10) / 10 + " " + (unit === "g" ? "kg" : "L");
    return Math.round(qty) + " " + unit;
  }

  // ---------- reading an ingredient line ----------
  const VULGAR = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅕": 0.2 };
  const QTY = "(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*[½⅓⅔¼¾⅛⅕]|\\d+(?:\\.\\d+)?)";
  const QTY_RE = new RegExp("^\\s*" + QTY + "(?:\\s*(?:-|–|to)\\s*" + QTY + ")?");
  function num(s) {
    s = s.trim();
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if ((m = s.match(/^(\d*)([½⅓⅔¼¾⅛⅕])$/))) return (m[1] ? +m[1] : 0) + VULGAR[m[2]];
    return parseFloat(s);
  }
  // How much of a tracked item a line uses, in the item's unit, or null if it can't tell.
  function amountOf(line, key, factor) {
    const t = TRACKED[key];
    if (!t) return null;
    let part = String(line);
    if (/\s+or\s+/i.test(part)) {
      const hit = part.split(/\s+or\s+/i).find((p) => MK.matchOne(p) === key);
      if (!hit) return null;
      part = hit;
    }
    const m = part.match(QTY_RE);
    if (!m) return null;
    const qty = num(m[1]);
    if (!isFinite(qty)) return null;
    const word = ((part.slice(m[0].length).match(/^\s*([a-zA-Z]+)/) || [])[1] || "").toLowerCase();
    let value, dim;
    if (/^(g|grams?)$/.test(word)) { value = qty; dim = "g"; }
    else if (/^kg$/.test(word)) { value = qty * 1000; dim = "g"; }
    else if (/^ml$/.test(word)) { value = qty; dim = "ml"; }
    else if (/^(l|litre|liter|litres|liters)$/.test(word)) { value = qty * 1000; dim = "ml"; }
    else if (/^cups?$/.test(word)) { if (t.cup == null) return null; value = qty * t.cup; dim = t.unit; }
    else if (/^(tbsps?|tbs|tablespoons?|tblsps?|tbls|tblspns?)$/.test(word)) { if (t.cup == null) return null; value = (qty * t.cup) / 16; dim = t.unit; }
    else if (/^(tsps?|teaspoons?)$/.test(word)) { if (t.cup == null) return null; value = (qty * t.cup) / 48; dim = t.unit; }
    else { value = qty; dim = "count"; }
    let out;
    if (dim === "count") {
      if (t.unit === "pcs") out = value;
      else if (t.unit === "g") { if (t.pc == null) return null; out = value * t.pc; }
      else return null;
    } else if (dim === t.unit) out = value;
    else return null;
    out *= factor == null ? 1 : factor;
    return t.unit === "pcs" ? Math.round(out * 2) / 2 : Math.round(out);
  }

  const api = { TRACKED, amountOf, unitLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MKStock = api;
})(typeof window !== "undefined" ? window : globalThis);
