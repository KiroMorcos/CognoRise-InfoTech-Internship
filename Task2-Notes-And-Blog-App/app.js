const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'notes.json');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Sample initial notes for first visit
const sampleNotes = [
    {
        id: '1',
        title: 'Welcome to Your Enhanced Notes App! 🚀',
        description: 'This app now supports pinning, tags, live character counters, sorting, and JSON backups. Try pressing "/" to search or "n" for a new note!',
        tags: ['Welcome', 'Tips'],
        pinned: true,
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
        id: '2',
        title: 'Mastering Node.js & Express',
        description: 'Building CRUD applications helps solidify routing, middleware, template engines like EJS, and data persistence paradigms.',
        tags: ['Coding', 'NodeJS'],
        pinned: false,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
        id: '3',
        title: 'UI/UX Design Principles',
        description: 'Clean typography, consistent spacing, intuitive visual hierarchy, and smooth micro-interactions make web apps delightful to use.',
        tags: ['Design', 'UIUX'],
        pinned: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString()
    }
];

function getNotes() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(sampleNotes, null, 2));
        return sampleNotes;
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const notes = JSON.parse(data);
        if (notes.length === 0 && !fs.existsSync(path.join(__dirname, 'data', '.initialized'))) {
            // If user deleted all notes, don't re-seed automatically per requirement ("won't come back once you delete them")
            fs.writeFileSync(path.join(__dirname, 'data', '.initialized'), 'true');
        }
        return notes;
    } catch (err) {
        return sampleNotes;
    }
}

function saveNotes(notes) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

// Routes
app.get('/', (req, res) => {
    const notes = getNotes();
    res.render('index', { notes });
});

app.get('/new', (req, res) => {
    res.render('new');
});

app.post('/new', (req, res) => {
    const { title, description, tags, pinned } = req.body;
    if (!title || !description) return res.redirect('/new');

    const notes = getNotes();
    const newNote = {
        id: Date.now().toString(),
        title: title.trim(),
        description: description.trim(),
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        pinned: pinned === 'on',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    saveNotes(notes);
    res.redirect('/');
});

app.get('/edit/:id', (req, res) => {
    const notes = getNotes();
    const note = notes.find(n => n.id === req.params.id);
    if (!note) return res.redirect('/');
    res.render('edit', { note });
});

app.post('/edit/:id', (req, res) => {
    const { title, description, tags, pinned } = req.body;
    const notes = getNotes();
    const index = notes.findIndex(n => n.id === req.params.id);

    if (index !== -1) {
        notes[index] = {
            ...notes[index],
            title: title.trim(),
            description: description.trim(),
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            pinned: pinned === 'on',
            updatedAt: new Date().toISOString()
        };
        saveNotes(notes);
    }
    res.redirect('/');
});

app.post('/delete/:id', (req, res) => {
    let notes = getNotes();
    notes = notes.filter(n => n.id !== req.params.id);
    saveNotes(notes);
    res.redirect('/');
});

app.post('/pin/:id', (req, res) => {
    const notes = getNotes();
    const note = notes.find(n => n.id === req.params.id);
    if (note) {
        note.pinned = !note.pinned;
        saveNotes(notes);
    }
    res.redirect('/');
});

// JSON Backup Export & Import routes
app.get('/export', (req, res) => {
    const notes = getNotes();
    res.setHeader('Content-disposition', 'attachment; filename=notes-backup.json');
    res.setHeader('Content-type', 'application/json');
    res.send(JSON.stringify(notes, null, 2));
});

app.post('/import', (req, res) => {
    try {
        const importedNotes = req.body;
        if (Array.isArray(importedNotes)) {
            saveNotes(importedNotes);
        }
    } catch (e) {
        console.error('Import failed', e);
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});