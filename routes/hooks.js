var express = require("express");
var router = express.Router();
var https = require("follow-redirects").https;
var fs = require("fs");
var ii = require("../util/ick");
const rsr = require("../util/RSRMappings");
const kinseys = require("../util/KinseysMappings");
const lipseys = require("../util/LipseysMappings");
const south = require("../util/SportsouthMappings");
const rsr_dropship = require("../util/rsr_drop_ship_processor");
const south_dropship = require("../util/south_drop_ship_processor");
const kinseys_dropship = require("../util/kinseys_drop_ship_processor");

var Client = require('ftp');
const ftp = require("basic-ftp");

const hbs = require('handlebars');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
var request = require('request');
const csv = require('csv-parser')
const stream = require("stream");
const stringify = require( 'csv-stringify/lib/sync' );
const upc_metafield_options = {
  "permission_set": "write",
  "key": "saved_catg",
  "namespace": "sf.catalog"
};


const nodemailer = require('nodemailer');

const { addAbortSignal } = require("stream");
const { redirect_generation } = require("../util/redirect_generation");
const signyfid_approval_note = "Signifyd: Guarantee Approved";
global.dropped_shipped_south = "Drop-ship processed for Sports South";
global.dropped_shipped_kinseys = "Drop-ship processed for Kinsey's";
const dropped_shipped_lipseys = "Drop-ship processed for Lipsey's";
global.dropped_shipped_rsr = "Drop-ship processed for RSR";
const dropship_test_flag = "mcmarkio dropship test";
global.in_store_pickup = "In-Store Pickup";
const notification_sender = { name: "Sportsman's Finest Order Notificaiions", address: "info@mckenzieduo.com" }; //"onlinesales@sportsmansfinest.com";
const notification_recipients_test = ['mark.mckenzie@herodigital.com', 'mark@mckenzieduo.com'];
const notification_recipients = [
  "onlinesales@sportsmansfinest.com",
  "mark.mckenzie@herodigital.com"];


// These are pretty much hard-wired into BigCommerce API, although store can have customized text
const orderStatues = {
  statusIncomplete: { id: 0, text: "An incomplete order happens when a shopper reached the payment page, but did not complete the transaction." },
  statusPending: { id: 1, text: "Customer started the checkout process, but did not complete it." },
  statusShipped: { id: 2, text: "Order has been shipped, but receipt has not been confirmed; seller has used the Ship Items action." },
  statusPartially: { id: 3, text: "Shipped	Only some items in the order have been shipped, due to some products being pre-order only or other reasons." },
  statusRefunded: { id: 4, text: "Seller has used the Refund action." },
  statusCancelled: { id: 5, text: "Seller has cancelled an order, due to a stock inconsistency or other reasons." },
  statusDeclined: { id: 6, text: "Seller has marked the order as declined for lack of manual payment, or other reasons." },
  statusAwaiting: { id: 7, text: "Payment	Customer has completed checkout process, but payment has yet to be confirmed." },
  statusAwaiting: { id: 8, text: "Pickup	Order has been pulled, and is awaiting customer pickup from a seller-specified location." },
  statusAwaiting: { id: 9, text: "Shipment	Order has been pulled and packaged, and is awaiting collection from a shipping provider." },
  statusCompleted: { id: 10, text: "Client has paid for their digital product and their file(s) are available for download." },
  statusAwaitingFulfillment: { id: 11, text: "Customer has completed the checkout process and payment has been confirmed." },
  statusManualVerificationRequired: { id: 12, text: "Order on hold while some aspect needs to be manually confirmed." },
  statusDisputed: { id: 13, text: "Customer has initiated a dispute resolution process for the PayPal transaction that paid for the order." },
  statusPartiallyRefunded: { id: 14, text: "Seller has partially refunded the order." }
};

const orderOpts = {
  auth_token: "***",
  auth_client: "***",
  hash: "***"
};

const rsrOpts = {
  username: "***",
  password: "***",
  pos: "***",
  hostname: "test.rsrgroup.com",
};

/* GET users listing. */
router.post("/", function (req, res, next) {
  //console.log(req.session);
  console.log('hooked ' + req.body);
  console.log(req.body);
  res.send("OK");

  if (req.body.scope == "store/order/statusUpdated") {
    console.log("can't play with this");
    //processOrderTransactionCreated(req.body.data.id);
    console.log(req.body);
  } else if (req.body.scope == 'generate_redirects') {
    generate_redirects(req.body);
  } else if (req.body.scope == "store/order/transaction/created" || req.body.scope == "test dropship") {
    console.log("can play with this");

    processOrderTransactionCreated(req.body);
  } else if (req.body.scope == "store/order/emailtest") {
    email_test(req.body.data.id);
  } else if (req.body.scope == "nuts") {
    console.log('Going South!');
    createSouthOrder(req.body.data.id);
  } else if (req.body.scope == "demox") {
    console.log('Demo scrub');
    demoScrub(req.body);
  } else if (req.body.scope == "upc_reset") {
    console.log('upc_reset');
    upc_reset(req.body);
  } else if (req.body.scope == "weight_fix") {
    console.log('weight_fix');
    weight_fix(req.body);
  } else if (req.body.scope == "add_shared_modifier") {
    console.log('add_shared_modifier');
    add_shared_modifier(req.body);
  } else if (req.body.scope == "oos_meta") {
    console.log('oos_meta');
    oos_meta(req.body);
  } else if (req.body.scope == "restore_supplier_catg") {
    console.log('restore_supplier_catg');
    restore_supplier_catg(req.body);
  } else if (req.body.scope == "convert_rsr_weights_to_pounds") {
    console.log('convert_rsr_weights_to_pounds');
    convert_rsr_weights_to_pounds(req.body);
  } else if (req.body.scope == "update_rsr_images") {
    console.log('update_rsr_images');
    update_rsr_images(req.body);
  } else if (req.body.scope == "purge_deleted") {
    console.log('purge_deleted');
    purge_deleted(req.body);
  }
});

module.exports = router;

