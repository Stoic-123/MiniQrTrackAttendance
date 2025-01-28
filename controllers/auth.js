const db = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, "Long secret", { expiresIn: "2d" });
};
const signUpPost = async (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please provide name, email, and password" });
  }

  const salt = await bcrypt.genSalt();
  const hashPassword = await bcrypt.hash(password, salt);
  let sql = "insert into authqr(`email`,`password`) values(?,?)";
  db.query(sql, [email, hashPassword], (err, data) => {
    if (err) {
      res.json({ error: "Invalid data..!" });
    }
    res.json({ message: "User created successfully", userId: data.insertId });
  });
};
const loginPost = (req, res) => {
  let { email, password } = req.body;
  let sql = "Select * from authqr where email =? ";
  db.query(sql, [email], async (err, data) => {
    if (err) {
      console.log(err);
    }
    if (data.length == 0) {
      res.json({ message: "Invalid email or password..!" });
    }
    let comparePassword = await bcrypt.compare(password, data[0].password);
    if (comparePassword) {
      const token = generateToken(data[0].id, data[0].role);
      res.cookie("jwt", token, {
        maxAge: 3 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      });
      res.json({
        message: "Login successfully...",
        token,
        role: data[0].role,
        staff_id: data[0].id,
      });
    } else {
      res.json({ message: "Invalid password.." });
    }
  });
};
const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 1 });
  res.status(200).json("Logout successfully...");
};
module.exports = { signUpPost, loginPost, logout };
