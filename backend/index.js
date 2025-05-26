const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session"); // Added for Passport session support
const passport = require("passport");
const app = express();

require("dotenv").config();
require("./src/utilities/passport"); // Ensure this points to your Passport config

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads")); // Serve uploaded files
app.use(cors({ origin: "*" }));

// Session middleware for Passport
app.use(
  session({
    secret: process.env.JWT_SECRET || "your-session-secret", // Use JWT_SECRET or a fallback
    resave: false, // Corrected from resave.Amount
    saveUninitialized: false,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
const userRoutes = require("./src/Routes/user.routes");
app.use("/users", userRoutes);

const foldersRoutes = require("./src/Routes/folder.routes");
app.use("/folders", foldersRoutes);

const fileRoutes = require("./src/Routes/file.routes");
app.use("/files", fileRoutes);

// Google OAuth Routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    const { user, token } = req.user;
    // Redirect or send response with token
    res.status(200).json({
      code: 200,
      status: "success",
      message: "Logged in with Google successfully",
      data: { user, token },
    });
  }
);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    code: 500,
    status: "error",
    message: err.message || "Internal Server Error",
    data: null,
  });
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Listening to port ${PORT}`);
});