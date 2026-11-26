/* SLINGSHOT — main.js (vanilla, no build). One requestAnimationFrame loop drives every scroll effect. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var vh = innerHeight, vw = innerWidth;
  var isMobile = vw < 768;

  /* ---------------- frame loop ---------------- */
  var updaters = [], measurers = [];
  var scrollY = window.pageYOffset, lastY = scrollY, now = performance.now();
  function onFrame(fn) { updaters.push(fn); }
  function onMeasure(fn) { measurers.push(fn); }
  function docTop(el) { var r = el.getBoundingClientRect(); return r.top + window.pageYOffset; }
  function measure() {
    vh = innerHeight; vw = innerWidth; isMobile = vw < 768;
    for (var i = 0; i < measurers.length; i++) measurers[i]();
  }

  /* ---------------- smooth wheel (mouse only) ---------------- */
  var smooth = { on: false, target: scrollY, cur: scrollY, set: scrollY, active: false };
  function maxScroll() { return Math.max(0, root.scrollHeight - innerHeight); }
  if (finePointer && !reduced) {
    smooth.on = true;
    root.classList.add("has-smooth");
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.defaultPrevented) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (body.classList.contains("is-locked")) return;
      var t = e.target;
      if (t && t.closest && t.closest("[data-native-scroll]")) return;
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= innerHeight;
      e.preventDefault();
      if (!smooth.active) { smooth.cur = smooth.set = window.pageYOffset; smooth.target = smooth.cur; }
      smooth.target = clamp(smooth.target + d, 0, maxScroll());
      smooth.active = true;
    }, { passive: false });
    var cancel = function () { smooth.active = false; smooth.target = smooth.cur = smooth.set = window.pageYOffset; };
    window.addEventListener("keydown", cancel);
    window.addEventListener("pointerdown", cancel);
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("popstate", cancel);
    window.addEventListener("hashchange", cancel);
    window.addEventListener("scroll", function () {
      // someone else moved the page (scrollTo, scrollbar, keys, anchor): stop and follow
      if (smooth.active && Math.abs(window.pageYOffset - smooth.set) > 3) cancel();
    }, { passive: true });
  }
  function smoothStep(dt) {
    if (!smooth.active) return;
    var k = 1 - Math.pow(1 - 0.14, dt / 16.667);
    smooth.cur += (smooth.target - smooth.cur) * k;
    if (Math.abs(smooth.target - smooth.cur) < 0.5) { smooth.cur = smooth.target; smooth.active = false; }
    var y = Math.round(smooth.cur * 100) / 100;
    smooth.set = Math.round(y);
    window.scrollTo(0, y);
  }

  function loop(t) {
    var dt = Math.min(64, t - now); now = t;
    smoothStep(dt);
    scrollY = window.pageYOffset;
    for (var i = 0; i < updaters.length; i++) updaters[i](scrollY, dt, t);
    lastY = scrollY;
    requestAnimationFrame(loop);
  }

  /* ---------------- page transitions ---------------- */
  function ready() { requestAnimationFrame(function () { body.classList.add("is-ready"); }); }
  window.addEventListener("pageshow", function (e) { body.classList.remove("is-leaving"); if (e.persisted) body.classList.add("is-ready"); });
  doc.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (a.hasAttribute("data-soon")) { e.preventDefault(); return; }
    var href = a.getAttribute("href");
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    if (!href || href.charAt(0) === "#" || /^(mailto:|tel:|https?:)/i.test(href)) return;
    if (a.hasAttribute("data-back") && doc.referrer && history.length > 1 && doc.referrer.indexOf(location.protocol) === 0 && doc.referrer !== location.href) {
      e.preventDefault(); leave(function () { history.back(); }); return;
    }
    e.preventDefault();
    leave(function () { location.href = a.href; });
  });
  function leave(go) {
    if (reduced) return go();
    body.classList.add("is-leaving");
    setTimeout(go, 420);
  }

  /* ---------------- header ---------------- */
  var nav = $("[data-nav]");
  if (nav) {
    var darks = [];
    onMeasure(function () {
      darks = $$("[data-theme=dark], .hero, .fb, .loc, .foot").map(function (el) {
        return { el: el, top: docTop(el), h: el.offsetHeight, fb: el.classList.contains("fb") };
      });
    });
    var hidden = false, dark = null, acc = 0;
    onFrame(function (y) {
      var d = y - lastY;
      if (d !== 0) {
        acc = (acc > 0) === (d > 0) ? acc + d : d;
        var h = y > 160 && acc > 12 ? true : acc < -8 ? false : hidden;
        if (y < 80) h = false;
        if (h !== hidden) { hidden = h; nav.classList.toggle("is-hidden", h); }
      }
      var probe = 40, on = false;
      for (var i = 0; i < darks.length; i++) {
        var s = darks[i], top = s.top, bottom = s.top + s.h;
        if (s.fb) { var r = s.el.getBoundingClientRect(); top = r.top + y; bottom = r.bottom + y; }
        if (y + probe >= top && y + probe < bottom) { on = true; break; }
      }
      if (on !== dark) { dark = on; nav.classList.toggle("on-dark", on); }
    });
  }

  /* ---------------- reveal ---------------- */
  var revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add("is-in"); });

  /* helper: run a callback on an interval only while an element is on screen */
  function whileVisible(el, ms, fn) {
    var vis = false, id = null;
    var io2 = new IntersectionObserver(function (es) {
      vis = es[0].isIntersecting;
      if (vis && !id) id = setInterval(fn, ms);
      if (!vis && id) { clearInterval(id); id = null; }
    });
    io2.observe(el);
  }

  /* ---------------- hero cuts + loader ---------------- */
  var hero = $("[data-hero]");
  if (hero) {
    var cuts = $$("[data-cuts] img", hero), ci = 0;
    var cut = function () { cuts[ci].classList.remove("is-on"); ci = (ci + 1) % cuts.length; cuts[ci].classList.add("is-on"); };
    if (!reduced && cuts.length > 1) whileVisible(hero, 2300, cut);
  }
  var loader = $("[data-loader]");
  function heroIn() { if (hero) hero.classList.add("is-in"); body.classList.add("intro-done"); }
  if (loader) {
    var seen = false;
    try { seen = sessionStorage.getItem("ss-intro") === "1"; } catch (e) {}
    if (seen || reduced) { loader.classList.add("is-gone"); heroIn(); }
    else {
      try { sessionStorage.setItem("ss-intro", "1"); } catch (e) {}
      body.classList.add("is-locked"); body.style.overflow = "hidden";
      var box = $("[data-loader-box]"), imgs = $$("img", box), li = 1;
      box.style.cssText = "width:100vw;height:100vh;clip-path:inset(50% 50% 50% 50%);transition:clip-path 1.6s cubic-bezier(.65,0,.25,1)";
      var at = function (ms, fn) { setTimeout(fn, ms); };
      at(350, function () { loader.classList.add("s1"); });
      at(1350, function () {
        loader.classList.add("s2");
        imgs[li].classList.add("is-on");
        box.style.clipPath = isMobile ? "inset(38% 22% 38% 22%)" : "inset(35% 41.5% 35% 41.5%)";
      });
      var cyc = setInterval(function () {
        imgs.forEach(function (im) { im.classList.remove("is-on"); });
        li = (li + 1) % imgs.length; imgs[li].classList.add("is-on");
      }, 300);
      at(1350, function () {});
      at(3400, function () {
        clearInterval(cyc);
        imgs.forEach(function (im) { im.classList.remove("is-on"); }); imgs[0].classList.add("is-on");
        loader.classList.add("s3");
        box.style.transition = "clip-path 1s cubic-bezier(.65,0,.25,1)";
        box.style.clipPath = "inset(0% 0% 0% 0%)";
      });
      at(4350, function () { loader.classList.add("s4"); heroIn(); body.classList.remove("is-locked"); body.style.overflow = ""; });
      at(5000, function () { loader.classList.add("is-gone"); });
    }
  }

  /* ---------------- intro image cycle ---------------- */
  $$("[data-cycle]").forEach(function (el) {
    var ims = $$("img", el), k = 0;
    if (ims.length > 1 && !reduced) whileVisible(el, 1100, function () { ims[k].classList.remove("is-on"); k = (k + 1) % ims.length; ims[k].classList.add("is-on"); });
  });

  /* ---------------- glyph sequence ---------------- */
  var glyph = $("[data-glyph]");
  if (glyph) {
    var gsvg = $(".glyph__svg", glyph), gfull = $(".glyph__full", glyph), gt = 0, gh = 0, gLast = -1;
    onMeasure(function () { gt = docTop(glyph); gh = glyph.offsetHeight; gLast = -1; });
    var ease = function (x) { return x * x * x; };
    onFrame(function (y) {
      if (y + vh < gt || y > gt + gh) return;
      var p = clamp((y - gt + vh * 0.35) / (gh - vh * 1.95), 0, 1);
      if (Math.abs(p - gLast) < 0.0005) return; gLast = p;
      var draw = clamp(p / 0.32, 0, 1), fill = clamp((p - 0.28) / 0.14, 0, 1), grow = clamp((p - 0.42) / 0.46, 0, 1);
      var s = 0.55 + ease(grow) * 24;
      gsvg.style.transform = "translate(-50%,-50%) scale(" + s.toFixed(4) + ")";
      gsvg.style.setProperty("--gd", (6200 * (1 - draw)).toFixed(1));
      gsvg.style.setProperty("--gi", fill.toFixed(3));
      gsvg.style.setProperty("--go", (1 - fill).toFixed(3));
      if (gfull) gfull.style.opacity = clamp((p - 0.8) / 0.12, 0, 1).toFixed(3);
    });
  }

  /* ---------------- featured slider ---------------- */
  var fb = $("[data-fb]");
  if (fb) {
    var slides = $$(".fb__slide", fb), dots = $$(".fb__dots button", fb), fi = 0;
    var nameEl = $("[data-fb-name]", fb), idxEl = $("[data-fb-i]", fb), linkEl = $("[data-fb-link]", fb);
    var data = [];
    try { data = JSON.parse(fb.getAttribute("data-items") || "[]"); } catch (e) {}
    var go = function (n) {
      slides[fi].classList.remove("is-on"); dots[fi].classList.remove("is-on");
      fi = (n + slides.length) % slides.length;
      slides[fi].classList.add("is-on"); dots[fi].classList.add("is-on");
      idxEl.textContent = fi + 1;
      if (data[fi]) { nameEl.textContent = data[fi].p; linkEl.setAttribute("href", data[fi].h); }
    };
    dots.forEach(function (d, k) { d.addEventListener("click", function () { go(k); reset(); }); });
    var timer = null, fbVis = false;
    var reset = function () { clearInterval(timer); timer = null; if (fbVis && !reduced) timer = setInterval(function () { go(fi + 1); }, 5000); };
    new IntersectionObserver(function (es) { fbVis = es[0].isIntersecting; reset(); }).observe(fb);
  }

  /* ---------------- home work list ---------------- */
  var wl = $("[data-wl]");
  if (wl) {
    var items = $$(".wl__item", wl), frames = $$(".wl__frame img", wl), centers = [], cur = 0;
    onMeasure(function () { centers = items.map(function (it) { return docTop(it) + it.offsetHeight / 2; }); });
    var setOn = function (k) {
      if (k === cur) return;
      items[cur].classList.remove("is-on"); if (frames[cur]) frames[cur].classList.remove("is-on");
      cur = k; items[cur].classList.add("is-on"); if (frames[cur]) frames[cur].classList.add("is-on");
    };
    items[0].classList.add("is-on");
    onFrame(function (y) {
      if (!centers.length || isMobile) return;
      var mid = y + vh / 2, best = 0, bd = 1e9;
      for (var i = 0; i < centers.length; i++) { var d = Math.abs(centers[i] - mid); if (d < bd) { bd = d; best = i; } }
      setOn(best);
    });
    items.forEach(function (it, k) { it.addEventListener("mouseenter", function () { if (!isMobile) setOn(k); }); });
    $$("[data-view]", wl).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-view]", wl).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        wl.classList.toggle("is-grid", b.getAttribute("data-view") === "grid");
        measure();
      });
    });
  }

  /* ---------------- drag sliders ---------------- */
  $$("[data-slider]").forEach(function (sl) {
    var track = $(".slider__track", sl), x = 0, tx = 0, min = 0, down = false, sx = 0, sy = 0, startX = 0, moved = false, vel = 0, lastPX = 0, lastT = 0, axis = null;
    var vis = true;
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(sl);
    var bounds = function () { min = Math.min(0, sl.clientWidth - track.scrollWidth); tx = clamp(tx, min, 0); };
    onMeasure(bounds);
    sl.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      down = true; moved = false; axis = null; sx = e.clientX; sy = e.clientY; startX = tx; lastPX = e.clientX; lastT = performance.now(); vel = 0;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!axis) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"; }
      if (axis !== "x") { down = false; return; }
      moved = true; sl.classList.add("is-drag");
      var t = performance.now(); vel = (e.clientX - lastPX) / Math.max(1, t - lastT); lastPX = e.clientX; lastT = t;
      var n = startX + dx;
      if (n > 0) n *= 0.35; if (n < min) n = min + (n - min) * 0.35;
      tx = n; x = n;
    });
    var up = function () {
      if (!down && !moved) return;
      down = false; sl.classList.remove("is-drag");
      if (moved) tx = clamp(tx + vel * 320, min, 0);
      setTimeout(function () { moved = false; }, 0);
    };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    sl.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    sl.addEventListener("dragstart", function (e) { e.preventDefault(); });
    sl.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); tx = clamp(tx - e.deltaX, min, 0); }
    }, { passive: false });
    var step = function (dir) { var it = $(".slider__item", track); var w = it ? it.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0) : 300; tx = clamp(tx - dir * w, min, 0); };
    var wrap = sl.parentElement;
    var pv = $("[data-prev]", wrap), nx = $("[data-next]", wrap);
    if (pv) pv.addEventListener("click", function () { step(-1); });
    if (nx) nx.addEventListener("click", function () { step(1); });
    var pager = sl.hasAttribute("data-pages") ? $("[data-pager]", wrap) : null, page = 0;
    if (pager) $$("button", pager).forEach(function (b, k) { b.addEventListener("click", function () { tx = k ? min : 0; }); });
    var lastX = null;
    onFrame(function () {
      if (!vis) return;
      if (!down) x += (tx - x) * 0.14;
      if (Math.abs(tx - x) < 0.05) x = tx;
      if (x !== lastX) { track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)"; lastX = x; }
      if (pager) {
        var pg = min && x < min / 2 ? 1 : 0;
        if (pg !== page) { page = pg; $$("button", pager).forEach(function (b, k) { b.classList.toggle("is-on", k === pg); }); $("b", pager).textContent = pg + 1; }
      }
    });
  });

  /* ---------------- marquees (headline text) ---------------- */
  $$("[data-mq]").forEach(function (mq) {
    var tr = mq.firstElementChild, off = 0, w = 0, vis = false, last = null;
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(mq);
    onMeasure(function () { var a = tr.children[0], b = tr.children[1]; w = b ? b.offsetLeft - a.offsetLeft : tr.scrollWidth / 2; w *= tr.children.length > 2 ? 1 : 1; });
    onFrame(function (y, dt) {
      if (!vis || !w || reduced) return;
      off -= dt * 0.06 + Math.abs(y - lastY) * 0.25;
      var span = w * 2 / 2; // one repeat (two children make one sentence)
      if (tr.children.length >= 4) span = (tr.children[2].offsetLeft - tr.children[0].offsetLeft) || w;
      if (-off >= span) off += span;
      var v = Math.round(off * 10) / 10;
      if (v !== last) { tr.style.transform = "translate3d(" + v + "px,0,0)"; last = v; }
    });
  });

  /* ---------------- locations ---------------- */
  $$("[data-loc]").forEach(function (loc) {
    var rows = $$(".loc__row", loc), bg = $(".loc__bg", loc), card = $("[data-loc-card]", loc);
    var top = 0, h = 0, widths = [], offs = rows.map(function (r) { return -(+r.style.getPropertyValue("--off") || 0) * 6; });
    var paused = -1;
    onMeasure(function () { top = docTop(loc); h = loc.offsetHeight; widths = rows.map(function (r) { return r.firstElementChild.scrollWidth / 2; }); });
    var lastT = [];
    onFrame(function (y, dt) {
      if (y + vh < top || y > top + h) return;
      for (var i = 0; i < rows.length; i++) {
        var dir = +rows[i].getAttribute("data-dir");
        if (i !== paused && !reduced) offs[i] -= dir * (dt * 0.035 + (y - lastY) * 0.12);
        var w = widths[i] || 1;
        offs[i] = ((offs[i] % w) - w) % w;
        var v = Math.round(offs[i] * 10) / 10;
        if (v !== lastT[i]) { rows[i].firstElementChild.style.transform = "translate3d(" + v + "px,0,0)"; lastT[i] = v; }
      }
      if (bg && !isMobile) { var p = (y + vh - top) / (vh + h); bg.style.transform = "translate3d(0," + ((p - 0.5) * -8).toFixed(2) + "%,0)"; }
    });
    var info = {};
    doc.querySelectorAll("[data-city]");
    var cityData = { Lisbon: ["Rua da Boavista 84, Lisbon", "+351 21 000 0000"], Berlin: ["Köpenicker Str. 70, Berlin", "+49 30 000 0000"], Tokyo: ["2-14-5 Jingumae, Shibuya", "+81 3 0000 0000"], Oslo: ["Grünerløkka 12, Oslo", "+47 22 00 00 00"], Seoul: ["45 Seongsu-ro, Seoul", "+82 2 000 0000"], Denver: ["1550 Platte St, Denver CO", "+1 303 000 0000"], "Cape Town": ["71 Bree St, Cape Town", "+27 21 000 0000"], Jakarta: ["Jl. Senopati 18, Jakarta", "+62 21 000 0000"] };
    if (!finePointer) return;
    loc.addEventListener("pointerover", function (e) {
      var c = e.target.closest(".loc__c"); if (!c) return;
      var name = c.getAttribute("data-city");
      loc.classList.add("is-hover");
      $$(".loc__c", loc).forEach(function (x) { x.classList.toggle("is-hl", x.getAttribute("data-city") === name); });
      paused = rows.indexOf(c.closest(".loc__row"));
      var d = cityData[name] || ["", ""];
      card.children[1].textContent = name; card.children[2].textContent = d[0]; card.children[3].textContent = d[1];
    });
    loc.addEventListener("pointermove", function (e) {
      var r = loc.getBoundingClientRect();
      card.style.left = (e.clientX - r.left) + "px"; card.style.top = (e.clientY - r.top) + "px";
    });
    loc.addEventListener("pointerout", function (e) {
      if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".loc__c")) return;
      loc.classList.remove("is-hover"); paused = -1;
    });
  });

  /* ---------------- work page ---------------- */
  var par = $("[data-par]");
  if (par) {
    var pt = 0, ph = 0, pl = null;
    onMeasure(function () { par.style.transform = ""; pt = docTop(par); ph = par.offsetHeight; pl = null; });
    onFrame(function (y) {
      if (isMobile || reduced) return;
      if (y + vh < pt - 200 || y > pt + ph + 200) return;
      var v = Math.round(clamp((y - pt + vh * 0.5) * -0.18, -ph * 0.25, 60) * 10) / 10;
      if (v !== pl) { par.style.transform = "translate3d(0," + v + "px,0)"; pl = v; }
    });
  }
  var grid = $("[data-grid]");
  if (grid) {
    var state = { services: "", sector: "" };
    var dds = $$("[data-dd]");
    var apply = function () {
      var n = 0;
      $$(".poster", grid).forEach(function (p) {
        var ok = (!state.services || p.getAttribute("data-services").split("|").indexOf(state.services) > -1) && (!state.sector || p.getAttribute("data-sector") === state.sector);
        p.classList.toggle("is-out", !ok); if (ok) n++;
      });
      $(".allp__empty").hidden = n > 0;
      measure();
    };
    dds.forEach(function (dd) {
      $(".dd__b", dd).addEventListener("click", function (e) {
        e.stopPropagation();
        var open = !dd.classList.contains("is-open");
        dds.forEach(function (o) { o.classList.remove("is-open"); });
        dd.classList.toggle("is-open", open);
      });
      $$(".dd__m button", dd).forEach(function (b) {
        b.addEventListener("click", function () {
          $$(".dd__m button", dd).forEach(function (x) { x.classList.toggle("is-on", x === b); });
          state[dd.getAttribute("data-dd")] = b.getAttribute("data-v");
          dd.classList.toggle("is-set", !!b.getAttribute("data-v"));
          dd.classList.remove("is-open"); apply();
        });
      });
    });
    doc.addEventListener("click", function () { dds.forEach(function (o) { o.classList.remove("is-open"); }); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") dds.forEach(function (o) { o.classList.remove("is-open"); }); });
  }

  /* ---------------- news filter ---------------- */
  var nf = $("[data-filter]");
  if (nf) {
    $$("button", nf).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", nf).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        var v = b.getAttribute("data-v");
        $$(".nw__grid .ncard").forEach(function (c) { c.classList.toggle("is-out", !!v && c.getAttribute("data-cat") !== v); });
        measure();
      });
    });
  }

  /* ---------------- about ---------------- */
  var acc = $("[data-acc]");
  if (acc) {
    var cards = $$(".dl__card", acc);
    var open = function (c) { cards.forEach(function (x) { x.classList.toggle("is-open", x === c); }); };
    cards.forEach(function (c) {
      c.addEventListener("click", function () { open(c); });
      c.addEventListener("mouseenter", function () { if (finePointer) open(c); });
      c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(c); } });
    });
  }
  var cr = $("[data-cr]");
  if (cr) {
    var crt = 0, crh = 0, crl = -1, stick = $(".cr__stick", cr);
    onMeasure(function () { crt = docTop(cr); crh = cr.offsetHeight; crl = -1; });
    onFrame(function (y) {
      if (y + vh < crt || y > crt + crh) return;
      var p = clamp((y - crt) / (crh - vh), 0, 1);
      if (Math.abs(p - crl) < 0.001) return; crl = p;
      stick.style.setProperty("--cr-p", (p * 1.4).toFixed(3));
      stick.style.setProperty("--cr-r", (p * 40 - 10).toFixed(2) + "deg");
    });
  }
  var film = $("[data-film]");
  if (film) {
    var vid = $("video", film);
    var openFilm = function () { film.hidden = false; body.classList.add("is-locked"); requestAnimationFrame(function () { film.classList.add("is-open"); }); try { vid.play(); } catch (e) {} };
    var closeFilm = function () { film.classList.remove("is-open"); body.classList.remove("is-locked"); vid.pause(); setTimeout(function () { film.hidden = true; }, 400); };
    $$("[data-film-open]").forEach(function (b) { b.addEventListener("click", openFilm); });
    $("[data-film-close]", film).addEventListener("click", closeFilm);
    film.addEventListener("click", function (e) { if (e.target === film) closeFilm(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !film.hidden) closeFilm(); });
  }

  /* ---------------- case hero parallax ---------------- */
  var ch = $(".ch__img");
  if (ch && !reduced) {
    var chl = null;
    onFrame(function (y) {
      if (y > vh) return;
      var v = (y * 0.25).toFixed(1);
      if (v !== chl) { ch.style.transform = "translate3d(0," + v + "px,0) scale(1.05)"; chl = v; }
    });
  }

  /* ---------------- forms (demo, never submitted) ---------------- */
  $$("[data-form]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$(".fld", f).forEach(function (l) {
        var i = $("input,select", l); if (!i.required) return;
        var bad = !i.value || (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value));
        l.classList.toggle("is-bad", bad); if (bad) ok = false;
      });
      if (ok) { $(".form__ok", f).hidden = false; $(".form__go", f).hidden = true; }
    });
    f.addEventListener("input", function (e) { var l = e.target.closest(".fld"); if (l) l.classList.remove("is-bad"); });
    f.addEventListener("change", function (e) { var l = e.target.closest(".fld"); if (l) l.classList.remove("is-bad"); });
  });

  /* ---------------- start ---------------- */
  var rt = null;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(measure, 120); });
  window.addEventListener("load", measure);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
  $$("img").forEach(function (im) { if (!im.complete) im.addEventListener("load", function () { clearTimeout(rt); rt = setTimeout(measure, 120); }, { once: true }); });
  measure();
  ready();
  requestAnimationFrame(function (t) { now = t; loop(t); });
})();
