var Client = require('ftp');
const ftp = require("basic-ftp");
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("../util/ick");
const rsr = require("./RSRMappings");
const stream = require("stream");
//const request = require("request");
//const e = require('express');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
//const webdavClient = require('webdav-client');
//const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");

const DD = " / ";

//duh();

async function rsr_import(hash, auth_token, client_id, opts) {
  
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

  
  if( opts.start && opts.start.trim() != '' ) {
    imp_start = (1 * opts.start) - 1;
  }
  if( opts.count && opts.count.trim() != '' ) {
    imp_count = 1 * opts.count;
  }
  
  // Common processing provides BigCommerce products and categories
  const bc_export = opts.bc_products;
  const bc_cats = opts.bc_categories;

  // let cc = await iii.getBigCommerceCategories(hash, auth_token, client_id);
  // let bb = await iii.getBigCommerceBrands(hash, auth_token, client_id);

  await downloads();

  
  const results = [];
  const catgRes = [];
  const attr = [];
  const sell_features = [];

  const rsr_cats = rsr.RSRtoBigCommerceCategoryMappings;
  for( let i = 0; i < rsr_cats.length; i++ ) {
    let path = rsr_cats[i].bcPath;
    let bc_catg = iii.getBigCommerceCategoryByPath(bc_cats, path);
    if( bc_catg ) {
      let bc_catg_id = bc_catg.id;
      rsr_cats[i].bc_catg_id = bc_catg_id;
    } else {
      console.log( "not BigCommerce match for path " + rsr_cats[i] );
    }
  }

  var product_sell_desc = iii.get_xml_data("../app_data/product_sell_descriptions_unicode.xml");

  ///update_status("parsing categories");
  //console.log('cat',hash, auth_token, client_id);
  let fd = fs.createReadStream('../app_data/categories.txt');
  let csv1 = csv({ separator: ';', headers: rsr.catgCSVColumns, quote: '"' }); 
  
  fd.pipe(csv1).on('data', (data) => catgRes.push(data));
  
  let end = new Promise(function(resolve, reject) {
      csv1.on('end', () => resolve("yes"));
      fd.on('error', reject); // or something like that. might need to close `hash`
  });
  
  // await (async function() {
  //   let sha1sum = await end;
  //   console.log("done read 1",sha1sum,catgRes[0]);
  // }());
  await end;
  console.log("RSR done read 1"); //,end,catgRes[0]);

  //update_status("parsing products");
  fd = fs.createReadStream('../app_data/rsrinventory-keydlr-new.txt');
  csv1 = csv({ separator: ';', headers: rsr.invCSVColumns, quote: '\b' });
  fd.pipe(csv1).on('data', (data) => results.push(data));

  end = new Promise(function(resolve, reject) {
    csv1.on('end', () => resolve("yes yes"));
    fd.on('error', reject); // or something like that. might need to close `hash`
  });

  await end;
  console.log("RSR done read 2"); //,DD,end,DD,results[0]);

  //update_status("product attributes");
  fd = fs.createReadStream('../app_data/attributes-all.txt');
  csv1 = csv({ separator: ';', headers: rsr.attributeFields, quote: '\b', skip_empty_line: true });
  fd.pipe(csv1).on('data', (data) => attr.push(data));

  end = new Promise(function(resolve, reject) {
    csv1.on('end', () => resolve("yes yes"));
    fd.on('error', reject); // or something like that. might need to close `hash`
  });

  await end;
  console.log("RSR done read 3"); //,DD,DD,attr[0]);

  let rsrToAttr = [];
  for( var i = 0; i < attr.length; i++ ) {
    var ob = new Object();
    ob.attributes = attr[i];
    rsrToAttr[attr[i].RSRStockNumber] = ob;
  }

  /** 
    To handle duplicate product names, build map by name to it's 
    SKUs - we can then append and index to the name to avoid BigCommerce
    duplicate errors
  **/
  let rsrByName = []; {
    for( let i = 0; i < results.length; i++ ) {
      let rsr_prod = results[i];
      let prod_name = rsr_prod.ProductDescription;
      let prods_for_name = rsrByName[prod_name];
      if( !prods_for_name ) {
        prods_for_name = [];
        rsrByName[prod_name] = prods_for_name;
      }
      prods_for_name.push(rsr_prod);
    }
  }

  
  // Sell Descriptions may have two rows per stock #, one for Sell Copy, one for Features
  let matches = xpath.find(product_sell_desc, "//product");
  //console.log('matches', matches.length);
  //console.log(matches[10],matches[10].sku,matches[10].sell_copy,matches[10].features[0].feature);
  for( var i = 0; i < matches.length; i++ ) {
    let xprod = matches[i];
    let rsrStockNumber = xprod.sku[0];
    let sell_copy = xprod.sell_copy[0];
    let features = xprod.features;
    let oo = rsrToAttr[rsrStockNumber];
    if( !oo ) {
      oo = new Object();
    }
    oo.sellcopy = sell_copy;
    oo.features = features[0].feature;
    rsrToAttr[rsrStockNumber] = oo;
    // if( i < 4 ) {
    //   console.log('\nrsrExtra for[' + rsrStockNumber + ']');
    //   console.log(rsrToAttr[rsrStockNumber]);
    // }
  }    

  let pending_updates = [];
  if( imp_count == -1 ) {
    imp_count = results.length;
  }
  if( imp_start < 0 ) {
    imp_start = 0;
  }
  for( var i = imp_start; i < imp_start + imp_count && i < results.length; i++ ) {

    if( sf.abort_sync ) {
      break;
    }

    let rsr_prod = results[i];
    let import_sku = rsr_prod.RSRStockNumber + "-" + rsr.importOptions.sku_tag;
    let bc_export_prod = bc_export.bc_by_sku[import_sku];
    if( bc_export_prod ) {
      // check if any fields to update
      //console.log( "already have " + import_sku );
      // console.log(bc_export_prod);
      // console.log(rsr_prod);
      
      // temporary code to see if hazmat category is missing on some RSR products
      // let cat = null;
      let catg_updt = false;
      // for (let i = 0; i < rsr_cats.length; i++) {
      //   if (1 * rsr_cats[i].deptId == 1 * rsr_prod.DepartmentNumber) {
      //     cat = rsr_cats[i];
      //     break;
      //   }
      // }
      // let bc_catg_id = null;
      // if (cat) {
      //   bc_catg_id = cat.bc_catg_id;
      // } else {
      //   let def_cat = iii.getBigCommerceCategoryByPath(bc_cats, rsr.importOptions.default_category_path);
      //   if (def_cat) {
      //     bc_catg_id = def_cat.id;
      //   }
      // }
      // if (opts.is_ammo(bc_catg_id) && !bc_export_prod.categories.includes(opts.catg_hazmat.id)) {
      //   console.log("no hazmat for", bc_export_prod.ic, bc_export_prod);
      //   catg_updt = true;
      //   bc_export_prod.categories.push(opts.catg_hazmat.id);
      //   let oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, bc_export_prod.id);
      //   if (oc && oc.data) {
      //     //
      //   } else {
      //     console.log("In-House hazmat metafield add failed for " + bc_export_prod.id + ", error is " + oc);
      //   }
      // }
      // end of temporary code - turn this into update to categories/metafields if common

      let rsr_inv = rsr_prod.InventoryQty;
      let rsr_price = rsr_prod.RSRPricing;
      let rsr_map = rsr_prod.RetailMAP;
      if( !rsr_map || rsr_map == '' ) {
        rsr_map = 0;
      } else {
        rsr_map = 1 * rsr_map;
      }

      let bc_inv = bc_export_prod.inventory_level;
      let bc_price = bc_export_prod.price;
      let bc_cost = bc_export_prod.cost_price;
      let bc_map = bc_export_prod.map_price;
      let overrides = getOverrides(bc_export_prod);

      let map = 0;
      if( rsr_map && rsr_map != '' && rsr_map != 0 ) {
        map = rsr_map * 1;
      }
      if( overrides.map_price ) {
        map = overrides.map_price;
      }
      let is_oos = bc_export_prod.categories.includes(opts.catg_oos.id);
      
      let new_price = bc_price;
      let is_gun = false;
      //if (bc_cost != rsr_price || bc_map != rsr_map) {
       
        let test_categories = bc_export_prod.categories;
        if (is_oos) {
          let xkey = "x" + bc_export_prod.id;
          if( ! opts.saved_catg_meta[xkey] ) {
            test_categories = await iii.getSavedCategories(hash, auth_token, client_id, bc_export_prod, bc_cats);
            opts.saved_catg_meta[xkey] = test_categories;
          } else {
            test_categories = opts.saved_catg_meta[xkey];
          }
        }
        let markup = 1.40;
        is_gun = opts.is_gun(test_categories);
        //let is_ammo = opts.is_gun(bc_export_prod.categories);
        if( is_gun ) {
          markup = 1.20;
        }
  

        new_price = markup * rsr_price;
        if (is_gun) {
          if (map > 0) {
            new_price = map;
          }
        } else {
          if (map > new_price) {
            new_price = map;
          }
        }
        new_price = Math.floor(new_price) + 0.99;

      //} 
      
      
      if( bc_inv != rsr_inv || bc_cost != rsr_price || new_price != bc_price || rsr_map != bc_map || catg_updt ) {
       
        let updt =
          { "id": bc_export_prod.id, "price": ""+new_price, "inventory_level": ""+rsr_inv,
             "cost_price": ""+rsr_price, "map_price": ""+rsr_map };
        if( catg_updt ) {
          updt.categories = bc_export_prod.categories;
        }
        pending_updates.push(updt);
        // console.log('import_sku='+ import_sku + ', bc_inv=' + bc_inv + ', rsr_inv=' + rsr_inv);
        if( pending_updates.length == 10 ) {
          // console.log( "batch of updates", pending_updates );
          let batch_res = null;
          batch_res = await iii.updateProductBatch( hash, auth_token, client_id, pending_updates );
          // console.log( 'batch res', batch_res );
          pending_updates = [];
        }
        ++imp_updated;
        if( new_price != bc_price ) {
          ++imp_price_changed;
        }
        if( bc_inv != rsr_inv ) {
          ++imp_inv_changed;
        }
        if( bc_map != rsr_map ) {
          ++imp_map_changed;
        }
        if( bc_cost != rsr_price ) {
          ++imp_cost_changed;
        }
      } else {
        ++imp_unchanged;
      }
    } else {
      let add_outcome = await add_product( hash, auth_token, client_id, rsr_prod, rsrToAttr, opts, catgRes, rsrByName, rsr_cats );
      if (!add_outcome) {
        ++imp_add_failed;
      } else {
        ++imp_added;
      }
    }
  }
  
  if( pending_updates.length > 0 ) {
    // console.log( "final updates", pending_updates );
    let batch_res = null;
    batch_res= await iii.updateProductBatch( hash, auth_token, client_id, pending_updates );
    // console.log( 'batch res', batch_res );
  }

  console.log('RSR is done, added ' + imp_added + ", add failed " + imp_add_failed + 
  ', updated ' + imp_updated + ', unchanged ' + imp_unchanged );
  console.log('Changes: cost ' + imp_cost_changed + ", map " + imp_map_changed + ", inv " + imp_inv_changed + ", calculated price " + imp_price_changed );

  //console.log('bye bye', hash, auth_token, client_id);
  complete_status();

}
async function downloads() {
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
    await client.downloadTo("../app_data/attributes-all.txt","/keydealer/attributes-all.txt");
    await client.downloadTo("../app_data/product_sell_descriptions_unicode.xml","/keydealer/product_sell_descriptions_unicode.xml");
    await client.downloadTo("../app_data/categories.txt", "/keydealer/categories.txt");
    await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");
    //update_status("downloads complete");
  }
  catch (err) {
    console.log(err)
  }
  client.close()
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
  // var now = new Date();
  // dd.rsr_import_status.xstatus = "finished";
  // dd.rsr_import_status.xstatus_time = now;
  // dd.rsr_import_status.xfinished = now;
  // iii.save_app_data(dd);
  // log_status(dd.rsr_import_status);
}

