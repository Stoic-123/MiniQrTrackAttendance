const express = require("express");
const cookieParser = require("cookie-parser");
const qrRoutes = require("./routes/qr");
const authRoutes = require("./routes/auth");
const app = express();
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
app.use("/", qrRoutes);
app.use(authRoutes);
app.get("/", (req, res) => {
  res.render("admin");
});
app.get("/scan", (req, res) => {
  res.render("scan");
});
app.get("/staff", (req, res) => {
  res.render("staff");
});
app.get("/login", (req, res) => {
  res.render("login"); // Render login.ejs
});
app.get("/signup", (req, res) => {
  res.render("signup"); // Render login.ejs
});
app.listen(9090, () => {
  console.log("http://localhost:9090");
});
