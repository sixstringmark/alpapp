/**
 * This module handles specific processing for importing / syncing Sportsman's Finest BigCommerce catalog
 * with Lipsey's.
 * 
 * Lipseys has four ftp files:
 * 
 *  catalog.csv
 *  pricingquantity.csv
 *  accessoriescatalog.csv
 *  accessoriespricingquantity.csv
 *
 * 
 */
const Client = require('ftp');
const ftp = require("basic-ftp");
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("../util/ick");
const lips = require("./LipseysMappings");
const stream = require("stream");
//const request = require("request");
//const e = require('express');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
//const webdavClient = require('webdav-client');
//const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const gun_types = [
    "semi-auto pistol", "rifle", "shotgun", "nfa - short barrel rifle",
    "revolver", "specialty handgun", "muzzleloader", "combo", "nfa short barrel shotgun"
];

const DD = " / ";

//duh();

async function lipseys_import(hash, auth_token, client_id, opts) {

    init_status();

    let imp_start = 0;
    let imp_count = -1;

    let imp_added = 0;
    let imp_add_failed = 0;
    let imp_updated = 0;
    let imp_unchanged = 0;
    let imp_price_changed = 0;
    let imp_inv_changed = 0;
    let imp_map_changed = 0;
    let imp_cost_changed = 0;

    const imp_data = {};

    if (opts.start && opts.start.trim() != '') {
        imp_start = (1 * opts.start) - 1;
    }
    if (opts.count && opts.count.trim() != '') {
        imp_count = 1 * opts.count;
    }

    imp_data.bc_catg = opts.bc_categories;
    //let bb = await iii.getBigCommerceBrands(hash, auth_token, client_id);

    imp_data.lips_cats = lips.category_map;
    for( let i = 0; i < imp_data.lips_cats.length; i++ ) {
        let path = imp_data.lips_cats[i].bc_path;
        let bc_catg = iii.getBigCommerceCategoryByPath(imp_data.bc_catg, path);
        if( bc_catg ) {
            let bc_catg_id = bc_catg.id;
            imp_data.lips_cats[i].bc_catg_id = bc_catg_id;
        } else {
            console.log( "not BigCommerce match for path " + i + ":" + imp_data.lips_cats[i].bc_path );
            imp_data.lips_cats[i].bc_catg_id = opts.catg_default.id;
        }
    }

    imp_data.bc_export = opts.bc_products;

    let image_index = await downloads();

    imp_data.products = [];
    imp_data.pricing_and_qty = [];

    let fd = fs.createReadStream('../app_data/lipseys/catalog.csv');
    let csv1 = csv({ separator: ',' });

    fd.pipe(csv1).on('data', (data) => imp_data.products.push(data));

    let end = new Promise(function (resolve, reject) {
        csv1.on('end', () => resolve("yes"));
        fd.on('error', reject); // or something like that. might need to close `hash`
    });

    await end;
    console.log("done read 1"); //, end, imp_data.products[0]);

    // category mappings
    fd = fs.createReadStream('../app_data/lipseys/pricingquantity.csv');
    csv1 = csv({ separator: ',' });

    fd.pipe(csv1).on('data', (data) => imp_data.pricing_and_qty.push(data));

    end = new Promise(function (resolve, reject) {
        csv1.on('end', () => resolve("yes"));
        fd.on('error', reject); // or something like that. might need to close `hash`
    });

    await end;
    //console.log("done read qty/pricing ", end, catg_map[0]['ICC Desc']);

    await map_data(imp_data);

    let lips_skus = {};
    for( let i = 0; i < imp_data.products.length; i++ ) {
        let sku = imp_data.products[i].ItemNo;
        if( lips_skus[sku] ) {
            console.log("Lipsey's duplicate sku (" + sku + "), offset " + i );
        }
        lips_skus[sku] = 'y';
    }

    // some checks...
 
    // const tt = [];
    // for( let i = imp_start; i < imp_data.products.length; i++ ) {
    //     let p = imp_data.products[i];
    //     let t = p.Type.trim().toLowerCase();
    //     if( p.FflRequired.trim() == 'True' 
    //     || t.indexOf("pistol") >= 0
    //     || t.indexOf("rifle") >= 0
    //     || t.indexOf("gun") >= 0
    //     || t.indexOf("revolver") >= 0 ) {
    //         //console.log( "probably a gun", p.ItemNo, p);
    //         let tf =  t + " / " + p.FflRequired;
    //         if( !tt.includes(tf) ) {
    //             tt.push(tf);
    //             console.log("tf " + tf);
    //             console.log(p);
    //         }
    //     }
    // }
    // console.log(tt);
   

    // Add any new products
    console.log("Lipsey's adds...");
    if( imp_count == -1 ) { // process all if no limit specified
        imp_count = imp_data.products.length;
    }
    for( let i = imp_start; i < imp_start + imp_count && i < imp_data.products.length; i++ ) {
        if( sf.abort_sync ) {
            break;
        }

        let item = imp_data.products[i];
        let import_sku = item.ItemNo + "-" + lips.importOptions.sku_tag;
        let bc_export_prod = imp_data.bc_export.bc_by_sku[import_sku];
        if( !bc_export_prod ) {
            let add_outcome = await add_product(hash, auth_token, client_id, imp_data, i, opts );
            if( !add_outcome ) {
                ++imp_add_failed;
            } else {
                ++imp_added;
            }
        }
        
    }

    // update from price-and-quantity feed
    let pending_updates = [];
    console.log("Lipsey's updates...")
    for( let i = 0; i < imp_data.pricing_and_qty.length; i++ ) {

        if( sf.abort_sync ) {
            break;
        }

        let pq = imp_data.pricing_and_qty[i];
        // if( pq.ItemNumber == 'HERR22B6-GLD') {
        //     console.log('yes');
        // } else {
        //     continue;
        // }
        let bc_sku = pq.ItemNumber + "-" + lips.importOptions.sku_tag;
        let bc_export_prod = imp_data.bc_export.bc_by_sku[bc_sku];
        let overrides = getOverrides(bc_export_prod);
        if( bc_export_prod ) { 
            let is_oos = bc_export_prod.categories.includes(opts.catg_oos.id); 
            let test_categories = bc_export_prod.categories;
            
            if( is_oos ) {
                let xkey = "x" + bc_export_prod.id;
                if( ! opts.saved_catg_meta[xkey] ) {
                  test_categories = await iii.getSavedCategories(hash, auth_token, client_id, bc_export_prod, imp_data.bc_catg);
                  opts.saved_catg_meta[xkey] = test_categories;
                } else {
                  test_categories = opts.saved_catg_meta[xkey];
                }
            }
            let new_qty = pq.Quantity * 1;
            let new_cost_price = pq.Price * 1;
            let new_map = pq.RetailMap * 1;
            let new_upc = pq.Upc;
            if( overrides.map_price ) {
                new_map = overrides.map_price;
            }

            let bc_cost_price = bc_export_prod.cost_price;
            let bc_qty = bc_export_prod.inventory_level;
            let bc_upc = bc_export_prod.upc;
            let bc_map = bc_export_prod.map_price;

            let cat = imp_data.lips_by_sku[bc_export_prod.sku];
            if( !cat ) {
                console.log("Lipsey's - no cat for bc product " + bc_export_prod.sku);
            }
            let bc_catg = null;
            if( cat ) {
                // Get current mapped category
                bc_catg = find_bc_category(cat, imp_data, opts);
            }
            
            if( true || new_qty != bc_qty || new_cost_price != bc_cost_price || new_upc != bc_upc || new_map != bc_map 
                || (bc_catg && !bc_export_prod.categories.includes(bc_catg.id) ) ) {
                    
                let is_gun = opts.is_gun(test_categories);
                let markup = is_gun ? 1.20 : 1.40;
                let price = new_cost_price * markup;
                if( is_gun ) {
                    if( new_map > 0 ) {
                        price = new_map;
                    }
                } else {
                    if( new_map > price ) {
                        price = new_map;
                    }
                }
                price = Math.floor(price) + 0.99;
                if( new_qty != bc_qty || new_cost_price != bc_cost_price || new_upc != bc_upc || new_map != bc_map 
                    || price != bc_export_prod.price) {
                    let updt = {
                        "id": bc_export_prod.id,
                        "price": "" + price, "inventory_level": "" + new_qty,
                        "upc": new_upc,
                        "map_price": new_map,
                        "cost_price": new_cost_price
                    };

                    if (bc_catg && !bc_export_prod.categories.includes(bc_catg.id) 
                    && !is_oos ) {
                        let new_catg = [bc_catg.id, opts.catg_lipseys.id];
                        if (bc_export_prod.categories.includes(opts.catg_hazmat.id)) {
                            new_catg.push(opts.catg_hazmat.id);
                        }
                        updt.categories = new_catg;
                    }

                    pending_updates.push(updt);
                    ++imp_updated;
                    if( price != bc_export_prod.price ) {
                        ++imp_price_changed;
                      }
                      if( bc_qty != new_qty ) {
                        ++imp_inv_changed;
                      }
                      if( bc_map != new_map ) {
                        ++imp_map_changed;
                      }
                      if( bc_cost_price != new_cost_price ) {
                        ++imp_cost_changed;
                      }
                    if (pending_updates.length == 10) {
                        // console.log( "batch of updates", pending_updates );
                        let batch_res = null;
                        batch_res = await iii.updateProductBatch(hash, auth_token, client_id, pending_updates);
                        // console.log( 'batch res', batch_res );
                        pending_updates = [];
                    }
                } else {
                    ++imp_unchanged;
                }
            } else {
                ++imp_unchanged;
            }
        }
    }
    // apply any remaining updates
    if( pending_updates.length > 0 ) {
        // console.log( "final updates", pending_updates );
        let batch_res = null
        batch_res = await iii.updateProductBatch( hash, auth_token, client_id, pending_updates );
        // console.log( 'batch res', batch_res );
    }

    console.log('Lipsey\'s is done, added ' + imp_added + ", add failed " + imp_add_failed + 
    ', updated ' + imp_updated + ', unchanged ' + imp_unchanged );
    console.log('Changes: cost ' + imp_cost_changed + ", map " + imp_map_changed + ", inv " + imp_inv_changed + ", calculated price " + imp_price_changed );

    return;
}


