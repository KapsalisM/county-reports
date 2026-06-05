import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import multer from "multer";
import path from "path";
import nodemailer from "nodemailer";
import { get } from "http";


const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
})




//ollama integration
async function getDangerLevel(title, description) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: `You are a system that classifies the danger level of community problem reports.
        
Based on this report, respond with ONLY one word: high, medium, or low.

Rules:
- high: immediate danger to people (fire, flood, gas leak, collapsed structure, fallen tree blocking road)
- medium: potential danger or major inconvenience (broken road, damaged infrastructure, clogged drain)
- low: minor issues (graffiti, noise, small potholes, aesthetic problems)

Title: ${title}
Description: ${description}

Respond with only one word (high, medium, or low):`,
        stream: false
      })
    });

    const data = await response.json();
    const result = data.response.trim().toLowerCase();

    // Make sure it only returns valid values
    if (["high", "medium", "low"].includes(result)) return result;
    return "low"; // default fallback

  } catch (err) {
    console.log("Ollama error:", err);
    return "low"; // fallback if Ollama is offline
  }
}


//app.get("/", (req, res) => res.render("home.ejs"));
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
      user: req.user || null
    });
  } catch (err) {
    console.log(err);
  }
});
app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

const storage = multer.diskStorage({
    destination: "public/uploads",
    filename:(req,file,cb)=>{
        cb(null,Date.now()+ path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ─── DASHBOARD ───────────────────────────────────────────

app.get("/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  try {
    const result = await db.query(
      `SELECT reports.*, users.email 
       FROM reports 
       JOIN users ON reports.user_id = users.id 
       ORDER BY reports.created_at DESC`
    );
    res.render("dashboard.ejs", {
      reports: result.rows,
      user: req.user
    });
  } catch (err) {
    console.log(err);
  }
});

// ─── SUBMIT REPORT ───────────────────────────────────────

app.post("/report",upload.single("image"), async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  const { title, description, category, address } = req.body;
  const latitude = req.body.latitude !== "" ? parseFloat(req.body.latitude) : null;
  const longitude = req.body.longitude !== "" ? parseFloat(req.body.longitude) : null;
  const image = req.file ? req.file.filename : null;//epistrefo null an den dwsw img
  //asking ollada 
  const danger_level = await getDangerLevel(title,description);
  console.log("Danger Level:",danger_level)
  try {
    await db.query(
      "INSERT INTO reports (user_id, title, description, category, image, danger_level, address ,latitude ,longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8 ,$9)",
      [req.user.id, title, description, category, image, danger_level, address , latitude, longitude]
    ); 
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
  }
});

// ─── ADMIN - DELETE REPORT ───────────────────────────────

app.post("/report/delete/:id", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    await db.query("DELETE FROM reports WHERE id = $1", [req.params.id]);
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
  }
});

// ─── ADMIN - MARK AS SOLVED ──────────────────────────────















// app.post("/report/solve/:id", async (req, res) => {
//   if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
//   try {
//     await db.query("UPDATE reports SET status = 'solved' WHERE id = $1", [req.params.id]);
//     res.redirect("/dashboard");
//   } catch (err) {
//     console.log(err);
//   }
// });
//nodemailer updated post request
app.post("/report/solve/:id", async (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    // Get the report and the user's email before updating
    const result = await db.query(
      `SELECT reports.*, users.email 
       FROM reports 
       JOIN users ON reports.user_id = users.id 
       WHERE reports.id = $1`,
      [req.params.id]
    );

    const report = result.rows[0];

    // Mark as solved in the database
    await db.query(
      "UPDATE reports SET status = 'solved' WHERE id = $1",
      [req.params.id]
    );

    // Sending email to the user who made the report
    await transporter.sendMail({
      from: `"County Reports" <${process.env.EMAIL_USER}>`,
      to: report.email,
      subject: "✅ Your report has been solved!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #198754;">Report Solved!</h2>
          <p>Hello,</p>
          <p>Your report has been reviewed and marked as solved by our team.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">📋 Report Details</h4>
            <p style="margin: 5px 0;"><strong>Title:</strong> ${report.title}</p>
            <p style="margin: 5px 0;"><strong>Category:</strong> ${report.category}</p>
            <p style="margin: 5px 0;"><strong>Description:</strong> ${report.description}</p>
          </div>
          <p>Thank you for helping improve our community!</p>
          <p style="color: #6c757d; font-size: 12px;">— County Reports Team</p>
        </div>
      `
    });

    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
  }
});




// ─── GOOGLE AUTH ─────────────────────────────────────────

app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

app.get("/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  })
);

//Login - register
app.post("/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",  // <-- was /secrets, now /dashboard
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  try {
    const checkResult = await db.query(
      "SELECT * FROM users WHERE email = $1", [email]
    );
    if (checkResult.rows.length > 0) {
      res.redirect("/login"); // <-- was req.redirect (bug!), now res.redirect
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) return console.error(err);
        const result = await db.query(
          "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
          [email, hash]
        );
        const user = result.rows[0];
        req.login(user, (err) => {
          if (err) return console.error(err);
          res.redirect("/dashboard"); // <-- was /secrets, now /dashboard
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// ─── PASSPORT STRATEGIES ─────────────────────────────────

passport.use("local", new Strategy(async (username, password, cb) => {
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1", [username]
    );
    if (result.rows.length === 0) return cb(null, false);
    const user = result.rows[0];
    bcrypt.compare(password, user.password, (err, valid) => {
      if (err) return cb(err);
      return valid ? cb(null, user) : cb(null, false);
    });
  } catch (err) {
    return cb(err);
  }
}));

passport.use("google", new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback", // <-- fixed URL
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1", [profile.email]
    );
    if (result.rows.length === 0) {
      const newUser = await db.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [profile.email, "google"]
      );
      return cb(null, newUser.rows[0]);
    } else {
      return cb(null, result.rows[0]);
    }
  } catch (err) {
    return cb(err);
  }
}));

app.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

app.listen(port, () => console.log(`Server running on port ${port}`));