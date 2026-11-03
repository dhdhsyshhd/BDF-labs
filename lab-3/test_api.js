const http = require("http");

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });
        req.on("error", reject);
        if (data) {
            req.write(typeof data === "string" ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log("=== Lab 03 Test Suite ===");
    const app = require("./server.js");
    await new Promise(r => setTimeout(r, 1200));

    let passed = 0;
    let failed = 0;

    function assert(desc, condition, details = "") {
        if (condition) {
            console.log(`[PASS] ${desc}`);
            passed++;
        } else {
            console.error(`[FAIL] ${desc} - ${details}`);
            failed++;
        }
    }

    // 1. GET /books
    let res = await request({ hostname: "localhost", port: 3000, path: "/books", method: "GET" });
    assert("1. GET /books returns 200 and array", res.statusCode === 200 && Array.isArray(res.body), JSON.stringify(res.body));

    // 2. GET /books?search_q=fire
    res = await request({ hostname: "localhost", port: 3000, path: "/books?search_q=fire", method: "GET" });
    assert("2. GET /books?search_q=fire filters by title", res.statusCode === 200 && res.body.some(b => b.title.toLowerCase().includes("fire")));

    // 3. GET /books?order_by=price&order=ASC
    res = await request({ hostname: "localhost", port: 3000, path: "/books?order_by=price&order=ASC", method: "GET" });
    const pricesAsc = res.body.map(b => b.price);
    const isSortedAsc = pricesAsc.every((v, i, a) => !i || a[i - 1] <= v);
    assert("3. GET /books?order_by=price&order=ASC sorts ascending", res.statusCode === 200 && isSortedAsc);

    // 4. GET /books?order_by=price&order=DESC
    res = await request({ hostname: "localhost", port: 3000, path: "/books?order_by=price&order=DESC", method: "GET" });
    const pricesDesc = res.body.map(b => b.price);
    const isSortedDesc = pricesDesc.every((v, i, a) => !i || a[i - 1] >= v);
    assert("4. GET /books?order_by=price&order=DESC sorts descending", res.statusCode === 200 && isSortedDesc);

    // 5. GET /books?min_price=300&max_price=500
    res = await request({ hostname: "localhost", port: 3000, path: "/books?min_price=300&max_price=500", method: "GET" });
    const withinRange = res.body.every(b => b.price >= 300 && b.price <= 500);
    assert("5. GET /books?min_price=300&max_price=500 filters price range", res.statusCode === 200 && withinRange && res.body.length > 0);

    // 6. GET /books?limit=3&offset=2
    res = await request({ hostname: "localhost", port: 3000, path: "/books?limit=3&offset=2", method: "GET" });
    assert("6. GET /books?limit=3&offset=2 applies limit and offset", res.statusCode === 200 && res.body.length <= 3);

    // 7. GET /books/1
    res = await request({ hostname: "localhost", port: 3000, path: "/books/1", method: "GET" });
    assert("7. GET /books/1 returns single book", res.statusCode === 200 && res.body.id === 1);

    // 8. GET /books/999 (404)
    res = await request({ hostname: "localhost", port: 3000, path: "/books/999", method: "GET" });
    assert("8. GET /books/999 returns 404 Book not found", res.statusCode === 404 && res.body.message === "Book not found");

    // 9. POST /books valid creation
    const newBook = { title: "Test Node Book", author: "Test Dev", price: 420, pages: 250 };
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, newBook);
    const createdId = res.body.id;
    assert("9. POST /books creates book with 201 Created", res.statusCode === 201 && createdId > 0);

    // 10. POST /books missing title (400)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { author: "Missing Title", price: 100 });
    assert("10. POST /books missing title returns 400 Bad Request", res.statusCode === 400 && res.body.message.includes("Title"));

    // 11. POST /books missing author (400)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { title: "Some Title", price: 100 });
    assert("11. POST /books missing author returns 400 Bad Request", res.statusCode === 400 && res.body.message.includes("Author"));

    // 12. POST /books price as text (400)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { title: "Some Title", author: "Author", price: "free" });
    assert("12. POST /books invalid price text returns 400", res.statusCode === 400 && res.body.message.includes("Price"));

    // 13. POST /books negative price (400)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, { title: "Some Title", author: "Author", price: -50 });
    assert("13. POST /books negative price returns 400", res.statusCode === 400 && res.body.message.includes("Price"));

    // 14. GET /books?order_by=invalid_field (400)
    res = await request({ hostname: "localhost", port: 3000, path: "/books?order_by=malicious_col", method: "GET" });
    assert("14. GET with unsupported sort field returns 400", res.statusCode === 400 && res.body.message.includes("order_by"));

    // 15. GET /books?order=SIDEWAYS (400)
    res = await request({ hostname: "localhost", port: 3000, path: "/books?order=SIDEWAYS", method: "GET" });
    assert("15. GET with invalid order direction returns 400", res.statusCode === 400 && res.body.message.includes("order"));

    // 16. GET /books?min_price=600&max_price=200 (400)
    res = await request({ hostname: "localhost", port: 3000, path: "/books?min_price=600&max_price=200", method: "GET" });
    assert("16. GET with min_price > max_price returns 400", res.statusCode === 400 && res.body.message.includes("min_price cannot be greater"));

    // 17. GET /books?limit=-5 (400)
    res = await request({ hostname: "localhost", port: 3000, path: "/books?limit=-5", method: "GET" });
    assert("17. GET with negative limit returns 400", res.statusCode === 400 && res.body.message.includes("limit"));

    // 18. PUT /books/:id
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: `/books/${createdId}`,
        method: "PUT",
        headers: { "Content-Type": "application/json" }
    }, { title: "Test Node Book (Updated)", author: "Test Dev", price: 499, pages: 300 });
    assert("18. PUT /books/:id updates existing book with 200", res.statusCode === 200 && res.body.message.includes("updated"));

    // 19. PUT /books/999 (404)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books/999",
        method: "PUT",
        headers: { "Content-Type": "application/json" }
    }, { title: "Title", author: "Author", price: 100 });
    assert("19. PUT /books/999 non-existent returns 404", res.statusCode === 404 && res.body.message === "Book not found");

    // 20. DELETE /books/:id
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: `/books/${createdId}`,
        method: "DELETE"
    });
    assert("20. DELETE /books/:id deletes book with 200", res.statusCode === 200 && res.body.message.includes("deleted"));

    // 21. DELETE /books/999 (404)
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books/999",
        method: "DELETE"
    });
    assert("21. DELETE /books/999 non-existent returns 404", res.statusCode === 404 && res.body.message === "Book not found");

    // 22. GET /about (Lab 1 compatibility)
    res = await request({ hostname: "localhost", port: 3000, path: "/about", method: "GET" });
    assert("22. GET /about returns student details", res.statusCode === 200 && res.body.name === "Talakonda Bharath");

    // 23. GET /time (Lab 1 compatibility)
    res = await request({ hostname: "localhost", port: 3000, path: "/time", method: "GET" });
    assert("23. GET /time returns current datetime", res.statusCode === 200 && Boolean(res.body.currentDateTime));

    // 24. Malformed JSON handling
    res = await request({
        hostname: "localhost",
        port: 3000,
        path: "/books",
        method: "POST",
        headers: { "Content-Type": "application/json" }
    }, "{ broken json ");
    assert("24. Malformed JSON request body returns 400", res.statusCode === 400 && res.body.message === "Invalid JSON payload");

    console.log(`\nTests Completed: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
