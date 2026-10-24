(() => {
    "use strict";
    const $ = s => document.querySelector(s), KEY = "simblog.notes.v1", SEED = "simblog.seeded", THEME = "simblog.theme", VIEW = "simblog.view", DRAFTS = "simblog.drafts";
    const COLORS = [...document.querySelectorAll("#colors .sw")].map(b => b.dataset.c); if (!COLORS.length) COLORS.push("plain");
    const df = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
    const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    function h(t, a, ...k) { const e = document.createElement(t); for (const x in a || {}) { const v = a[x]; if (x === "class") e.className = v; else if (x.startsWith("on")) e.addEventListener(x.slice(2), v); else if (v != null && v !== false) e.setAttribute(x, v === true ? "" : v) } k.flat().forEach(c => c != null && e.append(c)); return e }
    const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(k, v); return true } catch (e) { return false } }, del(k) { try { localStorage.removeItem(k) } catch (e) { } } };

    /* ---------- toast (optional Undo action) ---------- */
    function toast(msg, o = {}) {
        const t = $("#toast"), ms = o.action ? 7000 : 2600; clearTimeout(toast.t); t.replaceChildren(h("span", {}, msg)); t.classList.remove("timed");
        if (o.action) t.append(h("button", { onclick: () => { clearTimeout(toast.t); t.classList.remove("show"); o.action() } }, o.label || "Undo"));
        t.append(h("i")); t.style.setProperty("--ms", ms + "ms"); void t.offsetWidth; t.classList.add("show"); if (o.action) t.classList.add("timed");
        toast.t = setTimeout(() => t.classList.remove("show"), ms)
    }

    /* ---------- markdown (escaped first → safe) ---------- */
    const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const inl = s => esc(s).split(/(`[^`]+`)/).map((p, i) => i % 2 ? `<code>${p.slice(1, -1)}</code>` : p
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>").replace(/~~(.+?)~~/g, "<del>$1</del>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')).join("");
    const LI = /^\s*([-*•]|\d+\.)\s+/;
    function md(src) {
        const L = src.replace(/\r/g, "").split("\n"), out = []; let i = 0, m;
        while (i < L.length) {
            const l = L[i];
            if (/^```/.test(l)) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out.push(`<pre><code>${esc(b.join("\n"))}</code></pre>`) }
            else if (m = l.match(/^(#{1,3})\s+(.*)/)) { out.push(`<h4 class="h${m[1].length}">${inl(m[2])}</h4>`); i++ }
            else if (LI.test(l)) { const o = /^\s*\d+\./.test(l), it = []; while (i < L.length && LI.test(L[i])) it.push(`<li>${inl(L[i++].replace(LI, ""))}</li>`); out.push(`<${o ? "ol" : "ul"}>${it.join("")}</${o ? "ol" : "ul"}>`) }
            else if (/^>\s?/.test(l)) { const b = []; while (i < L.length && /^>\s?/.test(L[i])) b.push(inl(L[i++].replace(/^>\s?/, ""))); out.push(`<blockquote>${b.join("<br>")}</blockquote>`) }
            else if (!l.trim()) i++;
            else { const b = []; while (i < L.length && L[i].trim() && !/^(```|#{1,3}\s|>\s?)/.test(L[i]) && !LI.test(L[i])) b.push(inl(L[i++])); out.push(`<p>${b.join("<br>")}</p>`) }
        }
        return out.join("")
    }

    /* ---------- storage (LocalStorage) ---------- */
    function clean(n) {
        if (!n || typeof n !== "object") return null; const title = String(n.title || "").trim().slice(0, 80), content = String(n.content || "").trim().slice(0, 5000); if (!title || !content) return null;
        const tags = [...new Set((Array.isArray(n.tags) ? n.tags : []).map(t => String(t).trim().toLowerCase().replace(/^#/, "").slice(0, 20)).filter(Boolean))].slice(0, 6);
        const c = Number(n.created) || Date.now(); return { id: String(n.id || uid()), title, content, tags, color: COLORS.includes(n.color) ? n.color : "plain", pinned: !!n.pinned, created: c, updated: Number(n.updated) || c }
    }
    function load() {
        let a = []; try { const r = JSON.parse(ls.get(KEY, "[]")); a = (Array.isArray(r) ? r : []).map(clean).filter(Boolean) } catch (e) { a = [] }
        if (!a.length && !ls.get(SEED)) {
            const n = Date.now(), D = 864e5; a = [
                { title: "Welcome to SimBlog Notes 👋", content: "Notes now support **Markdown**:\n\n- **bold**, *italic* and `inline code`\n- bullet and numbered lists\n- colours, pins and tags\n\nTry deleting me — you can **undo** it!", tags: ["welcome", "tips"], color: "green", pinned: true, created: n - D * .1 },
                { title: "Project ideas", content: "1. Habit tracker with streaks\n2. Recipe book with ingredient search\n3. Expense splitter for trips", tags: ["ideas"], color: "amber", created: n - D * 2 },
                { title: "Node.js study plan", content: "**Week 1:** modules and the event loop\n**Week 2:** Express routing\n\n```\nnode server.js\n```", tags: ["study", "nodejs"], color: "sky", created: n - D * 5 }].map(clean); ls.set(SEED, "1"); ls.set(KEY, JSON.stringify(a))
        }
        return a
    }
    let notes = load(), st = { q: "", tag: "", sort: "new", view: ls.get(VIEW, "grid") }, editing = null, viewing = null, color = "plain";
    function save() { if (ls.set(KEY, JSON.stringify(notes))) return true; toast("Couldn't save — browser storage is full or blocked"); return false }
    const find = id => notes.find(n => n.id === id);

    /* ---------- render ---------- */
    function visible() {
        const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
        return notes.filter(n => (!st.tag || n.tags.includes(st.tag)) && terms.every(t => (n.title + " " + n.content + " " + n.tags.join(" ")).toLowerCase().includes(t.replace(/^#/, ""))))
            .sort((a, b) => (b.pinned - a.pinned) || ({ new: b.created - a.created, edited: b.updated - a.updated, old: a.created - b.created, az: a.title.localeCompare(b.title) })[st.sort])
    }
    const when = n => df.format(n.created) + (n.updated - n.created > 6e4 ? " · edited " + df.format(n.updated) : "");
    function render() {
        const list = visible(), pins = notes.filter(n => n.pinned).length, words = notes.reduce((s, n) => s + n.content.split(/\s+/).length, 0);
        $("#stats").textContent = notes.length ? `${notes.length} note${notes.length > 1 ? "s" : ""} · ${pins} pinned · ${words} words` + (list.length !== notes.length ? ` · showing ${list.length}` : "") : "Nothing here yet — start with your first note.";
        const all = [...new Set(notes.flatMap(n => n.tags))].sort(); if (st.tag && !all.includes(st.tag)) st.tag = "";
        $("#tagBar").replaceChildren(...(all.length ? [h("button", { class: "chip" + (st.tag ? "" : " on"), onclick: () => setTag("") }, "All"), ...all.map(t => h("button", { class: "chip" + (st.tag === t ? " on" : ""), "aria-pressed": String(st.tag === t), onclick: () => setTag(t) }, "#" + t))] : []));
        $("#grid").className = "grid" + (st.view === "list" ? " list" : ""); $("#grid").replaceChildren(...list.map(card));
        const e = $("#empty"); e.hidden = list.length > 0;
        if (!list.length) e.replaceChildren(...(notes.length ? [h("h2", {}, "No notes match"), h("p", {}, "Try a different keyword or tag."), h("button", { class: "btn", onclick: () => { st.q = ""; st.tag = ""; $("#q").value = ""; render() } }, "Clear filters")] : [h("h2", {}, "No notes yet"), h("p", {}, "Capture an idea, a to-do or a draft post."), h("button", { class: "btn primary", onclick: () => openEditor() }, "+ Create your first note")]))
    }
    function card(n) {
        const ex = h("div", { class: "excerpt md" + (n.content.length > 260 || n.content.split("\n").length > 7 ? " long" : "") }); ex.innerHTML = md(n.content);
        return h("article", { class: "card", "data-c": n.color, onmousemove: e => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", e.clientX - r.left + "px"); e.currentTarget.style.setProperty("--my", e.clientY - r.top + "px") } },
            h("div", { class: "card-top" }, h("h3", {}, n.title), h("button", { class: "pinb" + (n.pinned ? " on" : ""), "aria-label": (n.pinned ? "Unpin " : "Pin ") + n.title, "aria-pressed": String(n.pinned), title: n.pinned ? "Unpin" : "Pin to top", onclick: () => pin(n.id) }, "📌")),
            ex, n.tags.length ? h("div", { class: "tags" }, n.tags.map(t => h("button", { class: "tag", onclick: () => setTag(t) }, "#" + t))) : null,
            h("div", { class: "card-foot" }, h("span", { class: "date" }, when(n)), h("div", { class: "acts" },
                h("button", { class: "link", onclick: () => view(n.id) }, "Read"), h("button", { class: "link", onclick: () => openEditor(n.id) }, "Edit"), h("button", { class: "link danger", onclick: () => del(n.id) }, "Delete"))))
    }
    function setTag(t) { st.tag = st.tag === t ? "" : t; render() }
    function pin(id) { const n = find(id); n.pinned = !n.pinned; save(); render(); if (viewing === id && $("#viewer").open) view(id, true) }
    function setView(v) { st.view = v; ls.set(VIEW, v); $("#vGrid").setAttribute("aria-pressed", v === "grid"); $("#vList").setAttribute("aria-pressed", v === "list"); render() }
    $("#vGrid").onclick = () => setView("grid"); $("#vList").onclick = () => setView("list");

    /* ---------- create / edit, validation, formatting, autosaved drafts ---------- */
    const ed = $("#editor"), F = { t: $("#title"), c: $("#content"), g: $("#tags") };
    const drafts = () => { try { return JSON.parse(ls.get(DRAFTS, "{}")) || {} } catch (e) { return {} } };
    const dkey = () => editing || "new";
    function counters() { $("#tc").textContent = F.t.value.length + "/80"; $("#cc").textContent = F.c.value.length + "/5000" }
    function setColor(c) { color = c; document.querySelectorAll(".sw").forEach(s => s.setAttribute("aria-checked", s.dataset.c === c)) }
    document.querySelectorAll("#colors .sw").forEach(b => b.onclick = () => { setColor(b.dataset.c); autosave() });
    let dt; function autosave() {
        clearTimeout(dt); dt = setTimeout(() => {
            const d = drafts(), v = { title: F.t.value, content: F.c.value, tags: F.g.value, color };
            if (!v.title.trim() && !v.content.trim() && !v.tags.trim()) { delete d[dkey()] } else d[dkey()] = v; ls.set(DRAFTS, JSON.stringify(d)); $("#ds").textContent = d[dkey()] ? "Draft autosaved ✓" : ""
        }, 400)
    }
    function clearDraft(k) { clearTimeout(dt); const d = drafts(); delete d[k]; ls.set(DRAFTS, JSON.stringify(d)) }
    function showPrev(on) { $("#prevBtn").setAttribute("aria-pressed", on); F.c.hidden = on; $("#prev").hidden = !on; if (on) $("#prev").innerHTML = md(F.c.value) || "<p style='color:var(--mu)'>Nothing to preview yet.</p>" }
    $("#prevBtn").onclick = () => showPrev($("#prevBtn").getAttribute("aria-pressed") !== "true");
    function openEditor(id) {
        editing = id || null; const n = id && find(id), d = drafts()[dkey()];
        $("#edTitle").textContent = n ? "Edit note" : "New note";
        const src = d || (n ? { title: n.title, content: n.content, tags: n.tags.join(", "), color: n.color } : { title: "", content: "", tags: "", color: "plain" });
        F.t.value = src.title; F.c.value = src.content; F.g.value = src.tags; setColor(src.color); $("#draftBar").hidden = !d; $("#ds").textContent = ""; showPrev(false);
        for (const k of ["title", "content"]) { $("#" + k + "Err").textContent = ""; $("#" + k).removeAttribute("aria-invalid") } counters(); ed.showModal(); F.t.focus()
    }
    $("#discard").onclick = () => { clearDraft(dkey()); $("#draftBar").hidden = true; const n = editing && find(editing); F.t.value = n ? n.title : ""; F.c.value = n ? n.content : ""; F.g.value = n ? n.tags.join(", ") : ""; setColor(n ? n.color : "plain"); counters(); showPrev(false); toast("Draft discarded") };
    function fmt(k) {
        const t = F.c, s = t.selectionStart, e = t.selectionEnd, v = t.value, sel = v.slice(s, e); let from = s, to = e, txt, a, b;
        const wrap = (p, q, ph) => { txt = p + (sel || ph) + q; a = from + p.length; b = a + (sel || ph).length };
        const lines = f => { from = v.lastIndexOf("\n", s - 1) + 1; const blk = v.slice(from, e); txt = blk.split("\n").map((x, i) => f(i) + x).join("\n"); a = from; b = from + txt.length };
        ({ b: () => wrap("**", "**", "bold text"), i: () => wrap("*", "*", "italic text"), c: () => sel.includes("\n") ? wrap("```\n", "\n```", "code") : wrap("`", "`", "code"), ul: () => lines(() => "- "), ol: () => lines(i => i + 1 + ". "), q: () => lines(() => "> ") })[k]();
        t.focus(); t.setRangeText(txt, from, to, "end"); t.setSelectionRange(a, b); t.dispatchEvent(new Event("input", { bubbles: true }))
    }
    document.querySelectorAll(".tb [data-f]").forEach(b => b.onclick = () => { showPrev(false); fmt(b.dataset.f) });
    function check() {
        let ok = true; const t = F.t.value.trim(), c = F.c.value.trim();
        const set = (el, err, msg) => { $("#" + err).textContent = msg; el.setAttribute("aria-invalid", !!msg); if (msg) ok = false };
        set(F.t, "titleErr", !t ? "Please enter a title." : ""); set(F.c, "contentErr", !c ? "Please write something in the description." : ""); return ok
    }
    $("#form").addEventListener("submit", e => {
        e.preventDefault(); if (!check()) { showPrev(false); (F.t.getAttribute("aria-invalid") === "true" ? F.t : F.c).focus(); return }
        const old = editing && find(editing), data = clean({ id: editing || uid(), title: F.t.value, content: F.c.value, tags: F.g.value.split(","), color, pinned: old ? old.pinned : false, created: old ? old.created : Date.now(), updated: Date.now() });
        if (old) notes[notes.indexOf(old)] = data; else notes.push(data);
        if (save()) { clearDraft(dkey()); ed.close(); render(); toast(old ? "Note updated" : "Note saved ✓") }
    });
    [F.t, F.c, F.g].forEach(el => el.addEventListener("input", () => { counters(); autosave(); if (el.getAttribute("aria-invalid") === "true") check() }));
    $("#cancel").onclick = () => { const d = drafts()[dkey()]; ed.close(); if (d) toast("Draft kept — it'll be here next time") }; $("#newBtn").onclick = () => openEditor();

    /* ---------- read / delete (confirm + undo) ---------- */
    const vw = $("#viewer");
    function view(id, keep) {
        const n = find(id); viewing = id; $("#vWrap").dataset.c = n.color; $("#vTitle").textContent = n.title; $("#vMeta").textContent = when(n); $("#vBody").innerHTML = md(n.content);
        $("#vTags").replaceChildren(...n.tags.map(t => h("span", { class: "tag" }, "#" + t))); $("#vPin").textContent = n.pinned ? "Unpin" : "📌 Pin"; if (!keep) vw.showModal()
    }
    $("#vPin").onclick = () => pin(viewing); $("#vEdit").onclick = () => { vw.close(); openEditor(viewing) }; $("#vDel").onclick = () => { vw.close(); del(viewing) }; $("#vClose").onclick = () => vw.close();
    const cf = $("#confirm");
    function del(id) {
        const n = find(id); $("#cMsg").textContent = `“${n.title}” will be deleted.`; cf.returnValue = ""; cf.showModal();
        cf.addEventListener("close", () => {
            if (cf.returnValue !== "ok") return; const idx = notes.indexOf(n); notes.splice(idx, 1);
            if (save()) { render(); toast("Note deleted", { action: () => { notes.splice(Math.min(idx, notes.length), 0, n); if (save()) { render(); toast("Note restored ✓") } } }) }
        }, { once: true })
    }
    document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close() }));

    /* ---------- search, sort, backup, theme, shortcuts ---------- */
    let to; $("#q").addEventListener("input", e => { clearTimeout(to); to = setTimeout(() => { st.q = e.target.value; render() }, 120) });
    $("#sort").onchange = e => { st.sort = e.target.value; render() };
    $("#export").onclick = () => { const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify({ app: "simblog", notes }, null, 2)], { type: "application/json" })), download: `simblog-notes-${new Date().toISOString().slice(0, 10)}.json` }); a.click(); URL.revokeObjectURL(a.href); toast("Backup downloaded") };
    $("#import").onchange = async e => {
        const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        try {
            const r = JSON.parse(await f.text()), arr = (Array.isArray(r) ? r : r.notes || []).map(clean).filter(Boolean), have = new Set(notes.map(n => n.id)), add = arr.filter(n => !have.has(n.id));
            notes.push(...add); if (save()) { render(); toast(add.length ? `Imported ${add.length} note${add.length > 1 ? "s" : ""}` : "Nothing new to import") }
        } catch (x) { toast("That file isn't a valid notes backup") }
    };
    function theme(t) { document.documentElement.dataset.theme = t; ls.set(THEME, t); $("#theme").textContent = t === "dark" ? "☀" : "☾"; $("#theme").setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode") }
    $("#theme").onclick = () => theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); theme(document.documentElement.dataset.theme);
    document.addEventListener("keydown", e => {
        if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.key === "/") { e.preventDefault(); $("#q").focus() } else if (e.key === "n") { e.preventDefault(); openEditor() }
    });
    $("#home").onclick = () => { st.q = ""; st.tag = ""; $("#q").value = ""; render(); window.scrollTo({ top: 0, behavior: "smooth" }) };
    setView(st.view === "list" ? "list" : "grid");
})();
