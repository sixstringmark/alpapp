/**
 * /remove_user
 *
 * Called when a single-click user should be removed
 */

const express = require("express");
const session = require("express-session");
const router = express.Router();
const BigCommerce = require("node-bigcommerce");

require('dotenv').config();

const ii = require("../util/ick");

const dd = ii.get_app_data();


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
  console.log('load.js');
  try {
    // verify request came from BigCommerce
    const data = bigCommerce.verify(req.query["signed_payload"]);
    if (typeof data.user !== "undefined") {
      //console.log('load data'); console.log(data.store_hash);
      console.log( "remove user", data);
      //req.session.mc_hash = data.store_hash;
      //req.session.baby = 'boo';
      //res.render('load', {
      //  post: {
      //    author: 'Alpine Supplier Feeds Configurator',
      //    image: 'https://picsum.photos/500/500',
      //    comments: []
      //  }
      //});
    }
    res.send("ok");
  } catch (err) { }
});

module.exports = router;
