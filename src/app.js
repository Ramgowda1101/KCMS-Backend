// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const errorHandler = require("./middlewares/error.middleware");
const routes = require("./routes"); // ✅ Centralized router hub

const app = express();

// ===== Global Middlewares =====
app.use(helmet());               // security headers
app.use(cors());                 // CORS
app.use(express.json());         // JSON body parser
app.use(morgan("dev"));          // request logging

// ===== Routes =====
app.use("/api/v1", routes);      // all feature routes (auth, users, clubs, events, recruitments)

// ===== Health Check =====
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ===== Error Handler (last) =====
app.use(errorHandler);

module.exports = app;
