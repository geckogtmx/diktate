const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('.'));

// Paths to Python scripts
const ROOT_DIR = path.resolve(__dirname, '../../');
const PYTHON_CMD = 'python'; // Assumes python is in PATH
const FETCH_SCRIPT = path.join(ROOT_DIR, 'python/tools/fetch_test_data.py');
const FEEDER_SCRIPT = path.join(ROOT_DIR, 'python/tools/audio_feeder.py');
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'tests/fixtures/downloads');

// helper to run python script and stream output
function runScript(res, scriptPath, args) {
    console.log(`Running: ${scriptPath} ${args.join(' ')}`);

    const child = spawn(PYTHON_CMD, [scriptPath, ...args], {
        cwd: ROOT_DIR // Run from root so relative paths work
    });

    // Send headers for streaming text
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    child.stdout.on('data', (data) => {
        res.write(data);
    });

    child.stderr.on('data', (data) => {
        res.write(`[STDERR] ${data}`);
    });

    child.on('close', (code) => {
        res.write(`\n[EXIT] Process finished with code ${code}`);
        res.end();
    });

    child.on('error', (err) => {
        res.write(`\n[ERROR] Failed to start process: ${err.message}`);
        res.end();
    });
}

// API: Fetch YouTube Data
app.post('/api/fetch', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send("Missing URL");
    runScript(res, FETCH_SCRIPT, [url]);
});

// API: Run Feeder
app.post('/api/run', (req, res) => {
    const { mode, file, count, loop, start_at } = req.body;
    const args = [];

    if (mode === 'last') {
        args.push('--last-download');
    } else if (mode === 'file' && file) {
        // Construct absolute path to fixture file
        const filePath = path.join(DOWNLOADS_DIR, file);
        args.push('--file', filePath);

        // Check for matching SRT
        const srtPath = filePath.replace('.wav', '.srt');
        if (fs.existsSync(srtPath)) {
            args.push('--subs', srtPath);
        }
    }

    if (loop) args.push('--loop');
    if (count) args.push('--count', count);
    if (start_at) args.push('--start-at', start_at);

    runScript(res, FEEDER_SCRIPT, args);
});

// API: List Files
app.get('/api/files', (req, res) => {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
        return res.json([]);
    }

    const files = fs.readdirSync(DOWNLOADS_DIR)
        .filter(f => f.endsWith('.wav'))
        .map(f => ({
            name: f,
            mtime: fs.statSync(path.join(DOWNLOADS_DIR, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

    res.json(files);
});

app.listen(PORT, () => {
    console.log(`Test Runner UI running at http://localhost:${PORT}`);
});
