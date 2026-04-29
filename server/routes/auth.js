const express = require("express");
const UserService = require("../services/UserService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

// Validates email format: must contain @ with non-empty local and domain parts
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * POST /auth/register
 *
 * Register a new consumer account.
 *
 * Body:
 *   { firstName: string, lastName: string, email: string, password: string }
 *
 * Responses:
 *   201 - Account created successfully
 *   400 - Validation error (missing/invalid fields)
 *   409 - Email already registered
 */
router.post("/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // --- Input validation ---
    const fields = {};

    if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
      fields.firstName = "First name is required";
    }

    if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0) {
      fields.lastName = "Last name is required";
    }

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      fields.email = "A valid email address is required (e.g. user@example.com)";
    }

    if (!password || typeof password !== "string") {
      fields.password = "Password is required";
    } else {
      const passwordErrors = [];
      if (password.length < 8)            passwordErrors.push("at least 8 characters");
      if (!/[A-Z]/.test(password))        passwordErrors.push("an uppercase letter");
      if (!/[a-z]/.test(password))        passwordErrors.push("a lowercase letter");
      if (!/[0-9]/.test(password))        passwordErrors.push("a number");
      if (!/[^A-Za-z0-9]/.test(password)) passwordErrors.push("a special character");
      if (passwordErrors.length > 0) {
        fields.password = `Password must contain: ${passwordErrors.join(", ")}`;
      }
    }

    if (Object.keys(fields).length > 0) {
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));
    }

    // --- Duplicate email check ---
    const existing = await UserService.findByEmail(email);
    if (existing) {
      return res.status(409).json(
        errorResponse("EMAIL_CONFLICT", "An account with this email address already exists")
      );
    }

    // --- Create consumer account ---
    const user = await UserService.createConsumer({ firstName, lastName, email, password });

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
