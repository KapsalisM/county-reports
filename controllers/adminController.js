import * as User from "../models/userModel.js";
import * as Report from "../models/reportModel.js";

// GET /admin
export async function getAdmin(req, res) {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    const stats = {
      totalUsers: await User.getTotalUsers(),
      totalReports: await Report.getTotalReports(),
      openReports: await Report.getOpenReports(),
      solvedReports: await Report.getSolvedReports()
    };
    const reports = await Report.getAllReports();
    const users = await User.getAllUsers();

    res.render("admin.ejs", {
      user: req.user,
      stats,
      reports,
      users
    });
  } catch (err) {
    console.log(err);
  }
}

// POST /admin/delete-user/:id
export async function deleteUser(req, res) {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    await User.deleteUser(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.log(err);
  }
}