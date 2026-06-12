import bcrypt from "bcrypt";
import * as User from "../models/userModel.js";

const saltRounds = 10;

// GET /login
export function getLogin(req, res) {
  res.render("login.ejs");
}

// GET /register
export function getRegister(req, res) {
  res.render("register.ejs");
}

// GET /logout
export function getLogout(req, res) {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
}

// POST /register
export async function postRegister(req, res) {
  const email = req.body.username;
  const password = req.body.password;
  try {
    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) return console.error(err);
        const user = await User.createUser(email, hash);
        req.login(user, (err) => {
          if (err) return console.error(err);
          res.redirect("/dashboard");
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
}