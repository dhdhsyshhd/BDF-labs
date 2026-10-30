const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "bookStore.db");

let db = null;

// Initialize database and start server
const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        // Ensure table exists and has seed data if fresh database
        await db.exec(`
            CREATE TABLE IF NOT EXISTS book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                price INTEGER NOT NULL,
                pages INTEGER NOT NULL
            );
        `);

        const countResult = await db.get(`SELECT COUNT(*) AS count FROM book;`);
        if (countResult && countResult.count === 0) {
            const initialBooks = [
                ["Wings of Fire", "A.P.J. Abdul Kalam", 250, 180],
                ["The Alchemist", "Paulo Coelho", 300, 208],
                ["Atomic Habits", "James Clear", 450, 320],
                ["Rich Dad Poor Dad", "Robert Kiyosaki", 350, 336],
                ["The Guide", "R.K. Narayan", 200, 220],
                ["Harry Potter", "J.K. Rowling", 500, 400],
                ["Think Like a Monk", "Jay Shetty", 400, 288],
                ["Ikigai", "Hector Garcia", 299, 194],
                ["Deep Work", "Cal Newport", 375, 296],
                ["The Discovery of India", "Jawaharlal Nehru", 550, 600]
            ];
            for (const b of initialBooks) {
                await db.run(
                    `INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);`,
                    b
                );
            }
        }

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.log(`DB Error: ${error.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

// Root route: Interactive Web Dashboard connecting student info, live database books, and API links
app.get("/", async (req, res) => {
    try {
        const books = await db.all("SELECT * FROM book ORDER BY id ASC");

        if (req.accepts("html")) {
            const bookRows = books
                .map(
                    (b) => `
                <tr style="border-bottom: 1px solid #2d2d2d;">
                    <td style="padding: 12px; font-weight: bold; color: #ff8c00;">${b.id}</td>
                    <td style="padding: 12px; font-weight: 600; color: #ffffff;">${b.title}</td>
                    <td style="padding: 12px; color: #aaaaaa;">${b.author}</td>
                    <td style="padding: 12px; color: #0cbb52; font-weight: 600;">₹${b.price}</td>
                    <td style="padding: 12px; color: #569cd6;">${b.pages} pages</td>
                </tr>`
                )
                .join("");

            return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab 02: SQLite Database & CRUD API - Talakonda Bharath</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #e0e0e0; padding: 30px 20px; }
        .container { max-width: 960px; margin: 0 auto; background: #1e1e1e; border: 1px solid #333; border-radius: 10px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .header-badge { background: #0cbb52; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; vertical-align: middle; margin-left: 10px; }
        h1 { font-size: 24px; color: #ffffff; display: flex; align-items: center; margin-bottom: 8px; }
        .student-card { background: #252526; padding: 14px 18px; border-radius: 6px; margin: 16px 0 24px 0; border-left: 4px solid #097bed; }
        .student-card p { margin: 4px 0; font-size: 14px; color: #ccc; }
        .student-card strong { color: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 14px; }
        th { text-align: left; padding: 12px; background: #252526; color: #ff8c00; font-weight: 600; border-bottom: 2px solid #333; }
        .endpoints-box { margin-top: 28px; background: #181818; border: 1px solid #2a2a2a; border-radius: 8px; padding: 18px; }
        .endpoints-box h2 { font-size: 16px; color: #fff; margin-bottom: 12px; }
        .endpoints-list { list-style: none; }
        .endpoints-list li { margin: 10px 0; font-size: 13px; font-family: monospace; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .endpoints-list a { color: #569cd6; text-decoration: none; font-weight: bold; background: #252526; padding: 4px 10px; border-radius: 4px; display: inline-block; }
        .endpoints-list a:hover { text-decoration: underline; background: #333; }
        .pill-get { background: #0cbb52; color: #000; padding: 2px 7px; border-radius: 3px; font-weight: bold; font-size: 11px; }
        .pill-post { background: #ff8c00; color: #000; padding: 2px 7px; border-radius: 3px; font-weight: bold; font-size: 11px; }
        .pill-put { background: #097bed; color: #fff; padding: 2px 7px; border-radius: 3px; font-weight: bold; font-size: 11px; }
        .pill-del { background: #eb4d4b; color: #fff; padding: 2px 7px; border-radius: 3px; font-weight: bold; font-size: 11px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 SQLite Books Management &amp; CRUD API <span class="header-badge">LIVE &amp; CONNECTED</span></h1>
        <div class="student-card">
            <p><strong>Course:</strong> Backend Development Fundamentals · Year II Term II · Aurora</p>
            <p><strong>Student:</strong> Talakonda Bharath &nbsp;|&nbsp; <strong>Reg No:</strong> 252U1R9156 &nbsp;|&nbsp; <strong>Section:</strong> CSE-GAI-2C</p>
        </div>

        <h2 style="font-size: 18px; color: #fff; margin-bottom: 8px;">Database Books (${books.length} records in bookStore.db)</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Price</th>
                    <th>Pages</th>
                </tr>
            </thead>
            <tbody>
                ${bookRows}
            </tbody>
        </table>

        <div class="endpoints-box">
            <h2>Interactive Endpoints</h2>
            <ul class="endpoints-list">
                <li><span class="pill-get">GET</span> <a href="/books/">/books/</a> <span>- Retrieve all books as JSON array</span></li>
                <li><span class="pill-get">GET</span> <a href="/books/1/">/books/1/</a> <span>- Retrieve single book (ID: 1 - Wings of Fire)</span></li>
                <li><span class="pill-get">GET</span> <a href="/books/2/">/books/2/</a> <span>- Retrieve single book (ID: 2 - The Alchemist)</span></li>
                <li><span class="pill-get">GET</span> <a href="/about">/about</a> <span>- Student details JSON</span></li>
                <li><span class="pill-get">GET</span> <a href="/time">/time</a> <span>- Current DateTime JSON</span></li>
                <li><span class="pill-post">POST</span> <span style="color:#fff; background:#252526; padding: 4px 10px; border-radius:4px;">/books/</span> <span>- Add new book (JSON body: title, author, price, pages)</span></li>
                <li><span class="pill-put">PUT</span> <span style="color:#fff; background:#252526; padding: 4px 10px; border-radius:4px;">/books/:bookId/</span> <span>- Update existing book by ID</span></li>
                <li><span class="pill-del">DELETE</span> <span style="color:#fff; background:#252526; padding: 4px 10px; border-radius:4px;">/books/:bookId/</span> <span>- Delete book by ID</span></li>
            </ul>
        </div>
    </div>
</body>
</html>`);
        }

        res.status(200).json(books);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// GET: Retrieve all books
