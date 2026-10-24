// Renders the EJS views to plain static HTML in /dist so the site can be hosted on GitHub Pages.
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const site = require("./site");

const out = path.join(__dirname, "dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(__dirname, "public"), out, { recursive: true });   // css/ + js/

ejs.renderFile(path.join(__dirname, "views", "index.ejs"), site, {}, (err, html) => {
    if (err) { console.error(err); process.exit(1); }
    fs.writeFileSync(path.join(out, "index.html"), html);
    fs.writeFileSync(path.join(out, ".nojekyll"), "");
    console.log("Built static site → dist/");
});