async function downloads() {
    //await iii.downloadBCExport(export_file);  // Fetch the data from WEBDAV to local copy
  
    const client = new ftp.Client()
    let image_index = [];
    client.ftp.verbose = false;
    //update_status("downloads begin");
    try {
        await client.access({
            host: lips.importOptions.ftp_options.host,
            user: lips.importOptions.ftp_options.user,
            password: lips.importOptions.ftp_options.password
            //secure: true
        });
        await client.downloadTo("../app_data/lipseys/catalog.csv","/catalog.csv");
        await client.downloadTo("../app_data/lipseys/pricingquantity.csv","/pricingquantity.csv");

    }
    catch (err) {
        console.log(err);
    }
    client.close();
    return image_index;
}

function init_status() {
    // dd = iii.get_app_data();
    // dd.rsr_import_status = { xstatus: "started", xstarted: new Date(), xprogress: "initiating", xfinished: null };
    // iii.save_app_data(dd);
    // log_status(dd.rsr_import_status);
}
function update_status(msg) {
    // dd = iii.get_app_data();
    // dd.rsr_import_status.xstatus = msg;
    // dd.rsr_import_status.xstatus_time = new Date();
    // iii.save_app_data(dd);
    // log_status(dd.rsr_import_status);
}
function complete_status() {
    // dd = iii.get_app_data();
    // let now = new Date();
    // dd.rsr_import_status.xstatus = "finished";
    // dd.rsr_import_status.xstatus_time = now;
    // dd.rsr_import_status.xfinished = now;
    // iii.save_app_data(dd);
    // log_status(dd.rsr_import_status);
}

