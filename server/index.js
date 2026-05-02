require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const consumerRouter = require("./routes/consumer");
const cafeRouter = require("./routes/cafe");

const app = express();

// --- Middleware ---
app.use(express.json());

// --- Routes ---
app.get("/", (req, res) => {
  res.json({ message: "Reusable Cup Platform API" });
});

app.use("/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/consumer", consumerRouter);
app.use("/api/cafe", cafeRouter);

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "An unexpected error occurred"
    }
  });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
