const express = require("express");
const router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  console.log('ix');console.log(req.session);
  res.render("index", { title: "Express McHello Worlds App" });
});

module.exports = router;
