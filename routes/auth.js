const express = require("express"),
  router = express.Router(),
  BigCommerce = require("node-bigcommerce");

const fs = require("fs");

const ii = require("../util/ick");

let dd = ii.get_app_data();

let rawdata = fs.readFileSync('../app_data/output.json');
let app_db = JSON.parse(rawdata);

/**
 * sandoxes are public on the web by default
 * do not hard-code any credentials here
 * use codesandbox environment variables
 */
const bigCommerce = new BigCommerce({
  logLevel: "info",
  clientId: app_db.app_client, //"bhbr39ez9774t7hoe75utu1xybbkyv2" /*process.env.client_id*/, // set in  condesandbox server control panel
  secret: app_db.app_secret, //"b0de4c004fee96358785b87a35bc725cc09b19350c5a270eb387f9479aedbb0b" /*process.env.client_secret*/, // set in condesandbox server  control panel
  callback: "https://mcmarkio-bc.ngrok.io/auth" /*process.env.callback*/, // set in condesandbox server control pannel
  responseType: "json",
  headers: { "Accept-Encoding": "*" },
  apiVersion: "v3"
});

router.get("/", (req, res, next) => {
  console.log("auth.js");
  bigCommerce
    .authorize(req.query)
    .then(data => {
      if (typeof data.access_token !== "undefined") {
        //===========================================================+
        // data.acces_token
        //
        // If authorize successful, data object will contain access_token
        // store securely in DB; use to make API request to BigCOmmerce
        // ==========================================================+

        const storeHash = data.context.split("/")[1];
        const sec = "";
        dd.store_hash[storeHash] = data.access_token;
        ii.save_app_data(dd);
        //res.send(
        //  `Authorization Successful<br><a href="https://store-${storeHash}.mybigcommerce.com/manage/marketplace/apps/my-apps">My Apps</a>`
        //);
        res.render('load', {
          //data: ff,
          post: {
            author: 'Alpine Supplier Feed Configurator',
            image: 'https://picsum.photos/500/500',
            comments: []
          }
        });
      } else {
        res.send("Authorization Failed");
      }
    })
    .catch(next);
});

module.exports = router;

