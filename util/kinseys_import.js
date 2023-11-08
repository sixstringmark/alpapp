/**
 * This module handles specific processing for importing / syncing Sportsman's Finest BigCommerce catalog
 * with Kinsey's.
 * 
 * Basically, Kinsey's had two main FTP files:
 *
 * KinseysUpdate_MMDDYY.txt -  csv, tab-delimited, with all product details
 * kin-inv - XML with just product id and current inventory and price
 * 
 * There is also a Categories Excel file that can be processed manually to set up Categories
 */
const Client = require('ftp');
const ftp = require("basic-ftp");
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("../util/ick");
const kins = require("./KinseysMappings");
const stream = require("stream");
//const request = require("request");
//const e = require('express');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
//const webdavClient = require('webdav-client');
//const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const { scryptSync } = require('crypto');
const img_domain = "webstore.kinseysinc.com";
const img_path = "/product/image/large/";
const img_host = img_domain + img_path;

const DD = " / ";

//duh();

async function kinseys_import(hash, auth_token, client_id, opts) {

    init_status();

    let start = new Date().getTime();

    let cc = opts.bc_categories;

    let catmap = kins.categoryMappings;
    let def_cat = iii.getBigCommerceCategoryByPath(cc, kins.importOptions.default_category_path);
    //import_data.default_catg = def_cat;
    for (let i = 0; i < catmap.length; i++) {
        let path = catmap[i].bc_path;
        let bc_catg = iii.getBigCommerceCategoryByPath(cc, path);
        if (bc_catg) {
            let bc_catg_id = bc_catg.id;
            catmap[i].bc_catg_id = bc_catg_id;
        } else {
            console.log("No Kinsey's BigCommerce category match for path ", catmap[i].bc_path );
            catmap[i].bc_catg_id = def_cat.id;
        }
    }

    // Get the mother lode from the BigCommerce catalog
    let pp = opts.bc_products;

    let elapsed = new Date().getTime() - start;

    //console.log( 'took ' + elapsed );
    
    
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
  

    if (opts.start && opts.start.trim() != '') {
        imp_start = (1 * opts.start) - 1;
    }
    if (opts.count && opts.count.trim() != '') {
        imp_count = 1 * opts.count;
    }
 
    // Refresh local copies from FTP
    let image_index = await downloads();

    // Join Kinsey's csv files
    let prod_to_inv = await mapProductsToInv();

    const results = [];
    const catg_map = [];

    let fd = fs.createReadStream('../app_data/Products.csv');
    let csv1 = csv({bom:true});

    fd.pipe(csv1).on('data', (data) => results.push(data));

    let end = new Promise(function (resolve, reject) {
        csv1.on('end', () => resolve("yes"));
        fd.on('error', reject); // or something like that. might need to close `hash`
    });

    await end;

    
    console.log("Kinsey's done read 1");

    // Due to csv parser and character set issues, first column name could be corrupted with BOM, so get the actual value
    let keyNorthItemNumber = "";
  Object.keys(results[0]).forEach(function (key, index) {
    
    if (key.endsWith("NorthItemNumber")) {
      keyNorthItemNumber = key;
    }
    

    // key: the name of the object key
    // index: the ordinal position of the key within the object 
  });

    let zc = 0;
    for( let z in pp.bc_by_sku ) {
        zc++;
        if( z == '1001406-a2luc2V5cw' ) {
            console.log('bang',z);
        }
        z = 'x';
    }

    // category mappings
    // fd = fs.createReadStream('../app_data/kinsey_master_cat.csv');
    // csv1 = csv({ separator: ',' });

    // fd.pipe(csv1).on('data', (data) => catg_map.push(data));

    // end = new Promise(function (resolve, reject) {
    //     csv1.on('end', () => resolve("yes"));
    //     fd.on('error', reject); // or something like that. might need to close `hash`
    // });

    // await end;
    //console.log("done read catg map ", end, catg_map[0]['ICC Desc']);

    /** 
     To handle duplicate product names, build map by name to it's 
     SKUs - we can then append and index to the name to avoid BigCommerce
     duplicate errors
   **/
    let kinsByName = [];
    for (let i = 0; i < results.length; i++) {
        let kins_prod = results[i];
        let kins_name = kins_prod.Description1 + ' ' + kins_prod.Description2;
        let prods_for_name = kinsByName[kins_name];
        if (!prods_for_name) {
            prods_for_name = [];
            kinsByName[kins_name] = prods_for_name;
            prods_for_name.push(kins_prod);
        } else {
            // watch out for duplicate on product code
            let found = false;
            for( let j = 0; j < prods_for_name.length; j++ ) {
                if( prods_for_name[j][keyNorthItemNumber] == kins_prod[keyNorthItemNumber] ) {
                    found == true;
                    break;
                }
            }
            if( !found ) { // same name, haven't seen that product code yet
                prods_for_name.push(kins_prod);
            }
        }
 
    }

    let pending_updates = [];
    let processed_prods = []; // watch out for duplicates on product code
    if( imp_count == -1 ) {
        imp_count = results.length;
    }
    for (let i = imp_start; i < imp_start + imp_count && i < results.length; i++) {

        if( sf.abort_sync ) {
            break;
        }

        let item = results[i];
        
        let inactive = item.Inactive;
        
        // if (inactive != 'True') {
            let import_sku = item[keyNorthItemNumber] + "-" + kins.importOptions.sku_tag;
            let bc_export_prod = pp.bc_by_sku[import_sku];
            let overrides = getOverrides(bc_export_prod);
            if (bc_export_prod) {

                let is_oos = bc_export_prod.categories.includes(opts.catg_oos.id); 
                let test_categories = bc_export_prod.categories;
                if( is_oos ) {
                    let xkey = "x" + bc_export_prod.id;
                    if( ! opts.saved_catg_meta[xkey] ) {
                      test_categories = await iii.getSavedCategories(hash, auth_token, client_id, bc_export_prod, cc);
                      opts.saved_catg_meta[xkey] = test_categories;
                    } else {
                      test_categories = opts.saved_catg_meta[xkey];
                    }

                }

                // grab BigCommerce values for comparison
                let bc_inv = bc_export_prod.inventory_level;
                let bc_price = bc_export_prod.price;
                let bc_map_price = bc_export_prod.map_price;
                let bc_upc = bc_export_prod.upc;
                let bc_cost_price = bc_export_prod.cost_price;
                
                let is_gun = opts.is_gun(test_categories);
                let is_archery = opts.is_archery(test_categories);
            
                let item_inv = prod_to_inv[item[keyNorthItemNumber]];

                if (item_inv) {
                    // Kinsey's values for comparison
                    let kins_inv = item_inv.quantity;
                    let kins_cost_price = item_inv.price;
                    let markup = 1.40;
                    if( is_gun ) {
                        markup = 1.20;
                    }
                    let kins_upc = item_inv.upc;
                    let kins_map_price = 0;
                    if( item_inv.map_price && item_inv.map_price != 0 ) {
                        kins_map_price = item_inv.map_price * 1;
                    }
                    if( overrides.map_price ) {
                        kins_map_price = overrides.map_price;
                    }
                    let kins_price = 0;
                    if( is_gun ) {
                        if( kins_map_price > 0 ) {
                            kins_price = kins_map_price; // take MAP price if present for gun
                        } else {
                            kins_price = kins_cost_price * markup; // otherwise multiplier for gun
                        }
                    } else {
                        kins_price = kins_cost_price * markup;
                        if( kins_price < kins_map_price ) {
                            kins_price = kins_map_price; // take larger of MAP and multiplier for non-gun
                        }
                    }
                    kins_price = Math.floor(kins_price) + 0.99;
                    let hide_me = bc_export_prod.is_visible && is_archery;

                    if( bc_inv != kins_inv || hide_me ||
                        bc_price != kins_price || 
                        bc_upc != kins_upc || 
                        kins_map_price != bc_map_price ||
                        kins_cost_price != bc_cost_price ) {
                        let updt = { "id": bc_export_prod.id, "price": "" + kins_price, "inventory_level": "" + kins_inv, "upc": kins_upc,
                                     "cost_price": kins_cost_price, "map_price": kins_map_price };
                        if( hide_me ) {
                            updt.is_visible = false;
                        }
                        // if( updt_images ) {
                        //     updt.images = updt_images;
                        // }

                        if (bc_price != kins_price) {
                            ++imp_price_changed;
                        }
                        if (bc_inv != kins_inv) {
                            ++imp_inv_changed;
                        }
                        if (kins_map_price != bc_map_price) {
                            ++imp_map_changed;
                        }
                        if (kins_cost_price != bc_cost_price) {
                            ++imp_cost_changed;
                        }
                        pending_updates.push(updt);
                        // console.log('import_sku='+ import_sku + ', bc_inv=' + bc_inv + ', rsr_inv=' + rsr_inv);
                        if (pending_updates.length == 10) {
                            // console.log("batch of updates", pending_updates);
                            let batch_res = null;
                            batch_res = await iii.updateProductBatch(hash, auth_token, client_id, pending_updates);
                            // console.log( 'batch res', batch_res );
                            pending_updates = [];
                        }
                        ++imp_updated;
                    } else {
                        ++imp_unchanged;
                    }
                } else {
                    ++imp_unchanged;
                    // Some not in inv file
                    // if( !bc_images || !bc_images.item ) {
                    //     //console.log( "need image", bc_export_prod);
                    //     let img_url = img_path + item.ProductCode + "_1.jpg";
                    //     let have_img = await iii.imageExists(img_domain, img_url);
                    //     if( have_img ) {
                    //         let updt = { "id": bc_export_prod.Product_ID[0], "images": [ 
                    //             {
                    //                 "image_url": "https://" + img_domain + img_url,
                    //                 "is_thumbnail": true
                    //             }
                    //         ] };
                    //         pending_updates.push(updt);
                    //         // console.log('import_sku='+ import_sku + ', bc_inv=' + bc_inv + ', rsr_inv=' + rsr_inv);
                    //         if( pending_updates.length == 10 ) {
                    //             console.log( "batch of updates", pending_updates );
                    //             let batch_res = await iii.updateProductBatch( hash, auth_token, client_id, pending_updates );
                    //             //console.log( 'batch res', batch_res );
                    //             pending_updates = [];
                    //         }
                    //         ++imp_updated;
                    //     }
                    // }
                }
            } else {
                if ( !processed_prods[item[keyNorthItemNumber]] && inactive != "Yes" ) {
                    let oc = await add_product(hash, auth_token, client_id, item, cc, image_index, kinsByName, catmap, prod_to_inv, opts, keyNorthItemNumber);
                    if( oc ) {
                        ++imp_added;
                    } else {
                        ++imp_add_failed;
                    }
                    processed_prods[item[keyNorthItemNumber]] = true;
                } else {
                    //console.log('will not process duplicate or inactive ' + item.NorthItemNumber);
                }
            }
        // } else {
        //     console.log("Skipping inactive item " + item.ProductCode);
        // }
    }

    if( pending_updates.length > 0 ) {
        // console.log( "final updates", pending_updates );
        let batch_res = null;
        batch_res = await iii.updateProductBatch( hash, auth_token, client_id, pending_updates );
        // console.log( 'batch res', batch_res );
    }

    console.log('Kinsey\'s is done, added ' + imp_added + ", add failed " + imp_add_failed + 
    ', updated ' + imp_updated + ', unchanged ' + imp_unchanged );
    console.log('Changes: cost ' + imp_cost_changed + ", map " + imp_map_changed + ", inv " + imp_inv_changed + ", calculated price " + imp_price_changed );


    return;
}


