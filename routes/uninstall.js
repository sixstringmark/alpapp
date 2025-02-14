/**
 * /uninstall
 *
 * called when the store owner clicks to uninstall the app.
 */

var ii = require("../util/ick");

require('dotenv').config();

//var dd = ii.get_app_data();

const express = require("express"),
  router = express.Router(),
  BigCommerce = require("node-bigcommerce");

// const bigCommerce = new BigCommerce({
//   secret: dd.app_secret, // set in server control panel
//   responseType: "json"
// });

const bigCommerce = new BigCommerce({
  logLevel: "info",
  clientId: process.env.app_client, //"bhbr39ez9774t7hoe75utu1xybbkyv2" /*process.env.client_id*/, // set in  condesandbox server control panel
  secret: process.env.app_secret, //"b0de4c004fee96358785b87a35bc725cc09b19350c5a270eb387f9479aedbb0b" /*process.env.client_secret*/, // set in condesandbox server  control panel
  callback: process.env.callback, // "https://mcmarkio-bc.ngrok.io/auth" /*process.env.callback*/, // set in condesandbox server control pannel
  responseType: "json",
  headers: { "Accept-Encoding": "*" },
  apiVersion: "v3"
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
