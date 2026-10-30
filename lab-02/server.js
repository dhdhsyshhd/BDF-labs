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

// Optional root route for quick browser verification
app.get("/", (req, res) => {
    res.send("Book Store API is running. Use /books/ to view all books.");
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

module.exports = app;
