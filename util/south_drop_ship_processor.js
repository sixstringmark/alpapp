/**
 * This module handles using vendor API to create dropship orders for Sports South
 */
const fs = require('fs')
const ii = require("./ick");
const ss = require("./SportsouthMappings");
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
const hbs = require('handlebars');
const request = require('request');
const { parseXML } = require('webdav');
const rsr_email = "onlinesales@sportsmansfinest.com";
const ss_creds = {
  live: {
    UserName: "***",
    Source: "***",
    CustomerNumber: "***",
    Password: "***"
  },
  test: {
    UserName: "***",
    Source: "***",
    CustomerNumber: "***",
    Password: "***",
  }
};
const in_store_addr = {
  "first_name": "Sales",
  "last_name": "Manager",
  "company": "SPORTSMAN'S FINEST",
  "street_1": "12434 BEE CAVE RD",
  "street_2": "",
  "city": "AUSTIN",
  "zip": "78738",
  "country": "United States",
  "country_iso2": "US",
  "state": "Texas",
  "email": "onlinesales@sportsmansfinest.com",
  "phone": "5122631888",
  "shipping_method": "In-Store Pickup (Collect from Store - Sportsman's Finest Store)"
};


async function process_south_orders(email_info, southItemsByAddress, dropship_common) {

  for (let id in southItemsByAddress) {

    let order_data = {
      supplier: "Sports South",
      order_messages: [],
      order_items: []
    };
    email_info.data.orders.push(order_data);

    let addr = dropship_common.bcAddressesById[id];
    let in_store = (addr.shipping_method.indexOf(in_store_pickup) >= 0);
    console.log('in_store ' + in_store);
    if( in_store ) {
      console.log('ouch');
    }
    if (in_store) {
      order_data.type = "Ship to Sportsman's store";
      order_data.address = in_store_addr;
    } else {
      order_data.type = "Ship direct to customer";
      order_data.address = addr; // for email display
    }

    let creds = dropship_common.test_order ? ss_creds.test : ss_creds.live;
    let drop_notes = {
      "header_notes": ["Sports South Drop-Ship for Order #" + dropship_common.order_id],
      "item_notes": []
    }
    dropship_common.order_updated = true;
    if (dropship_common.test_order) {
      drop_notes.header_notes.push("This is a test order and dropship is directed to the Sports South order system");
      order_data.order_messages.push("This is a test order and dropship is directed to the Sports South order system");
    }
    if (addr.first_name == "FFL" && addr.last_name == "Manager") {
      drop_notes.header_notes.push("Order's FFL item(s) must be processed manually");
      order_data.order_messages.push("Order's FFL item(s) must be processed manually");
    } else {


      let dataAddHeader = {
        ...creds,
        'PO': 'SS-' + dropship_common.order_id, //'SF-' + dropship_common.order_id + "-" + ("" + Math.random()).substring(2, 6),
        'CustomerOrderNumber': dropship_common.order_id,
        'SalesMessage': "Sportsman's Finest Order",
        'ShipVIA': "ground",
        'ShipToName': order_data.address.first_name + " " + order_data.address.last_name,
        'ShipToAttn': '',
        'ShipToAddr1': order_data.address.street_1,
        'ShipToAddr2': order_data.address.street_2,
        'ShipToCity': order_data.address.city,
        'ShipToState': order_data.address.state,
        'ShipToZip': order_data.address.zip,
        'ShipToPhone': order_data.address.phone,
        'AdultSignature': false,
        'Signature': false,
        'Insurance': false
      }
      console.log("PO is " + dataAddHeader.PO);
      let hh = await getAndParseSouthAPI("AddHeader", dataAddHeader);
      if (hh.int) {
        console.log("SS header order number is " + hh.int._);
      } else {
        // handle error
      }
      let ss_order_no = hh.int._;
      console.log(hh);
      let items = southItemsByAddress[id];
      let ordered_items = [];
      for (let i = 0; i < items.length; i++) {
        let bc_item = items[i];
        let dataAddDetail = {
          ...creds,
          'SSItemNumber': bc_item.sku.replace("-" + ss.importOptions.sku_tag, ""),
          'OrderNumber': ss_order_no,
          'Quantity': bc_item.quantity,
          'OrderPrice': bc_item.base_cost_price,
          'CustomerItemNumber': bc_item.product_id,
          'CustomerItemDescription': bc_item.name
        }
        let dtl = await getAndParseSouthAPI("AddDetail", dataAddDetail);
        console.log(dtl);
        if (dtl && dtl.boolean && dtl.boolean._ == 'true') {
          console.log('added dtl ', dataAddDetail);
          ordered_items.push(bc_item);
        } else {
          drop_notes.item_notes.push("AddDetail failed for " + bc_item.name + "/" + bc_item.sku);
          order_data.order_items.push(
            {
              qty_ack: '',
              qty_req: bc_item.quantity,
              name: bc_item.name,
              sku: bc_item.sku,
              upc: bc_item.upc,
              outcome: "Add to order failed"
            }
          );
          console.log('failed to add dtl', dataAddDetail);
        }
      }
      if (ordered_items.length > 0) {
        let dataSubmit = {
          ...creds,
          'OrderNumber': ss_order_no
        };
        let oo = await getAndParseSouthAPI("Submit", dataSubmit);
        if (oo && oo.boolean && oo.boolean._ == 'true') {
          console.log(`Order ${ss_order_no} placed`, oo);
          drop_notes.header_notes.push("Sports South Order No " + ss_order_no + " placed - PO " + dataAddHeader.PO + "\n" + dropped_shipped_south);
          order_data.po_number = dataAddHeader.PO;
          order_data.supplier_ref = '';
          order_data.supplier_id = ss_order_no;
          order_data.order_messages.push("Sports South Order Placed");
          //order_data.total = oo.Total;
          //order_data.shipping = oo.Shipping;
          //order_data.subtotal = oo.Subtotal;
          dropship_common.order_updated = true;
          let dataGetDetail = {
            ...creds,
            'OrderNumber': ss_order_no,
            'CustomerOrderNumber': dropship_common.order_id
          };
          let gg = await getAndParseSouthAPI("GetDetail", dataGetDetail);
          if (gg && gg.string) {
            let zzz = await parseXMLText( gg.string._ );
            let zitems = xpath.find(zzz, "//Table");
            //let zitems = zz[0].Table;
            let product_subtotal = 0.0;
            for (let z = 0; z < zitems.length; z++) {
              let zitem = zitems[z];
              let filled_qty = zitem.ORQTYF[0] * 1;
              let match_sku = zitem.ORITEM[0] + "-" + ss.importOptions.sku_tag;
              let bc_item = null;
              for (let p = 0; p < ordered_items.length; p++) {
                let ordered_item = ordered_items[p];
                if (ordered_item.sku == match_sku) {
                  bc_item = ordered_item;
                  break;
                }
              }
              if (bc_item) {
                drop_notes.item_notes.push("Filled " + filled_qty + "/" + bc_item.quantity + " for " + bc_item.name + "/" + bc_item.sku);
                dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": "(SS " + filled_qty + "/" + bc_item.quantity + ") " + bc_item.name });
                let outcome = "Allocated";
                if( filled_qty == 0 ) {
                  outcome = "None Allocated";
                } else if ( filled_qty < bc_item.quantity ) {
                  outcome = 'Partially Allocated';
                }
                order_data.order_items.push(
                  {
                    qty_ack: filled_qty,
                    qty_req: bc_item.quantity,
                    name: bc_item.name,
                    sku: bc_item.sku,
                    upc: bc_item.upc,
                    cost: (filled_qty * zitem.ORPRC[0]).toLocaleString("en-US", {style:"currency", currency:"USD"}),
                    outcome: outcome
                  }
                );
                product_subtotal += filled_qty * zitem.ORPRC[0] * 1.00;
              }
              //console.log(zitems[z], filled_qty, item_no);
            }
            order_data.subtotal = product_subtotal.toLocaleString("en-US", {style:"currency", currency:"USD"});
            // console.log(gg);
          }

        } else {
          console.log(`Order ${ss_order_no} not placed`, oo);
        }
      }
    }
    dropship_common.staff_notes.push(drop_notes);
  }
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
      // 'CustomerNumber': 99994, //sportsouth.importOptions.customer_number,
      // 'Password': 99999, //sportsouth.importOptions.password,
      // 'UserName': 99994, //sportsouth.importOptions.user_name,
      // 'Source': 99994, //sportsouth.importOptions.source,
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

async function parseXMLText(txt) {

  return new Promise(function (resolve, reject) {
    let dobj = null;
    let parser = new xml2js.Parser();
    parser.parseString(txt, function (err, result) {
      //console.dir(result);
      dobj = result;
    });
    resolve(dobj);
  });
}

exports.process_south_orders = process_south_orders;