async function processOrderTransactionCreated(body) {
  let orderId = body.data.order_id;
  let meth = "processOrderTransactionCreated";
  console.log(meth, "processing for order " + orderId);

  console.log(meth, "Order " + orderId + " getting order");
  let order = await ii.getOrder(orderOpts, orderId);
  console.log(meth, "Order " + orderId + " got order", order);

  /* 
    Requirements to trigger dropship processing:
    1. Must have Signyfid approval in Staff Notes
    2. Must have "capture" transaction or Customer Message contain dropship_test flag
    3. Must have items for a supplier that does not already have a dropship order in the Staff Notes 
  */

  // Gather information from the order Notes
  let dropship_common = {
    order_id: orderId,
    order_updated: false,
    updt: {
      "staff_notes": order.staff_notes,
      "products": [
        // {
        //   "id": 25,
        //   "merchant_name": ">>>UPD - Simms Headwaters BOA Wading Boot - Wetstone"
        // }
      ]
    },
    test_order: (order.customer_message.indexOf(dropship_test_flag) >= 0 || body.test_order),
    signyfid_approved: (order.staff_notes.indexOf(signyfid_approval_note) >= 0),
    staff_notes: [
      {
        "header_notes": ["Drop-Ship Summary for Order #" + orderId],
        "item_notes": []
      }
    ],
    bcAddressesById: {}
  };

  if (order && dropship_common.signyfid_approved && !order.order_is_digital) {

    console.log(meth, "Order " + orderId + " is approved and not digital");

    let order_captured = false;

    console.log(meth, "Order " + orderId + " getting transactions");

    let trans = await ii.getOrderTransactions(orderOpts, orderId);
    console.log(meth, "Order " + orderId + " got transactions", trans);
    if (trans && trans.data) {
      for (let i = 0; i < trans.data.length; i++) {
        if (trans.data[i].event == "capture") {
          order_captured = true;
          break;
        }
      }
    }
    if (!order_captured && !dropship_common.test_order) {
      console.log("nothing ready to process for order " + orderId);
      return;
    }

    console.log(meth, "Order " + orderId + " is captured or test order(" + dropship_common.test_order + ")");

    const st = {
      "year": "numeric", "hour12": false, "month": "2-digit", "day": "2-digit",
      "hour": "2-digit", "minute": "2-digit", "second": "2-digit"
    };
    let processed_time = new Date().toLocaleString(undefined, st);
    let email_info = {
      messages: [],
      errors: [],
      data: {
        order_id: orderId,
        date_time: processed_time,
        orders: []
      }
    };
    let rsrItemsByAddress = [];
    let southItemsByAddress = [];
    let kinseysItemsByAddress = [];
    let lipseysItemsByAddress = [];

    console.log(meth, "Order " + orderId + " getting addresses");
    let addr = await ii.getOrderAddresses(orderOpts, orderId);
    console.log(meth, "Order " + orderId + " got addresses", addr);
    for (let i = 0; i < addr.length; i++) {
      dropship_common.bcAddressesById[addr[i].id] = addr[i];
    }

    console.log(meth, "Order " + orderId + " getting products");
    let prod = await ii.getOrderProducts(orderOpts, orderId);
    console.log(meth, "Order " + orderId + " got products", prod);

    for (let i = 0; i < prod.length; i++) {
      if (prod[i].sku.endsWith(rsr.importOptions.sku_tag)) {
        if (!rsrItemsByAddress[prod[i].order_address_id]) {
          rsrItemsByAddress[prod[i].order_address_id] = [];
        }
        rsrItemsByAddress[prod[i].order_address_id].push(prod[i]);
      } else if (prod[i].sku.endsWith(kinseys.importOptions.sku_tag)) {
        if (!kinseysItemsByAddress[prod[i].order_address_id]) {
          kinseysItemsByAddress[prod[i].order_address_id] = [];
        }
        kinseysItemsByAddress[prod[i].order_address_id].push(prod[i]);
        //kinseysItemsByAddress[prod[i].order_address_id] = prod[i];
      } else if (prod[i].sku.endsWith(lipseys.importOptions.sku_tag)) {
        lipseysItemsByAddress[prod[i].order_address_id] = prod[i];
      } else if (prod[i].sku.endsWith(south.importOptions.sku_tag)) {
        if (!southItemsByAddress[prod[i].order_address_id]) {
          southItemsByAddress[prod[i].order_address_id] = [];
        }
        southItemsByAddress[prod[i].order_address_id].push(prod[i]);
      }
    }


    let rsr_processed = (order.staff_notes.indexOf(dropped_shipped_rsr) >= 0);
    let south_processed = (order.staff_notes.indexOf(dropped_shipped_south) >= 0);
    let kinseys_processed = (order.staff_notes.indexOf(dropped_shipped_kinseys) >= 0);


    if (!rsr_processed) {
      await rsr_dropship.process_rsr_orders(email_info, rsrItemsByAddress, dropship_common);
    }

    if (!south_processed) {
      await south_dropship.process_south_orders(email_info, southItemsByAddress, dropship_common);
    }

    if (!kinseys_processed) {
      await kinseys_dropship.process_kinseys_orders(email_info, kinseysItemsByAddress, dropship_common);
    }

    for (let id in lipseysItemsByAddress) {
      console.log("Lipsey's", id, lipseysItemsByAddress[id], dropship_common.bcAddressesById[id]);
    }


    if (dropship_common.order_updated) {
      // rework this for making sense with multi vendors
      let email_html = "<h1>Dropship for Order " + orderId + "</h1>";
      for (let i = 0; i < dropship_common.staff_notes.length; i++) {
        let ss = dropship_common.staff_notes[i];
        for (let j = 0; j < ss.header_notes.length; j++) {
          dropship_common.updt.staff_notes += "\n" + ss.header_notes[j] + "\n";
          email_html += '<div class="hdr">' + ii.escapeForHTML(ss.header_notes[j]) + "</div>";
        }
        for (let j = 0; j < ss.item_notes.length; j++) {
          dropship_common.updt.staff_notes += "\n" + ss.item_notes[j];
          email_html += '<div class="item">' + ii.escapeForHTML(ss.item_notes[j]) + "</div>";
        }
      }
      let uo = await ii.updateOrder(orderOpts, dropship_common.updt, orderId);
      console.log(uo);



      const tpl = fs.readFileSync('./views/dropship_notification.hbs', { encoding: 'utf-8' });

      const template = hbs.compile(tpl);

      const result = template(email_info);

      let mailOptions = {
        from: notification_sender,
        to: dropship_common.test_order ? notification_recipients_test : notification_recipients,
        subject: "Dropship for Order " + orderId,
        html: result
      };


      await ii.wrappedSendMail(mailOptions);
      console.log("sent");

    }

  }



}


function ick(h, res) {

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


async function email_test(orderId) {
  console.log('email_test - entry ');

  const tpl = fs.readFileSync('./views/dropship_notification.hbs', { encoding: 'utf-8' });

  const template = hbs.compile(tpl);

  let cost1 = 44.50;
  let cost2 = 1444.00;
  const result = template(
    {
      errors: [
        "None", "Some", "Many"
      ],
      messages: [
        "This", "And that"
      ],
      data: {
        order_id: "116",
        date_time: "2022/04/28 14:22:44",
        orders: [
          {
            supplier: "RSR",
            type: "Ship to customer",
            po_number: "116-R-1012",
            supplier_id: "1555",
            supplier_ref: "560005",
            total: "$55.88",
            order_outcome: "Order placed",
            order_items: [
              {
                qty_ack: 1,
                qty_req: 3,
                name: "Widget Table",
                sku: "W555",
                upc: "88899948881",
                cost: cost1.toLocaleString("en-US", { style: "currency", currency: "USD" }),
                shipping_method: "FedEx Ground",
                outcome: "Partially filled"
              },
              {
                qty_ack: 1,
                qty_req: 1,
                name: "Gun Cleaner",
                sku: "G000-555",
                upc: "88899948881",
                cost: cost2.toLocaleString("en-US", { style: "currency", currency: "USD" }),
                shipping_method: "FedEx Ground",
                outcome: "Filled"
              }


            ]
          },

          {
            supplier: "RSR",
            type: "Ship to store",
            po_number: "116-R-1022",
            supplier_id: "1556",
            supplier_ref: "567005",
            total: "$55.88",
            order_outcome: "Order placed",
            order_messages: [
              "Wow", "Pow"
            ],
            order_items: [
              {
                qty_ack: 1,
                qty_req: 3,
                name: "Widget Table",
                sku: "W555",
                upc: "88899948881",
                cost: "$44.20",
                shipping_method: "FedEx Ground",
                outcome: "Partially filled"
              },
              {
                qty_ack: 1,
                qty_req: 1,
                name: "Gun Cleaner",
                sku: "G000-555",
                upc: "88899948881",
                cost: "$10.00",
                shipping_method: "FedEx Ground",
                outcome: "Filled"
              }


            ]
          }
        ]
      }
    }
  );

  let mailOptions = {
    from: notification_sender,
    to: ["mark.mckenzie@herodigital.com"],
    subject: "Drop-Ship Processing for Order " + orderId,
    html: result
  };


  await ii.wrappedSendMail(mailOptions);

  console.log("sent");
}

async function createSouthOrder(orderId) {

  let dataAddHeader = {
    'PO': 'SF-6000-' + ("" + Math.random()).substring(2, 6),
    'CustomerOrderNumber': '55555',
    'SalesMessage': 'Test Order',
    'ShipVIA': "ground",
    'ShipToName': "McMarkio M",
    'ShipToAttn': '',
    'ShipToAddr1': '323 Galway Dr',
    'ShipToAddr2': '',
    'ShipToCity': 'Cary',
    'ShipToState': 'IL',
    'ShipToZip': '60013',
    'ShipToPhone': '8479628847',
    'AdultSignature': false,
    'Signature': false,
    'Insurance': false
  }
  console.log("PO is " + dataAddHeader.PO);
  let hh = await getAndParseSouthAPI("AddHeader", dataAddHeader);
  if (hh.int) {
    console.log("SS header order number is " + hh.int._);
  }
  console.log(hh);
}

async function getAndParseSouthAPI(api_path, api_props) {
  var options = {
    'method': 'POST',
    'url': "http://webservices.theshootingwarehouse.com/smart/orders.asmx/" + api_path,
    'headers': {
      'Accept': 'application/xml',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      'CustomerNumber': 99994, //sportsouth.importOptions.customer_number,
      'Password': 99999, //sportsouth.importOptions.password,
      'UserName': 99994, //sportsouth.importOptions.user_name,
      'Source': 99994, //sportsouth.importOptions.source,
      ...api_props
    }
  };
  return new Promise(function (resolve, reject) {
    request(options, function (error, response) {
      if (error) {
        reject(error);
      }
      let parser = new xml2js.Parser();
      let dobj = null;
      parser.parseString(response.body, function (err, result) {
        //console.dir(result);
        dobj = result;
      });
      resolve(dobj);
    });

  });
}

async function demoScrub(body) {
  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  const paths = [
    {
      catg_path: ["Firearms", "Long Guns", "Shotguns"],
      keywords: ["long gun", "shotgun"]
    },
    {
      catg_path: ["Firearms", "Long Guns", "Shotguns", "Over & Under"],
      keywords: ["long gun", "shotgun", "over & under"]
    },
    {
      catg_path: ["Firearms", "Long Guns", "Shotguns", "Side-by-Side"],
      keywords: ["long gun", "shotgun", "side-by-side"]
    },
    {
      catg_path: ["Firearms", "Long Guns", "Shotguns", "Semi Auto"],
      keywords: ["long gun", "shotgun", "semi auto", "semi-auto", "semi-automatic"]
    },
    {
      catg_path: ["Firearms", "Long Guns", "Shotguns", "Pump Action"],
      keywords: ["long gun", "shotgun", "pump action"]
    },
    {
      catg_path: ["Firearms", "Handguns", "Pistols"],
      keywords: ["handgun", "pistol"]
    }
  ];

  let q = 'limit=250&include_fields=id,categories,search_keywords,is_visible';

  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);
  let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);

  for (let i = 0; i < paths.length; i++) {
    paths[i].bc_category = ii.getBigCommerceCategoryByPath(cc, paths[i].catg_path);
  }

  let pending_updates = [];

  for (let i = 0; i < pp.data.length; i++) {
    let added_keywords = pp.data[i].search_keywords;
    for (let j = 0; j < paths.length; j++) {
      if (paths[j].bc_category && pp.data[i].categories.includes(paths[j].bc_category.id)) {
        //console.log('wow - this is a match', pp.data[i]);
        let keywords = paths[j].keywords;
        let bc_keywords = [];
        if (pp.data[i].search_keywords != '') {
          bc_keywords = pp.data[i].search_keywords.split(',');
          for (let b = 0; b < bc_keywords.length; b++) {
            bc_keywords[b] = bc_keywords[b].toLowerCase().trim();
          }
        }
        for (let k = 0; k < keywords.length; k++) {
          if (!bc_keywords.includes(keywords[k].toLowerCase())) {
            if (added_keywords.length > 0) {
              added_keywords += ", ";
            }
            added_keywords += keywords[k];
          }
        }
        if (added_keywords != pp.data[i].search_keywords) {
          let updt = {
            "id": pp.data[i].id,
            "search_keywords": added_keywords
          };
          pending_updates.push(updt);
          if (pending_updates.length == 10) {
            // let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, pending_updates);
            // sfLog('demox', 'batch res', batch_res);
            pending_updates = [];
          }
        }
      } else {
        //console.log('nuts - this is not a match', pp.data[i]);
      }
    }

  }
  if (pending_updates.length > 0) {
    // let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, pending_updates);
    // sfLog('demox', 'batch res', batch_res);
  }

  console.log('demo');


}