function log_status(ss) {
    console.log(ss);
}
                        
async function add_product(hash, auth_token, client_id, d, i, opts ) {
    let item = d.products[i];
    let add_data = {
        "inventory_warning_level": 3
    };

    let item_no = item.ItemNo;
    let bc_sku = item_no + '-' + lips.importOptions.sku_tag;

    let custom_fields = [ 
        { name: "_warehouse_", value: "lipseys" }
    ];
    
    add_data.type = "physical";
    add_data.sku = item_no + "-" + lips.importOptions.sku_tag;

    add_data.categories = [ opts.catg_lipseys.id ];

    // Determine category

    let bc_catg = find_bc_category(item, d, opts);
    add_data.categories.push(bc_catg.id);

    let is_ammo = opts.is_ammo(add_data.categories);

    let is_gun = false;
    if (opts.is_gun(add_data.categories) ) {
        is_gun = true;
    } else {
        if( gun_types.includes(item.Type) ) {
            is_gun = true;
        }
    }

    if( is_gun || item.FflRequired.toLowerCase() == "true" || item.FflRequired.toLowerCase() == "yes" ) {
        custom_fields.push( { name: "FFL", "value": "Yes" } );
    }
    if( is_gun ) {
        custom_fields.push({ "name": "_gun_", "value": "true" });
    }
    if( is_ammo ) {
        custom_fields.push({ "name": "_ammo_", "value": "true" });
    }

    if( is_ammo  ) {       
        add_data.categories.push( opts.catg_hazmat.id );
    }

    add_data.inventory_level = 1.0 * item.Quantity;
    add_data.inventory_tracking = "product";
    add_data.condition = "New";

    // Determine if this is a 
    let price = item.Price;
    let map = item.RetailMap;
    if( map != '' ) {
        map = map * 1.00;
    }
    let inv = item.Quantity;
    // Pricing and Quantity ftp file may have newer data
    let pq = d.pricing_and_qty_by_sku[bc_sku];
    if (pq) {
        inv = pq.Quantity;
        price = pq.Price;
        map = pq.RetailMap;
    }
    let cost_price = price * 1.0;
    if( is_gun ) {
        price = 1.20 * price;
        if( map > 0 ) {
            price = map;
        }
    } else {
        price = 1.40 * price;
        if( map > price ) {
            price = map;
        }
    }
    // if( map != '' && (map * 1.0 > price ) ) {
    //     map = map * 1.0;
    //     price = 1.0 * map;
    // }
    price = Math.floor(price) + 0.99;

    add_data.price = price;
    add_data.map_price = map;
    add_data.cost_price = cost_price;

    add_data.weight = 1.0 * item.ShippingWeight;
    if( item.ItemLength != '' ) {
        add_data.length = 1.0 * item.ItemLength;
    }
    if( item.ItemWidth != '' ) {
        add_data.width = 1.0 * item.ItemWidth;
    }
    if( item.ItemHeight != '' ) {
        add_data.depth = 1.0 * item.ItemHeight;
    }
    if( item.ManufacturerModelNo != '' ) {
        add_data.mpn = item.ManufacturerModelNo;
    }
    if( item.RetailMap != '' && item.RetailMap != '0' ) {
        add_data.map_price = 1.0 * item.RetailMap;
    }
    if( item.Manufacturer != '' ) {
        add_data.brand_name = item.Manufacturer;
    }
    if( item.Upc != '' ) {
        add_data.upc = item.Upc;
    }

   
    add_data.name = getUniqueLipseysProductName(d.lipsByName, item, opts);
    
    const img_regex = / /ig;
    let imageName = item.ImageName.replace(img_regex,"%20"); // BigCommerce doesn't like spaces in the URL
    let img_url = lips.importOptions.image_url.replace(lips.importOptions.image_url_ix,imageName);
    if( img_url == "https://www.lipseyscloud.com/images/CD930.246" ) { // this is fix for one stupid item with a goofy image 
        img_url = "https://i.securesrvr.net/small_image/bGlwc2V5cw/CD.jpg";
    }
    if( iii.imgURLExists(img_url) ) {
        add_data.images = [ { "image_url": img_url, "is_thumbnail": true } ];
    } else {
        add_data.is_visible = false;
    }
    add_data.is_visible = false; // all added get initially hidden

    let desc = '<div>' + iii.escapeForHTML(item.Description1) + '</div>';
    if( item.Description2 != '' ) {
        desc += '\n<div>' + iii.escapeForHTML(item.Description2) + '</div>'
    }
    let bullets = "";
    if( item.AdditionalFeature1 != '' ) {
        bullets += '\n<li>' + iii.escapeForHTML(item.AdditionalFeature1) + '</li>'
    }
    if( item.AdditionalFeature2 != '' ) {
        bullets += '\n<li>' + iii.escapeForHTML(item.AdditionalFeature2) + '</li>'
    }
    if( item.AdditionalFeature3 != '' ) {
        bullets += '\n<li>' + iii.escapeForHTML(item.AdditionalFeature3) + '</li>'
    }
    if(bullets != '') {
        desc += '\n<ul class="sf_feat">' + bullets + '</ul>';
    }
    add_data.description = desc;

    
    var entries = Object.entries(item);
    for ([k, v] of entries) {
        if( v != '' && v != 'False' ) {
            let cname = lips.importOptions.csvCustomFields[k];
            if( cname ) {
                custom_fields.push( { "name": cname, "value": v } );
            }
        }
    }   
    add_data.custom_fields = custom_fields;

    
    let add_opts = {
          'method': 'POST',
          'hostname': 'api.bigcommerce.com',
          'path': '/stores/' + hash + '/v3/catalog/products',
          'headers': {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Auth-Token': auth_token,
              'X-Auth-Client': client_id,
          },
          'maxRedirects': 20
    };

    //console.log('going to add', add_data);
    let added = false;
    add_data.categories.push(opts.catg_unlisted.id); 
    let ss = JSON.stringify(add_data);
    let outcome = await iii.addABC(add_opts, ss);
    if( outcome && outcome.data ) {
        added = true;
        if( add_data.categories.includes(opts.catg_hazmat.id) ) {
            let oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, outcome.data.id);
            if( oc && oc.data ) {
            //
            } else {
                console.log("Lipsey's hazmat metafield add failed for " + outcome.data.id + ", error is " + oc);
            }
        } 
    } else {
        console.log( "Lipsey's add failed - " + outcome);
        console.log(add_data);
    }
    return added;
  }
  