app.get("/books/", async (req, res) => {
    try {
        const query = `SELECT * FROM book;`;
        const books = await db.all(query);
        res.send(books);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// GET: Retrieve a specific book
app.get("/books/:bookId/", async (req, res) => {
    try {
        const { bookId } = req.params;
        const query = `SELECT * FROM book WHERE id = ?;`;
        const book = await db.get(query, [bookId]);

        if (book === undefined) {
            res.status(404).send("Book Not Found");
        } else {
            res.send(book);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// POST: Add a new book
app.post("/books/", async (req, res) => {
    try {
        const { title, author, price, pages } = req.body;
        const query = `
            INSERT INTO book (title, author, price, pages)
            VALUES (?, ?, ?, ?);
        `;
        await db.run(query, [title, author, price, pages]);
        res.status(201).send("Book Added Successfully");
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// PUT: Update an existing book
app.put("/books/:bookId/", async (req, res) => {
    try {
        const { bookId } = req.params;
        const { title, author, price, pages } = req.body;

        const query = `
            UPDATE book
            SET title = ?, author = ?, price = ?, pages = ?
            WHERE id = ?;
        `;

        const result = await db.run(query, [
            title,
            author,
            price,
            pages,
            bookId,
        ]);

        if (result.changes === 0) {
            res.status(404).send("Book Not Found");
        } else {
            res.send("Book Updated Successfully");
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// DELETE: Remove a book
app.delete("/books/:bookId/", async (req, res) => {
    try {
        const { bookId } = req.params;
        const query = `DELETE FROM book WHERE id = ?;`;
        const result = await db.run(query, [bookId]);

        if (result.changes === 0) {
            res.status(404).send("Book Not Found");
        } else {
            res.send("Book Deleted Successfully");
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Student about info route
app.get("/about", (req, res) => {
    res.status(200).json({
        name: "Talakonda Bharath",
        registrationNumber: "252U1R9156",
        section: "CSE-GAI-2C"
    });
});

// Server time route
app.get("/time", (req, res) => {
    res.status(200).json({
        currentDateTime: new Date()
    });
});

module.exports = app;