async function weight_fix(body) {

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  let q = 'limit=250&include_fields=id,weight,is_visible,sku,upc,name,inventory_level,date_modified';
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  let pending_updates = [];
  let updated = 0;
  let reset = 0;

  // This is to support possible reset of previous updates, based on date modified range (not exact, because manual 
  // or sync job updates could have taken place during the interval.
  let date_reset_beg, time_reset_beg, date_reset_end, time_reset_end;
  //date_reset_beg = new Date('2022-08-15T19:00:12+00:00');
  //time_reset_beg = date_res.getTime();
 
  //date_reset_end = new Date('2022-08-15T21:23:12+00:00');
  //time_reset_end = date_first_log.getTime();
  let do_update = true;
  let do_reset = false;
  if( body.do_reset ) {
    do_update = false;
    do_reset = true;
    date_reset_beg = new Date(body.reset_beg);
    time_reset_beg = date_reset_beg.getTime();
    date_reset_end = new Date(body.reset_end);
    time_reset_end = date_reset_end.getTime();
  }
  for (let i = 0; i < pp.data.length; i++) {
    let p = pp.data[i];
    if( p.is_visible && p.weight == 0 && do_update ) {
        
          let updt = {
            "id": pp.data[i].id,
            "weight": 1
          };
          pending_updates.push(updt);
          updated++;
          console.log(p.id +"/\\"+ p.sku +"/\\"+ p.upc +"/\\"+ p.name +"/\\"+ p.inventory_level);
          if (pending_updates.length == 10) {
            let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, pending_updates);
            // sfLog('demox', 'batch res', batch_res);
            pending_updates = [];
          }
        
      
    }
    if( p.is_visible && p.weight == 1 && do_reset) {
      let d = new Date(p.date_modified);
      let t = d.getTime();
      if( t >= time_reset_beg && t <= time_reset_end ) {
        reset++;
        console.log(p.id +"/\\"+ p.sku +"/\\"+ p.upc +"/\\"+ p.name +"/\\"+ p.inventory_level);
      }
    }

  }
  if (pending_updates.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, pending_updates);
    // sfLog('demox', 'batch res', batch_res);
  }

  console.log('weight_fix ' + updated + ", " + reset);


}
/***
 * Create csv file(s) of manual 301 redirects for import into BigCommerce
 */
