const express = require("express");
const UserService = require("../services/UserService");
const CafeService = require("../services/CafeService");
const TokenService = require("../services/TokenService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password) => {
  if (!password || typeof password !== "string") return ["Password is required"];
  const errors = [];
  if (password.length < 8)            errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password))        errors.push("an uppercase letter");
  if (!/[a-z]/.test(password))        errors.push("a lowercase letter");
  if (!/[0-9]/.test(password))        errors.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("a special character");
  return errors;
};

// POST /auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const fields = {};

    if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0)
      fields.firstName = "First name is required";
    if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0)
      fields.lastName = "Last name is required";
    if (!email || typeof email !== "string" || !isValidEmail(email))
      fields.email = "A valid email address is required (e.g. user@example.com)";
    if (!password || typeof password !== "string") {
      fields.password = "Password is required";
    } else {
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0)
        fields.password = `Password must contain: ${passwordErrors.join(", ")}`;
    }

    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const existing = await UserService.findByEmail(email);
    if (existing)
      return res.status(409).json(errorResponse("EMAIL_CONFLICT", "An account with this email address already exists"));

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

// POST /auth/register-cafe
router.post("/register-cafe", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, cafeName, address, lat, lng, contactInfo } = req.body;
    const fields = {};

    if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0)
      fields.firstName = "First name is required";
    if (!lastName || typeof lastName !== "string" || lastName.trim().length === 0)
      fields.lastName = "Last name is required";
    if (!email || typeof email !== "string" || !isValidEmail(email))
      fields.email = "A valid email address is required (e.g. owner@example.com)";

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0)
      fields.password = typeof password !== "string" ? "Password is required" : `Password must contain: ${passwordErrors.join(", ")}`;

    if (!cafeName || typeof cafeName !== "string" || cafeName.trim().length === 0)
      fields.cafeName = "Cafe name is required";
    if (!address || typeof address !== "string" || address.trim().length === 0)
      fields.address = "Address is required";
    if (lat === undefined || lat === null || typeof lat !== "number" || lat < -90 || lat > 90)
      fields.lat = "A valid latitude between -90 and 90 is required";
    if (lng === undefined || lng === null || typeof lng !== "number" || lng < -180 || lng > 180)
      fields.lng = "A valid longitude between -180 and 180 is required";
    if (!contactInfo || typeof contactInfo !== "string" || contactInfo.trim().length === 0)
      fields.contactInfo = "Contact information is required";

    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const existing = await UserService.findByEmail(email);
    if (existing)
      return res.status(409).json(errorResponse("EMAIL_CONFLICT", "An account with this email address already exists"));

    const user = await UserService.createCafeOwner({ firstName, lastName, email, password });
    const cafe = await CafeService.createCafe({ ownerId: user._id, name: cafeName, address, lat, lng, contactInfo });

    return res.status(201).json({
      message: "Cafe registration submitted. Your account is pending admin approval.",
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, createdAt: user.createdAt },
      cafe: { id: cafe._id, name: cafe.name, location: cafe.location, contactInfo: cafe.contactInfo, activeStatus: cafe.activeStatus, createdAt: cafe.createdAt }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const fields = {};

    if (!email || typeof email !== "string" || email.trim().length === 0)
      fields.email = "Email is required";
    if (!password || typeof password !== "string" || password.length === 0)
      fields.password = "Password is required";
    if (Object.keys(fields).length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", fields));

    const user = await UserService.findByEmail(email);
    const dummyHash = "$2b$12$invalidhashfortimingprotectiononly000000000000000000000";
    const passwordMatch = user
      ? await UserService.verifyPassword(password, user.passwordHash)
      : await UserService.verifyPassword(password, dummyHash);

    if (!user || !passwordMatch)
      return res.status(401).json(errorResponse("INVALID_CREDENTIALS", "Invalid email or password"));

    if (user.accountStatus === "inactive")
      return res.status(401).json(errorResponse("ACCOUNT_INACTIVE", "This account has been deactivated"));

    const accessToken = TokenService.issueAccessToken({ id: user._id, role: user.role });
    const refreshToken = await TokenService.issueRefreshToken({ userId: user._id, role: user.role });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim().length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Refresh token is required"));

    const record = await TokenService.verifyRefreshToken(refreshToken);
    const accessToken = TokenService.issueAccessToken({ id: record.userId, role: record.role });

    return res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string" || refreshToken.trim().length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Refresh token is required"));

    await TokenService.revokeRefreshToken(refreshToken.trim());

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