async function downloads() {
    const client = new ftp.Client()
    let image_index = [];
    client.ftp.verbose = false;
    //update_status("downloads begin");
    try {
        await client.access({
            host: "ftp.kinseysinc.com",
            user: "***",
            password: "***"
            //secure: true
        });
        let fff = await client.list("/images/1024x1024 Item Images/");
        for( let i = 0; i < fff.length; i++ ) {
            image_index[fff[i].name] = fff[i];
        }
        //console.dir(fff.length, fff[0].name);
        //await client.uploadFrom("README.md", "README_FTP.md")
        //update_status("downloading categories");attributes-all.txt

        await client.downloadTo("../app_data/kin-inv.xml","/kin-inv");
        await client.downloadTo("../app_data/Products.csv","/Products.csv");

        // the following file is not update - may be replaced at some point by a more current file
        //await client.downloadTo("../app_data/KinseysUpdate.txt","KinseysUpdate_051421.txt");

        // await client.downloadTo("../app_data/categories.txt", "/keydealer/categories.txt");
        // await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");
        //update_status("downloads complete");
        //client.end();
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

async function add_product(hash, auth_token, client_id, prod, cc, image_index, kinsByName, catg_map, prod_to_inv, opts, keyNorthItemNumber) {

    let added = false;

    let item_inv = prod_to_inv[prod[keyNorthItemNumber]];
    if( !item_inv ) {
        console.log("Can't add - No Kinsey's Inv for " + prod[keyNorthItemNumber], prod);
        return added;
    }

    //console.log("add_product", hash, auth_token, client_id, prod);

    // First deal with categories
    // Find 'Kinsey Products' Parent in BC
    let item_catg_id = locateBigCommerceCategory( cc, prod, catg_map, keyNorthItemNumber );
    if( !item_catg_id ) {
        console.log("Kinsey's - can't add, no category mapped", prod);
        return;
    }
    let is_gun = opts.is_gun(item_catg_id);
    let is_ammo = opts.is_ammo(item_catg_id);
    let is_archery = opts.is_archery(item_catg_id);
    let markup = 1.40;
    if( is_gun ) {
        markup = 1.20;
    }

    // See how many images we have for this item
    const ftp_images = [
        image_index[prod[keyNorthItemNumber] + "_1.jpg"], 
        image_index[prod[keyNorthItemNumber] + "_2.jpg"], 
        image_index[prod[keyNorthItemNumber] + "_3.jpg"], 
        image_index[prod[keyNorthItemNumber] + "_4.jpg"],     
        image_index[prod[keyNorthItemNumber] + "_5.jpg"], 
        image_index[prod[keyNorthItemNumber] + "_6.jpg"]  
    ];

    let ff = null;
    let base_img = prod.ImageName;
    let prod_images = [];

    for( let i = 0; i < ftp_images.length; i++ ) {
        if( ftp_images[i] ) {
            if( prod_images.length == 0 ) {
                prod_images.push(
                {
                    "image_url": "https://" + img_host + ftp_images[i].name,
                    "is_thumbnail": true
                }
                );
            } else {
                prod_images.push(
                {   
                    "image_url": "https://" + img_host + ftp_images[i].name
                }
                );
            }
        }
    }
    if( prod_images.length == 0 ) {
        let img_url = "https://webstore.kinseysinc.com/product/image/large/" + prod[keyNorthItemNumber] + "_1.jpg";
        if( await iii.imgURLExists( img_url ) ) {
            prod_images.push(
                {
                    "image_url": img_url,
                    "is_thumbnail": true
                }
            );
            console.log("Kinsey's - added aux image: " + img_url);
        }
    }
    if( prod_images.length == 0 ) {
        let img_url = "https://webstore.kinseysinc.com/product/image/medium/" + prod[keyNorthItemNumber] + "_1.jpg";
        if( await iii.imgURLExists( img_url ) ) {
            prod_images.push(
                {
                    "image_url": img_url,
                    "is_thumbnail": true
                }
            );
            console.log("Kinsey's - added aux image: " + img_url);
        }
    }

    let cust = [{ name: "_warehouse_", "value": "kinseys" }];

    if( prod.RHLH != '' ) {
        cust.push( {'name': 'Hand (L/R)', 'value': prod.RHLH} );
    }
    if( prod.Color1 != '') {
        cust.push( {'name': 'Color 1', 'value': prod.Color1} );
    }
    if( prod.Color2 != '') {
        cust.push( {'name': 'Color 2', 'value': prod.Color2} );
    }
    if( prod.Size != '') {
        cust.push( {'name': 'Size', 'value': prod.Size} );
    }

    let add_opts =
    {
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

   // let bcCategory = await getBCCatg(hash, auth_token, client_id, prod, cc, rsrCatg);

//    const bullet_features = [
//        prod.BulletFeature1,
//        prod.BulletFeature2,
//        prod.BulletFeature3,
//        prod.BulletFeature4,
//        prod.BulletFeature5
//    ];

    let xct = 0;
    let bullet_features = [];
    if( prod.BulletFeatures != '' ) {
        bullet_features = prod.BulletFeatures.split(';');
    }
    
    let extra_desc = '<div class="sf-features"><ul>';
    for(let j = 0; j < bullet_features.length; j++) {
        if( bullet_features[j] != '' ) {
            xct++;
            extra_desc += '<li>' + bullet_features[j] + '</li>';
        }
    }
    extra_desc += '</ul></div>';
    if( xct == 0 ) {
        extra_desc = '';
    }
    
    let add_data =
    {
        "name": getUniqueKinseysProductName(kinsByName, prod, opts, keyNorthItemNumber),
        "sku": prod[keyNorthItemNumber] + "-" + kins.importOptions.sku_tag,
        "upc": prod.BarCode,
        "type": "physical",
        "inventory_warning_level": 3,
        "description": prod.ExtendedText + ' ' + extra_desc,
        "weight": prod.Weight * 1.0,
        "price": 9999.99, // have to get this from the inv xml file prod.RetailPrice,
        "categories": [
            item_catg_id, opts.catg_kinseys.id
        ],
        //"images": prod_images,
        "inventory_level": 0, // have to get from inv xml file prod.InventoryQty,
        "inventory_tracking": "product",
        "condition": "New"
    };
    if (prod_images != null && prod_images.length > 0) {
        add_data.images = prod_images;
    } else {
        add_data.is_visible = false;
    }
    if( is_archery ) {
        add_data.is_visible = false;        
    }
    add_data.is_visible = false; // all added get initially hidden
    

    if (prod.Brand != '') {
        // let bcb = await getBCBrand(hash, auth_token, client_id, prod.Brand, bcBrands);
        add_data.brand_name = prod.Brand;
    }
    if( prod.VendorItemNumber != '' ) {
        add_data.mpn = prod.VendorItemNumber;
    }
    if( prod.ProductLength != '' ) {
        add_data.depth = prod.ProductLength * 1.0;
    }
    if( prod.ProductWidth != '' ) {
        add_data.width = prod.ProductWidth * 1.0;
    }
    if( prod.ProductHeight != '' ) {
        add_data.height = prod.ProductHeight * 1.0;
    }

    // insert values from the inventory update file
    // if( item_inv ) {
        let base_price = item_inv.price * 1;
        let price = base_price * markup;
        if( item_inv.map_price && item_inv.map_price != '' ) {
            let map_price = item_inv.map_price * 1;
            if( is_gun ) {
                if( map_price > 0 ) {
                    price = map_price; // always use MAP if present for gun
                }
            } else if( price < map_price ) {
                price = map_price; // for non-gun, use MAP if greater than marked-up.
            }
            add_data.map_price = map_price;
        }
        add_data.price = Math.floor(price) + 0.99;
        add_data.cost_price = base_price;
        add_data.inventory_level = item_inv.quantity;
        add_data.upc = item_inv.upc;
    // }

    if( is_ammo ) {
        let ammo_catg = iii.getBigCommerceCategoryByPath( cc, ["HazMat"] );
        if( ammo_catg ) {
            add_data.categories.push( ammo_catg.id );
            cust.push( { "name": "_ammo_", "value" : "true" } );
        }
    }

    if( is_gun ) {
        cust.push( { "name": "FFL", "value" : "Yes" } );
    }

    if (cust.length > 0) {
        add_data.custom_fields = cust;
    }

    

    //console.log(add_data);
    add_data.categories.push(opts.catg_unlisted.id); 
    let ss = JSON.stringify(add_data);
    ff = 'test';
    ff = await iii.addABC(add_opts, ss);
    if( ff && ff.data && ff != 'test' ) {
        added = true;
        if( add_data.categories.includes(opts.catg_hazmat.id) ) {
            let oc = null;
            oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, ff.data.id);
            if( oc && oc.data ) {
            //
            } else {
                console.log("Kinsey's hazmat metafield add failed for " + ff.data.id + ", error is " + oc);
            }
        } 
    } else {
        console.log('bad add - ', ff);
        console.log(add_data);
    }
    return added;
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
function getUniqueKinseysProductName(namesToProd, prod, opts, keyNorthItemNumber) {
    let product_name = prod.Description1 + ' ' + prod.Description2
    let products_for_name = namesToProd[product_name];
    let name_ix = '';
    if (products_for_name && products_for_name.length > 1) {
        for (let i = 0; i < products_for_name.length; i++) {
            let name_prod = products_for_name[i];
            if (name_prod.NorthItemNumber == prod[keyNorthItemNumber]) {
                name_ix += (i + 1);
                break;
            }
        }
    }
    product_name += " (" + kins.importOptions.name_tag + name_ix + ")";
    let bc = opts.bc_products.bc_by_name[product_name];
    if( bc ) {
        // nuts - same name in BigCommerce already
        product_name = product_name.slice(0, -1) + "." + bc.dupe_ct++ + ")";
    }
    return product_name;
}




async function findBigCommerceCategory(hash, auth_token, client_id, cats, item, catg_map ) {

    const kICC = item.ItemCategoryCode;
    const kPGC = item.ProductGroupCode;
    let kSG1 = item.ProductSubGroup1;
    if( !kSG1 ) {
        kSG1 = '';
    }
    let kSG2 = item.ProductSubGroup2;
    if( !kSG2 ) {
        kSG2 = '';
    }

    // Find map by levels 

    // Find Kinsey Products category
    const kinseysTopName = 'Kinsey\'s Products';
    let topcat = null;
    for (let i = 0; i < cats.data.length; i++) {
        if (cats.data[i].name == kinseysTopName) {
            topcat = cats.data[i];
            break;
        }
    }
    if( !topcat ) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kinseysTopName, 0 );
        topcat = newcat.data;
        cats.data.push(topcat);
    }

    // Find a matching entry
    let kMaster = null;
    for( let i = 0; i < catg_map.length; i++ ) {
        // _string1.localeCompare(_string2, _locale, { sensitivity: 'base' }) === 0
        if( catg_map[i].ICC.localeCompare( kICC, undefined, { sensitivity: 'base' } ) === 0 &&
            catg_map[i].PGC.localeCompare( kPGC, undefined, { sensitivity: 'base' } ) === 0 &&
            catg_map[i].Sub1.localeCompare( kSG1, undefined, { sensitivity: 'base' } ) === 0 &&
            catg_map[i].Sub2.localeCompare( kSG2, undefined, { sensitivity: 'base' } ) === 0 
        ) {
            kMaster = catg_map[i];
            break;
        }
    }
    if( !kMaster ) {
        return topcat;
    }

    // This cascade will populate up to 5 levels of categories
    
    const kMainName = kMaster.CatgMain;
    const kICCname = kMaster.ICCDesc;
    const kPGCname = kMaster.PGCDesc;
    const kSub1name = kMaster.Sub1Desc;
    const kSub2name = kMaster.Sub2Desc;

    let catgMain = null;
    for( let i = 0; i < cats.data.length; i++ ) {
        if (cats.data[i].name == kMainName && cats.data[i].parent_id == topcat.id ) {
            catgMain = cats.data[i];
            break;
        }
    }
    if( !catgMain ) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kMainName, topcat.id );  
        catgMain = newcat.data;
        cats.data.push(catgMain);
    }
    if( kICCname == '' ) {
        return catgMain;
    }

    let catgICC = null;
    // Little hiccup here - skip level if main category name is same as ICC level
    if( kMainName == kICCname ) {
        catgICC = catgMain;
    } else {
        for( let i = 0; i < cats.data.length; i++ ) {
            if (cats.data[i].name == kICCname && cats.data[i].parent_id == catgMain.id ) {
                catgICC = cats.data[i];
                break;
            }
        }
        if( !catgICC ) {
            let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kICCname, catgMain.id );  
            catgICC = newcat.data;
            cats.data.push(catgICC);
        }
    }

    if( kPGCname == '' ) {
        return catgICC;
    }

    let catgPGC = null;
    for( let i = 0; i < cats.data.length; i++ ) {
        if (cats.data[i].name == kPGCname && cats.data[i].parent_id == catgICC.id ) {
            catgPGC = cats.data[i];
            break;
        }
    }
    if( !catgPGC ) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kPGCname, catgICC.id );  
        catgPGC = newcat.data;
        cats.data.push(catgPGC);
    }
    if( kSub1name == '' ) {
        return catgPGC;
    }

    let catgSub1 = null;
    for( let i = 0; i < cats.data.length; i++ ) {
        if (cats.data[i].name == kSub1name && cats.data[i].parent_id == catgPGC.id ) {
            catgSub1 = cats.data[i];
            break;
        }
    }
    if( !catgSub1 ) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kSub1name, catgPGC.id );  
        catgSub1 = newcat.data;
        cats.data.push(catgSub1);
    }
    if( kSub2name == '' ) {
        return catgSub1;
    }

    let catgSub2 = null;
    for( let i = 0; i < cats.data.length; i++ ) {
        if (cats.data[i].name == kSub2name && cats.data[i].parent_id == catgSub1.id ) {
            catgSub2 = cats.data[i];
            break;
        }
    }
    if( !catgSub2 ) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kSub2name, catgSub1.id );  
        catgSub2 = newcat.data;
        cats.data.push(catgSub2);
    }
 
    return catgSub2;
}