async function generate_redirects(body) {

  let out_file = body.data.output_file; //"../app_data/redirects-f";

  let redirect_set = [];

  const redirect_sets = [redirect_set];

  const old_domain = body.data.old_domain; //"https://sportsmansfinest.com";
  const new_domain = body.data.new_domain; //"https://sportsmansfinest.com";
  
  let current_redirects = [];
  let fdb = fs.createReadStream( body.data.current_redirects_file ); //"../app_data/current_redirects.csv");
  let csvb = csv({ separator: ',', quote: '"' });

  fdb.pipe(csvb).on('data', (data) => current_redirects.push(data));

  let endb = new Promise(function (resolve, reject) {
    csvb.on('end', () => resolve("yes"));
    fdb.on('error', reject); // or something like that. might need to close `hash`
  });

  await endb;

  let used_paths = [];
  for( let i = 0; i < current_redirects.length; i++ ) {
    let text = current_redirects[i]["Old Path"];
    used_paths.push(text.substring(1, text.length - 1));
  }

  let new_paths = [];

  let fda = fs.createReadStream(body.data.redirects_to_add_file); //"../app_data/urls_to_redirect.csv");
  let csva = csv({ separator: ',', quote: '"' });

  fda.pipe(csva).on('data', (data) => new_paths.push(data));

  let enda = new Promise(function (resolve, reject) {
    csva.on('end', () => resolve("yes"));
    fda.on('error', reject); // or something like that. might need to close `hash`
  });

  await enda;

  let aa = [];
  for( let i = 0; i < new_paths.length; i++ ) {
    if( !used_paths.includes(new_paths[i].old_url) ) {
      aa.push(new_paths[i]);
    }
  }

  let q = 'limit=250&include_fields=id,name,custom_url,sku';
  let bc = await ii.getAllBigCommerceProducts(orderOpts.hash, orderOpts.auth_token, orderOpts.auth_client, q);


  



  let ct = 0;
  for (let i = 0; i < bc.data.length; i++) {
    let bc_item = bc.data[i];
    let bc_x_url = bc_item.name.toLowerCase();
    bc_x_url = bc_x_url
      .replace(/  +/g, ' ')
      .replace(' (s)', '').replace(' (l)', '').replace(' (k)', '').replace(' (r)', '').replace('- ', '').replace('--', '-');
    bc_x_url = bc_x_url.replace(/ /g, '-').replace(/\//g, '-').replace(/\./g, '-').replace(/\'/g, '-')
    .replace(/\(/g, '').replace(/\)/g, '').replace(/\"/g, '').replace(/\&/g, '-').replace(/\+/g, '-');
    bc_x_url = bc_x_url.trim();
    // allch += bc_x_url +"\n";
    //bc_item.bc_x_url = bc_x_url;
    for (let j = 0; j < aa.length; j++) {
      if (bc_x_url == aa[j].old_url && !used_paths.includes(aa[j].old_url)) {

        //bc_item.old_url = aa[j].old_url;
        //console.log('exact match(' + aa[j].old_url + ")\n...........(" + bc_x_url + ')', bc_item.custom_url.url, bc_item.sku, bc_item.name);
        ct++;
        redirect_set.push( {
          "Old Path":"/" + aa[j].old_url + "/",
          "Old URL": old_domain + "/" + aa[j].old_url + "/",
          "New URL": new_domain + bc_item.custom_url.url
        });
        if( redirect_set.length >= 2000 ) {
          redirect_set = [];
          redirect_sets.push(redirect_set);
        }
        aa[j].matched = "y";
        break;
        //bc_matched.push(bc_item);
      } else if(bc_x_url.indexOf(aa[j].old_url) == 0) {
        //console.log('fuzzy match(' + aa[j].old_url + ")\n...........(" + bc_x_url + ')', bc_item.custom_url.url, bc_item.sku, bc_item.name);
        ct++;
        redirect_set.push( {
          "Old Path":"/" + aa[j].old_url + "/",
          "Old URL": old_domain + "/" + aa[j].old_url + "/",
          "New URL": new_domain + bc_item.custom_url.url
        });
        if( redirect_set.length >= 2000 ) {
          redirect_set = [];
          redirect_sets.push(redirect_set);
        }
        aa[j].matched = "y";
        break;
      }
    }
  }

  for (let i = 0; i < redirect_sets.length; i++) {
    
    let ggg = stringify(redirect_sets[i], {
      header: false, delimiter: ',', quoted: true
    });
    let file_spec = out_file + "-" + (i+1) + ".csv";
    fs.writeFileSync(file_spec, ggg);
    console.log( "wrote " + redirect_sets[i].length + " redirects to " + file_spec);

  }

  console.log("no match for")
  for( let i = 0; i < aa.length; i++ ) {
    if( typeof(aa[i].matched) == 'undefined' ) {
      console.log(aa[i].old_url);
    }
  }
  console.log('ach', ct);
  // console.log(allch);

}

async function add_shared_modifier(body) {

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  if( body.get_mods_for_id ) {
    let mm = await ii.getProductModifiers(creds.hash, creds.access_token, creds.client_id,body.get_mods_for_id);
    console.log("modifiers",mm);
  }
  // /stores/ycmjyu2rb7/v3/catalog/products?include_fields=id,weight,is_visible,sku,upc,name,inventory_level,date_modified&limit=250
  let q = 'include_fields=id,name,sku,categories&limit=250';
  let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);
  let mods_catgs = [];
  for( let i = 0; i < body.category_paths.length; i++ ) {
    let cs = ii.getBigCommerceCategoryByPath(cc,body.category_paths[i]);
    if( !cs ) {
      console.log( "no category for ", body.category_paths[i]);
    } else {
      mods_catgs.push(cs.id);
    }
  }
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  let skipped = 0;
  let updated = 0;

  for (let i = 0; i < pp.data.length; i++) {
    let p = pp.data[i];
    let is_ammo = false;
    for (let c = 0; c < p.categories.length; c++) {
      if (mods_catgs.includes(p.categories[c])) {
        is_ammo = true;
        break;
      }
    }
    if (is_ammo) {
      let has_modifier = false;
      let mm = await ii.getProductModifiers(creds.hash, creds.access_token, creds.client_id,p.id);
      for (let m = 0; m < mm.data.length; m++) {
        if (mm.data[m].shared_option_id && mm.data[m].shared_option_id == body.shared_option.shared_option_id) {
          has_modifier = true;
          break;
        }
      }
      if (has_modifier) {
        //console.log('this one has it', p);
        ++skipped;
      } else {
        //console.log('this one needs it', p);
        
        let add_opts =
        {
            'method': 'POST',
            'hostname': 'api.bigcommerce.com',
            'path': '/stores/' + creds.hash + '/v3/catalog/products/' + p.id + "/modifiers",
            'headers': {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Auth-Token': creds.access_token,
                'X-Auth-Client': creds.client_id,
            },
            'maxRedirects': 20
        };

        let add_data = body.shared_option;
    
        //console.log(add_data);
        let ss = JSON.stringify(add_data);
        ff = await ii.addABC(add_opts, JSON.stringify(add_data));
        ++updated;
        if( body.update_limit ) {
          console.log("updated " + p.id + ", " + p.sku,p,ff);
        }
        if( body.update_limit && updated == body.update_limit ) {
          console.log( 'updated limit reached ' + body.update_limit );
          break;
        }
      }

    }
  }

  console.log( 'add_shared_modifier complete - updated ' + updated + ", skipped " + skipped );

  /*
  
  var options = {
    'method': 'POST',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/rhy2bzbpcq/v3/catalog/products/5050/modifiers',
    'headers': {
      'X-Auth-Client': '4yjm6dv8mi5yzawo4gmoezfi53tp7c',
      'X-Auth-Token': '9xkxf8gx98cefm0jrpci7oc9xtor7lf',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
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
      console.log(body.toString());
    });
  
    res.on("error", function (error) {
      console.error(error);
    });
  });
  
  var postData = JSON.stringify({
    "display_name": "I am 21 years of age or older",
    "type": "radio_buttons",
    "required": true,
    "sort_order": 1,
    "config": [],
    "option_values": [
      {
        "label": "YES"
      }
    ],
    "shared_option_id": 5
  });
  
  req.write(postData);
  
  req.end();
*/

}


async function upc_reset(body) {
  let m = "upc_reset";

  let products_hidden = 0;
  let products_shown = 0;


  sfLog(m, 'upc hey');

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

 
  let q = null; //'limit=250&include_fields=id,categories,search_keywords,is_visible';
  let addq = null;
  if( body.addq && body.addq != '' ) {
    addq = body.addq;
  }

  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q, addq);
  let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);

  const opts = {};

  opts.catg_in_house = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "In-House Catalog"]);
  // opts.catg_unlisted = ii.getBigCommerceCategoryByPath(cc, ["Unlisted"]);
  opts.catg_lipseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Lipsey's Catalog"]);
  opts.catg_kinseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Kinsey's Catalog"]);
  opts.catg_rsr = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "RSR Catalog"]);
  opts.catg_south = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Sports South Catalog"]);
  opts.catg_oos = ii.getBigCommerceCategoryByPath(cc, ["Out of Stock"]);
  opts.catg_unlisted = ii.getBigCommerceCategoryByPath(cc, ["Unlisted"]);
  //opts.catg_hazmat = ii.getBigCommerceCategoryByPath(cc, ["HazMat"]);
  let xbyUPC = [];
  let in_house_pp = [];
  let updts = [];
  let uc = 0;
  let uc_groups = 0;
  let uc_group_products = 0;
  let uc_made_visible = 0;

  let ihp = [];
  for (let x = 0; x < pp.data.length; x++) {
    let bc = pp.data[x];
    if (bc.categories.includes(opts.catg_rsr.id)) {
      bc.xsort_order = opts.catg_rsr.sort_order;
    } else if (bc.categories.includes(opts.catg_south.id)) {
      bc.xsort_order = opts.catg_south.sort_order;
    } else if (bc.categories.includes(opts.catg_lipseys.id)) {
      bc.xsort_order = opts.catg_lipseys.sort_order;
    } else if (bc.categories.includes(opts.catg_kinseys.id)) {
      bc.xsort_order = opts.catg_kinseys.sort_order;
    } else {
      bc.xsort_order = opts.catg_in_house.sort_order;
      ihp.push(bc);
    }
    if (bc.upc && bc.upc != '' && bc.upc != '0' && /^\d+$/.test(bc.upc)
    && bc.xsort_order != 999
      && !bc.categories.includes(opts.catg_unlisted.id) && bc.images.length > 0) {
      let bcs = xbyUPC["" + bc.upc];
      if (!bcs) {
        bcs = []
        xbyUPC["" + bc.upc] = bcs;
      }
      bcs.push(bc);
      if (bc.xsort_order == opts.catg_in_house.sort_order) {
        //console.log(bc.xsort_order,opts.catg_in_house.sort_order,bc.sku,bc.upc);
        in_house_pp.push(bc);
      }
      // if( bcs.length == 2 ) {
      //   ++multi;
      //   console.log("ick " + bcs[0].upc + " 1 /" + bcs[0].sku + "/" + bcs[0].id); // log the first
      //   console.log("ick " + bc.upc + " 2 /" + bc.sku + "/" + bc.id); // and the 2nd
      // }
    }
  }

  // Prune down to UPCs with more than one product
  let byUPC = [];
  let ihUC = [];
  for (let upc in xbyUPC) {
    let prod = xbyUPC[upc]; // Get array of SKUs for this UPC
    if (prod.length > 1) {
      ++uc_groups;
      uc_group_products += prod.length;
      // Sort the SKUs by Warehouse priority
      prod.sort(function (a, b) {
        return a.xsort_order - b.xsort_order
      });
      let ih = false;
      for( let i = 0; i < prod.length; i++ ) {
        if( prod[i].xsort_order == -5 ) {
          ihUC.push(prod);
          ih = true;
        }
      }
      byUPC[upc] = prod;
    }
  }
  xbyUPC = null;
  sfLog(m, "done with by UPC");

  // Process each UPC grouping

  // first pass - make all sure eligible UPC group members visible
  for (let key in byUPC) {
    let prod = byUPC[key]; // Get array of SKUs for this UPC
    for (let i = 0; i < prod.length; i++) {
      let p = prod[i];
      if (!p.is_visible) {
        updts.push({ "id": p.id, "is_visible": true });
        p.is_visible = true;
        ++uc_made_visible;
        if (updts.length == 10) {
          let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
          //sfLog(m, 'batch res', batch_res);
          updts = [];
        }
      }
    }
  }
  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    updts = [];
  }


  for (let key in byUPC) {
    uc++;
    let prod = byUPC[key]; // Get array of SKUs for this UPC
   
    let have_in_house = false;
    let have_in_stock = false;
    for (let i = 0; i < prod.length; i++) {
      let p = prod[i];
      if (p.xsort_order == opts.catg_in_house.sort_order) {
          have_in_house = true;
          p.show_me = true;
          // console.log('have in-house',p);
          // console.log(prod);
      } else {
        if( !have_in_stock && p.inventory_level > 0 ) {
          have_in_stock = true;
          p.show_me = true;
        } else {
          p.show_me = false;
        }
      }
      if( p.inventory_level > 0 ) {
        have_in_stock = true;
      }
    }
    if( !have_in_stock && !have_in_house ) {
      prod[0].show_me = true; // nothing in stock, show the first SKU
    }
    for (let i = 0; i < prod.length; i++) {
      let bc_prod = prod[i];
      let is_hidden = bc_prod.categories.includes(opts.catg_oos.id);
      let rc = null;
      if (is_hidden) {
        if (bc_prod.show_me) {
          rc = await showSKUforUPC(creds, opts, cc, bc_prod, updts);
          ++products_shown;
        }
      } else {
        if (!bc_prod.show_me) {
          rc = await hideSKUforUPC(creds, opts, cc, bc_prod, updts);
          ++products_hidden;
        }
      }
      if (updts.length == 10) {
        let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
        //sfLog(m, 'batch res', batch_res);
        updts = [];
      }
    }
    //console.log( prod );
    // have to add processing to show / hide as needed
  }

  if (updts.length > 0) {
    //sfLog(m, "final batch of upc updates", updts);
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    updts = [];
  }


  console.log('UPC SKU Scrub is done, hidden ' + products_hidden + ", shown " + products_shown
    + ", products made visible " + uc_made_visible
    + ", eligible UPC groups " + uc_groups + ", products in eligible groups " + uc_group_products);

  console.log('demo');


}


