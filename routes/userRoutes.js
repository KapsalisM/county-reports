import express from "express";
import passport from "passport";
import * as userController from "../controllers/userController.js";

const router = express.Router();

// ─── ROUTES ──────────────────────────────────────────────

router.get("/login", userController.getLogin);
router.get("/register", userController.getRegister);
router.get("/logout", userController.getLogout);

router.post("/register", userController.postRegister);
router.post("/login", passport.authenticate("local", {
  successRedirect: "/dashboard",
  failureRedirect: "/login",
}));

// Google OAuth
router.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));
router.get("/auth/google/callback", passport.authenticate("google", {
  successRedirect: "/dashboard",
  failureRedirect: "/login",
}));

export default router;