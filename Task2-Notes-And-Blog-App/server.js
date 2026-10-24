// Local preview server: renders the same EJS views on every request.
const express = require("express");
const path = require("path");
const site = require("./site");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.render("index", site));

app.listen(PORT, () => console.log(`SimBlog Notes running at http://localhost:${PORT}`));