async function showSKUforUPC(creds, opts, bc_catgs, bc_prod, updts) {
  // first see if there's saved metafield
  let product_id = bc_prod.id;
  //console.log("showing " + product_id, bc_prod);
  let params = "namespace=" + upc_metafield_options.namespace + "&key=" + upc_metafield_options.key;
  let mf = null;
  try {
    mf = await ii.getProductMetafields(creds.hash, creds.access_token, creds.client_id, product_id, params);
  } catch (ick) {
    console.log(ick);
  }
  if (mf) {
    if (mf.data.length == 1) {

      const restore_catgs = mf.data[0].value.split(",").map(element => {
        return Number(element)
      });
      let new_catgs = [];
      for (let i = 0; i < restore_catgs.length; i++) {
        let catg = restore_catgs[i];
        if (bc_catgs.cats_by_id[catg]) {
          new_catgs.push(catg);
        }
      }
      updts.push({ "id": product_id, "categories": new_catgs });
    }
  }
}

async function hideSKUforUPC(creds, opts, bc_catgs, bc_prod, updts) {
  // first see if it exists
  let product_id = bc_prod.id;
  //console.log("showing " + product_id, bc_prod);
  let save_categories = bc_prod.categories.join(",");
  let params = "namespace=" + upc_metafield_options.namespace + "&key=" + upc_metafield_options.key;
  let mf = null;
  try {
    mf = await ii.getProductMetafields(creds.hash, creds.access_token, creds.client_id, product_id, params);
  } catch (ick) {
    console.log(ick);
  }
  if (mf) {
      if (mf.data.length == 0) {
        let meta_add_data = {
          "permission_set": upc_metafield_options.permission_set,
          "key": upc_metafield_options.key,
          "value": save_categories, 
          "namespace": upc_metafield_options.namespace
        };

        let md = await ii.create_product_metafield(creds.hash, creds.access_token, creds.client_id, product_id, meta_add_data);

        //console.log(md);
      } else {

        let mu = await ii.updateProductMetafield(creds.hash, creds.access_token, creds.client_id, product_id, mf.data[0].id, save_categories);

        //console.log(mu);

      }
      // Now set the categories - keep just Unlisted and the Warehouse and add the Out of Stock
      let new_catgs = [opts.catg_oos.id];
      for( let i = 0; i < bc_prod.categories.length; i++ ) {
        let catg = bc_prod.categories[i];
        if( catg == opts.catg_in_house.id 
          || catg == opts.catg_kinseys.id
          || catg == opts.catg_lipseys.id
          || catg == opts.catg_rsr.id
          || catg == opts.catg_south.id) {
            new_catgs.push(catg);
          }
      }
      updts.push( { "id": product_id, "categories": new_catgs} );
  }
}