/**
 * Pull latest BigCommerce product export and map Kins stock numbers to the BigCommerce objects. 
 * This is for the purpose of seeing if an item needs to be added or updated.
 * 
 * @returns 
 */
 async function map_data(imp_data) {
  
    imp_data.pricing_and_qty_by_sku = [];
    for( let i =0; i < imp_data.pricing_and_qty.length; i++ ) {
        let pq = imp_data.pricing_and_qty[i];
        let bc_sku = pq.ItemNumber + '-' + lips.importOptions.sku_tag;
        imp_data.pricing_and_qty_by_sku[bc_sku] = pq;
     }

    imp_data.lipsByName = [];
    imp_data.lips_by_sku = [];
    for (let i = 0; i < imp_data.products.length; i++) {
        let lips_prod = imp_data.products[i];
        let lips_name = lips_prod.Description1;
        let prods_for_name = imp_data.lipsByName[lips_name];
        if (!prods_for_name) {
            prods_for_name = [];
            imp_data.lipsByName[lips_name] = prods_for_name;
        } 
        prods_for_name.push(lips_prod);
        let bc_sku = lips_prod.ItemNo + '-' + lips.importOptions.sku_tag;
        imp_data.lips_by_sku[bc_sku] = lips_prod;
    }

    
  }

// manual adjustment of fields from quote csv - found errors with non-escapped "

