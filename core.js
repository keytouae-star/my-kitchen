/* My Kitchen core: ingredient catalog, line parser, matcher, scaling, swaps,
   and converters for recipes from TheMealDB, websites and pasted text.
   Works in the browser (window.MK) and in Node (module.exports) for checks. */
(function (root) {
  "use strict";

  // ---------- Ingredient catalog ----------
  // key: [label, group, "synonym, synonym"]  (label and key words are matched too)
  const GROUPS = [
    ["basics", "Basics"],
    ["meat", "Meat, fish & eggs"],
    ["dairy", "Dairy"],
    ["veg", "Vegetables"],
    ["salad", "Salad & leafy greens"],
    ["fruit", "Fruit"],
    ["herb", "Fresh herbs"],
    ["grain", "Rice, grains & bread"],
    ["pulse", "Beans, lentils & cans"],
    ["jar", "Sauces & jars"],
    ["bake", "Baking & sweet"],
    ["spice", "Spices"],
    ["other", "My other ingredients"],
  ];
  const RAW = {
    salt: ["Salt", "basics", "sea salt, kosher salt, table salt"],
    pepper: ["Black pepper", "basics", "pepper, ground pepper, peppercorns, ground black pepper"],
    oil: ["Cooking oil", "basics", "oil, olive oil, vegetable oil, sunflower oil, canola oil, corn oil, extra virgin olive oil, frying oil"],
    water: ["Water", "basics", "hot water, cold water, boiling water"],
    ice: ["Ice cubes", "basics", "ice, ice cubes, crushed ice, a handful of ice"],

    egg: ["Eggs", "meat", "egg, egg yolk, egg white, yolk"],
    chicken: ["Chicken", "meat", "chicken breast, chicken thigh, chicken thighs, chicken legs, chicken drumsticks, chicken wings, whole chicken, boneless chicken"],
    beef: ["Beef", "meat", "beef steak, steak, stewing beef, beef chunks, sirloin, brisket, beef brisket, beef tenderloin, veal"],
    beef_mince: ["Minced beef", "meat", "ground beef, beef mince, mince, minced meat, ground meat, keema, kheema"],
    lamb: ["Lamb", "meat", "mutton, lamb chops, lamb shoulder, leg of lamb, lamb shanks, minced lamb, ground lamb, lamb mince"],
    turkey: ["Turkey", "meat", "turkey mince, minced turkey, ground turkey, turkey breast, whole turkey, turkey thighs"],
    sausage: ["Beef or chicken sausages", "meat", "sausages, beef sausages, chicken sausages, sausage"],
    beef_bacon: ["Beef or turkey bacon", "meat", "beef bacon, turkey bacon"],
    turkey_ham: ["Turkey or beef ham", "meat", "turkey ham, beef ham, turkey slices, beef pastrami, pastrami"],
    fish: ["Fish fillets", "meat", "fish, white fish, salmon, cod, hammour, tilapia, sea bass, seabass, haddock, hake, fish fillet, salmon fillets, kingfish, sea bream, seabream, bream, safi, shaari, whole fish"],
    tuna: ["Canned tuna", "meat", "tuna, tinned tuna, tuna chunks"],
    shrimp: ["Prawns / shrimp", "meat", "prawns, prawn, shrimps, king prawns"],

    milk: ["Milk", "dairy", "whole milk, full fat milk, skimmed milk, fresh milk"],
    butter: ["Butter", "dairy", "unsalted butter, salted butter"],
    ghee: ["Ghee", "dairy", "clarified butter, samna"],
    cheese: ["Cheese", "dairy", "cheddar, cheddar cheese, grated cheese, mozzarella, mozzarella cheese, processed cheese, gouda, cheese slices, shredded cheese"],
    parmesan: ["Parmesan", "dairy", "parmesan cheese, parmigiano, grana padano, pecorino"],
    feta: ["Feta / white cheese", "dairy", "feta cheese, white cheese, akkawi, halloumi"],
    labneh: ["Labneh", "dairy", "labne, labneh cheese"],
    cream_cheese: ["Cream cheese", "dairy", "philadelphia, soft cheese"],
    yogurt: ["Yogurt", "dairy", "yoghurt, plain yogurt, greek yogurt, natural yogurt, laban, curd, dahi"],
    evaporated_milk: ["Evaporated or condensed milk", "dairy", "evaporated milk, condensed milk, sweetened condensed milk, carnation milk, rainbow milk"],
    cream: ["Cream", "dairy", "cooking cream, heavy cream, double cream, single cream, whipping cream, sour cream, creme fraiche, fresh cream"],

    onion: ["Onions", "veg", "onion, red onion, white onion, yellow onion, brown onion, shallot, shallots"],
    spring_onion: ["Spring onions", "veg", "spring onion, green onion, green onions, scallion, scallions"],
    garlic: ["Garlic", "veg", "garlic clove, garlic cloves, garlic powder, minced garlic, garlic paste"],
    ginger: ["Ginger", "veg", "fresh ginger, ginger paste, ground ginger, root ginger"],
    tomato: ["Tomatoes", "veg", "tomato, plum tomatoes, ripe tomatoes, fresh tomatoes"],
    potato: ["Potatoes", "veg", "potato, baby potatoes, new potatoes"],
    sweet_potato: ["Sweet potatoes", "veg", "sweet potato"],
    carrot: ["Carrots", "veg", "carrot"],
    bell_pepper: ["Bell peppers", "veg", "bell pepper, capsicum, red pepper, green pepper, yellow pepper, sweet pepper, red peppers, green peppers"],
    green_chili: ["Green chilies", "veg", "green chili, green chilli, green chillies, chili, chilli, chillies, fresh chili, jalapeno, red chili, red chilli, bird's eye chili"],
    spinach: ["Spinach", "salad", "baby spinach"],
    cucumber: ["Cucumbers", "salad", "cucumber"],
    lettuce: ["Lettuce / salad leaves", "salad", "lettuce, iceberg, romaine, salad leaves, mixed salad, mixed greens, baby leaves, little gem"],
    rocket: ["Rocket (jarjeer)", "salad", "rocket, arugula, jarjeer, rucola"],
    kale: ["Kale", "salad", "curly kale"],
    radish: ["Radishes", "salad", "radish, red radish, white radish, mooli"],
    beetroot: ["Beetroot", "veg", "beets, beet, beetroots"],
    celery: ["Celery", "salad", "celery sticks, celery stalks"],
    leek: ["Leeks", "veg", "leek"],
    pumpkin: ["Pumpkin / squash", "veg", "pumpkin, butternut squash, butternut, squash"],
    turnip: ["Turnips", "veg", "turnip"],
    asparagus: ["Asparagus", "veg", ""],
    bean_sprouts: ["Bean sprouts", "salad", "sprouts, mung bean sprouts"],
    cherry_tomato: ["Cherry tomatoes", "salad", "cherry tomatoes, cherry tomato, baby tomatoes"],
    red_cabbage: ["Red cabbage", "salad", "purple cabbage"],
    molokhia: ["Molokhia", "veg", "mulukhiyah, jute leaves, molokhia leaves"],
    vine_leaves: ["Vine leaves", "veg", "grape leaves, vine leaves, warak enab"],
    artichoke: ["Artichoke", "veg", "artichoke hearts"],
    mushroom: ["Mushrooms", "veg", "mushroom, button mushrooms, chestnut mushrooms"],
    zucchini: ["Zucchini", "veg", "courgette, courgettes, kousa, marrow"],
    eggplant: ["Eggplant", "veg", "aubergine, aubergines, brinjal, eggplants"],
    cabbage: ["Cabbage", "veg", "white cabbage, napa cabbage, chinese cabbage, bok choy, pak choi"],
    cauliflower: ["Cauliflower", "veg", "cauliflower florets"],
    broccoli: ["Broccoli", "veg", "broccoli florets, tenderstem"],
    peas: ["Peas", "veg", "frozen peas, green peas, garden peas, pea"],
    green_beans: ["Green beans", "veg", "french beans, string beans"],
    corn: ["Sweetcorn", "veg", "corn, sweet corn, corn kernels"],
    okra: ["Okra", "veg", "bamia, bhindi, ladies fingers"],
    avocado: ["Avocado", "salad", "avocados"],

    tea: ["Tea", "jar", "black tea, tea bags, tea bag, loose tea, red tea"],
    green_tea: ["Green tea", "jar", "green tea bags, gunpowder tea, chinese green tea"],
    coffee: ["Coffee", "jar", "instant coffee, ground coffee, espresso, nescafe, coffee powder, strong coffee"],
    sparkling_water: ["Sparkling water / soda", "jar", "soda water, sparkling water, club soda, soda"],
    chia: ["Chia or basil seeds", "jar", "chia seeds, basil seeds, sabja, tukmaria"],
    lemon: ["Lemons or limes", "fruit", "lemon, lime, limes, lemon juice, lime juice, lemon zest, lime zest"],
    banana: ["Bananas", "fruit", "banana"],
    apple: ["Apples", "fruit", "apple"],
    dates: ["Dates", "fruit", "date, medjool dates"],
    dried_lime: ["Dried limes (loomi)", "spice", "dried lime, dried limes, loomi, black lime, black limes, omani lime"],
    juice: ["Fruit juice", "fruit", "grape juice, red grape juice, white grape juice, sparkling grape juice, apple juice, orange juice"],
    malt_drink: ["Malt drink (non-alcoholic)", "jar", "non-alcoholic malt drink, malt drink, malt beverage"],
    raisins: ["Raisins", "fruit", "sultanas, raisin"],
    cranberries: ["Dried cranberries", "fruit", "cranberries, dried cranberries, craisins"],
    barberries: ["Barberries (zereshk)", "fruit", "zereshk, barberry, dried barberries"],
    orange: ["Oranges", "fruit", "orange, mandarin, mandarins, clementine, clementines, tangerine, orange zest"],
    mango: ["Mangoes", "fruit", "mango, mangos"],
    grapes: ["Grapes", "fruit", "grape, red grapes, green grapes"],
    berries: ["Berries", "fruit", "strawberries, strawberry, blueberries, blueberry, raspberries, raspberry, mixed berries, frozen berries"],
    pomegranate: ["Pomegranate", "fruit", "pomegranates, pomegranate seeds, pomegranate arils"],
    melon: ["Melon / watermelon", "fruit", "watermelon, melon, cantaloupe, honeydew"],
    pineapple: ["Pineapple", "fruit", "pineapple chunks"],
    kiwi: ["Kiwi", "fruit", "kiwis, kiwi fruit, kiwifruit"],
    pear: ["Pears", "fruit", "pear"],
    peach: ["Peaches / apricots", "fruit", "peach, peaches, nectarine, nectarines, apricot, apricots"],
    figs: ["Figs", "fruit", "fig, fresh figs, dried figs"],
    coconut: ["Coconut (fresh or desiccated)", "fruit", "desiccated coconut, shredded coconut, coconut flakes, fresh coconut"],

    parsley: ["Parsley", "herb", "flat-leaf parsley, flat leaf parsley, curly parsley"],
    coriander: ["Coriander leaves", "herb", "cilantro, fresh coriander, coriander leaves, dhania"],
    mint: ["Mint", "herb", "fresh mint, mint leaves"],
    basil: ["Basil", "herb", "fresh basil, basil leaves"],
    dill: ["Dill", "herb", "fresh dill"],
    chives: ["Chives or leek greens", "herb", "chives, garlic chives, tareh"],
    thyme_fresh: ["Fresh thyme", "herb", "fresh thyme, thyme sprigs"],
    rosemary_fresh: ["Fresh rosemary", "herb", "fresh rosemary, rosemary sprigs"],
    curry_leaves: ["Curry leaves", "herb", "curry leaf, kadi patta"],
    lemongrass: ["Lemongrass", "herb", "lemon grass, lemongrass stalk"],

    rice: ["Rice", "grain", "basmati, basmati rice, long grain rice, white rice, jasmine rice, cooked rice, egyptian rice"],
    pasta: ["Pasta", "grain", "spaghetti, penne, macaroni, fusilli, linguine, tagliatelle, farfalle, rigatoni, lasagne sheets, orzo"],
    vermicelli: ["Vermicelli", "grain", "vermicelli noodles, sheriya, seviyan"],
    wheat_grain: ["Harees wheat", "grain", "harees wheat, whole wheat grains, wheat berries, whole wheat"],
    noodles: ["Noodles", "grain", "egg noodles, rice noodles, instant noodles, ramen, udon, noodle, flat rice noodles, pad thai noodles, soba"],
    bread: ["Bread", "grain", "white bread, brown bread, toast, bread slices, sliced bread, burger buns, buns, baguette, croissants, croissant"],
    flatbread: ["Flatbread / pita", "grain", "pita, pitta, pita bread, khubz, arabic bread, naan, chapati, roti, paratha, lavash, regag, regag bread, chebab bread"],
    tortilla: ["Tortillas / wraps", "grain", "tortillas, wraps, flour tortillas, tortilla wraps, corn tortillas, taco shells"],
    bulgur: ["Bulgur", "grain", "burghul, bulgur wheat, cracked wheat"],
    couscous: ["Couscous", "grain", "cous cous"],
    oats: ["Oats", "grain", "rolled oats, porridge oats, oatmeal, quick oats"],
    breadcrumbs: ["Breadcrumbs", "grain", "panko, bread crumbs"],
    semolina: ["Semolina (smeed)", "grain", "smeed, semolina flour, sooji, suji, rava"],
    puff_pastry: ["Puff pastry", "grain", "puff pastry sheets, ready-rolled puff pastry"],

    split_peas: ["Yellow split peas", "pulse", "split peas, yellow split peas, lappeh, chana dal"],
    tofu: ["Tofu", "pulse", "firm tofu, silken tofu"],
    chickpeas: ["Chickpeas", "pulse", "chickpea, garbanzo beans, canned chickpeas, chana"],
    lentils: ["Lentils", "pulse", "red lentils, brown lentils, green lentils, masoor dal, dal, yellow lentils, lentil"],
    beans: ["Canned beans", "pulse", "kidney beans, red kidney beans, black beans, white beans, cannellini beans, butter beans, baked beans, fava beans, foul, ful medames, pinto beans"],
    canned_tomato: ["Canned tomatoes", "pulse", "chopped tomatoes, tinned tomatoes, canned tomatoes, crushed tomatoes, passata, tomato puree, plum tomatoes in juice"],
    tomato_paste: ["Tomato paste", "pulse", "tomato purée concentrate, tomato concentrate"],
    coconut_milk: ["Coconut milk", "pulse", "coconut cream"],
    stock: ["Stock cubes or stock", "pulse", "stock cube, stock cubes, chicken stock, beef stock, vegetable stock, broth, chicken broth, bouillon, maggi cube"],

    soy_sauce: ["Soy sauce", "jar", "light soy sauce, dark soy sauce, soya sauce"],
    oyster_sauce: ["Oyster sauce", "jar", ""],
    fish_sauce: ["Fish sauce", "jar", "nam pla"],
    sesame_oil: ["Sesame oil", "jar", "toasted sesame oil"],
    vinegar: ["Vinegar", "jar", "white vinegar, rice vinegar, apple cider vinegar, cider vinegar, malt vinegar, grape vinegar"],
    ketchup: ["Ketchup", "jar", "tomato ketchup, tomato sauce"],
    mayo: ["Mayonnaise", "jar", "mayo"],
    mustard: ["Mustard", "jar", "dijon mustard, yellow mustard, wholegrain mustard"],
    hot_sauce: ["Hot sauce", "jar", "chili sauce, sriracha, sweet chili sauce"],
    tahini: ["Tahini", "jar", "tahina, sesame paste"],
    peanut_butter: ["Peanut butter", "jar", ""],
    honey: ["Honey", "jar", ""],
    miso: ["Miso paste", "jar", "white miso, red miso"],
    worcestershire: ["Worcestershire sauce", "jar", "worcester sauce"],
    bbq_sauce: ["BBQ sauce", "jar", "barbecue sauce"],
    salsa: ["Salsa", "jar", "tomato salsa, jarred salsa"],
    kashk: ["Kashk", "jar", "kashk sauce, liquid kashk"],
    tamarind: ["Tamarind paste", "jar", "tamarind, tamarind concentrate"],
    seaweed: ["Seaweed (nori / wakame)", "jar", "nori, wakame, seaweed sheets, dried seaweed"],
    date_syrup: ["Date syrup (dibs)", "jar", "dibs, date molasses, date honey"],
    olives: ["Olives", "jar", "black olives, green olives, kalamata olives"],
    pomegranate_molasses: ["Pomegranate molasses", "jar", "dibs rumman"],

    flour: ["Flour", "bake", "plain flour, all-purpose flour, all purpose flour, self-raising flour, wheat flour, maida"],
    sugar: ["Sugar", "bake", "white sugar, brown sugar, caster sugar, granulated sugar, icing sugar, powdered sugar"],
    baking_powder: ["Baking powder", "bake", "baking soda, bicarbonate of soda"],
    cornflour: ["Cornflour", "bake", "cornstarch, corn starch, corn flour"],
    rose_water: ["Rose water", "bake", "rosewater"],
    vanilla: ["Vanilla flavouring", "bake", "vanilla essence, alcohol-free vanilla flavouring, vanilla flavoring"],
    yeast: ["Yeast", "bake", "dried yeast, instant yeast"],
    nuts: ["Nuts", "bake", "almonds, cashews, walnuts, pistachios, peanuts, pine nuts"],
    chocolate: ["Chocolate or cocoa", "bake", "cocoa, cocoa powder, dark chocolate, chocolate chips"],

    cumin: ["Cumin", "spice", "ground cumin, cumin seeds, jeera"],
    coriander_ground: ["Ground coriander", "spice", "coriander powder, coriander seeds, dhania powder"],
    paprika: ["Paprika", "spice", "smoked paprika, sweet paprika"],
    turmeric: ["Turmeric", "spice", "haldi, ground turmeric"],
    chili_flakes: ["Chili powder or flakes", "spice", "chili flakes, chilli flakes, red pepper flakes, chili powder, chilli powder, red chili powder, cayenne, cayenne pepper, kashmiri chili powder, crushed chillies"],
    garam_masala: ["Garam masala", "spice", ""],
    curry_powder: ["Curry powder", "spice", "curry paste, madras curry powder"],
    cinnamon: ["Cinnamon", "spice", "cinnamon stick, ground cinnamon"],
    cardamom: ["Cardamom", "spice", "cardamom pods, green cardamom, elaichi"],
    bay_leaf: ["Bay leaves", "spice", "bay leaf"],
    oregano: ["Oregano or mixed herbs", "spice", "dried oregano, mixed herbs, italian seasoning, thyme, dried thyme, rosemary, dried basil"],
    za_atar: ["Za'atar", "spice", "zaatar, zatar"],
    sumac: ["Sumac", "spice", ""],
    fenugreek: ["Dried fenugreek leaves", "spice", "dried fenugreek, fenugreek leaves, kasuri methi, methi leaves, fenugreek"],
    hibiscus: ["Hibiscus (karkade)", "spice", "karkade, dried hibiscus, hibiscus flowers, hibiscus petals"],
    chamomile: ["Chamomile", "spice", "chamomile tea, chamomile flowers, babounej"],
    sage: ["Sage (maramiya)", "spice", "maramiya, dried sage, fresh sage, sage leaves"],
    anise: ["Aniseed / fennel seeds", "spice", "aniseed, anise seeds, star anise, fennel seeds, yansoon"],
    baharat: ["Baharat / 7 spices", "spice", "seven spices, 7 spices, mixed spice, allspice, bzar, bezar, emirati spice mix"],
    sesame: ["Sesame seeds", "spice", "sesame seed"],
    saffron: ["Saffron", "spice", ""],
  };

  const CATALOG = {};
  for (const k in RAW) {
    const [label, group, syn] = RAW[k];
    const words = new Set([label.toLowerCase(), k.replace(/_/g, " ")]);
    syn.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).forEach((s) => words.add(s));
    label.toLowerCase().split(/\s*(?:\/| or )\s*/).forEach((s) => s && words.add(s.trim()));
    CATALOG[k] = { key: k, label, group, words: [...words] };
  }
  // one big list of [phrase, key] sorted longest first, so "coconut milk" beats "milk"
  const PHRASES = [];
  for (const k in CATALOG) CATALOG[k].words.forEach((w) => PHRASES.push([w, k]));
  PHRASES.sort((a, b) => b[0].length - a[0].length);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const PHRASE_RE = PHRASES.map(([w, k]) => [new RegExp("(^|[^a-z])" + esc(w) + "(s|es)?(?![a-z])", "i"), k, w]);

  // a more specific item also covers the general one (cherry tomatoes work where a recipe says tomatoes)
  const COUNTS_AS = { cherry_tomato: "tomato", red_cabbage: "cabbage", rocket: "lettuce" };
  // Every cuisine name (old built-in names and online-library areas) belongs to one kitchen.
  const KITCHEN_OF = {
    "Middle Eastern": "Gulf & Arabic", "Emirati / Gulf": "Gulf & Arabic", Egyptian: "Gulf & Arabic", Syrian: "Gulf & Arabic", "Saudi Arabian": "Gulf & Arabic", Lebanese: "Gulf & Arabic", Emirati: "Gulf & Arabic",
    "Indian / Pakistani": "Indian & Pakistani", Indian: "Indian & Pakistani", Pakistani: "Indian & Pakistani",
    Moroccan: "Mediterranean", Tunisian: "Mediterranean", Turkish: "Mediterranean", Greek: "Mediterranean", Italian: "Mediterranean", Spanish: "Mediterranean", Portuguese: "Mediterranean", Croatian: "Mediterranean",
    Chinese: "Asian", Japanese: "Asian", Thai: "Asian", Vietnamese: "Asian", Malaysian: "Asian", Filipino: "Asian", Korean: "Asian", Indonesian: "Asian",
    American: "Western", British: "Western", Canadian: "Western", French: "Western", Irish: "Western", Dutch: "Western", Polish: "Western", Russian: "Western", Ukrainian: "Western", Norwegian: "Western", Australian: "Western", European: "Western",
    Mexican: "Mexican", Jamaican: "Mexican", Iranian: "Persian",
  };
  const kitchenOf = (cuisine) => KITCHEN_OF[cuisine] || cuisine || "";
  const BASICS_DEFAULT = ["salt", "pepper", "oil", "water", "ice"];
  const EQUIPMENT = { stove: "Stove", oven: "Oven", airfryer: "Air fryer", pressurecooker: "Pressure cooker", blender: "Blender", microwave: "Microwave" };
  const EQUIP_DEFAULT = ["stove", "oven", "airfryer", "pressurecooker", "blender"];

  // ---------- Quantity parsing and scaling ----------
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
  const MEASURED = /^(cups?|c|tsps?|teaspoons?|tbsps?|tablespoons?|tbs|tblsps?|oz|ounces?|lbs?|pounds?|pinch(es)?|handfuls?|dash(es)?|drops?)$/;
  function fmt(n, unit) {
    if (!isFinite(n) || n <= 0) return "";
    const u = (unit || "").toLowerCase();
    if (/^(g|grams?|ml|millilit(re|er)s?)$/.test(u)) {
      const step = n >= 500 ? 50 : n >= 100 ? 10 : 5;
      return String(Math.max(step, Math.round(n / step) * step));
    }
    if (/^(kg|l|lit(re|er)s?)$/.test(u)) return String(Math.round(n * 10) / 10);
    // things you count (onions, cloves, eggs, pods, cans): no "4¾ onions"
    if (!MEASURED.test(u)) n = n < 1 ? Math.max(0.25, Math.round(n * 4) / 4) : n < 3 ? Math.round(n * 2) / 2 : Math.round(n);
    const whole = Math.floor(n + 1e-9);
    const frac = n - whole;
    const opts = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, ""]];
    let best = opts[0];
    for (const o of opts) if (Math.abs(frac - o[0]) < Math.abs(frac - best[0])) best = o;
    const w = best[0] === 1 ? whole + 1 : whole;
    if (w === 0 && !best[1]) return n < 0.2 ? "a pinch of" : "¼";
    return (w ? String(w) : "") + best[1];
  }
  const NOUNS = { onion: "onions", carrot: "carrots", potato: "potatoes", tomato: "tomatoes", egg: "eggs", lemon: "lemons", lime: "limes", cucumber: "cucumbers", banana: "bananas", apple: "apples", flatbread: "flatbreads", tortilla: "tortillas", fillet: "fillets", chili: "chilies", pepper: "peppers", bun: "buns", date: "dates", thigh: "thighs", breast: "breasts", flatbreads: "flatbreads" };
  // Scale the leading amount of each " or " part of an ingredient line.
  function scaleLine(line, factor) {
    if (!factor || Math.abs(factor - 1) < 1e-6) return line;
    return line.split(/(\s+or\s+)/i).map((part) => {
      const m = part.match(QTY_RE);
      if (!m) return part;
      const rest = part.slice(m[0].length);
      const unit = (rest.match(/^\s*([a-zA-Z]+)/) || [])[1];
      const a = fmt(num(m[1]) * factor, unit);
      const b = m[2] ? fmt(num(m[2]) * factor, unit) : "";
      const top = num(b || a) || 0; // the rounded amount decides "onion" vs "onions"
      let fixed = rest.replace(/^(\s*)(cup|can|tin|clove|slice|piece|stick|bunch)(e?s)?\b/i, (all, sp, u) => sp + u + (top > 1.01 ? (/h$/i.test(u) ? "es" : "s") : ""));
      // count nouns: "1 onion" x2 -> "2 onions", "2 onions" x0.5 -> "1 onion"
      fixed = fixed.replace(/^(\s+(?:(?:small|medium|large|big|ripe|red|green|white|whole|very ripe)\s+)?)([a-z]+)\b/i, (all, pre, w) => {
        const low = w.toLowerCase();
        for (const sing in NOUNS) {
          if (low === sing && top > 1.01) return pre + NOUNS[sing];
          if (low === NOUNS[sing] && top <= 1.01) return pre + sing;
        }
        return all;
      });
      return part.slice(0, part.indexOf(m[0])) + (b && b !== a ? a + "–" + b : a) + fixed;
    }).join("");
  }

  // ---------- Matching an ingredient line to catalog keys ----------
  const UNIT_WORDS = "g|gr|grams?|kg|kilos?|ml|l|litres?|liters?|cups?|c|tbsps?|tablespoons?|tbs|tblsps?|tbls|tblspns?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|cans?|tins?|jars?|packets?|packs?|pkts?|bunch(?:es)?|handfuls?|pinch(?:es)?|dash(?:es)?|sprigs?|slices?|pieces?|pcs|sticks?|heads?|stalks?|knobs?|drops?|cloves?|fillets?|large|medium|small|big|whole|heaped|level|generous|scant";
  const UNIT_RE = new RegExp("^\\s*(?:(?:" + UNIT_WORDS + ")\\.?\\s+)+(?:of\\s+)?", "i");
  function cleanName(text) {
    let t = String(text).replace(/\([^)]*\)/g, " ");
    t = t.replace(QTY_RE, "").replace(/^\s*(a|an|some|few|a few)\s+/i, "");
    for (let i = 0; i < 3; i++) t = t.replace(UNIT_RE, "");
    t = t.split(/,|;| - | – /)[0];
    t = t.replace(/\b(fresh|freshly|chopped|finely|roughly|thinly|sliced|diced|minced|grated|crushed|peeled|ground|to taste|for serving|to serve|optional|about|approx\.?|approximately|plus extra|extra)\b/gi, " ");
    return t.replace(/\s+/g, " ").trim();
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  function matchOne(text) {
    const t = " " + String(text).toLowerCase().replace(/\([^)]*\)/g, " ") + " ";
    for (const [re, k] of PHRASE_RE) if (re.test(t)) return k;
    return null;
  }
  // Returns {keys:[...], custom:{key,label}|null}
  function matchLine(line) {
    // brackets are notes ("(beef bacon or block beef bacon)"), so ignore them before splitting on "or"
    const parts = String(line).replace(/\([^)]*\)/g, " ").split(/\s+or\s+/i);
    const keys = [];
    for (const p of parts) {
      const k = matchOne(p);
      if (k && !keys.includes(k)) keys.push(k);
    }
    if (keys.length) return { keys, custom: null };
    const name = cleanName(parts[0]) || String(line).trim();
    const key = "x_" + slug(name.replace(/s$/, ""));
    return { keys: [key], custom: { key, label: name.charAt(0).toUpperCase() + name.slice(1) } };
  }

  // ---------- Halal-friendly swaps with UAE-available items ----------
  // [regex, replacement, ingredientOnly]
  const SWAPS = [
    [/\bpork belly\b/gi, "beef brisket"],
    [/\bpork (chops?)\b/gi, "lamb $1"],
    [/\bpork (loin|tenderloin|fillet)\b/gi, "beef tenderloin"],
    [/\bpork shoulder\b/gi, "lamb shoulder"],
    [/\bpork ribs\b/gi, "beef ribs"],
    [/\b(ground|minced) pork\b/gi, "minced beef"],
    [/\bpork mince\b/gi, "beef mince"],
    [/\bpork sausages?\b/gi, "beef sausages"],
    [/\bpork\b/gi, "@PORK"],
    [/\b(streaky |smoked |back )?bacon\b/gi, "beef bacon"],
    [/\b(pancetta|guanciale|speck|lardo)\b/gi, "beef bacon"],
    [/\b(mortadella|capicola|capocollo|coppa|soppressata)\b/gi, "beef pastrami"],
    [/\b(bratwurst|kielbasa|andouille|frankfurters?|cumberland sausages?|chipolatas?|n'?duja|black pudding|blood sausage)\b/gi, "beef sausages"],
    [/\bchar siu\b/gi, "honey-glazed beef"],
    [/\b(pork rinds?|crackling|chicharr[oó]n(es)?)\b/gi, "crispy fried onions"],
    [/\b(prosciutto|parma ham|serrano ham|jamón|jamon)\b/gi, "beef pastrami"],
    [/\bham hocks?\b/gi, "smoked beef"],
    [/\bhams?\b/gi, "turkey ham"],
    [/\bchorizo\b/gi, "beef sausage with smoked paprika"],
    [/\b(pepperoni|salami)\b/gi, "beef pepperoni"],
    [/\blardons?\b/gi, "beef bacon"],
    [/\blard\b/gi, "ghee"],
    [/\bgelatine?\b/gi, "beef gelatin"],
    [/\b(shaoxing|chinese cooking|rice) wine\b(?!\s*vinegar)/gi, "rice vinegar with a little sugar", false, "rice vinegar"],
    [/\bmirin\b/gi, "rice vinegar with a little sugar", false, "rice vinegar"],
    [/\bsake\b/gi, "rice vinegar", true],
    [/\b(dry |sweet )?red wine\b(?!\s*vinegar)/gi, "red grape juice with a splash of vinegar", false, "grape juice"],
    [/\b(dry |sweet )?white wine\b(?!\s*vinegar)/gi, "white grape juice with a splash of vinegar", false, "grape juice"],
    [/\b(marsala|madeira) wine\b|\b(marsala|madeira)\b/gi, "grape juice"],
    [/\b(dry |cooking )?sherry\b(?!\s*vinegar)/gi, "apple juice"],
    [/\b(cooking )?wine\b(?!\s*vinegar)/gi, "grape juice with a splash of vinegar", false, "grape juice"],
    [/\b(champagne|prosecco|sparkling wine)\b(?!\s*vinegar)/gi, "sparkling grape juice"],
    [/\b(beer|lager|ale|stout|guinness)\b/gi, "non-alcoholic malt drink", true],
    [/\bbeer\b/gi, "malt drink"],
    [/\b(hard )?cider\b(?!\s*vinegar)/gi, "apple juice"],
    [/\bvanilla extract\b/gi, "alcohol-free vanilla flavouring"],
    [/\b(dark |white |spiced )?rum\b/gi, "apple juice"],
    [/\b(brandy|cognac|bourbon|whiske?y|scotch)\b/gi, "apple juice"],
    [/\b(coffee liqueur|kahlua|kahlúa)\b/gi, "strong coffee"],
    [/\b(grand marnier|cointreau|triple sec|orange liqueur)\b/gi, "orange juice"],
    [/\b(amaretto|liqueur)\b/gi, "orange juice"],
    [/\bvodka\b/gi, "a squeeze of lemon juice", false, "lemon juice"],
    [/\btequila\b/gi, "lime juice"],
    [/\b(port wine|ruby port)\b/gi, "grape juice"],
  ];
  function swapText(text, isIngredient, porkTo) {
    let out = String(text);
    let changed = false;
    for (const [re, rep, ingOnly, stepRep] of SWAPS) {
      if (ingOnly && !isIngredient) continue;
      re.lastIndex = 0;
      if (re.test(out)) { re.lastIndex = 0; out = out.replace(re, (rep === "@PORK" ? porkTo || "beef" : !isIngredient && stepRep ? stepRep : rep)); changed = true; }
    }
    // tidy doubled words like "beef beef"
    if (changed) out = out.replace(/\b(\w+) \1\b/gi, "$1");
    return out;
  }
  function swapRecipe(r) {
    // one replacement meat per recipe, so ingredients and steps agree
    const all = (r.need || []).concat(r.extra || []).join(" ");
    const porkTo = /\bpork (chops?|shoulder)\b/i.test(all) ? "lamb" : "beef";
    r.need = (r.need || []).map((l) => swapText(l, true, porkTo));
    r.extra = (r.extra || []).map((l) => swapText(l, true, porkTo));
    r.steps = (r.steps || []).map((s) => swapText(s, false, porkTo));
    r.name = swapText(r.name, true, porkTo).replace(/^./, (ch) => ch.toUpperCase());
    if (r.cuisine) r.cuisine = swapText(r.cuisine, false);
    if (r.tip) r.tip = swapText(r.tip, false);
    return r;
  }

  // ---------- Inference helpers for imported recipes ----------
  const MEAT = new Set(["turkey", "chicken", "beef", "beef_mince", "lamb", "sausage", "beef_bacon", "turkey_ham", "fish", "tuna", "shrimp"]);
  const ANIMAL = new Set(["evaporated_milk", "egg", "milk", "butter", "ghee", "cheese", "parmesan", "feta", "labneh", "cream_cheese", "yogurt", "cream", "honey"]);
  function inferDiet(lines) {
    let d = "vegan";
    for (const l of lines) {
      const low = l.toLowerCase();
      const ks = matchLine(l).keys;
      if (ks.some((k) => MEAT.has(k)) || /\b(oyster sauce|fish sauce|anchov\w*|gelatin|meat)\b/.test(low)) return "meat";
      if (ks.some((k) => ANIMAL.has(k))) d = "veg";
    }
    return d;
  }
  function inferEquipment(steps) {
    const t = steps.join(" ").toLowerCase();
    const eq = [];
    if (/\b(oven|bake|baked|baking|roast|roasted|grill|broil)\b/.test(t)) eq.push("oven|airfryer");
    if (/\b(blend|blender|food processor|puree|purée|whizz|blitz)\b/.test(t)) eq.push("blender");
    if (/\b(pan|pot|saucepan|wok|skillet|boil|simmer|fry|heat|stove|hob)\b/.test(t) || !eq.length) eq.unshift("stove");
    return eq;
  }
  function splitSteps(text) {
    let t = String(text || "").replace(/\r/g, "");
    t = t.replace(/^\s*(step\s*\d+[:.)]?|\d+[.)])\s*/gim, "\n");
    let parts = t.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 2);
    if (parts.length <= 1 && t.length > 260) {
      // one long paragraph: group sentences into steps of about two sentences
      const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
      parts = [];
      for (let i = 0; i < sentences.length; i += 2) parts.push(sentences.slice(i, i + 2).join(" ").trim());
    }
    return parts.filter((s) => !/^step\s*\d*$/i.test(s));
  }
  function isoMinutes(iso) {
    const m = String(iso || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!m) return null;
    const n = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
    return n || null;
  }
  function yieldServes(y) {
    if (Array.isArray(y)) y = y[0];
    const m = String(y || "").match(/\d+/);
    return m ? Math.min(20, Math.max(1, +m[0])) : 4;
  }
  // Tidy website clutter: "(Note 1)", "*", "((double brackets))", a bracket left open at the end, stray commas.
  function cleanLine(l) {
    let t = String(l).replace(/\*/g, "").replace(/\(\s*\(/g, "(").replace(/\)\s*\)/g, ")");
    t = t.replace(/\(\s*(see\s+)?(the\s+)?(recipe\s+)?notes?(\s*#?\d+)?\s*\)/gi, "").replace(/\b(see\s+)?(recipe\s+)?notes?\s*#?\d+\b/gi, "").replace(/\bsee notes?\b\.?/gi, "");
    for (let i = 0; i < 3; i++) { const o = t.lastIndexOf("("), c = t.lastIndexOf(")"); if (o > c) t = t.slice(0, o); else break; }
    let depth = 0, out = "";
    for (const ch of t) { if (ch === "(") depth++; if (ch === ")") { if (!depth) continue; depth--; } out += ch; }
    return out.replace(/\(\s*\)/g, "").replace(/\(\s+/g, "(").replace(/\s+([,.;)])/g, "$1").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").replace(/[\s,;:(]+$/, "").trim();
  }
  // Rough total time from the minutes written in the steps, plus 10 minutes to get ready.
  function estimateMinutes(steps) {
    let total = 0, found = false;
    for (const s of steps || []) { const m = stepMinutes(s); if (m) { total += m; found = true; } }
    return found ? Math.max(5, Math.round((total + 10) / 5) * 5) : null;
  }
  function finish(r) {
    r.need = r.need.filter(Boolean).map(cleanLine).filter(Boolean);
    r.extra = (r.extra || []).map(cleanLine).filter(Boolean);
    r.steps = (r.steps || []).map((s) => String(s).replace(/\s{2,}/g, " ").trim()).filter(Boolean);
    if (!r.minutes) r.minutesEst = estimateMinutes(r.steps);
    swapRecipe(r); // swap first, so "guanciale" -> "beef bacon" counts as meat
    r.diet = r.diet || inferDiet(r.need.concat(r.extra));
    r.equipment = r.equipment && r.equipment.length ? r.equipment : inferEquipment(r.steps);
    return r;
  }

  // TheMealDB meal -> recipe
  function fromMealDB(m) {
    const need = [];
    for (let i = 1; i <= 20; i++) {
      const ing = (m["strIngredient" + i] || "").trim();
      if (!ing) continue;
      const meas = (m["strMeasure" + i] || "").trim();
      need.push((meas ? meas + " " : "") + ing.toLowerCase());
    }
    return finish({
      id: "mdb_" + m.idMeal,
      name: m.strMeal,
      cuisine: m.strArea && m.strArea !== "Unknown" ? m.strArea : "",
      minutes: null,
      serves: 4,
      need,
      extra: [],
      steps: splitSteps(m.strInstructions),
      tip: "",
      source: "online",
      url: m.strSource || "",
      imageUrl: m.strMealThumb || "",
    });
  }

  // schema.org Recipe object -> recipe
  function textOf(x) { return typeof x === "string" ? x : (x && (x.text || x.name)) || ""; }
  function flattenInstructions(ins) {
    if (!ins) return [];
    if (typeof ins === "string") return splitSteps(ins.replace(/<[^>]+>/g, "\n"));
    const out = [];
    (Array.isArray(ins) ? ins : [ins]).forEach((s) => {
      if (s && (s["@type"] === "HowToSection" || s.itemListElement)) out.push(...flattenInstructions(s.itemListElement));
      else { const t = textOf(s).replace(/<[^>]+>/g, " ").trim(); if (t) out.push(t); }
    });
    return out;
  }
  function decode(s) {
    return String(s || "").replace(/&amp;/g, "&").replace(/&#39;|&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  }
  function fromSchema(o, url) {
    const img = Array.isArray(o.image) ? o.image[0] : o.image;
    const name = decode(o.name || "Imported recipe");
    return finish({
      id: "web_" + slug(name) + "_" + Date.now().toString(36),
      name,
      cuisine: decode(Array.isArray(o.recipeCuisine) ? o.recipeCuisine[0] : o.recipeCuisine || ""),
      minutes: isoMinutes(o.totalTime) || ((isoMinutes(o.prepTime) || 0) + (isoMinutes(o.cookTime) || 0)) || null,
      serves: yieldServes(o.recipeYield),
      need: (o.recipeIngredient || o.ingredients || []).map((l) => decode(l).replace(/\(\s*\(/g, "(").replace(/\)\s*\)/g, ")").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()),
      extra: [],
      steps: flattenInstructions(o.recipeInstructions).map(decode),
      tip: "",
      source: "web",
      url: url || o.url || "",
      imageUrl: textOf(img) || (img && img.url) || "",
    });
  }

  // Pasted free text -> recipe draft
  function fromPaste(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/^[\s•●▪◦*·\-–]+/, "").trim());
    let name = "", serves = 4;
    const need = [], steps = [];
    let mode = "auto";
    for (const raw of lines) {
      if (!raw) continue;
      const low = raw.toLowerCase().replace(/[:\s]+$/, "");
      if (/^(ingredients?|you will need|what you need)$/.test(low)) { mode = "ing"; continue; }
      if (/^(method|directions?|instructions?|steps?|preparation|how to make( it)?|to make)$/.test(low)) { mode = "steps"; continue; }
      if (/^(serves|servings|yield|makes)\b/.test(low) && raw.length < 40) { const sm = low.match(/\d+/); if (sm) serves = Math.min(20, +sm[0]); continue; }
      if (/^(prep|cook|total|notes?)\b/.test(low) && raw.length < 40) continue;
      if (!name && mode === "auto" && !QTY_RE.test(raw) && raw.length < 70) { name = raw; continue; }
      if (mode === "ing") { need.push(raw); continue; }
      if (mode === "steps") { steps.push(...splitSteps(raw)); continue; }
      // no headings: short lines starting with an amount are ingredients
      if (QTY_RE.test(raw) && raw.length < 90) need.push(raw); else steps.push(...splitSteps(raw));
    }
    return finish({
      id: "mine_" + Date.now().toString(36),
      name: name || "My recipe",
      cuisine: "",
      minutes: null,
      serves,
      need,
      extra: [],
      steps: steps.map((s) => s.replace(/^\d+[.)]\s*/, "")),
      tip: "",
      source: "mine",
    });
  }

  // Find timer minutes in a step, e.g. "simmer 10–15 minutes" -> 10
  function stepMinutes(step) {
    const m = String(step).match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(minutes?|mins?|hours?|hrs?)\b/i);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (/^h/i.test(m[3])) n *= 60;
    return n > 0 && n <= 600 ? n : null;
  }

  const api = { KITCHEN_OF, kitchenOf, cleanLine, estimateMinutes, COUNTS_AS, GROUPS, CATALOG, BASICS_DEFAULT, EQUIPMENT, EQUIP_DEFAULT, matchLine, matchOne, cleanName, scaleLine, swapText, swapRecipe, fromMealDB, fromSchema, fromPaste, splitSteps, stepMinutes, inferDiet, inferEquipment, slug, finish };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MK = api;
})(typeof window !== "undefined" ? window : globalThis);
