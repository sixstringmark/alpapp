const rsr = require("../util/RSRMappings");
const kinseys = require("../util/KinseysMappings");
const lipseys = require("../util/LipseysMappings");
const south = require("../util/SportsouthMappings");

var express = require("express");
var router = express.Router();
const { create } = require('xmlbuilder2');

var https = require("follow-redirects").https;
var fs = require("fs");
var ii = require("../util/ick");

/* GET ammofeed */
router.get("/", function (req, res, next) {
  //console.log(req.session);
  ick(req, res);
  //res.send("respond with a resource");
});

module.exports = router;

async function ick(req, res) {

  console.log('go ' + new Date().getTime());
  try {

    const creds = {
      client_id: "***",
      access_token: "***",
      hash: "***"
    };
    let bb = await ii.getBigCommerceBrands(creds.hash, creds.access_token, creds.client_id);
    let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);
    let ammocats = ii.get_ammunition_category_ids(cc);
    let q = 'limit=250&include=custom_fields&include_fields=id,name,is_visible,inventory_level,price,upc,custom_url,sku,categories&categories:in=' + ammocats.join(",");
    let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);
    // console.log(pp);




    // get started with top-levels
    const root = create({ version: '1.0' })
      .ele('productlist', { retailer: 'sportsmansfinest.com' });

    for (let i = 0; i < pp.data.length; i++) {
      let p = pp.data[i];
      if (!p.sku.endsWith(kinseys.importOptions.sku_tag)
        && !p.sku.endsWith(lipseys.importOptions.sku_tag)
        && !p.sku.endsWith(south.importOptions.sku_tag)
        && !p.sku.endsWith(rsr.importOptions.sku_tag)
        && p.is_visible) {
        // Get product data
        let title = p.name.substring(0,160);
        let brand_name = "SF";
        for( let b = 0; b < bb.data.length; b++) {
          if( bb.data[b].id == p.brand_id ) {
            brand_name = bb.data[b].name; 
          }
        }
        root
          .ele('product')
          .ele('type').txt('ammunition').up()
          .ele('title').txt(p.name).up()
          .ele('manufacturer').txt(brand_name).up()
          .ele('caliber').txt('38 Special').up()
          .ele('url').txt('https://sportsmansfinest.com' + p.custom_url.url).up()
          .ele('upc').txt(p.upc).up()
          .ele('grains').txt('').up()
          .ele('price').txt(p.price).up()
          .ele('rebate').txt('').up()
          .ele('numrounds').txt('30').up()
          .ele('shot_size').txt('').up()
          .ele('shell_length').txt('').up()
          .ele('purchaselimit').txt('10').up()
          .ele('condition').txt('new').up()
          .ele('casing').txt('brass').up()
          .up()
          ;
      }
    }
    // convert the XML tree to string
    let xmlData = root.end({ prettyPrint: true });
    //console.log(xxml);
    res.header('Content-Type', 'application/xml')
    res.status(200).send(xmlData)

    // res.render('relaunch', {
    //   //      data: f,
    //   message: 'Instance has been restarted - please relaunch the app from the Dashboard'
    // });
  } catch (e) {
    console.log(e);
    res.render('relaunch', {
      //      data: f,
      message: 'error ' + e
    });
  }
  console.log('doh ' + new Date().getTime());

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