// Note this returns category id, or null if none found
function locateBigCommerceCategory(bc_cats, item, catg_map, keyNorthItemNumber ) {

    let ret_catg_id = null; 

    let kICC = item.ItemCategoryCode.toUpperCase();
    let kPGC = item.ProductGroupCode.toUpperCase();
    let kSG1 = item.ProductSubGroup1;
    if( !kSG1 ) {
        kSG1 = '';
    } else {
        kSG1 = kSG1.toUpperCase();
    }
    let kSG2 = item.ProductSubGroup2;
    if( !kSG2 ) {
        kSG2 = '';
    } else {
        kSG2 = kSG2.toUpperCase();
    }

    // Find map by levels 

    

    // Find a matching entry
    let kMaster = null;
    for( let i = 0; i < catg_map.length; i++ ) {
        // _string1.localeCompare(_string2, _locale, { sensitivity: 'base' }) === 0
        let bICC = catg_map[i].itemCatgCode.toUpperCase();
        let bPGC = catg_map[i].groupCode.toUpperCase();
        let bSG1 = catg_map[i].subgroup1Code.toUpperCase();
        let bSG2 = catg_map[i].subgroup2Code.toUpperCase();

        if( bICC == kICC && bPGC == kPGC && bSG1 == kSG1 && bSG2 == kSG2 ) {
            let bc_catg = iii.getBigCommerceCategoryByPath(bc_cats,catg_map[i].bc_path)
            //console.log("locate for ", catg_map[i].bc_path, " returned ", bc_catg );
            if( bc_catg ) {
                ret_catg_id = bc_catg.id;
            }
            break;
        }
    }

    if( !ret_catg_id ) {
        console.log("Kinsey's has no category path for /" + kICC + "/" + kPGC + "/" + kSG1 + "/" + kSG2 + "/");
        console.log("Item " + item[keyNorthItemNumber] );
    } else {
        //console.log("Kinsey's has category path for /" + kICC + "/" + kPGC + "/" + kSG1 + "/" + kSG2 + "/", item);
    }
    return ret_catg_id;

}



/**
 * index Kinsey's inventory/price XML by item no for easy access
 */
async function mapProductsToInv() {

    const kinseys_inv = iii.get_xml_data("../app_data/kin-inv.xml");

    const matches = xpath.find(kinseys_inv, "//Items/Item");
    const prod_to_inv = [];

    for( let i = 0; i < matches.length; i++ ) {
        let xprod = matches[i];
        let xkey = xprod.ItemNo[0];
        let qty = xprod.QtyAvailable[0];
        let map = xprod.MapPrice[0];
        let price = xprod.Price[0];
        let upc = xprod.UPC[0];

        prod_to_inv[xkey] = 
        {
            'quantity': qty,
            'map_price': map,
            'price': price,
            'upc': upc,
            'item_no': xkey
        }
    }

    return prod_to_inv;

}


exports.kinseys_import = kinseys_import;
