/**
 * This module handles using vendor API to create dropship orders for Kinsey's
 */
const fs = require('fs')
const ii = require("./ick");
const ss = require("./KinseysMappings");
const hbs = require('handlebars');
const request = require('request');
const { parseXML } = require('webdav');
const e = require('express');
const ss_creds = {
  live: {
    APIIdentifier: "***",
    POPrefix: "SF"
  },
  test: {
    APIIdentifier: "***",
    POPrefix: "TEST DON'T SHIP"
  }
};
const in_store_addr = {
  "first_name": "SPORTSMAN'S",
  "last_name": "FINEST",
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


async function process_kinseys_orders(email_info, kinseysItemsByAddress, dropship_common) {

  for (let id in kinseysItemsByAddress) {

    let order_data = {
      supplier: "Kinsey's",
      order_messages: [],
      order_items: []
    };
    email_info.data.orders.push(order_data);

    let addr = dropship_common.bcAddressesById[id];
    let in_store = (addr.shipping_method.indexOf(in_store_pickup) >= 0);
    console.log('in_store ' + in_store);
    if (in_store) {
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
      "header_notes": ["Kinsey's Drop-Ship for Order #" + dropship_common.order_id],
      "item_notes": []
    }
    dropship_common.order_updated = true;
    if (dropship_common.test_order) {
      drop_notes.header_notes.push("This is a test order and Kinsey's dropship PO says not to ship");
      order_data.order_messages.push("This is a test order and Kinsey's dropship PO says not to ship");
    }
    if (addr.first_name == "FFL" && addr.last_name == "Manager") {
      drop_notes.header_notes.push("Order's FFL item(s) must be processed manually");
      order_data.order_messages.push("Order's FFL item(s) must be processed manually");
      let items = kinseysItemsByAddress[id];
      for (let i = 0; i < items.length; i++) {
        let bc_item = items[i];
        let item_dtl =
        {
          qty_ack: 0,
          qty_req: bc_item.quantity,
          name: bc_item.name,
          sku: bc_item.sku,
          upc: bc_item.upc,
          //cost: sales_match.price,
          outcome: "Cannot be dropshipped"
        };

        order_data.order_items.push(item_dtl);
      }

    } else {



      // First, build request for Inventory Items check
      let inv_data = {
        "InventoryRequest": {
          "APIIdentifier": creds.APIIdentifier,
          "Format": "JSON",
          "Items": [
            //{"ItemNo": "1001091"},
            //{"ItemNo": "1001026"}
          ]
        }
      };

      let items = kinseysItemsByAddress[id];
      let ordered_items = [];
      for (let i = 0; i < items.length; i++) {
        let bc_item = items[i];
        inv_data.InventoryRequest.Items.push({ "ItemNo": bc_item.sku.replace("-" + ss.importOptions.sku_tag, "") });
      }
      let inv_opts = {
        hostname: "api.kinseysinc.com",
        path: "/inventory/items"
      }

      let inv_res = await ii.kinseysInventory(inv_opts, inv_data);

      // Let's see what we got
      if (inv_res && inv_res.Status && inv_res.Status == "OK" && inv_res.Results) {
        let found_inv = [];
        for (let i = 0; i < items.length; i++) {
          let bc_item = items[i];
          let ksku = bc_item.sku.replace("-" + ss.importOptions.sku_tag, "");
          let inv_found = false;
          for (let j = 0; j < inv_res.Results.length; j++) {
            if (ksku == inv_res.Results[j].ItemNo) {
              found_inv.push({
                "bc_item": bc_item,
                "inv_item": inv_res.Results[j]
              });
              inv_found = true;
              break;
            }
          }
          if (!inv_found) {

            let item_dtl =
            {
              qty_ack: 0,
              qty_req: bc_item.quantity,
              name: bc_item.name,
              sku: bc_item.sku,
              upc: bc_item.upc,
              //cost: sales_match.price,
              outcome: "Unavailable or restricted"
            };

            order_data.order_items.push(item_dtl);
            dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": "(K0/" + bc_item.quantity + ")" + bc_item.name });
          }
        }
        let order_lines = [];
        if (found_inv.length > 0) {
          for (let i = 0; i < found_inv.length; i++) {
            let f = found_inv[i];
            if (f.inv_item.Available >= f.bc_item.quantity) {
              console.log("full", f);
            } else if (f.inv_item.Available > 0) {
              console.log("insufficient", f);
            } else {
              console.log("none", f);
            }
            if (f.inv_item.Available > 0) {
              order_lines.push(
                {
                  "ItemNo": f.inv_item.ItemNo,
                  "Description": f.bc_item.name,
                  "Quantity": Math.min(f.inv_item.Available, f.bc_item.quantity)
                }
              );
            }
          }
        }

        if (order_lines.length > 0) {
          // Create the order with Kinsey's
          let po_num =  
            creds.POPrefix + " " + dropship_common.order_id + "-" + ("" + Math.random()).substring(2, 6);
            
          let place_data =
          {
            "OrderImportRequest": {
              "APIIdentifier": creds.APIIdentifier,
              "Orders": [
                {
                  "OrderNo": po_num,
                  "ShipVia": "ground",
                  "ShipTo": {
                    "ContactName": order_data.address.first_name + " " + order_data.address.last_name,
                    "Address1": order_data.address.street_1,
                    "Address2": order_data.address.street_2,
                    "City": order_data.address.city,
                    "State": ii.state_name_to_code(order_data.address.state),
                    "Zip": order_data.address.zip,
                    "Country": order_data.address.country,
                    "PhoneNumber": order_data.address.phone
                  },
                  "OrderLines": order_lines
                }
              ]
            }
          };
          console.log(place_data);
          let place_opts = {
            hostname: "api.kinseysinc.com",
            path: "/orders/import"
          }
          let place_res = await ii.kinseysInventory(place_opts, place_data);
          let xplace_res = {
            Status: 0,
            ErrorMessage: "",
            OrderImportResults: [
              {
                ExternalOrderNumber: "TEST ORDER-DON'T SHIP 116-2755",
                Status: 0,
                KinseyOrderNumber: "S1387839",
                ErrorMessages: [
                ],
                SalesOrderLines: [
                  {
                    itemNo: "73456",
                    price: 15.8,
                    quantity: 1,
                    backordered: 0,
                  },
                  {
                    itemNo: "1001089",
                    price: 10.48,
                    quantity: 1,
                    backordered: 0,
                  },
                ],
              },
            ],
          };
          if (place_res.Status == 0 || place_res.ErrorMessages.length == 0) {
            // success
            // get common data and match to see outcome for items

            let kres = place_res.OrderImportResults[0];

            drop_notes.header_notes.push("Kinsey's Order " + kres.KinseyOrderNumber + " placed,"
              + " external order number " + kres.ExternalOrderNumber + "\n" + dropped_shipped_kinseys);
            order_data.order_messages.push("Kinsey's Order " + kres.KinseyOrderNumber + " placed");

            order_data.po_number = kres.ExternalOrderNumber;

            order_data.supplier_id = kres.KinseyOrderNumber;

            // Check outcome for each item
            for (let i = 0; i < items.length; i++) {
              let bc_item = items[i];
              let sku = bc_item.sku.replace("-" + ss.importOptions.sku_tag, "");
              let sales_match = null;
              for (let j = 0; j < kres.SalesOrderLines.length; j++) {
                let sales_item = kres.SalesOrderLines[j];
                if (sku == sales_item.itemNo) {
                  sales_match = sales_item;
                  break;
                }
              }
              let outcome = null;
              let pref = "(K";
              if (!sales_match) {
                pref += "0/" + bc_item.quantity + ")";
                let item_dtl =
                {
                  qty_ack: 0,
                  qty_req: bc_item.quantity,
                  name: bc_item.name,
                  sku: bc_item.sku,
                  upc: bc_item.upc,
                  //cost: sales_match.price,
                  outcome: "Unavailable or restricted"
                };

                order_data.order_items.push(item_dtl);
                dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": pref + bc_item.name });
              } else {
                if (sales_match.quantity == bc_item.quantity) {
                  outcome = "Allocated";
                  pref += ")";
                } else if (sales_match.quantity > 0) {
                  outcome = "Partially Allocated";
                  pref += sales_match.quantity + "/" + bc_item.quantity + ")";
                } else {
                  outcome = "Out of Stock";
                  pref += "0/" + bc_item.quantity + ")";
                }

                let item_dtl =
                {
                  qty_ack: sales_match.quantity,
                  qty_req: bc_item.quantity,
                  name: bc_item.name,
                  sku: bc_item.sku,
                  upc: bc_item.upc,
                  cost: sales_match.price,
                  outcome: outcome
                };

                order_data.order_items.push(item_dtl);

                dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": pref + bc_item.name });
              }
            }

          } else {
            drop_notes.header_notes.push("Error placing Kinsey's Order");
            order_data.order_messages.push("Error placing Kinsey's Order");
            console.log("Kinsey's place error", place_res);
          }

          console.log(place_res);
        }

      } else {
        // error handling
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



exports.process_kinseys_orders = process_kinseys_orders;