(function(){
  "use strict";

  /* ---------------- Language toggle ---------------- */
  var LANG_KEY = "refraction-lang";
  function setLang(lang){
    document.documentElement.setAttribute("data-active-lang", lang);
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "uk");
    try{ localStorage.setItem(LANG_KEY, lang); }catch(e){}
    document.querySelectorAll("[data-set-lang]").forEach(function(btn){
      btn.classList.toggle("is-active", btn.getAttribute("data-set-lang") === lang);
    });
    document.dispatchEvent(new CustomEvent("refraction:lang-changed", { detail: lang }));
  }
  function initLang(){
    var saved = "ua";
    try{ saved = localStorage.getItem(LANG_KEY) || "ua"; }catch(e){}
    setLang(saved);
    document.querySelectorAll("[data-set-lang]").forEach(function(btn){
      btn.addEventListener("click", function(){ setLang(btn.getAttribute("data-set-lang")); });
    });
  }

  /* ---------------- Header scroll state + mobile nav ---------------- */
  function initHeader(){
    var header = document.querySelector(".site-header");
    if(header){
      var onScroll = function(){
        header.classList.toggle("is-scrolled", window.scrollY > 30);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive:true });
    }
    var burger = document.querySelector(".burger");
    var mobileNav = document.querySelector(".mobile-nav");
    if(burger && mobileNav){
      burger.addEventListener("click", function(){
        mobileNav.classList.toggle("is-open");
      });
      mobileNav.querySelectorAll("a").forEach(function(a){
        a.addEventListener("click", function(){ mobileNav.classList.remove("is-open"); });
      });
    }
  }

  /* ---------------- Reveal on scroll ---------------- */
  function initReveal(){
    var items = document.querySelectorAll(".reveal");
    if(!items.length) return;
    if(!("IntersectionObserver" in window)){
      items.forEach(function(el){ el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.14, rootMargin:"0px 0px -60px 0px" });
    items.forEach(function(el){ io.observe(el); });
  }

  /* ---------------- Ambient particle field ---------------- */
  function initParticles(){
    var canvas = document.getElementById("bg-particles");
    if(!canvas) return;
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var particles = [];
    var COUNT = window.innerWidth < 700 ? 34 : 70;
    var warmth = 0; // 0 = cave (warm), 1 = city (cool/starlit)

    function resize(){
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    function makeParticle(){
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.6 + 0.4,
        vy: -(Math.random() * 0.18 + 0.05),
        vx: (Math.random() - 0.5) * 0.06,
        a: Math.random() * 0.5 + 0.15,
        tw: Math.random() * Math.PI * 2
      };
    }
    function init(){
      resize();
      particles = [];
      for(var i=0;i<COUNT;i++){ particles.push(makeParticle()); }
    }
    function colorFor(a, w){
      // interpolate warm amber -> cool ice-white as w goes 0..1
      var r = Math.round(255 + (223-255)*w);
      var g = Math.round(150 + (240-150)*w);
      var b = Math.round(90 + (255-90)*w);
      return "rgba("+r+","+g+","+b+","+a+")";
    }
    function tick(){
      ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
      for(var i=0;i<particles.length;i++){
        var p = particles[i];
        p.y += p.vy;
        p.x += p.vx + Math.sin((p.tw += 0.004))*0.05;
        if(p.y < -10){ p.y = window.innerHeight + 10; p.x = Math.random()*window.innerWidth; }
        ctx.beginPath();
        ctx.fillStyle = colorFor(p.a, warmth);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    window.addEventListener("resize", resize);
    document.addEventListener("refraction:warmth", function(e){
      warmth = e.detail;
    });
    init();
    requestAnimationFrame(tick);
  }

  /* ---------------- Experience: the switch lights up the sculpture ---------------- */
  function initExperience(){
    var section = document.querySelector(".experience");
    var sw = section && section.querySelector(".exp-switch");
    if(!sw) return;
    var sound = switchSound();
    sw.addEventListener("click", function(){
      var on = !section.classList.contains("is-on");
      section.classList.toggle("is-on", on);
      sw.setAttribute("aria-pressed", on ? "true" : "false");
      sound(on);
    });
  }

  /* ---------------- Switch sound: a dry mechanical clack (synthesised, no audio files) ---------------- */
  function switchSound(){
    var AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return function(){};
    var ctx = null, input = null;

    function setup(){
      ctx = new AC();
      input = ctx.createGain();
      input.gain.value = 0.8;
      var comp = ctx.createDynamicsCompressor();
      input.connect(comp); comp.connect(ctx.destination);
    }

    // one mechanical transient: a bright noise snap plus a short low knock of the plate
    function clack(at, pitch, level){
      var n = Math.floor(ctx.sampleRate * 0.03);
      var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for(var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 6);
      var noise = ctx.createBufferSource(); noise.buffer = buf;
      var band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 2600 * pitch; band.Q.value = 1.4;
      var ng = ctx.createGain(); ng.gain.value = level;
      noise.connect(band); band.connect(ng); ng.connect(input);
      noise.start(at);

      var knock = ctx.createOscillator(); knock.type = "sine";
      knock.frequency.setValueAtTime(190 * pitch, at);
      knock.frequency.exponentialRampToValueAtTime(70 * pitch, at + 0.08);
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0.0001, at);
      kg.gain.exponentialRampToValueAtTime(level * 0.9, at + 0.003);
      kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      knock.connect(kg); kg.connect(input);
      knock.start(at); knock.stop(at + 0.14);
    }

    return function(on){
      try{
        if(!ctx) setup();
        if(ctx.state === "suspended") ctx.resume();
        var t = ctx.currentTime + 0.01;
        // switching on is a firm double clack; switching off is a single, lower one
        if(on){ clack(t, 1, 0.9); clack(t + 0.028, 1.25, 0.45); }
        else  { clack(t, 0.8, 0.75); }
      }catch(e){}
    };
  }

  /* ---------------- Teaser: lite YouTube embed ---------------- */
  function initVideoEmbed(){
    var box = document.querySelector(".video-embed");
    if(!box) return;
    var id = box.getAttribute("data-yt-id");
    box.addEventListener("click", function(){
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      iframe.title = "YouTube video player";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      box.innerHTML = "";
      box.appendChild(iframe);
    }, { once:true });
  }

  /* ---------------- Objects of memory: images orbiting a large circle ---------------- */
  function initOrbit(){
    var orbit = document.querySelector(".orbit");
    if(!orbit) return;
    var items = Array.prototype.slice.call(orbit.querySelectorAll(".orbit-item"));
    var N = items.length;
    if(!N) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var STEP = Math.PI * 2 / N;          // equal spacing along the circle
    var SPEED = STEP / 3.6;              // one position every ~3.6 s
    var HOVER_SCALE = 1.6;
    var HIDE_FROM = 0.8, HIDE_TO = 1.25; // radians from the front: fade out before the side turns back
    var TILT = 0.07;                     // the ring is seen a little from above, so the sides rise slightly

    var R = 0, S = 0, offset = 0, speedK = reduce ? 0 : 1;
    var active = -1, visible = false, raf = 0, last = 0;
    var zoom = items.map(function(){ return 1; });
    var lastType = "";
    var scrub = null, dragging = false;  // scrub: offset the ring is being pulled to by the dragged dot

    // one dot per object; the dot of the object at the front grows and lights up
    var dotsBar = document.querySelector(".orbit-dots");
    var dots = [];
    if(dotsBar){
      for(var d = 0; d < N; d++){
        var b = document.createElement("button");
        b.type = "button";
        b.className = "orbit-dot";
        b.setAttribute("aria-label", (d + 1) + " / " + N);
        dotsBar.appendChild(b);
        dots.push(b);
      }
    }

    function layout(){
      var W = orbit.clientWidth;
      // x reaches its widest (0.707 R) at ~70° -> that is the visible half-width
      R = Math.max(W * 0.72, 560);
      S = Math.round(R * 0.25);
      orbit.style.setProperty("--orbit-s", S + "px");
      orbit.style.setProperty("--orbit-h", Math.round(S * 1.1 + R * TILT * 0.6) + "px");
    }

    function place(){
      for(var i = 0; i < N; i++){
        var th = offset + i * STEP;
        th = Math.atan2(Math.sin(th), Math.cos(th));          // wrap to [-PI, PI]
        var a = Math.abs(th);
        var el = items[i];
        if(a > HIDE_TO && i !== active){ el.style.opacity = "0"; el.style.visibility = "hidden"; continue; }
        var c = Math.cos(th);
        var p = 2 / (3 - c);                                  // perspective with the eye 2R in front of the ring
        var x = R * Math.sin(th) * p;
        var y = -R * (1 - c) * TILT;
        var fade = a < HIDE_FROM ? 1 : 1 - (a - HIDE_FROM) / (HIDE_TO - HIDE_FROM);
        var k = p * zoom[i];
        el.style.visibility = "visible";
        el.style.opacity = (fade * (0.45 + 0.55 * (p - 0.7) / 0.3)).toFixed(3);
        el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + k.toFixed(4) + ")";
        el.style.zIndex = i === active ? 1000 : Math.round(p * 100);
      }
      // continuous "front" position, so the highlight glides from dot to dot with the ring
      if(dots.length){
        var f = frontPos();
        for(var j = 0; j < N; j++){
          var dd = Math.abs(j - f);
          dd = Math.min(dd, N - dd);
          dots[j].style.setProperty("--k", Math.max(0, 1 - dd).toFixed(3));
        }
      }
    }

    function frontPos(){ return ((-offset / STEP) % N + N) % N; }

    // bring object i to the front, travelling along the dot row (not round the back),
    // so the glowing dot follows the pointer across the row
    function scrubTo(i){
      var f = frontPos();
      if(f > N - 0.5) f -= N;                               // highlight is wrapping from the last dot to the first
      scrub = offset - (i - f) * STEP;
      kick();
    }

    function frame(t){
      raf = 0;
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      // ease the ring to a stop while an image is held, and back up to speed afterwards
      var targetK = (active >= 0 || reduce || scrub !== null) ? 0 : 1;
      var moving = false;
      if(scrub !== null){
        // pulled from the dots: rush to the chosen object, then settle
        speedK = 0;
        var v = (scrub - offset) * 1.5;                     // ease in towards the chosen object...
        var VMAX = STEP * 4;                                // ...but never faster than 4 objects a second
        v = Math.max(-VMAX, Math.min(VMAX, v));
        offset += v * dt;
        if(Math.abs(scrub - offset) < 0.002){ offset = scrub; if(!dragging) scrub = null; }
        moving = scrub === null || offset !== scrub;
      } else {
        speedK += (targetK - speedK) * Math.min(1, dt * 4);
        offset -= SPEED * speedK * dt;                      // negative: right-to-left
        moving = Math.abs(targetK - speedK) > 0.001 || targetK > 0;
      }
      for(var i = 0; i < N; i++){
        var z = i === active ? HOVER_SCALE : 1;
        zoom[i] += (z - zoom[i]) * Math.min(1, dt * 7);
        if(Math.abs(z - zoom[i]) > 0.001) moving = true;
      }
      place();
      if(visible && moving) raf = requestAnimationFrame(frame);
      else last = 0;
    }
    function kick(){ if(!raf && visible) raf = requestAnimationFrame(frame); }

    function setActive(i){
      if(active === i) return;
      if(active >= 0) items[active].classList.remove("is-active");
      active = i;
      if(active >= 0) items[active].classList.add("is-active");
      kick();
    }

    items.forEach(function(el, i){
      el.addEventListener("pointerenter", function(e){ if(e.pointerType === "mouse") setActive(i); });
      el.addEventListener("pointerleave", function(e){ if(e.pointerType === "mouse" && active === i) setActive(-1); });
      // touch: tap to enlarge, tap again (or anywhere else) to let it go.
      // The type comes from pointerdown: older Safari fires click as a plain MouseEvent.
      el.addEventListener("pointerdown", function(e){ lastType = e.pointerType; });
      el.addEventListener("click", function(e){
        if(lastType === "mouse") return;
        e.stopPropagation();
        setActive(active === i ? -1 : i);
      });
    });
    document.addEventListener("click", function(){ if(active >= 0 && !orbit.matches(":hover")) setActive(-1); });

    if(dotsBar){
      // press anywhere on the row and sweep along it (button held) to spin through the objects
      var posAt = function(e){
        var r = dotsBar.getBoundingClientRect();
        return Math.max(0, Math.min(N - 1, (e.clientX - r.left) / r.width * N - 0.5));
      };
      dotsBar.addEventListener("pointerdown", function(e){
        e.preventDefault();
        dragging = true;
        dotsBar.classList.add("is-dragging");
        setActive(-1);
        if(dotsBar.setPointerCapture) dotsBar.setPointerCapture(e.pointerId);
        scrubTo(Math.round(posAt(e)));
      });
      dotsBar.addEventListener("pointermove", function(e){ if(dragging) scrubTo(Math.round(posAt(e))); });
      var release = function(e){
        if(!dragging) return;
        dragging = false;
        dotsBar.classList.remove("is-dragging");
        scrubTo(Math.round(posAt(e)));                      // settle on the object under the dot, then carry on
      };
      dotsBar.addEventListener("pointerup", release);
      dotsBar.addEventListener("pointercancel", release);
      // keyboard
      dots.forEach(function(b, i){
        b.addEventListener("click", function(e){ if(e.detail === 0) scrubTo(i); });
      });
    }

    layout(); place();
    window.addEventListener("resize", function(){ layout(); place(); });

    if("IntersectionObserver" in window){
      new IntersectionObserver(function(entries){
        visible = entries[0].isIntersecting;
        if(visible) kick();
      }, { rootMargin:"100px 0px" }).observe(orbit);
    } else { visible = true; kick(); }
  }

  /* ---------------- Team cards: hand-drawn wireframe boxes (like the VR scene and the mine cart) ---------------- */
  function initWireFrames(){
    var cards = Array.prototype.slice.call(document.querySelectorAll(".team-card"));
    if(!cards.length) return;
    var NS = "http://www.w3.org/2000/svg";
    var M = 28;                                    // room around the card for overshooting lines and the depth box
    var DEPTH = 0.11;                              // how far the back face recedes towards the vanishing point
    var grid = document.querySelector(".team-grid");

    function rng(seed){                            // small deterministic PRNG, so each card keeps its own sketch
      return function(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    }

    function draw(card, idx){
      var old = card.querySelector(".wf");
      if(old) old.remove();
      var W = card.offsetWidth, H = card.offsetHeight;
      if(!W || !H) return;
      var r = rng(idx * 7919 + 17);
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "wf");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("width", W + M * 2);
      svg.setAttribute("height", H + M * 2);
      var n = 0;
      function line(x1, y1, x2, y2, cls){
        var l = document.createElementNS(NS, "line");
        l.setAttribute("x1", x1.toFixed(1)); l.setAttribute("y1", y1.toFixed(1));
        l.setAttribute("x2", x2.toFixed(1)); l.setAttribute("y2", y2.toFixed(1));
        l.setAttribute("pathLength", "1");
        l.setAttribute("class", cls);
        l.style.setProperty("--d", (n++ * 0.035).toFixed(2) + "s");
        svg.appendChild(l);
      }
      // an edge that runs past both corners, drawn twice with a slight wobble, like a quick technical sketch
      function edge(x1, y1, x2, y2, cls, twice){
        var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / len, uy = dy / len;
        var a = 3 + r() * 12, b = 3 + r() * 12;
        line(x1 - ux * a, y1 - uy * a, x2 + ux * b, y2 + uy * b, cls);
        if(twice){
          var j = function(){ return (r() - 0.5) * 2.4; };
          line(x1 - ux * a * 0.4 + j(), y1 - uy * a * 0.4 + j(), x2 + ux * b * 0.6 + j(), y2 + uy * b * 0.6 + j(), cls + " wf-thin");
        }
      }
      var L = M, T = M, R = M + W, B = M + H;
      // back face of the box: one-point perspective, every box recedes towards the same vanishing point
      // in the middle of the team grid (between the 2nd and 3rd card)
      var gr = grid.getBoundingClientRect(), cr = card.getBoundingClientRect();
      var vx = gr.left + gr.width / 2 - cr.left + M, vy = gr.top + gr.height / 2 - cr.top + M;
      var sc = 1 - DEPTH;
      var bL = vx + (L - vx) * sc, bR = vx + (R - vx) * sc, bT = vy + (T - vy) * sc, bB = vy + (B - vy) * sc;
      var vpRight = vx > (L + R) / 2, vpBelow = vy > (T + B) / 2;

      // edges of the back face on the far side from the vanishing point read as hidden -> dashed
      edge(bL, bT, bR, bT, vpBelow ? "wf-back wf-dash" : "wf-back", false);
      edge(bL, bB, bR, bB, vpBelow ? "wf-back" : "wf-back wf-dash", false);
      edge(bL, bT, bL, bB, vpRight ? "wf-back wf-dash" : "wf-back", false);
      edge(bR, bT, bR, bB, vpRight ? "wf-back" : "wf-back wf-dash", false);
      [[L, T, bL, bT], [R, T, bR, bT], [R, B, bR, bB], [L, B, bL, bB]].forEach(function(c){
        edge(c[0], c[1], c[2], c[3], "wf-back", false);
        // faint guide ray carrying on towards the vanishing point
        line(c[2], c[3], c[2] + (vx - c[2]) * 0.35, c[3] + (vy - c[3]) * 0.35, "wf-ray wf-dash");
      });

      edge(L, T, R, T, "wf-front", true);
      edge(R, T, R, B, "wf-front", true);
      edge(L, B, R, B, "wf-front", true);
      edge(L, T, L, B, "wf-front", true);
      // an inner frame on two sides, like the thick frames round the paintings in the VR scene
      var i = 7;
      edge(L + i, T + i, L + i, B - i, "wf-inner", false);
      edge(L + i, B - i, R - i, B - i, "wf-inner", false);
      // one long construction line across the bottom of the card, below the centred text
      var y = T + H * (0.89 + r() * 0.04);
      line(L - 18 - r() * 10, y, R + 10 + r() * 16, y + (r() - 0.5) * 6, "wf-back wf-dash");

      card.insertBefore(svg, card.firstChild);
    }

    function drawAll(){ cards.forEach(draw); }
    drawAll();
    var t;
    window.addEventListener("resize", function(){
      clearTimeout(t);
      t = setTimeout(function(){ document.documentElement.classList.add("wf-drawn"); drawAll(); }, 150);
    });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
  }

  /* ---------------- Hero title: living particle field (spring physics + cursor repulsion) ---------------- */
  function initHeroParticles(){
    var wrap = document.getElementById("hero-title-wrap");
    var canvas = document.getElementById("hero-title-particles");
    if(!wrap || !canvas) return;
    particleText({
      wrap: wrap,
      canvas: canvas,
      textEl: function(){
        var lang = document.documentElement.getAttribute("data-active-lang") || "ua";
        return wrap.querySelector('h1[data-lang="' + lang + '"]');
      }
    });
  }

  /* ---------------- About quote: the same particle text, over several lines ---------------- */
  function initQuoteParticles(){
    var wrap = document.querySelector(".quote-block");
    if(!wrap) return;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // wrap every word, so each wrapped line can be redrawn exactly where the browser put it
    Array.prototype.forEach.call(wrap.querySelectorAll("p"), function(pEl){
      pEl.innerHTML = pEl.textContent.replace(/[&<>]/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c]; })
        .replace(/(\S+)/g, '<span class="pt-word">$1</span>');
    });
    var canvas = document.createElement("canvas");
    canvas.className = "quote-particles";
    canvas.setAttribute("aria-hidden", "true");
    wrap.appendChild(canvas);
    particleText({
      wrap: wrap,
      canvas: canvas,
      textEl: function(){
        var lang = document.documentElement.getAttribute("data-active-lang") || "ua";
        return wrap.querySelector('p[data-lang="' + lang + '"]');
      },
      step: 1.15, stepSparse: 1.6, alphaMin: 70,
      repel: 70, reflSquash: 0.38, reflGap: 10,
      onBuilt: function(){ wrap.classList.add("pt-on"); }
    });
  }

  function particleText(opt){
    var wrap = opt.wrap, canvas = opt.canvas;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var PALETTE = ["#fffaf2", "#ffd9a8", "#eef6ff", "#cfc6b4", "#b9c9d6"];

    // soft spring + strong damping: particles drift back without bouncing
    var SPRING = 0.008;
    var DAMPING = 0.86;
    var REPEL_RADIUS = opt.repel || 100;
    var REPEL_FORCE = 1.8;
    var LIFT = 0.3;        // pushed particles rise a little, like dust in air
    var SWIRL = 1.0;       // sideways (tangential) spread, per-particle direction
    var FLOAT_AMP = 0.4;   // barely visible idle wandering around the home point, px
    var FLOAT_SPEED = 0.35;
    var DRAFT = 0.18;      // particles get swept along the cursor's motion
    var DUST_FADE = 180;   // px of displacement at which a particle is most transparent

    // Reflection (mirror below the title, like a water surface)
    var REFL_GAP = opt.reflGap || 6;
    var REFL_SQUASH = opt.reflSquash || 0.72;
    var REFL_ALPHA = 0.55;
    var REFL_SPRING = 0.009;
    var REFL_DAMPING = 0.84;

    var particles = [];
    var running = false;
    var raf = null;
    var mouseX = -9999, mouseY = -9999;
    var mouseVX = 0, mouseVY = 0;
    var canvasRect = null;
    var field = { pad:0, w:0, reflTop:0, reflH:0 };

    function buildParticles(){
      var h1 = opt.textEl();
      if(!h1) return;
      var rect = h1.getBoundingClientRect();
      var wrapRect = wrap.getBoundingClientRect();
      var offX = rect.left - wrapRect.left, offY = rect.top - wrapRect.top;
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var PAD = Math.round(REPEL_RADIUS * 2.4);

      var off = document.createElement("canvas");
      // integer pixel size; the row stride below must match exactly or rows drift sideways at fractional DPR
      var OW = Math.round(w * DPR), OH = Math.round(h * DPR);
      off.width = OW;
      off.height = OH;
      var octx = off.getContext("2d");
      var cs = getComputedStyle(h1);
      octx.scale(DPR, DPR);
      octx.fillStyle = "#fff";
      octx.textBaseline = "middle";
      octx.textAlign = "center";
      octx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
      try{ octx.letterSpacing = cs.letterSpacing; }catch(e){}

      var upper = cs.textTransform === "uppercase";
      var lineEls = h1.querySelectorAll(".line");
      var wordEls = h1.querySelectorAll(".pt-word");
      if(wordEls.length){
        // multi-line text: every word where the browser laid it out
        octx.textAlign = "left";
        Array.prototype.forEach.call(wordEls, function(wEl){
          var wr = wEl.getBoundingClientRect();
          var txt = upper ? wEl.textContent.toUpperCase() : wEl.textContent;
          octx.fillText(txt, wr.left - rect.left, (wr.top - rect.top) + wr.height / 2);
        });
      }else if(lineEls.length){
        lineEls.forEach(function(lineEl){
          var lr = lineEl.getBoundingClientRect();
          var cx = (lr.left - rect.left) + lr.width / 2;
          var cy = (lr.top - rect.top) + lr.height / 2;
          octx.fillText(lineEl.textContent.toUpperCase(), cx, cy);
        });
      }else{
        octx.fillText(h1.textContent.toUpperCase(), w / 2, h / 2);
      }

      var data = octx.getImageData(0, 0, OW, OH).data;
      var dense = window.innerWidth >= 700;
      var step = Math.max(1, Math.round((dense ? (opt.step || 1.6) : (opt.stepSparse || 2.6)) * DPR));
      var alphaMin = opt.alphaMin || 120;

      var points = [];
      var glyphTop = Infinity, glyphBottom = -Infinity;
      for(var y = 0; y < OH; y += step){
        for(var x = 0; x < OW; x += step){
          if(data[(y * OW + x) * 4 + 3] > alphaMin){
            var lx = x / DPR, ly = y / DPR;
            points.push(lx, ly);
            if(ly < glyphTop) glyphTop = ly;
            if(ly > glyphBottom) glyphBottom = ly;
          }
        }
      }
      if(!points.length) return;

      var glyphH = glyphBottom - glyphTop;
      var reflTop = glyphBottom + REFL_GAP;
      var reflH = glyphH * REFL_SQUASH;
      var extra = Math.max(0, Math.ceil(reflTop + reflH - h));

      canvas.width = Math.round((w + PAD * 2) * DPR);
      canvas.height = Math.round((h + extra + PAD * 2) * DPR);
      canvas.style.width = (w + PAD * 2) + "px";
      canvas.style.height = (h + extra + PAD * 2) + "px";
      canvas.style.left = (offX - PAD) + "px";
      canvas.style.top = (offY - PAD) + "px";
      canvasRect = null;
      field = { pad:PAD, w:w, reflTop:reflTop + PAD, reflH:reflH };

      particles = [];
      for(var n = 0; n < points.length; n += 2){
        var px = points[n], py = points[n + 1];
        var hx = px + PAD, hy = py + PAD;
        particles.push(makeParticle(hx, hy, false, 1));

        // every other glyph point also gets a mirrored twin below the title
        if((n / 2) % 2 === 0){
          var ry = reflTop + (glyphBottom - py) * REFL_SQUASH;
          var k = (ry - reflTop) / (reflH || 1);
          var fade = Math.pow(1 - k, 1.6) * REFL_ALPHA;
          if(fade > 0.02){
            particles.push(makeParticle(hx, ry + PAD, true, fade));
          }
        }
      }
      if(opt.onBuilt) opt.onBuilt();
    }

    function makeParticle(hx, hy, refl, fade){
      return {
        hx: hx, hy: hy,
        x: hx, y: hy,
        vx: 0, vy: 0,
        refl: refl, fade: fade,
        scat: 0.45 + Math.random() * 1.2,
        swirl: (Math.random() - 0.5) * 2 * SWIRL,
        ph: Math.random() * Math.PI * 2,
        jf: 0.25 + Math.random() * 0.5,
        flick: 0.5 + Math.random() * 1.1,
        size: (0.9 + Math.random() * 1.3) * DPR * (refl ? 0.9 : 1),
        color: PALETTE[(Math.random() * PALETTE.length) | 0]
      };
    }

    function draw(t){
      if(!canvasRect){ canvasRect = canvas.getBoundingClientRect(); }
      var localMouseX = mouseX - canvasRect.left;
      var localMouseY = mouseY - canvasRect.top;
      // the faster the cursor moves, the wider the area it stirs up
      var mouseSpeed = Math.min(30, Math.sqrt(mouseVX * mouseVX + mouseVY * mouseVY));
      var repelR = REPEL_RADIUS * (1 + mouseSpeed / 30 * 0.7);
      var r2 = repelR * repelR;

      // autonomous "ghost cursor" that keeps wandering through the reflection
      var ghostR = REPEL_RADIUS * 0.9;
      var ghostR2 = ghostR * ghostR;
      var ghostX = field.pad + field.w * (0.5 + 0.47 * Math.sin(t * 0.22 + Math.sin(t * 0.07) * 1.6));
      var ghostY = field.reflTop + field.reflH * (0.4 + 0.3 * Math.sin(t * 0.5));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(DPR, DPR);

      for(var idx = 0; idx < particles.length; idx++){
        var p = particles[idx];
        var spring = p.refl ? REFL_SPRING : SPRING;

        // home point slowly floats, so the text breathes instead of sitting still
        var tx = p.hx + Math.cos(t * FLOAT_SPEED * p.jf * 2 + p.ph) * FLOAT_AMP;
        var ty = p.hy + Math.sin(t * FLOAT_SPEED * p.jf * 1.7 + p.ph) * FLOAT_AMP;
        var fx = (tx - p.x) * spring;
        var fy = (ty - p.y) * spring;

        var dx = p.x - localMouseX, dy = p.y - localMouseY;
        var d2 = dx * dx + dy * dy;
        if(d2 < r2){
          var d = Math.sqrt(d2) || 0.001;
          var force = 1 - d / repelR;
          force = force * force * REPEL_FORCE * p.scat;
          var nx = dx / d, ny = dy / d;
          // radial push + sideways swirl + sweep along the cursor's motion = dust cloud
          fx += nx * force - ny * force * p.swirl + mouseVX * force * DRAFT;
          fy += ny * force + nx * force * p.swirl - force * LIFT + mouseVY * force * DRAFT;
        }

        if(p.refl){
          var gdx = p.x - ghostX, gdy = p.y - ghostY;
          var gd2 = gdx * gdx + gdy * gdy;
          if(gd2 < ghostR2){
            var gd = Math.sqrt(gd2) || 0.001;
            var gforce = 1 - gd / ghostR;
            gforce = gforce * gforce * REPEL_FORCE * 0.6;
            fx += (gdx / gd) * gforce;
            fy += (gdy / gd) * gforce;
          }
        }

        var damping = p.refl ? REFL_DAMPING : DAMPING;
        p.vx = (p.vx + fx) * damping;
        p.vy = (p.vy + fy) * damping;
        p.x += p.vx;
        p.y += p.vy;

        var twinkle = 0.68 + 0.32 * Math.sin(t * p.flick + p.ph);
        // scattered dust thins out the further it drifts from home
        var ox = p.x - p.hx, oy = p.y - p.hy;
        var disp2 = ox * ox + oy * oy;
        if(disp2 > 4){
          twinkle *= 1 - Math.min(Math.sqrt(disp2) / DUST_FADE, 1) * 0.6;
        }
        var drawX = p.x;
        if(p.refl){
          twinkle *= p.fade;
          // gentle water ripple, stronger further from the title
          drawX += Math.sin(p.hy * 0.11 + t * 1.3) * (0.6 + (p.hy - field.reflTop) * 0.05);
        }
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = p.color;
        var s = p.size / DPR;
        ctx.fillRect(drawX - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    }

    function loop(){
      draw(performance.now() * 0.001);
      mouseVX *= 0.88; mouseVY *= 0.88;
      if(running){ raf = requestAnimationFrame(loop); }
    }
    function start(){
      if(!running){
        running = true;
        if(!particles.length) buildParticles();
        raf = requestAnimationFrame(loop);
      }
    }
    function stop(){
      running = false;
      if(raf){ cancelAnimationFrame(raf); raf = null; }
    }

    document.addEventListener("pointermove", function(e){
      if(mouseX > -9000){
        var MAX_V = 30;
        mouseVX = mouseVX * 0.6 + Math.max(-MAX_V, Math.min(MAX_V, e.clientX - mouseX)) * 0.4;
        mouseVY = mouseVY * 0.6 + Math.max(-MAX_V, Math.min(MAX_V, e.clientY - mouseY)) * 0.4;
      }
      mouseX = e.clientX; mouseY = e.clientY;
    }, { passive:true });
    document.addEventListener("pointerleave", function(){ mouseX = -9999; mouseY = -9999; mouseVX = 0; mouseVY = 0; });
    document.addEventListener("scroll", function(){ canvasRect = null; }, { passive:true });

    document.addEventListener("refraction:lang-changed", function(){
      particles = [];
      buildParticles();
    });

    var resizeTimer;
    window.addEventListener("resize", function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){ particles = []; buildParticles(); }, 200);
    });

    function readyBuildAndMaybeStart(){
      buildParticles();
      if("IntersectionObserver" in window){
        var io = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            entry.isIntersecting ? start() : stop();
          });
        }, { threshold:0.05 });
        io.observe(wrap);
      }else{
        start();
      }
    }

    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(readyBuildAndMaybeStart);
    }else{
      setTimeout(readyBuildAndMaybeStart, 300);
    }
  }

  /* ---------------- Hero: shelf lamps light up while the cursor moves over the title ---------------- */
  function initHeroLamps(){
    var hero = document.querySelector(".hero");
    var wrap = document.getElementById("hero-title-wrap");
    if(!hero || !wrap || !hero.querySelector(".hero-lamps")) return;

    // lamp cluster in cave-hero.jpg (1280x853): centre and half-size in image pixels
    var IMG_W = 1280, IMG_H = 853;
    var LAMP_X = 556, LAMP_Y = 445, LAMP_RX = 95, LAMP_RY = 105;
    var GAIN = 0.012;       // brightness gained per px of cursor travel over the title
    var DECAY = 0.982;      // per frame; ~3 s to fade out
    var EASE = 0.12;        // how quickly the visible light follows the energy

    var energy = 0, shown = 0, raf = null;
    var lastX = null, lastY = null;

    function place(){
      var w = hero.clientWidth, h = hero.clientHeight;
      var scale = Math.max(w / IMG_W, h / IMG_H);   // background-size: cover
      var offX = (w - IMG_W * scale) / 2;           // background-position: center 50%
      var offY = (h - IMG_H * scale) / 2;
      hero.style.setProperty("--lamp-x", Math.round(offX + LAMP_X * scale) + "px");
      hero.style.setProperty("--lamp-y", Math.round(offY + LAMP_Y * scale) + "px");
      hero.style.setProperty("--lamp-rx", Math.round(LAMP_RX * scale) + "px");
      hero.style.setProperty("--lamp-ry", Math.round(LAMP_RY * scale) + "px");
    }

    function tick(){
      energy *= DECAY;
      shown += (energy - shown) * EASE;
      hero.style.setProperty("--lamp", shown.toFixed(3));
      if(energy > 0.002 || shown > 0.002){
        raf = requestAnimationFrame(tick);
      }else{
        energy = shown = 0;
        hero.style.setProperty("--lamp", "0");
        raf = null;
      }
    }

    document.addEventListener("pointermove", function(e){
      var r = wrap.getBoundingClientRect();
      var M = 30;
      var over = e.clientX > r.left - M && e.clientX < r.right + M && e.clientY > r.top - M && e.clientY < r.bottom + M;
      if(over && lastX !== null){
        var travel = Math.min(60, Math.hypot(e.clientX - lastX, e.clientY - lastY));
        energy = Math.min(1, energy + travel * GAIN);
        if(!raf){ raf = requestAnimationFrame(tick); }
      }
      lastX = e.clientX; lastY = e.clientY;
    }, { passive:true });

    var t;
    window.addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(place, 150); });
    place();
  }

  document.addEventListener("DOMContentLoaded", function(){
    initHeroLamps();
    initLang();
    initHeader();
    initReveal();
    initParticles();
    initExperience();
    initVideoEmbed();
    initHeroParticles();
    initQuoteParticles();
    initOrbit();
    initWireFrames();
  });
})();
