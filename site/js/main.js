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

  /* ---------------- Hero title: dissolve into particles on hover ---------------- */
  function initHeroParticles(){
    var wrap = document.getElementById("hero-title-wrap");
    var canvas = document.getElementById("hero-title-particles");
    if(!wrap || !canvas) return;
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var PALETTE = ["#fffaf2", "#ffd9a8", "#eef6ff", "#cfc6b4", "#b9c9d6"];

    var particles = [];
    var ready = false;
    var scatter = 0, scatterTarget = 0, raf = null;

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
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";

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
      particles = [];
      var step = Math.max(2, Math.round(3 * DPR));
      for(var y = 0; y < h * DPR; y += step){
        for(var x = 0; x < w * DPR; x += step){
          var alpha = data[(y * w * DPR + x) * 4 + 3];
          if(alpha > 120){
            particles.push({
              ox: x / DPR, oy: y / DPR,
              angle: Math.random() * Math.PI * 2,
              dist: 30 + Math.random() * 150,
              speed: 0.3 + Math.random() * 0.7,
              phase: Math.random() * Math.PI * 2,
              size: (0.7 + Math.random() * 1.5) * DPR,
              color: PALETTE[(Math.random() * PALETTE.length) | 0]
            });
          }
        }
      }
      ready = particles.length > 0;
    }

    function draw(){
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if(!ready) return;
      var t = performance.now() * 0.001;
      var ease = scatter * (2 - scatter); // ease-out quad, smooth spread
      ctx.save();
      ctx.scale(DPR, DPR);
      for(var i = 0; i < particles.length; i++){
        var p = particles[i];
        var jitter = 2.5 * scatter;
        var dx = Math.cos(p.angle) * p.dist * ease + Math.cos(t * p.speed + p.phase) * jitter;
        var dy = Math.sin(p.angle) * p.dist * ease + Math.sin(t * p.speed * 0.8 + p.phase) * jitter;
        ctx.globalAlpha = Math.max(0, 1 - ease * 0.25);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.ox + dx, p.oy + dy, p.size / DPR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function loop(){
      scatter += (scatterTarget - scatter) * 0.055;
      var h1 = activeH1();
      var fade = Math.min(1, scatter * 1.6);
      if(h1) h1.style.opacity = String(Math.max(0, 1 - fade));
      canvas.style.opacity = String(fade);
      draw();
      if(Math.abs(scatterTarget - scatter) > 0.002 || scatter > 0.002){
        raf = requestAnimationFrame(loop);
      }else{
        scatter = 0;
        if(h1) h1.style.opacity = "";
        canvas.style.opacity = "0";
        raf = null;
      }
    }
    function ensureLoop(){ if(!raf){ raf = requestAnimationFrame(loop); } }

    wrap.addEventListener("mouseenter", function(){
      if(!ready) buildParticles();
      scatterTarget = 1;
      ensureLoop();
    });
    wrap.addEventListener("mouseleave", function(){
      scatterTarget = 0;
      ensureLoop();
    });

    document.addEventListener("refraction:lang-changed", function(){
      ready = false;
      var h1 = activeH1();
      if(h1) h1.style.opacity = "";
      canvas.style.opacity = "0";
      scatter = 0; scatterTarget = 0;
    });

    var resizeTimer;
    window.addEventListener("resize", function(){
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function(){ ready = false; }, 200);
    });

    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(buildParticles);
    }else{
      setTimeout(buildParticles, 300);
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