function cleanCSV(str) {
    if (str.startsWith('"') && str.endsWith('"')) {
        str = str.substring(1, str.length - 1);
        str = str.replace(/[0-9]""/g, '"');
        str = str.replace(/"" /g, ', ');
    }
    return str;
}

/**
 * 
 * @param namesToProd - keyed around where [product_name] gives an array of one or more product csvs with that name 
 * @param {*} prod - csv object for the RSR product
 * 
 * Returns the BigCommerce unique name - RSR's ProductDescription with suffix of the form " (si)",
 * where 's' is the unique vendor suffix, and 'i' is the duplicate index of the products for the name, if it
 * is a duplicate.
 */
function getUniqueLipseysProductName(namesToProd, prod, opts) {
    let product_name = prod.Description1;
    let products_for_name = namesToProd[product_name];
    let name_ix = '';
    if (products_for_name && products_for_name.length > 1) {
        for (let i = 0; i < products_for_name.length; i++) {
            let name_prod = products_for_name[i];
            if (name_prod.ItemNo == prod.ItemNo) {
                name_ix += (i + 1);
                break;
            }
        }
    }
    product_name += " (" + lips.importOptions.name_tag + name_ix + ")";
    let bc = opts.bc_products.bc_by_name[product_name];
    if( bc ) {
        // nuts - same name in BigCommerce already
        product_name = product_name.slice(0, -1) + "." + bc.dupe_ct++ + ")";
    }
    return product_name;
}

function find_bc_category(item, d, opts) {
    // Determine category - outside loop since empty string is valid
    let grp = item.ItemGroup;
    if( !grp ) {
        grp = "";
    }
    let type = item.Type;
    if( !type ) {
        type = "";
    }
    let bc_catg = null;
    let pathx = null;
    for( let x = 0; x < d.lips_cats.length; x++ ) {
        if( d.lips_cats[x].itemGroup == grp && d.lips_cats[x].type == type ) {
            bc_catg = iii.getBigCommerceCategoryByPath( d.bc_catg, d.lips_cats[x].bc_path );
            pathx = d.lips_cats[x].bc_path;
            break;
        }
    }
    if( !bc_catg ) {
        console.log("No mapped category for Lipsey's item: " + item.ItemNo + ", path=" + pathx );
        console.log(item);
        bc_catg = opts.catg_default;
    } 
    
    return bc_catg;
}

exports.lipseys_import = lipseys_import;
