const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

// GET /
app.get("/", (req, res) => {
    res.status(200).send("Welcome to my Node.js and Express server!");
});

// GET /about
app.get("/about", (req, res) => {
    res.status(200).json({
        name: "Talakonda Bharath",
        registrationNumber: "252U1R9156",
        section: "CSE-GAI-2C"
    });
});

// GET /time
app.get("/time", (req, res) => {
    res.status(200).json({
        currentDateTime: new Date()
    });
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).send("404 - Page Not Found");
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
