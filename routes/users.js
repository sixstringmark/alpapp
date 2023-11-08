var express = require("express");
var router = express.Router();
var https = require("follow-redirects").https;
var fs = require("fs");
var ii = require("../util/ick");

/* GET users listing. */
router.get("/", function (req, res, next) {
  //console.log(req.session);
  ick(req.cookies.mc_hash,res);
  //res.send("respond with a resource");
});

module.exports = router;

function ick(h,res) {

  try {
    mc_d = ick1(h, res);
  } catch (e) {
    console.log(e);
  }

}

function ick1(hash, res1) {
  var https = require('follow-redirects').https;
  var fs = require('fs');
  var ff = null;
  var dd = ii.get_app_data();


  var options = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products?keyword=canon',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash], 
      'X-Auth-Client': dd.app_client, 
    },
    'maxRedirects': 20
  };

  var req = https.request(options, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function (chunk) {
      var body = Buffer.concat(chunks);
      try {
        var jj = JSON.parse(body);
        //console.log(jj);
        ff = jj;
      } catch (e) {
        console.log(e);
      }  
      res1.render('home', {
        data: ff,
        post: {
          author: 'Results',
          image: 'https://picsum.photos/500/500',
          comments: []
        }
      });
    
    });

    res.on("error", function (error) {
      console.error(error);
    });
  });

  req.end();
  return ff;
}


