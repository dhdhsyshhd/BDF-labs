const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const cors = require("cors");

const app = express();

// Enable CORS for cross-origin frontend-to-backend communication
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Middleware to catch malformed JSON payloads and return a clean 400 error
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ message: "Invalid JSON payload" });
    }
    next();
});

const dbPath = path.join(__dirname, "bookStore.db");
let db = null;

// Allowlist for sorting fields to avoid SQL injection
const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER = ["ASC", "DESC"];

// Initialize SQLite database and start Express server
const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        // Ensure table exists with correct schema
        await db.exec(`
            CREATE TABLE IF NOT EXISTS book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                price INTEGER NOT NULL,
                pages INTEGER NOT NULL
            );
        `);

        // Check if database needs initial seed data
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
        const server = app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

        // Debugging fix: Handle EADDRINUSE gracefully
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(`Port ${PORT} is already in use. Please terminate the conflicting process or set PORT environment variable.`);
                process.exit(1);
            } else {
                console.error(`Server error: ${err.message}`);
            }
        });

    } catch (error) {
        console.error(`DB Initialization Error: ${error.message}`);
        process.exit(1);
    }
};

initializeDBAndServer();

// ==========================================
// FRONTEND & DASHBOARD ROUTE (GET /)
// ==========================================
app.get("/", async (req, res) => {
    // If client is asking for JSON (API client), return API status
    if (!req.accepts("html") && req.accepts("json")) {
        return res.status(200).json({
            message: "Lab 03 REST API is running. Access /books for book endpoints.",
            endpoints: ["GET /books", "GET /books/:id", "POST /books", "PUT /books/:id", "DELETE /books/:id", "GET /about", "GET /time"]
        });
    }

    try {
        const books = await db.all("SELECT * FROM book ORDER BY id ASC");
        const apiBaseUrl = process.env.API_BASE_URL || "";

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab 03: REST API, Query Params & Validation - Talakonda Bharath</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #e0e0e0; padding: 25px 20px; }
        .container { max-width: 1050px; margin: 0 auto; background: #1e1e1e; border: 1px solid #333; border-radius: 10px; padding: 26px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); }
        .header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
        h1 { font-size: 22px; color: #ffffff; display: flex; align-items: center; }
        .header-badge { background: #0cbb52; color: #000; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; vertical-align: middle; margin-left: 10px; }
        .student-card { background: #252526; padding: 12px 18px; border-radius: 6px; margin: 14px 0 20px 0; border-left: 4px solid #097bed; }
        .student-card p { margin: 3px 0; font-size: 13.5px; color: #ccc; }
        .student-card strong { color: #fff; }

        /* Filter Controls */
        .controls-card { background: #181818; border: 1px solid #2d2d2d; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .controls-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: end; }
        .control-group { display: flex; flex-direction: column; gap: 5px; }
        .control-group label { font-size: 12px; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .control-group input, .control-group select { background: #252526; border: 1px solid #3d3d3d; border-radius: 5px; color: #fff; padding: 8px 12px; font-size: 13.5px; outline: none; }
        .control-group input:focus, .control-group select:focus { border-color: #097bed; }
        .btn-group { display: flex; gap: 8px; }
        button { cursor: pointer; border: none; border-radius: 5px; font-size: 13px; font-weight: 600; padding: 8px 14px; transition: 0.2s; }
        .btn-primary { background: #097bed; color: #fff; }
        .btn-primary:hover { background: #0060c0; }
        .btn-success { background: #0cbb52; color: #000; }
        .btn-success:hover { background: #0a9d44; }
        .btn-secondary { background: #333; color: #ccc; }
        .btn-secondary:hover { background: #444; color: #fff; }
        .btn-danger { background: #eb4d4b; color: #fff; padding: 4px 8px; font-size: 11.5px; }
        .btn-danger:hover { background: #c0392b; }
        .btn-edit { background: #ff8c00; color: #000; padding: 4px 8px; font-size: 11.5px; }
        .btn-edit:hover { background: #e67e00; }

        /* Alert notifications */
        .alert { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; display: none; }
        .alert-success { background: rgba(12, 187, 82, 0.15); border: 1px solid #0cbb52; color: #4ade80; }
        .alert-error { background: rgba(235, 77, 75, 0.15); border: 1px solid #eb4d4b; color: #ff6b6b; }

        /* Table */
        .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; padding: 10px 12px; background: #252526; color: #ff8c00; font-weight: 600; border-bottom: 2px solid #333; }
        td { padding: 10px 12px; border-bottom: 1px solid #282828; }
        tr:hover td { background: #222; }

        /* Pagination Controls */
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #2d2d2d; font-size: 13px; color: #aaa; }

        /* Endpoints Box */
        .endpoints-box { margin-top: 24px; background: #181818; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; }
        .endpoints-box h2 { font-size: 15px; color: #fff; margin-bottom: 10px; }
        .endpoints-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .endpoints-list li { font-size: 12.5px; font-family: monospace; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .endpoints-list a { color: #569cd6; text-decoration: none; font-weight: bold; background: #252526; padding: 3px 8px; border-radius: 4px; }
        .endpoints-list a:hover { text-decoration: underline; background: #333; }
        .pill-get { background: #0cbb52; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10.5px; }
        .pill-post { background: #ff8c00; color: #000; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10.5px; }
        .pill-put { background: #097bed; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10.5px; }
        .pill-del { background: #eb4d4b; color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10.5px; }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; width: 90%; max-width: 440px; padding: 22px; }
        .modal h3 { font-size: 16px; margin-bottom: 14px; color: #fff; }
        .modal-fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
        .modal-fields input { background: #252526; border: 1px solid #3d3d3d; border-radius: 5px; color: #fff; padding: 8px 12px; font-size: 13.5px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📖 Lab 03: REST API &amp; Books Dashboard <span class="header-badge">LIVE REST API</span></h1>
            <button class="btn-success" onclick="openAddModal()">+ Add New Book</button>
        </div>

        <div class="student-card">
            <p><strong>Course:</strong> Backend Development Fundamentals · Year II Term II · Aurora</p>
            <p><strong>Student:</strong> Talakonda Bharath &nbsp;|&nbsp; <strong>Reg No:</strong> 252U1R9156 &nbsp;|&nbsp; <strong>Section:</strong> CSE-GAI-2C</p>
            <p><strong>API Base:</strong> <code id="apiBaseDisplay">Same-Origin (Local / Hosted)</code></p>
        </div>

        <div id="alertSuccess" class="alert alert-success"></div>
        <div id="alertError" class="alert alert-error"></div>

        <!-- Query Parameters & Controls -->
        <div class="controls-card">
            <form id="filterForm" onsubmit="event.preventDefault(); applyFilters();" class="controls-grid">
                <div class="control-group">
                    <label>Search Title (search_q)</label>
                    <input type="text" id="searchQ" placeholder="e.g. fire, potter, habits...">
                </div>
                <div class="control-group">
                    <label>Sort By (order_by)</label>
                    <select id="orderBy">
                        <option value="id" selected>ID</option>
                        <option value="title">Title</option>
                        <option value="author">Author</option>
                        <option value="price">Price</option>
                        <option value="pages">Pages</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Order</label>
                    <select id="orderDir">
                        <option value="ASC" selected>Ascending (ASC)</option>
                        <option value="DESC">Descending (DESC)</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Min Price</label>
                    <input type="number" id="minPrice" placeholder="Min ₹" min="0">
                </div>
                <div class="control-group">
                    <label>Max Price</label>
                    <input type="number" id="maxPrice" placeholder="Max ₹" min="0">
                </div>
                <div class="control-group">
                    <label>Page Size (limit)</label>
                    <select id="pageLimit">
                        <option value="5">5 books</option>
                        <option value="10" selected>10 books</option>
                        <option value="20">20 books</option>
                    </select>
                </div>
                <div class="btn-group">
                    <button type="submit" class="btn-primary">Apply</button>
                    <button type="button" class="btn-secondary" onclick="resetFilters()">Reset</button>
                </div>
            </form>
        </div>

        <div class="table-header">
            <h2 id="booksHeader" style="font-size: 16px; color: #fff;">Books Table</h2>
            <span id="resultCount" style="font-size: 13px; color: #888;"></span>
        </div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">ID</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th style="width: 100px;">Price</th>
                        <th style="width: 100px;">Pages</th>
                        <th style="width: 120px;">Actions</th>
                    </tr>
                </thead>
                <tbody id="booksTableBody">
                    <tr><td colspan="6" style="text-align:center; padding: 20px; color:#888;">Loading books...</td></tr>
                </tbody>
            </table>
        </div>

        <div class="pagination-bar">
            <div>Offset: <span id="currentOffset">0</span></div>
            <div class="btn-group">
                <button class="btn-secondary" id="prevPageBtn" onclick="prevPage()" disabled>&larr; Previous</button>
                <button class="btn-secondary" id="nextPageBtn" onclick="nextPage()">Next &rarr;</button>
            </div>
        </div>

        <!-- Endpoints documentation & links -->
        <div class="endpoints-box">
            <h2>Lab 03 REST Endpoints (Query Parameters &amp; Validation)</h2>
            <ul class="endpoints-list">
                <li><span class="pill-get">GET</span> <a href="/books" target="_blank">/books</a> <span>- Retrieve books (supports ?search_q=&amp;order_by=&amp;order=&amp;limit=&amp;offset=&amp;min_price=&amp;max_price=)</span></li>
                <li><span class="pill-get">GET</span> <a href="/books?order_by=price&order=ASC" target="_blank">/books?order_by=price&amp;order=ASC</a> <span>- Books sorted by price ascending</span></li>
                <li><span class="pill-get">GET</span> <a href="/books?min_price=300&max_price=500" target="_blank">/books?min_price=300&amp;max_price=500</a> <span>- Books in price range ₹300-₹500</span></li>
                <li><span class="pill-get">GET</span> <a href="/books/1" target="_blank">/books/1</a> <span>- Retrieve single book by ID</span></li>
                <li><span class="pill-get">GET</span> <a href="/about" target="_blank">/about</a> <span>- Student credentials JSON (Lab 1 compatibility)</span></li>
                <li><span class="pill-get">GET</span> <a href="/time" target="_blank">/time</a> <span>- Server timestamp JSON (Lab 1 compatibility)</span></li>
                <li><span class="pill-post">POST</span> <span style="background:#252526; padding:3px 8px; border-radius:4px; color:#fff;">/books</span> <span>- Add book (Validates required title, author, price &gt;= 0)</span></li>
                <li><span class="pill-put">PUT</span> <span style="background:#252526; padding:3px 8px; border-radius:4px; color:#fff;">/books/:id</span> <span>- Update book (Validates body &amp; verifies existence)</span></li>
                <li><span class="pill-del">DELETE</span> <span style="background:#252526; padding:3px 8px; border-radius:4px; color:#fff;">/books/:id</span> <span>- Delete book (Verifies existence)</span></li>
            </ul>
        </div>
    </div>

    <!-- Add/Edit Modal -->
    <div id="bookModal" class="modal-overlay">
        <div class="modal">
            <h3 id="modalTitle">Add New Book</h3>
            <form id="modalForm" onsubmit="event.preventDefault(); submitBookModal();">
                <input type="hidden" id="modalBookId">
                <div class="modal-fields">
                    <input type="text" id="modalBookTitle" placeholder="Book Title *" required>
                    <input type="text" id="modalBookAuthor" placeholder="Author *" required>
                    <input type="number" id="modalBookPrice" placeholder="Price (₹) *" min="0" required>
                    <input type="number" id="modalBookPages" placeholder="Pages" min="1" value="200">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn-primary" id="modalSubmitBtn">Save Book</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        let currentOffset = 0;

        function showAlert(msg, isSuccess = true) {
            const successEl = document.getElementById("alertSuccess");
            const errorEl = document.getElementById("alertError");
            if (isSuccess) {
                errorEl.style.display = "none";
                successEl.textContent = msg;
                successEl.style.display = "block";
                setTimeout(() => { successEl.style.display = "none"; }, 4000);
            } else {
                successEl.style.display = "none";
                errorEl.textContent = msg;
                errorEl.style.display = "block";
                setTimeout(() => { errorEl.style.display = "none"; }, 5000);
            }
        }

        async function fetchBooks() {
            const searchQ = document.getElementById("searchQ").value.trim();
            const orderBy = document.getElementById("orderBy").value;
            const orderDir = document.getElementById("orderDir").value;
            const minPrice = document.getElementById("minPrice").value;
            const maxPrice = document.getElementById("maxPrice").value;
            const limit = document.getElementById("pageLimit").value;

            const params = new URLSearchParams();
            if (searchQ) params.append("search_q", searchQ);
            if (orderBy) params.append("order_by", orderBy);
            if (orderDir) params.append("order", orderDir);
            if (minPrice !== "") params.append("min_price", minPrice);
            if (maxPrice !== "") params.append("max_price", maxPrice);
            params.append("limit", limit);
            params.append("offset", currentOffset);

            document.getElementById("currentOffset").textContent = currentOffset;

            try {
                const res = await fetch(\`\${API_BASE}/books?\${params.toString()}\`);
                const data = await res.json();

                if (!res.ok) {
                    showAlert(data.message || "Failed to load books", false);
                    return;
                }

                const tbody = document.getElementById("booksTableBody");
                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color:#888;">No books match the given query criteria.</td></tr>';
                    document.getElementById("nextPageBtn").disabled = true;
                    document.getElementById("resultCount").textContent = "0 books";
                    return;
                }

                document.getElementById("resultCount").textContent = \`Showing \${data.length} books\`;
                document.getElementById("prevPageBtn").disabled = (currentOffset === 0);
                document.getElementById("nextPageBtn").disabled = (data.length < parseInt(limit));

                tbody.innerHTML = data.map(b => \`
                    <tr>
                        <td style="color:#ff8c00; font-weight:bold;">\${b.id}</td>
                        <td style="color:#fff; font-weight:600;">\${b.title}</td>
                        <td style="color:#aaa;">\${b.author}</td>
                        <td style="color:#0cbb52; font-weight:600;">₹\${b.price}</td>
                        <td style="color:#569cd6;">\${b.pages} pages</td>
                        <td>
                            <button class="btn-edit" onclick="openEditModal(\${b.id}, '\${b.title.replace(/'/g, "\\\\'")}', '\${b.author.replace(/'/g, "\\\\'")}', \${b.price}, \${b.pages})">Edit</button>
                            <button class="btn-danger" onclick="deleteBook(\${b.id})">Delete</button>
                        </td>
                    </tr>
                \`).join("");

            } catch (err) {
                showAlert("Network error connecting to API: " + err.message, false);
            }
        }

        function applyFilters() {
            currentOffset = 0;
            fetchBooks();
        }

        function resetFilters() {
            document.getElementById("searchQ").value = "";
            document.getElementById("orderBy").value = "id";
            document.getElementById("orderDir").value = "ASC";
            document.getElementById("minPrice").value = "";
            document.getElementById("maxPrice").value = "";
            document.getElementById("pageLimit").value = "10";
            currentOffset = 0;
            fetchBooks();
        }

        function prevPage() {
            const limit = parseInt(document.getElementById("pageLimit").value);
            if (currentOffset >= limit) {
                currentOffset -= limit;
                fetchBooks();
            }
        }

        function nextPage() {
            const limit = parseInt(document.getElementById("pageLimit").value);
            currentOffset += limit;
            fetchBooks();
        }

        function openAddModal() {
            document.getElementById("modalTitle").textContent = "Add New Book";
            document.getElementById("modalBookId").value = "";
            document.getElementById("modalBookTitle").value = "";
            document.getElementById("modalBookAuthor").value = "";
            document.getElementById("modalBookPrice").value = "";
            document.getElementById("modalBookPages").value = "200";
            document.getElementById("bookModal").style.display = "flex";
        }

        function openEditModal(id, title, author, price, pages) {
            document.getElementById("modalTitle").textContent = "Edit Book #" + id;
            document.getElementById("modalBookId").value = id;
            document.getElementById("modalBookTitle").value = title;
            document.getElementById("modalBookAuthor").value = author;
            document.getElementById("modalBookPrice").value = price;
            document.getElementById("modalBookPages").value = pages;
            document.getElementById("bookModal").style.display = "flex";
        }

        function closeModal() {
            document.getElementById("bookModal").style.display = "none";
        }

        async function submitBookModal() {
            const id = document.getElementById("modalBookId").value;
            const title = document.getElementById("modalBookTitle").value.trim();
            const author = document.getElementById("modalBookAuthor").value.trim();
            const price = parseFloat(document.getElementById("modalBookPrice").value);
            const pages = parseInt(document.getElementById("modalBookPages").value) || 100;

            const isEdit = Boolean(id);
            const url = isEdit ? \`\${API_BASE}/books/\${id}\` : \`\${API_BASE}/books\`;
            const method = isEdit ? "PUT" : "POST";

            try {
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, author, price, pages })
                });
                const data = await res.json();
                if (!res.ok) {
                    showAlert(data.message || "Validation failed", false);
                    return;
                }
                closeModal();
                showAlert(data.message || (isEdit ? "Book updated successfully" : "Book added successfully"), true);
                fetchBooks();
            } catch (err) {
                showAlert("Error submitting book: " + err.message, false);
            }
        }

        async function deleteBook(id) {
            if (!confirm(\`Are you sure you want to delete book #\${id}?\`)) return;

            try {
                const res = await fetch(\`\${API_BASE}/books/\${id}\`, { method: "DELETE" });
                const data = await res.json();
                if (!res.ok) {
                    showAlert(data.message || "Failed to delete book", false);
                    return;
                }
                showAlert(data.message || "Book deleted successfully", true);
                fetchBooks();
            } catch (err) {
                showAlert("Error deleting book: " + err.message, false);
            }
        }

        // Initialize table on load
        fetchBooks();
    </script>
</body>
</html>`);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// 1. GET /books - Search, Sort, Filter, Paginate
// ==========================================
app.get(["/books", "/books/"], async (req, res) => {
    try {
        let {
            search_q = "",
            order_by = "id",
            order = "ASC",
            limit = 10,
            offset = 0,
            min_price,
            max_price
        } = req.query;

        // Validation: order_by allowlist
        const sanitizedOrderBy = String(order_by).toLowerCase();
        if (!ALLOWED_ORDER_BY.includes(sanitizedOrderBy)) {
            return res.status(400).json({
                message: `Invalid order_by field. Allowed fields: ${ALLOWED_ORDER_BY.join(", ")}`
            });
        }

        // Validation: order direction allowlist
        const sanitizedOrder = String(order).toUpperCase();
        if (!ALLOWED_ORDER.includes(sanitizedOrder)) {
            return res.status(400).json({
                message: "Invalid order parameter, must be ASC or DESC"
            });
        }

        // Validation: limit
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 50) {
            return res.status(400).json({
                message: "Invalid limit parameter. Must be an integer between 1 and 50"
            });
        }

        // Validation: offset
        const parsedOffset = Number(offset);
        if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
            return res.status(400).json({
                message: "Invalid offset parameter. Must be a non-negative integer"
            });
        }

        // Price filter validations
        let parsedMinPrice = null;
        let parsedMaxPrice = null;

        if (min_price !== undefined) {
            parsedMinPrice = Number(min_price);
            if (!Number.isFinite(parsedMinPrice) || parsedMinPrice < 0) {
                return res.status(400).json({
                    message: "Invalid min_price parameter. Must be a non-negative number"
                });
            }
        }

        if (max_price !== undefined) {
            parsedMaxPrice = Number(max_price);
            if (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0) {
                return res.status(400).json({
                    message: "Invalid max_price parameter. Must be a non-negative number"
                });
            }
        }

        if (parsedMinPrice !== null && parsedMaxPrice !== null && parsedMinPrice > parsedMaxPrice) {
            return res.status(400).json({
                message: "min_price cannot be greater than max_price"
            });
        }

        // Build parameterized SQL query
        const conditions = [];
        const params = [];

        // Partial title search
        if (search_q && String(search_q).trim() !== "") {
            conditions.push("title LIKE ?");
            params.push(`%${String(search_q).trim()}%`);
        }

        // Price range filter
        if (parsedMinPrice !== null && parsedMaxPrice !== null) {
            conditions.push("price BETWEEN ? AND ?");
            params.push(parsedMinPrice, parsedMaxPrice);
        } else if (parsedMinPrice !== null) {
            conditions.push("price >= ?");
            params.push(parsedMinPrice);
        } else if (parsedMaxPrice !== null) {
            conditions.push("price <= ?");
            params.push(parsedMaxPrice);
        }

        let whereClause = "";
        if (conditions.length > 0) {
            whereClause = ` WHERE ${conditions.join(" AND ")}`;
        }

        const query = `
            SELECT * FROM book
            ${whereClause}
            ORDER BY ${sanitizedOrderBy} ${sanitizedOrder}
            LIMIT ? OFFSET ?;
        `;

        params.push(parsedLimit, parsedOffset);

        const books = await db.all(query, params);

        // Retrieve total count for headers
        const countQuery = `SELECT COUNT(*) AS total FROM book ${whereClause};`;
        const countParams = params.slice(0, -2);
        res.setHeader("Access-Control-Expose-Headers", "X-Total-Count");
        const countRow = await db.get(countQuery, countParams);
        if (countRow) {
            res.setHeader("X-Total-Count", countRow.total);
        }

        return res.status(200).json(books);

    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// 2. GET /books/:id - Retrieve Book by ID
// ==========================================
app.get(["/books/:id", "/books/:id/"], async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT * FROM book WHERE id = ?;`;
        const book = await db.get(query, [id]);

        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }

        return res.status(200).json(book);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// 3. POST /books - Create New Book (Validation)
// ==========================================
app.post(["/books", "/books/"], async (req, res) => {
    try {
        const { title, author, price, pages } = req.body;

        // Validation: title
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({ message: "Title is required" });
        }

        // Validation: author
        if (typeof author !== "string" || author.trim() === "") {
            return res.status(400).json({ message: "Author is required" });
        }

        // Validation: price
        const parsedPrice = Number(price);
        if (price === undefined || price === null || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: "Price must be a non-negative number" });
        }

        // Pages: default to 100 if omitted or validate positive integer
        let parsedPages = 100;
        if (pages !== undefined && pages !== null) {
            parsedPages = Number(pages);
            if (!Number.isInteger(parsedPages) || parsedPages <= 0) {
                return res.status(400).json({ message: "Pages must be a positive integer" });
            }
        }

        const query = `
            INSERT INTO book (title, author, price, pages)
            VALUES (?, ?, ?, ?);
        `;

        const result = await db.run(query, [
            title.trim(),
            author.trim(),
            parsedPrice,
            parsedPages
        ]);

        return res.status(201).json({
            message: "Book added successfully",
            id: result.lastID
        });

    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// 4. PUT /books/:id - Update Book (Validation)
// ==========================================
app.put(["/books/:id", "/books/:id/"], async (req, res) => {
    try {
        const { id } = req.params;

        // Verify book existence first
        const existingBook = await db.get(`SELECT * FROM book WHERE id = ?;`, [id]);
        if (!existingBook) {
            return res.status(404).json({ message: "Book not found" });
        }

        const { title, author, price, pages } = req.body;

        // Validation: title
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({ message: "Title is required" });
        }

        // Validation: author
        if (typeof author !== "string" || author.trim() === "") {
            return res.status(400).json({ message: "Author is required" });
        }

        // Validation: price
        const parsedPrice = Number(price);
        if (price === undefined || price === null || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: "Price must be a non-negative number" });
        }

        // Pages
        let parsedPages = existingBook.pages;
        if (pages !== undefined && pages !== null) {
            parsedPages = Number(pages);
            if (!Number.isInteger(parsedPages) || parsedPages <= 0) {
                return res.status(400).json({ message: "Pages must be a positive integer" });
            }
        }

        const query = `
            UPDATE book
            SET title = ?, author = ?, price = ?, pages = ?
            WHERE id = ?;
        `;

        await db.run(query, [
            title.trim(),
            author.trim(),
            parsedPrice,
            parsedPages,
            id
        ]);

        return res.status(200).json({ message: "Book updated successfully" });

    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// 5. DELETE /books/:id - Delete Book
// ==========================================
app.delete(["/books/:id", "/books/:id/"], async (req, res) => {
    try {
        const { id } = req.params;

        // Verify book existence first
        const existingBook = await db.get(`SELECT * FROM book WHERE id = ?;`, [id]);
        if (!existingBook) {
            return res.status(404).json({ message: "Book not found" });
        }

        await db.run(`DELETE FROM book WHERE id = ?;`, [id]);

        return res.status(200).json({ message: "Book deleted successfully" });

    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
});

// ==========================================
// COMPATIBILITY ROUTES (LAB 1 COMPATIBILITY)
// ==========================================
app.get("/about", (req, res) => {
    res.status(200).json({
        name: "Talakonda Bharath",
        registrationNumber: "252U1R9156",
        section: "CSE-GAI-2C"
    });
});

app.get("/time", (req, res) => {
    res.status(200).json({
        currentDateTime: new Date()
    });
});

// Catch-all 404 for unknown routes
app.use((req, res) => {
    if (req.accepts("html")) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>404 Not Found</title></head>
            <body style="font-family: sans-serif; background:#121212; color:#fff; text-align:center; padding:50px;">
                <h1>404 - Not Found</h1>
                <p>The requested route does not exist.</p>
                <p><a href="/" style="color:#097bed;">Return to Home Dashboard</a></p>
            </body>
            </html>
        `);
    }
    return res.status(404).json({ message: "Route not found" });
});

module.exports = app;
