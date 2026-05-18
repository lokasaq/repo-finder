const express = require('express');
const cors = require('cors');
const path = require('path');
const { translate } = require('@vitalets/google-translate-api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/translate', async (req, res) => {
    try {
        const { text, to } = req.body;
        if (!text || !to) {
            return res.status(400).json({ error: 'text and to are required' });
        }
        const result = await translate(text, { to });
        res.json({ translated: result.text });
    } catch (err) {
        console.error('Translation error:', err.message);
        if (err.name === 'TooManyRequestsError') {
            res.status(429).json({ error: 'Too many requests. Please try again later.' });
        } else {
            res.status(500).json({ error: 'Translation failed' });
        }
    }
});

app.get('/api/proxy/github', async (req, res) => {
    try {
        const { q, per_page = 30 } = req.query;
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${per_page}&sort=stars&order=desc`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/proxy/gitlab', async (req, res) => {
    try {
        const { q, per_page = 30 } = req.query;
        const url = `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(q)}&per_page=${per_page}&order_by=stars&sort=desc`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/proxy/bitbucket', async (req, res) => {
    try {
        const { q } = req.query;
        const url = `https://api.bitbucket.org/2.0/repositories?q=name~"%${encodeURIComponent(q)}%"&sort=-updated_on`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
