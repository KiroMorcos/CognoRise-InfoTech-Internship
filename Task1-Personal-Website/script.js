(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("year").textContent = new Date().getFullYear();

  // Theme toggle
  var themeBtn = document.getElementById("themeToggle");
  function syncThemeBtn() {
    var dark = root.getAttribute("data-theme") === "dark";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  syncThemeBtn();
  themeBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    syncThemeBtn();
  });

  // Navigation
  var header = document.querySelector(".site-header");
  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("navMenu");
  var links = [].slice.call(document.querySelectorAll(".nav-link"));
  function setMenu(open) { menu.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); }
  toggle.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
  links.forEach(function (l) { l.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  document.addEventListener("click", function (e) { if (!header.contains(e.target)) setMenu(false); });
  window.addEventListener("resize", function () { if (innerWidth > 900) setMenu(false); });

  var sections = links.map(function (l) { return document.querySelector(l.getAttribute("href")); }).filter(Boolean);
  function onScroll() {
    header.classList.toggle("scrolled", scrollY > 10);
    var offset = header.offsetHeight + 80, current = sections[0];
    sections.forEach(function (s) { if (s.getBoundingClientRect().top - offset <= 0) current = s; });
    if (innerHeight + scrollY >= document.body.scrollHeight - 4) current = sections[sections.length - 1];
    links.forEach(function (l) { l.classList.toggle("active", l.getAttribute("href") === "#" + current.id); });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Scroll reveal
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else revealEls.forEach(function (el) { el.classList.add("visible"); });

  // Typing effect
  var typed = document.getElementById("typed");
  var roles = ["Computer Engineering Student.", "Backend Developer.", "AWS Certified Cloud Practitioner."]; // EDIT roles
  if (!reduce) {
    var r = 0, c = 0, del = false;
    (function tick() {
      var word = roles[r];
      c += del ? -1 : 1;
      typed.textContent = word.slice(0, c);
      var wait = del ? 40 : 85;
      if (!del && c === word.length) { del = true; wait = 1600; }
      else if (del && c === 0) { del = false; r = (r + 1) % roles.length; wait = 400; }
      setTimeout(tick, wait);
    })();
  }

  // Stats count-up
  var counters = document.querySelectorAll("[data-count]");
  if (!reduce && "IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        var el = en.target, end = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0), t0 = performance.now();
        (function step(now) {
          var p = Math.min((now - t0) / 1200, 1);
          el.textContent = (end * p).toFixed(dec);
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  // Project filters
  var filters = [].slice.call(document.querySelectorAll(".filter"));
  var cards = [].slice.call(document.querySelectorAll(".project-card"));
  var none = document.getElementById("noResults");
  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.dataset.filter, shown = 0;
      filters.forEach(function (b) { var on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
      cards.forEach(function (card) {
        var match = f === "all" || card.dataset.tags.split(" ").indexOf(f) > -1;
        card.hidden = !match;
        if (match) { shown++; card.classList.add("visible"); }
      });
      none.hidden = shown > 0;
    });
  });

  // Contact form: validation + Formspree
  var form = document.getElementById("contactForm");
  var status = document.getElementById("formStatus");
  var submitBtn = document.getElementById("submitBtn");
  var EMAIL_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

var EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "icloud.com", "me.com", "mac.com",
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "yahoo.ca", "yahoo.com.au", "ymail.com",
  "proton.me", "protonmail.com", "pm.me", "aol.com", "gmx.com", "gmx.net",
  "zoho.com", "fastmail.com", "hey.com", "mail.com", "yandex.com",
  "comcast.net", "att.net", "verizon.net"
]);

var rules = {
  name: function (v) { 
    return !v ? "Please enter your name." : 
           v.length < 2 ? "Name must be at least 2 characters." : 
           !/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(v) ? "Use letters, spaces, apostrophes, or hyphens only (no numbers)." : ""; 
  },
  email: function (v) { 
    if (!v) return "Please enter your email address."; 
    if (!EMAIL_RE.test(v)) return "Please enter a valid email address."; 
    var domain = v.toLowerCase().split("@").pop(); 
    return !EMAIL_DOMAINS.has(domain) ? "Please use a supported email provider (e.g. Gmail, Outlook, iCloud, Yahoo, or Proton Mail)." : ""; 
  },
  message: function (v) { 
    return !v ? "Please write a message." : 
           v.length < 10 ? "Message must be at least 10 characters." : ""; 
  }
};
  var inputs = [].slice.call(form.querySelectorAll("#name, #email, #message"));
  function validate(input) {
    var msg = rules[input.name](input.value.trim()), field = input.closest(".field");
    document.getElementById(input.id + "Error").textContent = msg;
    field.classList.toggle("invalid", !!msg);
    field.classList.toggle("valid", !msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  inputs.forEach(function (i) {
    i.addEventListener("blur", function () { validate(i); });
    i.addEventListener("input", function () { if (i.closest(".field").classList.contains("invalid")) validate(i); });
  });

  function setStatus(text, cls) { status.textContent = text; status.className = "form-status carlito " + (cls || ""); }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setStatus("");
    var first = null;
    inputs.forEach(function (i) { if (!validate(i) && !first) first = i; });
    if (first) { first.focus(); return; }

    if (form.action.indexOf("YOUR_FORM_ID") > -1) {
      setStatus("The form isn't connected yet — add your Formspree form ID in index.html.", "fail");
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        setStatus("Thanks! Your message was sent — I'll get back to you soon.", "success");
        form.reset();
        inputs.forEach(function (i) { i.closest(".field").classList.remove("valid", "invalid"); i.removeAttribute("aria-invalid"); });
      })
      .catch(function () { setStatus("Sorry, something went wrong. Please try again or email me directly.", "fail"); })
      .then(function () { submitBtn.disabled = false; submitBtn.textContent = "Send Message"; });
  });
})();
