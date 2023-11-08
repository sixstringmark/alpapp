/**
 * /load
 *
 * Called when a store owner or user click to load the app
 */

const express = require("express");
const session = require("express-session");
const router = express.Router();
const BigCommerce = require("node-bigcommerce");

const ii = require("../util/ick");

const dd = ii.get_app_data();

const bigCommerce = new BigCommerce({
  clientId: dd.app_client, //"bhbr39ez9774t7hoe75utu1xybbkyv2" /*process.env.client_id*/, // set in  condesandbox server control panel
  secret: dd.app_secret, //"b0de4c004fee96358785b87a35bc725cc09b19350c5a270eb387f9479aedbb0b" /*process.env.client_secret*/, // set in condesandbox server  control panel
  responseType: "json",
  apiVersion: "v2"
});

router.get("/", (req, res, next) => {
  console.log('load.js');
  try {
    // verify request came from BigCommerce
    const data = bigCommerce.verify(req.query["signed_payload"]);
    if (typeof data.user !== "undefined") {
      //console.log('load data'); console.log(data.store_hash);
      console.log( "storing store hash in session:"+data.store_hash);
      req.session.mc_hash = data.store_hash;
      req.session.baby = 'boo';
      res.render('load', {
        post: {
          author: 'Alpine Supplier Feeds Configurator',
          image: 'https://picsum.photos/500/500',
          comments: []
        }
      });
    }
  } catch (err) { }
});

module.exports = router;