async function oos_meta(body) {

  const upc_metafield_options = {
    "permission_set": "write",
    "key": "saved_catg",
    "namespace": "sf.catalog"
  };

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  // Process our backup
  let fda = fs.createReadStream(body.exp_file);
  let csva = csv({ separator: ',', quote: '"', bom: false });
  let aa = [];

  fda.pipe(csva).on('data', (data) => {
    let aid = data["Product ID"];
    let cd = data["Category Details"];
    aa.push(data);
  }
    );

  let enda = new Promise(function (resolve, reject) {
    csva.on('end', () => resolve("yes"));
    fda.on('error', reject); // or something like that. might need to close `hash`
  });

  await enda;

  let kk = "";
  Object.keys(aa[1]).forEach(function (key, index) {
    console.log(key, key.length);
    console.log(index, aa[1][key]);
    if (key.endsWith("NorthItemNumber")) {
      kk = key;
    }
    console.log(index, aa[1][kk]);

    // key: the name of the object key
    // index: the ordinal position of the key within the object 
  });
    console.log("done read attributes", enda, aa[0]);
  let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);

  let q = 'limit=250&include_fields=id,categories';
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  let oos_ct = 0;
  let oos_ct_nothing_saved = 0;
  let oos_ids_nothing_saved = [];
  let oos_have_exp = [];
  let oos_ct_have_exp = 0;
  let oos_no_catgs = 0;
  const catg_path_tag = "Category Path: ";
  for (let x = 0; x < pp.data.length; x++) {
    let prod = pp.data[x];
    let exp = aa[prod.id];

    if (prod.categories.includes(2452)) {
      oos_ct++;
      let meta = await ii.getSavedCategories(creds.hash, creds.access_token, creds.client_id, prod, cc);
      if (meta.length == 0) {
        ++oos_ct_nothing_saved;
        oos_ids_nothing_saved.push(prod.id);
        if (exp) {
          let updt = { "id": prod.id, "categories": [] };
          let paths = exp.split("|");
          for (let p = 0; p < paths.length; p++) {
            let path = paths[p];
            let q = path.indexOf(catg_path_tag);
            if (q >= 0) {
              path = path.substring(q + catg_path_tag.length);
            }
            let segs = path.split("/");
            let cid = ii.getBigCommerceCategoryByPath(cc, segs);
            if (cid && cid.id != 2452) {
              updt.categories.push(cid.id);
              //++uc_added_categories;
            }
          }
          if (updt.categories.length > 0) {
            let save_categories = updt.categories.join(",");
            let meta_add_data = {
              "permission_set": upc_metafield_options.permission_set,
              "key": upc_metafield_options.key,
              "value": save_categories,
              "namespace": upc_metafield_options.namespace
            };

            let md = await ii.create_product_metafield(creds.hash, creds.access_token, creds.client_id, prod.id, meta_add_data);
            oos_have_exp.push({ "p": prod, "exp": exp });
            ++oos_ct_have_exp;
          }
        }
      }
    }

  }




    console.log('oos_meta, oos product ' + oos_ct + ", oos nothing saved " + oos_ct_nothing_saved);


  }







async function restore_supplier_catg(body) {

  console.log( "restore_supplier_catg entry" );

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  
  let cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);
  let catg_in_house = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "In-House Catalog"]);
  let catg_unlisted = ii.getBigCommerceCategoryByPath(cc, ["Unlisted"]);
  let catg_lipseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Lipsey's Catalog"]);
  let catg_kinseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Kinsey's Catalog"]);
  let catg_rsr = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "RSR Catalog"]);
  let catg_south = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Sports South Catalog"]);
  let catg_oos = ii.getBigCommerceCategoryByPath(cc, ["Out of Stock"]);

  let updts = [];
  let ct_updated = 0;
  let ct_updated_rsr = 0;
  let ct_updated_south = 0;
  let ct_updated_lipseys = 0;
  let ct_updated_kinseys = 0;
  let ct_updated_in_house = 0;
  let ct_no_categories = 0;


  
  let q = 'limit=250&include_fields=id,sku,categories';
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  
  for( let x =0; x < pp.data.length; x++ ) {
    
    let p = pp.data[x];

    if( p.categories.length == 0 ) {
      console.log("no categories");console.log(p);
      ++ct_no_categories;
    } 
    
    if (p.sku.endsWith(rsr.importOptions.sku_tag) ) {
      if( !p.categories.includes(catg_rsr.id)) {
        p.categories.push(catg_rsr.id);
        updts.push( { "id" : p.id, "categories": p.categories } );
        ++ct_updated_rsr;
      }
    } else if (p.sku.endsWith(south.importOptions.sku_tag) ) {
      if( !p.categories.includes(catg_south.id)) {
        p.categories.push(catg_south.id);
        updts.push( { "id" : p.id, "categories": p.categories } );
        ++ct_updated_south;
      }
    } else if (p.sku.endsWith(lipseys.importOptions.sku_tag) ) {
      if( !p.categories.includes(catg_lipseys.id)) {
        p.categories.push(catg_lipseys.id);
        updts.push( { "id" : p.id, "categories": p.categories } );
        ++ct_updated_lipseys;
      }
    } else if (p.sku.endsWith(kinseys.importOptions.sku_tag) ) {
      if( !p.categories.includes(catg_kinseys.id)) {
        p.categories.push(catg_kinseys.id);
        updts.push( { "id" : p.id, "categories": p.categories } );
        ++ct_updated_kinseys;
      }
    } else if (!p.categories.includes(catg_in_house.id)) {
      p.categories.push(catg_in_house.id);
      updts.push( { "id" : p.id, "categories": p.categories } );
      ++ct_updated_in_house;
    }
    
    if (updts.length == 10) {
      let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
      ct_updated += updts.length;
      //sfLog(m, 'batch res', batch_res);
      updts = [];
    }
    
  }

  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    ct_updated += updts.length;
    //sfLog(m, 'batch res', batch_res);
    updts = [];
  }

  console.log( "restore_supplier_catg complete" );
  console.log( "no categories " + ct_no_categories);
  console.log( "total updated " + ct_updated);
  console.log( "rsr updated " + ct_updated_rsr);
  console.log( "south updated " + ct_updated_south);
  console.log( "lipseys updated " + ct_updated_lipseys);
  console.log( "kinseys updated " + ct_updated_kinseys);
  console.log( "in-house updated " + ct_updated_in_house);

 


}

async function convert_rsr_weights_to_pounds(body) {

  
  const mm = "convert_rsr_weights_to_pounds";
  
  sfLog(mm, "entry");

  if( 1 == 1 ) {
    sfLog(mm, "this was completed and should not be run again");
    return;
  }

  let ct_updated = 0;
  let ct_unchanged = 0;
  let ct_defaulted = 0;

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  // the following has min to prevent any updates
  let q = 'limit=250&include_fields=id,weight,categories&categories:in=2405&id:min=999999';
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  let updts = [];

  for( let x =0; x < pp.data.length; x++ ) {
    
    let p = pp.data[x];

   if( p.weight == 0 ) {
    updts.push( {"id": p.id, "weight": 0.25 } ); //default to 1/4 lb
    ++ct_defaulted;
   } else if( p.weight > 1 ) {
    updts.push( {"id": p.id, "weight": p.weight / 16.0 } ); // convert oz to lbs
    ++ct_updated
   } else {
    ++ct_unchanged;
   }
    
    if (updts.length == 10) {
      let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
      //sfLog(m, 'batch res', batch_res);
      console.log(updts);
      updts = [];
    }
    
  }

  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    console.log(updts);
    updts = [];
  }

  sfLog(mm, "defaulted", ct_defaulted);
  sfLog(mm, "unchanged", ct_unchanged);
  sfLog(mm, "converted", ct_updated);

  sfLog(mm, "Complete")

 


}


