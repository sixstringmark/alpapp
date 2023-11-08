/**
 * /uninstall
 *
 * called when the store owner clicks to uninstall the app.
 */

var ii = require("../util/ick");
var dd = ii.get_app_data();

const express = require("express"),
  router = express.Router(),
  BigCommerce = require("node-bigcommerce");

const bigCommerce = new BigCommerce({
  secret: dd.app_secret, // set in server control panel
  responseType: "json"
});

router.get("/", (req, res, next) => {
  console.log('uninstall.js');
  try {
    const data = bigCommerce.verify(req.query["signed_payload"]);

    var dd = ii.get_app_data();
    if (typeof data.user !== "undefined") {
      // ... code to remove user / store from app db ...
      delete dd.store_hash[data.store_hash]; // remove store hash from saved tokens
      ii.save_app_data(dd); // store updated config
    }
  } catch (err) {
    //next(err);
    console.log(err);
  }
});

module.exports = router;
