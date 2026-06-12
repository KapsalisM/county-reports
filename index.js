import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import bcrypt from "bcrypt";
import env from "dotenv";

import db from "./db.js";
import * as User from "./models/userModel.js";

// ─── ROUTES ──────────────────────────────────────────────
import reportRoutes from "./routes/reportRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
const port = 3000;
env.config();

app.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

// ─── HOME ROUTE ───────────────────────────────────────────
app.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT reports.*, users.email 
       FROM reports 
       JOIN users ON reports.user_id = users.id 
       ORDER BY reports.created_at DESC`
    );
    res.render("home.ejs", {
      reports: result.rows,
      user: req.user || null,
      reportsJson: JSON.stringify(result.rows)
    });
  } catch (err) {
    console.log(err);
  }
});

// ─── USE ROUTES ───────────────────────────────────────────
app.use("/", reportRoutes);
app.use("/", userRoutes);
app.use("/", adminRoutes);

// ─── PASSPORT LOCAL STRATEGY ─────────────────────────────
passport.use("local", new Strategy(async (username, password, cb) => {
  try {
    const user = await User.findUserByEmail(username);
    if (!user) return cb(null, false);
    bcrypt.compare(password, user.password, (err, valid) => {
      if (err) return cb(err);
      return valid ? cb(null, user) : cb(null, false);
    });
  } catch (err) {
    return cb(err);
  }
}));

// ─── PASSPORT GOOGLE STRATEGY ────────────────────────────
passport.use("google", new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    let user = await User.findUserByEmail(profile.email);
    if (!user) {
      user = await User.createUser(profile.email, "google");
    }
    return cb(null, user);
  } catch (err) {
    return cb(err);
  }
}));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

app.listen(port, () => console.log(`Server running on port ${port}`));