async function update_rsr_images(body) {

  
  const mm = "update_rsr_images";

  
  sfLog(mm, "entry");

  
  let ct_updated = 0;
  let ct_unchanged = 0;
  let ct_added = 0;

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  // const limit = 1;
  // for( let i = 0; i < pp.data.length; i += limit ) {
  //   //console.log('start ' + i);
  //   await downloads();
  //   //console.log('end   ' + i);
  // }

  let ww = await downloads(body);
  
  if( false ) {
  let dobj; 
  console.log( "DiscontinuedItemsDS");
  dobj = await getAndParseXML( 'DiscontinuedItemsDS', {  } );
  const items = xpath.find(dobj, "//Table");

  let deletedItemNos = new Set();
  for( let i = 0; i < items.length; i++ ) {
    deletedItemNos.add(items[i].ITEMNO[0]);
  }
}
  // test with deletedItemNos.has(itemno-sku)
  // can get bigcommerce image date - new Date(pp.data[0].images[0].date_modified)
  //    compare images[0].image_file to see if it contains RSR name after path, before double __ ?


  //await downloads();
  // // the following has min to prevent any updates
  // let q = 'limit=250&include_fields=id,weight,categories&categories:in=2405&id:min=999999';
  // let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);
  let qs = body.query;
  let db = false;
  console.log("getting RSR products from BigCommerce");
  let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, qs);
  let download_list = [];
  let affected_products = new Set();

  for( let i = 0; i < pp.data.length; i++ ) {
    let bcp = pp.data[i];
    bcp.add_images = [];
    bcp.updt_images = [];
    let sku = bcp.sku.substring(0, bcp.sku.length - (rsr.importOptions.sku_tag.length+1));
    const angles = [ sku + "_1_HR", sku + "_2_HR", sku + "_3_HR", sku + "_4_HR" ];
    for( let angle = 0; angle < angles.length; angle++ ) {
      let img = ww.img_map.get(angles[angle]+".jpg");
      let angle_pattern = "/"+angles[angle]+"__";
      if( img ) {
        let have_it = false;
        for( let bc_img_ix = 0; bc_img_ix < bcp.images.length; bc_img_ix++ ) {
          let bc_img = bcp.images[bc_img_ix];
          if( bc_img.image_file.indexOf( angle_pattern ) > 0 ) {
            have_it = true;
            let bc_date = new Date(bcp.images[bc_img_ix].date_modified);
            bc_date.setUTCHours(0, 0, 0, 0);
            let rsr_date = new Date(img.rawModifiedAt);
            rsr_date.setUTCHours(0, 0, 0, 0);
            //console.log("big yay",bcp,img);
            let ms_diff = rsr_date.getTime() - bc_date.getTime();
            if( ms_diff > 12 * 24 * 60 * 60 * 1000 /* 12 hour difference at least */ ) {
              ++ct_updated;
              download_list.push(img);
              bcp.updt_images.push({ "id": bc_img.id, "img": img});
              affected_products.add(bcp.id);
            } else {
              ++ct_unchanged;
            }
          } 
        }
        if( !have_it ) {
          download_list.push(img);
          bcp.add_images.push(img);
          affected_products.add(bcp.id);
          ++ct_added;
        }
        //console.log('yay');
      } 
    }
    // imgs = null;
  }

  //console.log("to get " + download_list.length );
  console.log("Products affected " + affected_products.size + " of " + pp.data.length );
  console.log( "Images added/updated/unchanged", ct_added, ct_updated, ct_unchanged);

  // for( x = 0; x < download_list.length; x += 1 ) {
  //   console.log("ddd " + download_list[x].path + "/" + download_list[x].name);
  // }
  // for( x = 0; x < download_list.length; x += 20 ) {
  //   await download_required_imgs(download_list,x,20);
  // }

  let updts = [];


  for( let i = 0; i < pp.data.length; i++ ) {
    let bcp = pp.data[i];

    let have_thumbnail = false;
    for( let z = 0; z < bcp.images.length; z++ ) {
      if( bcp.images[z].is_thumbnail ) {
        have_thumbnail == true;
        break;
      }
    }

    let updt = { "id": bcp.id, "images": []};

    // local file path https://alpine-bc.ngrok.io/images/upload/
    // rsr site file path https://img.rsrgroup.com/highres-pimages/
    if( bcp.add_images.length > 0 ) {
      for( let j = 0; j < bcp.add_images.length; j++) {
        let img = bcp.add_images[j];
        //if( img.downloaded ) {
          updt.images.push(
            {
              "image_url": "https://img.rsrgroup.com/highres-pimages/" + img.name
            }
          )
        //}
      }
    }
    if( bcp.updt_images.length > 0 ) {
      for( let j = 0; j < bcp.updt_images.length; j++) {
        let img = bcp.updt_images[j].img;
        let id = bcp.updt_images[j].id;
        //if( img.downloaded ) {
          updt.images.push(
            {
              "id": id,
              "image_url": "https://img.rsrgroup.com/highres-pimages/" + img.name
            }
          )
        //}
      }
    }
    if( updt.images.length > 0 ) {
      if( !have_thumbnail ) {
        updt.images[0].is_thumbnail = true;
      }
      updts.push(updt);
      if (updts.length == 10) {
        let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
        //sfLog(m, 'batch res', batch_res);
        //console.log(batch_res);
        updts = [];
      }
    }
  }

  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    //console.log(batch_res);
    updts = [];
  }

  // sfLog(mm, "defaulted", ct_defaulted);
  // sfLog(mm, "unchanged", ct_unchanged);
  // sfLog(mm, "converted", ct_updated);

  sfLog(mm, "Complete")

 


}

async function purge_deleted(body) {

  
  const mm = "purge_deleted";

  
  sfLog(mm, "entry");

  
  let ct_deleted = 0;
  let ct_processed = 0;
  let ct_skipped = 0;

  const test_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  const prod_creds = {
    client_id: "***",
    access_token: "***",
    hash: "***"
  };
  let creds = null;
  if (body.env == "prod") {
    creds = prod_creds;
  } else {
    creds = test_creds;
  }

  
// await (async function() {
//   let sha1sum = await end;
//   console.log("done read 1",sha1sum,catgRes[0]);
// }());
  // const limit = 1;
  // for( let i = 0; i < pp.data.length; i += limit ) {
  //   //console.log('start ' + i);
  //   await downloads();
  //   //console.log('end   ' + i);
  // }
 

  sfLog(mm, "getting BigCommerce categories");

  const cc = await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);
  const catg_rsr = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "RSR Catalog"]);
  const catg_south = ii.getBigCommerceCategoryByPath(cc, ["Warehouse", "Sports South Catalog"]);
  const catg_discontinued = ii.getBigCommerceCategoryByPath(cc, ["Discontinued"]);

  let pp, qs;
  let updts = [];

  // test with deletedItemNos.has(itemno-sku)
  // can get bigcommerce image date - new Date(pp.data[0].images[0].date_modified)
  //    compare images[0].image_file to see if it contains RSR name after path, before double __ ?


  //await downloads();
  // // the following has min to prevent any updates
  // let q = 'limit=250&include_fields=id,weight,categories&categories:in=2405&id:min=999999';
  // let pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q);

  sfLog(mm, "Downloading and parsing RSR deleted products csv");

  // RSR deletes - first download csv file and parse it
  await rsr_downloads();
  let results = [];
  let fd = fs.createReadStream('../app_data/rsrdeletedinv.txt');
  let csv1 = csv({ separator: ';', headers: rsr.deletedInv, quote: '\b' });
  fd.pipe(csv1).on('data', (data) => 
  
  results.push(data)
  
  );

  let end = new Promise(function(resolve, reject) {
    csv1.on('end', () => resolve("yes"));
    fd.on('error', reject); // or something like that. might need to close `hash`
});
await end;

  const rsr_deleted = new Set();
  for( let i = 0; i < results.length; i++ ) {
    rsr_deleted.add(results[i].RSRStockNumber);
  }

  sfLog(mm, "Getting RSR products from BigCommerce");

  qs = "limit=250&include_fields=id,modifiers,categories,name,sku&categories:in=" + catg_rsr.id;

  pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, qs);

  sfLog(mm, "Got " + pp.data.length + " RSR products from BigCommerce");

  for( let i = 0; i < pp.data.length; i++ ) {
    let bcp = pp.data[i];
    ++ct_processed;

    if( !bcp.categories.includes(catg_discontinued.id) ) {
      let sku = bcp.sku.substring(0, bcp.sku.length - (rsr.importOptions.sku_tag.length+1));
    
      if( rsr_deleted.has(sku) ) {
        ++ct_deleted;
        bcp.categories.push(catg_discontinued.id);
        let updt = { "id": bcp.id, "is_visible": false, "categories": bcp.categories};
        updts.push(updt);
        if (updts.length == 10) {
          let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
          //sfLog(m, 'batch res', batch_res);
          //console.log(batch_res);
          updts = [];
        }
      }
    }
   
  }

  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    //console.log(batch_res);
    updts = [];
  }


  sfLog(mm, "RSR deletes completed - deleted " + ct_deleted + " of " + ct_processed );

  ct_deleted = 0;
  ct_processed = 0;


  
  console.log('\n==========================================================================================\n');

  let dobj; 
  
  sfLog(mm, "getting DiscontinuedItemsDS");
  dobj = await getAndParseXML( 'DiscontinuedItemsDS', {  } );
  const items = xpath.find(dobj, "//Table");

  let deletedItemNos = new Set();
  for( let i = 0; i < items.length; i++ ) {
    deletedItemNos.add(items[i].ITEMNO[0]);
  }

  sfLog(mm, "Getting South products from BigCommerce");

  qs = "limit=250&include_fields=id,modifiers,categories,name,sku&categories:in=" + catg_south.id;

  pp = await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, qs);

  sfLog(mm, "Got " + pp.data.length + " South products from BigCommerce");

  
  for( let i = 0; i < pp.data.length; i++ ) {
    let bcp = pp.data[i];
    ++ct_processed;

    if( !bcp.categories.includes(catg_discontinued.id) ) {
      let sku = bcp.sku.substring(0, bcp.sku.length - (south.importOptions.sku_tag.length+1));
    
      if( deletedItemNos.has(sku) ) {
        ++ct_deleted;
        bcp.categories.push(catg_discontinued.id);
        let updt = { "id": bcp.id, "is_visible": false, "categories": bcp.categories};
        updts.push(updt);
        if (updts.length == 10) {
          let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
          //sfLog(m, 'batch res', batch_res);
          //console.log(batch_res);
          updts = [];
        }
      }
    }
   
  }

  if (updts.length > 0) {
    let batch_res = await ii.updateProductBatch(creds.hash, creds.access_token, creds.client_id, updts);
    //sfLog(m, 'batch res', batch_res);
    //console.log(batch_res);
    updts = [];
  }

  // sfLog(mm, "defaulted", ct_defaulted);
  // sfLog(mm, "unchanged", ct_unchanged);
  // sfLog(mm, "converted", ct_updated);

  sfLog(mm, "South deletes completed - deleted " + ct_deleted + " of " + ct_processed );

  

}

