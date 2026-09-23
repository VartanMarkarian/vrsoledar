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

  /* ---------------- Experience: auto-rotating visual crossfade ---------------- */
  function initExperience(){
    var visual = document.querySelector(".exp-visual");
    if(!visual) return;
    var layers = visual.querySelectorAll(".exp-layer");
    var dots = visual.querySelectorAll(".exp-progress button");
    var steps = layers.length;
    var idx = 0;
    var timer = null;
    var INTERVAL = 4800;

    function show(i){
      idx = (i + steps) % steps;
      layers.forEach(function(l, n){ l.classList.toggle("is-active", n === idx); });
      dots.forEach(function(d, n){ d.classList.toggle("is-active", n === idx); });
      document.dispatchEvent(new CustomEvent("refraction:warmth", { detail: idx / Math.max(steps-1,1) }));
    }
    function next(){ show(idx + 1); }
    function start(){
      stop();
      timer = window.setInterval(next, INTERVAL);
    }
    function stop(){
      if(timer){ window.clearInterval(timer); timer = null; }
    }

    dots.forEach(function(d, n){
      d.addEventListener("click", function(){ show(n); start(); });
    });
    visual.addEventListener("mouseenter", stop);
    visual.addEventListener("mouseleave", start);

    if(!("IntersectionObserver" in window)){
      show(0); start();
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ start(); } else { stop(); }
      });
    }, { threshold:0.2 });
    io.observe(visual);
    show(0);
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

  /* ---------------- Gallery lightbox ---------------- */
  function initLightbox(){
    var items = Array.prototype.slice.call(document.querySelectorAll(".gallery-item"));
    var lightbox = document.querySelector(".lightbox");
    if(!items.length || !lightbox) return;
    var imgEl = lightbox.querySelector("img");
    var nEl = lightbox.querySelector(".lightbox-cap .n");
    var capEl = lightbox.querySelector(".lightbox-cap p");
    var closeBtn = lightbox.querySelector(".lightbox-close");
    var prevBtn = lightbox.querySelector(".lightbox-prev");
    var nextBtn = lightbox.querySelector(".lightbox-next");
    var current = 0;

    function open(i){
      current = (i + items.length) % items.length;
      var el = items[current];
      var full = el.getAttribute("data-full") || el.querySelector("img").src;
      var lang = document.documentElement.getAttribute("data-active-lang") || "ua";
      imgEl.src = full;
      imgEl.alt = el.querySelector("img").alt || "";
      if(nEl) nEl.textContent = el.getAttribute("data-n") || "";
      if(capEl) capEl.textContent = el.getAttribute("data-cap-" + lang) || el.getAttribute("data-cap-ua") || "";
      lightbox.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function close(){
      lightbox.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    items.forEach(function(el, i){
      el.addEventListener("click", function(){ open(i); });
    });
    if(closeBtn) closeBtn.addEventListener("click", close);
    if(prevBtn) prevBtn.addEventListener("click", function(){ open(current - 1); });
    if(nextBtn) nextBtn.addEventListener("click", function(){ open(current + 1); });
    lightbox.addEventListener("click", function(e){ if(e.target === lightbox) close(); });
    document.addEventListener("keydown", function(e){
      if(!lightbox.classList.contains("is-open")) return;
      if(e.key === "Escape") close();
      if(e.key === "ArrowRight") open(current + 1);
      if(e.key === "ArrowLeft") open(current - 1);
    });
  }

  /* ---------------- Hero title: living particle field (spring physics + cursor repulsion) ---------------- */
  function initHeroParticles(){
    var wrap = document.getElementById("hero-title-wrap");
    var canvas = document.getElementById("hero-title-particles");
    if(!wrap || !canvas) return;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var PALETTE = ["#fffaf2", "#ffd9a8", "#eef6ff", "#cfc6b4", "#b9c9d6"];

    var SPRING = 0.055;
    var DAMPING = 0.90;
    var REPEL_RADIUS = 78;
    var REPEL_FORCE = 3.1;
    var JITTER = 0.55;

    var particles = [];
    var running = false;
    var raf = null;
    var mouseX = -9999, mouseY = -9999;
    var canvasRect = null;

    function activeH1(){
      var lang = document.documentElement.getAttribute("data-active-lang") || "ua";
      return wrap.querySelector('h1[data-lang="' + lang + '"]');
    }

    function buildParticles(){
      var h1 = activeH1();
      if(!h1) return;
      var rect = h1.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var PAD = Math.round(REPEL_RADIUS * 1.4);
      canvas.width = (w + PAD * 2) * DPR;
      canvas.height = (h + PAD * 2) * DPR;
      canvas.style.width = (w + PAD * 2) + "px";
      canvas.style.height = (h + PAD * 2) + "px";
      canvas.style.left = (-PAD) + "px";
      canvas.style.top = (-PAD) + "px";
      canvasRect = null;

      var off = document.createElement("canvas");
      off.width = w * DPR;
      off.height = h * DPR;
      var octx = off.getContext("2d");
      var cs = getComputedStyle(h1);
      octx.scale(DPR, DPR);
      octx.fillStyle = "#fff";
      octx.textBaseline = "middle";
      octx.textAlign = "left";
      octx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
      try{ octx.letterSpacing = cs.letterSpacing; }catch(e){}
      octx.fillText(h1.textContent.toUpperCase(), 0, h / 2);

      var data = octx.getImageData(0, 0, w * DPR, h * DPR).data;
      var dense = window.innerWidth >= 700;
      var step = Math.max(1, Math.round((dense ? 1.6 : 2.6) * DPR));
      var oldCount = particles.length;
      particles = [];
      var i = 0;
      for(var y = 0; y < h * DPR; y += step){
        for(var x = 0; x < w * DPR; x += step){
          var alpha = data[(y * w * DPR + x) * 4 + 3];
          if(alpha > 120){
            var hx = x / DPR + PAD, hy = y / DPR + PAD;
            particles.push({
              hx: hx, hy: hy,
              x: hx, y: hy,
              vx: 0, vy: 0,
              ph: Math.random() * Math.PI * 2,
              jf: 0.25 + Math.random() * 0.5,
              flick: 0.5 + Math.random() * 1.1,
              size: (0.9 + Math.random() * 1.3) * DPR,
              color: PALETTE[(Math.random() * PALETTE.length) | 0]
            });
            i++;
          }
        }
      }
    }

    function draw(t){
      if(!canvasRect){ canvasRect = canvas.getBoundingClientRect(); }
      var localMouseX = mouseX - canvasRect.left;
      var localMouseY = mouseY - canvasRect.top;
      var r2 = REPEL_RADIUS * REPEL_RADIUS;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(DPR, DPR);

      for(var idx = 0; idx < particles.length; idx++){
        var p = particles[idx];

        var fx = (p.hx - p.x) * SPRING;
        var fy = (p.hy - p.y) * SPRING;
        fx += Math.cos(t * p.jf + p.ph) * JITTER * 0.03;
        fy += Math.sin(t * p.jf * 0.85 + p.ph) * JITTER * 0.03;

        var dx = p.x - localMouseX, dy = p.y - localMouseY;
        var d2 = dx * dx + dy * dy;
        if(d2 < r2){
          var d = Math.sqrt(d2) || 0.001;
          var force = 1 - d / REPEL_RADIUS;
          force = force * force * REPEL_FORCE;
          fx += (dx / d) * force;
          fy += (dy / d) * force;
        }

        p.vx = (p.vx + fx) * DAMPING;
        p.vy = (p.vy + fy) * DAMPING;
        p.x += p.vx;
        p.y += p.vy;

        var twinkle = 0.68 + 0.32 * Math.sin(t * p.flick + p.ph);
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = p.color;
        var s = p.size / DPR;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    }

    function loop(){
      draw(performance.now() * 0.001);
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
      mouseX = e.clientX; mouseY = e.clientY;
    }, { passive:true });
    document.addEventListener("pointerleave", function(){ mouseX = -9999; mouseY = -9999; });
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

  document.addEventListener("DOMContentLoaded", function(){
    initLang();
    initHeader();
    initReveal();
    initParticles();
    initExperience();
    initVideoEmbed();
    initHeroParticles();
    initLightbox();
  });
})();
