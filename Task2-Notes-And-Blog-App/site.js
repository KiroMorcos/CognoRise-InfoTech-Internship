// Shared template data — used by build.js (GitHub Pages) and server.js (local preview)
module.exports = {
  title: "SimBlog Notes — a simple notes app",
  description: "Create, search, edit and delete notes with Markdown. Everything is saved in your browser with LocalStorage.",
  brand: "SimBlog Notes",
  colors: ["plain", "green", "lime", "amber", "sky", "rose", "violet"],
  sorts: [["new", "Newest"], ["edited", "Recently edited"], ["old", "Oldest"], ["az", "A → Z"]],
  formats: [
    { f: "b", label: "Bold", html: "B" },
    { f: "i", label: "Italic", html: "<i>I</i>" },
    { f: "c", label: "Code", html: "&lt;/&gt;" },
    { f: "ul", label: "Bullet list", html: "• List" },
    { f: "ol", label: "Numbered list", html: "1. List" },
    { f: "q", label: "Quote", html: "❝" }
  ]
};