function log_status(ss) {
  console.log(ss);
}

async function add_product( hash, auth_token, client_id, prod, rsrToAttr, opts, rsrCatg, rsrByName, rsr_cats ) {

  //console.log("add_product", hash, auth_token, client_id, prod);
  let ff = null;
  let bc_cats = opts.bc_categories;
  let base_img = prod.ImageName;
  let prod_images = [];
  const img_host = "img.rsrgroup.com";
  if( base_img != null ) {
    const parts = base_img.split('_'); // expect suffix of basename _ 1.jpg

    if( parts.length == 2 ) {

      var img1_std = "/pimages/" + parts[0]+"_1.jpg";
      var img2_std = "/pimages/" + parts[0]+"_2.jpg";
      var img1_high = "/highres-pimages/" + parts[0]+"_1_HR.jpg";
      var img2_high = "/highres-pimages/" + parts[0]+"_2_HR.jpg";
      var have_img1_high = await iii.imageExists( img_host, img1_high );
      var have_img2_high = await iii.imageExists( img_host, img2_high );
      var have_img1_std = await iii.imageExists( img_host, img1_std );
      var have_img2_std = await iii.imageExists( img_host, img2_std );  

      if( have_img1_high) {
        if( have_img2_high) {
          prod_images = [
            {
              "image_url": "https://" + img_host + img1_high,
              "is_thumbnail": true        
            },
            {
              "image_url": "https://" + img_host + img2_high
            }
          ]
        } else {
          prod_images = [
            {
              "image_url": "https://" + img_host + img1_high,
              "is_thumbnail": true        
            }
          ]

        }
      } else if (have_img1_std) {
        if( have_img2_std) {
          prod_images = [
            {
              "image_url": "https://" + img_host + img1_std,
              "is_thumbnail": true        
            },
            {
              "image_url": "https://" + img_host +img2_std
            }
          ]
        } else {
          prod_images = [
            {
              "image_url": "https://" + img_host + img1_std,
              "is_thumbnail": true        
            }
          ]

        }
      }
      
    
    }
  }

  let cust = [{ name: "_warehouse_", "value": "rsr" }];
  let extra_desc = "";
  let rsrExtras = rsrToAttr[prod.RSRStockNumber];

  //console.log('\n\n\nrsrExtras\n', rsrExtras, '\n\n\n');
  
  let manu = null;
  if( rsrExtras ) {
    //console.log('\nrsrExtras for ', prod.RSRStockNumber, '\n', rsrExtras);
    if( rsrExtras.attributes ) {
    /* 
      Build custom fields if any - map to attributes 
    */
      //console.log(rsrExtras.attributes);
      var entries = Object.entries(rsrExtras.attributes);
      for ([k, v] of entries) {
        var vv = v.trim();
        if( v != '' ) {
          if( k == "Manufacturer") {
            manu = v;
          } else if(  
            k != 'RSRStockNumber'
            && k != 'ManufacturerId') {
            cust.push(
              { 'name': k, 'value': v }
            );
          }
        }     
      }
      
    }
  
    if( rsrExtras.sellcopy ) {
      extra_desc += '\n<div class="sf-sellcopy">' + rsrExtras.sellcopy + '</div>';
    }

    if( rsrExtras.features ) {
      extra_desc += '<div class="sf-features"><ul>';
     // var entries = Object.entries(rsrExtras.features);
      for(var j = 0; j < rsrExtras.features.length; j++) {
        extra_desc += '<li>' + rsrExtras.features[j] + '</li>';
      }
      extra_desc += '</ul></div>';
    }

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

  let cat = null;
  for( let i = 0; i < rsr_cats.length; i++) {
    if( 1 * rsr_cats[i].deptId == 1 * prod.DepartmentNumber ) {
      cat = rsr_cats[i];
      break;
    }
  }
  let bc_catg_id = null;
  if( cat ) {
    bc_catg_id = cat.bc_catg_id;
  } else {
    let def_cat = iii.getBigCommerceCategoryByPath( bc_cats, rsr.importOptions.default_category_path );
    if( def_cat ) {
      bc_catg_id = def_cat.id;
    }
  }
  
  let weight = 0.25; // default to 1/4 pound if no import weight
  if( prod.ProductWeight > 0 ) {
    weight = prod.ProductWeight / 16.0;
  }
  let add_data =
  {
    "name": getUniqueRSRProductName( rsrByName, prod, opts ),
    "sku": prod.RSRStockNumber + "-" + rsr.importOptions.sku_tag,
    "upc": prod.UPCCode,
    "type": "physical",
    "description": prod.ExpandedProductDescription + extra_desc,
    "weight": weight ,
    "inventory_warning_level": 3,
    //"width": 12,
    //"price": prod.RetailPrice,
    "categories": [
      bc_catg_id, opts.catg_rsr.id
    ],
    //"images": prod_images,
    "inventory_level": prod.InventoryQty,
    "inventory_tracking": "product",
    "condition": "New"
  };
  if( prod_images != null && prod_images.length > 0 ) {
    add_data.images = prod_images;
  } else {
    add_data.is_visible = false;
  }
  add_data.is_visible = false; // all added get initially hidden
  
  let markup = 1.40;

  // Need FFL custom field and different markup for guns and ammo categories
  let is_gun =  opts.is_gun(bc_catg_id);
  if( is_gun ) {
    markup = 1.20;
    cust.push( {"name": "FFL","value": "Yes"} );
    cust.push( { "name": "_gun_", "value": "true" } );
  } else if( opts.is_ammo(bc_catg_id) ) {
    cust.push( { "name": "_ammo_", "value": "true" } );
    let hazmat_catg = iii.getBigCommerceCategoryByPath(bc_cats, ["HazMat"]);
    if( hazmat_catg && hazmat_catg.id != 0 ) {
      add_data.categories.push(hazmat_catg.id);
    }
  }

  if( cust.length > 0 ) {
    add_data.custom_fields = cust;
  }

  if( manu ) {
    //var bcb = await getBCBrand( hash, auth_token, client_id, manu, bcBrands );
    add_data.brand_name = manu;
   }

  let map = prod.RetailMAP;
  if (map && map != '') {
    map = 1 * map;
  } else {
    map = 0;
  }
  let price = markup * prod.RSRPricing;
  if( is_gun ) {
    if( map > 0 ) {
      price = map;
    }
  } else {
    if (map > price) {
      price = map;
    }
  }
  add_data.price = Math.floor(price) + 0.99;
  add_data.map_price = map;
  add_data.cost_price = prod.RSRPricing * 1;

  add_data.categories.push(opts.catg_unlisted.id); 

  //console.log(add_data);
  let ss = JSON.stringify(add_data);
  
  let outcome = await iii.addABC(add_opts, ss);
  let added = false;
  if( outcome && outcome.data ) {
    added = true;
    if( add_data.categories.includes(opts.catg_hazmat.id) ) {
      let oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, outcome.data.id);
      if( oc && oc.data ) {
      //
      } else {
          console.log("In-House hazmat metafield add failed for " + outcome.data.id + ", error is " + oc);
      }
  } 

  } else {
    console.log( "RSR add failed - " + outcome);
    console.log(ss);
  }
  return added
}







// manual adjustment of fields from quote csv - found errors with non-escapped "

function cleanCSV(str) {
  if( str.startsWith('"') && str.endsWith('"') ) {
    str =  str.substring(1,str.length - 1);
    str =  str.replace(/[0-9]""/g,'"');
    str =  str.replace(/"" /g,', ');
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
function getUniqueRSRProductName(namesToProd, prod, opts) {
  // prod.ProductDescription + ' (' + rsr.importOptions.name_tag + ")"
  let product_name = prod.ProductDescription;
  let products_for_name = namesToProd[product_name];
  let name_ix = '';
  if( products_for_name && products_for_name.length > 1 ) {
    for( let i = 0; i < products_for_name.length; i++ ) {
      let name_prod = products_for_name[i];
      if( name_prod.RSRStockNumber == prod.RSRStockNumber ) {
        name_ix += (i+1);
        break;
      }
    }
  }
  product_name += " (" + rsr.importOptions.name_tag + name_ix + ")";
  let bc = opts.bc_products.bc_by_name[product_name];
  if( bc ) {
      // nuts - same name in BigCommerce already
      product_name = product_name.slice(0, -1) + "." + bc.dupe_ct++ + ")";
  }
  return product_name;
}

exports.rsr_import = rsr_import;
