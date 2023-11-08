/**
 * This module handles using vendor API to create dropship orders for RSR
 */
const fs = require('fs')
const ii = require("./ick");
const rsr = require("./RSRMappings");
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
const hbs = require('handlebars');
const request = require('request');
const rsr_email = "onlinesales@sportsmansfinest.com";


const rsr_creds = {
    test: {
      dealer: {
        "username": "***",
        "password": "***",
        "hostname": "test.rsrgroup.com"
      },
      fulfillment: {
        "username": "***",
        "password": "***",
        "hostname": "test.rsrgroup.com"
      }
    },
    live: {
      dealer: {
        "username": "***",
        "password": "***",
        "hostname": "www.rsrgroup.com"
      },
      fulfillment: {
        "username": "***",
        "password": "***", // ***
        "hostname": "www.rsrgroup.com"
      }
    }
  };

//duh();

async function process_rsr_orders(email_info, rsrItemsByAddress, dropship_common) {

    for (let id in rsrItemsByAddress) {
        let order_data = {
            supplier: "RSR",
            order_messages: [],
            order_items: []
        };
        email_info.data.orders.push(order_data);

        let addr = dropship_common.bcAddressesById[id];
        console.log(in_store_pickup,addr.shipping_method);
        let in_store = (addr.shipping_method.indexOf(in_store_pickup) >= 0);
        if (in_store) {
            order_data.type = "Ship to Sportsman's store";
        } else {
            order_data.type = "Ship direct to customer";
            order_data.address = addr; // for email display
        }

        let sys_creds = dropship_common.test_order ? rsr_creds.test : rsr_creds.live;
        let creds = in_store ? sys_creds.dealer : sys_creds.fulfillment;

        let opts = {
            "hostname": creds.hostname
        };


        let drop_notes = {
            "header_notes": ["RSR Drop-Ship for Order #" + dropship_common.order_id],
            "item_notes": []
        }
        dropship_common.order_updated = true;
        if (dropship_common.test_order) {
            drop_notes.header_notes.push("This is a test order and dropship is directed to the RSR test system");
            order_data.order_messages.push("This is a test order and dropship is directed to the RSR test system");
        }
        if (addr.first_name == "FFL" && addr.last_name == "Manager") {
            drop_notes.header_notes.push("Order's FFL item(s) must be processed manually");
            order_data.order_messages.push("Order's FFL item(s) must be processed manually");
        } else {
            let rsr_check_data = in_store ? {
                "Username": creds.username,
                "Password": creds.password,
                "POS": "I",
                "LookupBy": "S",
                "Items": [],
                "Storename": addr.first_name + " " + addr.last_name
            } : {
                "Username": creds.username,
                "Password": creds.password,
                "POS": "I",
                "LookupBy": "S",
                "Items": [],
                "Storename": addr.first_name + " " + addr.last_name,
                "ShipAddress": addr.street_1,
                "ShipAddress2": addr.street_2,
                "ShipCity": addr.city,
                "ShipState": ii.state_name_to_code(addr.state),
                "ShipZip": addr.zip
            };
            let items = rsrItemsByAddress[id];
            for (let i = 0; i < items.length; i++) {
                rsr_check_data.Items.push(items[i].sku.replace("-" + rsr.importOptions.sku_tag, ""));
            }
            let check_data = await ii.rsrCheckCatalog(opts, rsr_check_data);
            if (check_data && check_data.Status == "OK") {
                let place_data = in_store ? {
                    "Username": creds.username,
                    "Password": creds.password,
                    "POS": "I",
                    "PONum": dropship_common.order_id + "-" + "R-" + ("" + Math.random()).substring(2, 6),
                    "Email": rsr_email,
                    "Storename": rsr_check_data.Storename,
                    //"ContactNum": addr.phone, // looks like this is only for FFL dropship, which we don't do
                    "Items": []
                } : {
                    "Username": creds.username,
                    "Password": creds.password,
                    "POS": "I",
                    "PONum": dropship_common.order_id + "-" + "R-" + ("" + Math.random()).substring(2, 6),
                    "Email": rsr_email,
                    "Storename": rsr_check_data.Storename,
                    "ShipCity": rsr_check_data.ShipCity,
                    "ShipState": rsr_check_data.ShipState,
                    "ShipZip": rsr_check_data.ShipZip,
                    "ShipAddress": rsr_check_data.ShipAddress,
                    "ShipAddress2": rsr_check_data.ShipAddress2,
                    //"ContactNum": addr.phone, // looks like this is only for FFL dropship, which we don't do
                    "Items": []
                };

                let ordered_items = [];

                for (let i = 0; i < items.length; i++) {
                    // should be same number and order as the BC list used for check-catalog
                    let rsr_item = check_data.Items[i];
                    let bc_item = items[i];
                    if (!rsr_item.PartNum || rsr_item.RestrictedReason) {
                        console.log("oops - this didn't check out ", bc_item, rsr_item);
                        drop_notes.item_notes.push("Check-catalog failed for " + bc_item.name + "/" + bc_item.sku + ", " + rsr_item.RestrictedReason);
                        //order_data.order_messages.push("Check-catalog failed for " + bc_item.name + "/" + bc_item.sku + ", " + rsr_item.RestrictedReason);
                        order_data.order_items.push(
                            {
                                qty_ack: 0,
                                qty_req: bc_item.quantity,
                                name: bc_item.name,
                                sku: bc_item.sku,
                                upc: rsr_item.UPC,
                                cost: rsr_item.Cost,
                                outcome: rsr_item.RestrictedReason
                            }
                        );
                    } else {
                        place_data.Items.push(
                            {
                                "UPCcode": rsr_item.UPC,
                                "WishQty": bc_item.quantity,
                                "PartNum": rsr_item.PartNum
                            }
                        );
                        ordered_items.push(bc_item);
                    }
                }
                if (place_data.Items.length > 0) {
                    let oo = { "Status": "99", "StatusCode": "99" };
                    console.log(place_data);
                    console.log(opts);
                    // if( dropship_common.test_order ) {
                    oo = await ii.rsrPlaceOrder(opts, place_data);
                    // }
                    console.log(oo);
                    if (oo.Status == "OK" && oo.StatusCode == "00") {
                        let webref = oo.WebRef;
                        let poNum = place_data.PONum;
                        drop_notes.header_notes.push("RSR Order Placed - PO " + poNum + ", WebRef " + webref + "\n" + dropped_shipped_rsr);
                        order_data.po_number = poNum;
                        order_data.supplier_ref = webref;
                        order_data.supplier_id = oo.ConfirmResp;
                        order_data.order_messages.push("RSR Order Placed");
                        order_data.total = oo.Total;
                        order_data.shipping = oo.Shipping;
                        order_data.subtotal = oo.Subtotal;
                        dropship_common.order_updated = true;

                        for (let i = 0; i < oo.Items.length; i++) {
                            let p_item = oo.Items[i];
                            let bc_item = ordered_items[i];
                            console.log(p_item, bc_item);
                            if (p_item.FullyFilled == "Y") {
                                dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": "(RSR) " + bc_item.name });
                                drop_notes.item_notes.push("Allocated " + bc_item.quantity + " for " + bc_item.name + "/" + bc_item.sku);
                                order_data.order_items.push(
                                    {
                                        qty_ack: p_item.AckQty,
                                        qty_req: bc_item.quantity,
                                        name: bc_item.name,
                                        sku: bc_item.sku,
                                        upc: p_item.UPCcode,
                                        cost: p_item.Cost,
                                        outcome: "Allocated"
                                    }
                                );
                            } else {
                                dropship_common.updt.products.push({ "id": bc_item.id, "name_merchant": "(RSR " + p_item.AckQty + "/" + bc_item.quantity + ") " + bc_item.name });
                                drop_notes.item_notes.push("Partially Allocated,  " + p_item.AckQty + " of " + bc_item.quantity + ", for " + bc_item.name + "/" + bc_item.sku);
                                order_data.order_items.push(
                                    {
                                        qty_ack: p_item.AckQty,
                                        qty_req: bc_item.quantity,
                                        name: bc_item.name,
                                        sku: bc_item.sku,
                                        upc: p_item.UPCcode,
                                        cost: p_item.Cost,
                                        outcome: p_item.AckQty == 0 ? "None Allocated" : "Partially Allocated"
                                    }
                                );
                            }

                        }

                    } else {
                        drop_notes.header_notes.push("place-order error - StatusCode " + place_data.StatusCode + " / " + place_data.StatusMssg);
                        order_data.order_messages.push("place-order error - StatusCode " + place_data.StatusCode + " / " + place_data.StatusMssg);
                    }
                    console.log(oo);
                }
            } else {
                drop_notes.header_notes.push("check-catalog error - StatusCode " + check_data.StatusCode + " / " + check_data.StatusMssg);
                order_data.order_messages.push("check-catalog error - StatusCode " + check_data.StatusCode + " / " + check_data.StatusMssg);
            }
        }
        dropship_common.staff_notes.push(drop_notes);
    }
}

exports.process_rsr_orders = process_rsr_orders;