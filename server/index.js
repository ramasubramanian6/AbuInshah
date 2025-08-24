const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: true }));

// Example route
app.get("/", (req, res) => {
  res.send("Hello from Firebase Functions API!");
});

// ✅ Export Express app as a function
exports.api = functions.https.onRequest(app);