async function downloads_old(pp,start,stop) {
  const client = new ftp.Client(5*60*1000);
  client.ftp.verbose = false;
  const imgs_by_sku = {};
  //update_status("downloads begin");
  try {
    await client.access({
      host: "rsrgroup.com",
      user: "33753",
      password: "LoHfUXzP"
      //secure: true
    });
    //console.log(await client.list());
    const dirs = [ "#", "a","b","c","d","e","f","g","h","i","j","k",
      "l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
    
    for( let z in dirs ) {
      let dd = await client.list("/ftp_highres_images/rsr_number/" + z);
    }
    //update_status("downloading categories");attributes-all.txt
    //await client.downloadTo("../app_data/attributes-all.txt","/keydealer/attributes-all.txt");
    //await client.downloadTo("../app_data/product_sell_descriptions_unicode.xml","/keydealer/product_sell_descriptions_unicode.xml");
    for (x = start; x < pp.data.length && x < stop; x++) {
      
      let bcp = pp.data[x];

      bcp.new_imgs = [];
      let sku = bcp.sku.substring(0, bcp.sku.length - (rsr.importOptions.sku_tag.length + 1));
      const f = [sku + "_1_HR.jpg",
      sku + "_2_HR.jpg", sku + "_3_HR.jpg", sku + "_3_HR.jpgx"];


      for (let i = 0; i < f.length; i++) {
        let filename = f[i];
        let pref = filename.substring(0, 1).toLocaleLowerCase();
        if (pref < "a" || pref > "z") {
          pref = "#";
        }
        let path = "/ftp_highres_images/rsr_number/" + pref + "/" + filename;

        try {
          await client.downloadTo("./public/images/upload/" + filename, path);
          bcp.new_imgs.push(filename);
        } catch (e) {
          if( !((""+e).indexOf("550") > 0) ) {
            console.log("oops " + filename + " " + e);
          }
        }
      }
      
    }

    //q = null;
    //await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");
    //update_status("downloads complete");
  }
  catch (err) {
    console.log(err)
  }
  client.close()
  return;
}

async function downloads(body) {
  const download_data = {};
  const client = new ftp.Client(5*60*1000);
  client.ftp.verbose = false;
  const imgs_by_sku = {};
  //update_status("downloads begin");
  try {
    await client.access({
      host: "rsrgroup.com",
      user: "33753",
      password: "LoHfUXzP"
      //secure: true
    });
    //console.log(await client.list());
    let dirs = [ "#", "a","b","c","d","e","f","g","h","i","j","k",
      "l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
    if( body.dirs ) {
      dirs = body.dirs;
    }
    
    download_data.img_map = new Map();
    for( let z = 0; z < dirs.length; z++  ) {
      let dd = await client.list("/ftp_highres_images/rsr_number/" + dirs[z]);
      for( let y = 0; y < dd.length; y++ ) {
        dd[y].path = "/ftp_highres_images/rsr_number/" + dirs[z];
        download_data.img_map.set(dd[y].name,dd[y]);
      }
      console.log(dirs[z]);
    }
    
    //update_status("downloading categories");attributes-all.txt
    //await client.downloadTo("../app_data/attributes-all.txt","/keydealer/attributes-all.txt");
    //await client.downloadTo("../app_data/product_sell_descriptions_unicode.xml","/keydealer/product_sell_descriptions_unicode.xml");
    // for (x = start; x < pp.data.length && x < stop; x++) {
      
    //   let bcp = pp.data[x];
    //   bcp.new_imgs = [];
    //   let sku = bcp.sku.substring(0, bcp.sku.length - (rsr.importOptions.sku_tag.length + 1));
    //   const f = [sku + "_1_HR.jpg",
    //   sku + "_2_HR.jpg", sku + "_3_HR.jpg", sku + "_3_HR.jpgx"];


    //   for (let i = 0; i < f.length; i++) {
    //     let filename = f[i];
    //     let pref = filename.substring(0, 1).toLocaleLowerCase();
    //     if (pref < "a" || pref > "z") {
    //       pref = "#";
    //     }
    //     let path = "/ftp_highres_images/rsr_number/" + pref + "/" + filename;

    //     try {
    //       await client.downloadTo("./public/images/upload/" + filename, path);
    //       bcp.new_imgs.push(filename);
    //     } catch (e) {
    //       if( !((""+e).indexOf("550") > 0) ) {
    //         console.log("oops " + filename + " " + e);
    //       }
    //     }
    //   }
      
    // }

    //q = null;
    //await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");
    //update_status("downloads complete");
  }
  catch (err) {
    console.log(err)
  }
  client.close()
  return download_data;
}

async function download_required_imgs(img_list,start_ix,limit) {
  const download_data = {};
  const client = new ftp.Client(15 * 60 * 1000);
  client.ftp.verbose = false;
  const imgs_by_sku = {};
  let ct = 0;
  console.log("downloading from " + start_ix + " for " + limit );
  //update_status("downloads begin");
  try {
    await client.access({
      host: "rsrgroup.com",
      user: "***",
      password: "***"
      //secure: true
    });





    for (let i = start_ix; i < img_list.length && i < start_ix + limit; i++) {
      try {
        await client.downloadTo("./public/images/upload/" + img_list[i].name, img_list[i].path + "/" + img_list[i].name);
        img_list[i].downloaded = true;
        ct++;
      } catch (e) {
        if (!(("" + e).indexOf("550") > 0)) {
          console.log("oops " + e, img_list[i]);
        }
      }
    }

    // }

    //q = null;
    //await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");
    //update_status("downloads complete");
  }
  catch (err) {
    console.log(err)
  }
  client.close()
  console.log('downloaded ' + ct);
  return;
}



/***
 * Workhorse function to hit a Sports South API and return parsed XML object
 */
 async function getAndParseXML(api_path, api_props) {
  var options = {
    'method': 'POST',
    'url': south.importOptions.endpoint + api_path,
    'headers': {
      'Accept': 'application/xml',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      'CustomerNumber': south.importOptions.customer_number,
      'Password': south.importOptions.password,
      'UserName': south.importOptions.user_name,
      'Source': south.importOptions.source,
      ...api_props
    }
  };
  return new Promise(function (resolve, reject) {
    request(options, function (error, response) {
      if (error) {
        reject(error);
      }
      let parser = new xml2js.Parser();
      let dobj = null;
      parser.parseString(response.body, function (err, result) {
        //console.dir(result);
        dobj = result;
      });
      resolve(dobj);
    });

  });
}

async function rsr_downloads() {
  const client = new ftp.Client()
  client.ftp.verbose = false;
  //update_status("downloads begin");
  try {
    await client.access({
      host: "rsrgroup.com",
      user: "***",
      password: "***"
      //secure: true
    });
    //console.log(await client.list());
    //await client.uploadFrom("README.md", "README_FTP.md")
    //update_status("downloading categories");attributes-all.txt
    await client.downloadTo("../app_data/rsrdeletedinv.txt", "/keydealer/rsrdeletedinv.txt");
    //update_status("downloads complete");
  }
  catch (err) {
    console.log(err)
  }
  client.close()
}