// Runs before first paint (no flash). Kept as an external file so the CSP can forbid inline scripts.
(function () {
  try {
    var saved = localStorage.getItem("tf.theme");
    var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = saved || (dark ? "dark" : "light");
  } catch (e) { /* storage blocked — keep default */ }
})();
