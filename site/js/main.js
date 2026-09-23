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

  /* ---------------- Hero title: liquid-mirror hover distortion ---------------- */
  function initHeroDistort(){
    var wrap = document.querySelector(".hero-title-wrap");
    var disp = document.getElementById("hero-amalgam-disp");
    if(!wrap || !disp) return;

    var target = 0, current = 0, raf = null;

    function loop(){
      current += (target - current) * 0.08;
      disp.setAttribute("scale", current.toFixed(1));
      if(Math.abs(target - current) > 0.15){
        raf = requestAnimationFrame(loop);
      }else{
        disp.setAttribute("scale", String(target));
        raf = null;
      }
    }
    function ensureLoop(){
      if(!raf){ raf = requestAnimationFrame(loop); }
    }

    wrap.addEventListener("mouseenter", function(){
      target = 50;
      ensureLoop();
    });
    wrap.addEventListener("mousemove", function(e){
      var r = wrap.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      target = 42 + Math.sin((px + py) * 6) * 16;
      ensureLoop();
    });
    wrap.addEventListener("mouseleave", function(){
      target = 0;
      ensureLoop();
    });
  }

  document.addEventListener("DOMContentLoaded", function(){
    initLang();
    initHeader();
    initReveal();
    initParticles();
    initExperience();
    initVideoEmbed();
    initHeroDistort();
    initLightbox();
  });
})();
