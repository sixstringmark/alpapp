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
const sportsouth = require("./SportsouthMappings");
const stream = require("stream");
var request = require('request');
//const request = require("request");
//const e = require('express');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");
//const webdavClient = require('webdav-client');
//const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const img_domain = "webstore.kinseysinc.com";
const img_path = "/product/image/large/";
const img_host = img_domain + img_path;
const qs = require('qs');
const { imageExists } = require('../util/ick');
const modname =  "sports_south_import";

const DD = " / ";

//duh();

async function sports_south_import(hash, auth_token, client_id, opts) {

  init_status();

  let imp_start = 0;
  let imp_count = -1;
  let imp_last_date = "";
  

  let imp_added = 0;
  let imp_add_failed = 0;
  let imp_updated = 0;
  let imp_unchanged = 0;
  let imp_price_changed = 0;
  let imp_inv_changed = 0;
  let imp_map_changed = 0;
  let imp_cost_changed = 0;


  const import_data = {};

  if (opts.start && opts.start.trim() != '') {
    imp_start = (1 * opts.start) - 1;
  }
  if (opts.count && opts.count.trim() != '') {
    imp_count = 1 * opts.count;
  }
  if (opts.last_date && opts.last_date.trim() != '') {
    imp_last_date = opts.last_date;
  } else {
    // by default, look back 3 days
    const dat = new Date();
    dat.setDate(dat.getDate()-3);
    imp_last_date = dat.toISOString().substring(0,10).replace(/-/g,"/");
  }
  console.log( modname + ": last date is " + imp_last_date);
  
  import_data.bc_categories = opts.bc_categories;
  import_data.bc_export = opts.bc_products;

  import_data.category_map = sportsouth.categoryMappings;
  let def_cat = iii.getBigCommerceCategoryByPath( import_data.bc_categories, sportsouth.importOptions.default_category_path );
  import_data.default_catg = def_cat;
  for (let i = 0; i < import_data.category_map.length; i++) {
    let path = import_data.category_map[i].bc_path;
    let bc_catg = iii.getBigCommerceCategoryByPath(import_data.bc_categories, path);
    if (bc_catg) {
      let bc_catg_id = bc_catg.id;
      import_data.category_map[i].bc_catg_id = bc_catg_id;
    } else {
      console.log("no Sports South BigCommerce category match for path ", import_data.category_map[i]);
      import_data.category_map[i].bc_catg_id = opts.catg_default.id;
    }
  }
  
  
  let dobj = null;
  console.log( modname + ": getting DailyItemUpdateDS");
  dobj = await getAndParseXML( 'DailyItemUpdateDS', { 'LastItem': '-1', 'LastUpdate': imp_last_date } );
  import_data.items = xpath.find(dobj, "//Table");

  console.log( modname + ": getting ListNewTextDS");
  dobj = await getAndParseXML( 'ListNewTextDS', { 'DateFrom': imp_last_date } );
  import_data.texts = xpath.find(dobj, "//Table");

  console.log( modname + ": getting BrandUpdateDS");
  dobj = await getAndParseXML( 'BrandUpdateDS', {  } );
  import_data.brands = xpath.find(dobj, "//Table");

  console.log( modname + ": getting CategoryUpdateDS");
  dobj = await getAndParseXML( 'CategoryUpdateDS', {  } );
  import_data.categories = xpath.find(dobj, "//Table");

  console.log( modname + ": getting DepartmentUpdateDS");
  dobj = await getAndParseXML( 'DepartmentUpdateDS', {  } );
  import_data.departments = xpath.find(dobj, "//Table");

  console.log( modname + ": getting ManufacturerUpdateDS");
  dobj = await getAndParseXML( 'ManufacturerUpdateDS', {  } );
  import_data.manufacturers = xpath.find(dobj, "//Table");

  console.log( modname + ": getting IncrementalOnhandUpdateDS");
  dobj = await getAndParseXML( 'IncrementalOnhandUpdateDS',  { 'SinceDateTime': imp_last_date } );
  import_data.onhand = xpath.find(dobj, "//Onhand");

  
  // dobj = await mapSSToBC();
  // import_data.bc_export = dobj;
  // import_data.bc_export = await iii.getAllBigCommerceProducts( hash, auth_token, client_id );

  import_data.dump = true;
  generateMappings( import_data );

  // console.log(import_data.onhand_by_item_no['1232']);
  // console.log(import_data.texts_by_item_no['1232']);

  dobj = null;


  
  const results = [];
  const catg_map = [];

  // First pass, apply updates to existing products
  let pending_updates = [];
  for (let i = 0; i < import_data.onhand.length; i++) {

    if( sf.abort_sync ) {
      break;
    }

    let onhand = import_data.onhand[i];
    let item_no = onhand.I[0];
    let bc_item_no = item_no + '-' + sportsouth.importOptions.sku_tag;
    let bc_export_prod = import_data.bc_export.bc_by_sku[bc_item_no];
    if (bc_export_prod) {

      let is_oos = bc_export_prod.categories.includes(opts.catg_oos.id); 
      let test_categories = bc_export_prod.categories;
      if( is_oos ) {
          let xkey = "x" + bc_export_prod.id;
          if( ! opts.saved_catg_meta[xkey] ) {
            test_categories = await iii.getSavedCategories(hash, auth_token, client_id, bc_export_prod, import_data.bc_categories);
            opts.saved_catg_meta[xkey] = test_categories;
          } else {
            test_categories = opts.saved_catg_meta[xkey];
          }
      }

      // Get what we can from onhand update
      let new_qty = onhand.Q[0] * 1;
      let new_cost_price = onhand.C[0] * 1;
      let new_map_price = 0;
      let new_price = null;

      // if we have new enough daily item, consider its MAP and item type
      let ss_item = import_data.items_by_item_no[item_no];
      if( ss_item ) {
        new_map_price = ss_item.MFPRC[0] * 1;
      } else {
        new_map_price = bc_export_prod.map_price;
      }
      let overrides = getOverrides(bc_export_prod);
      if( overrides.map_price ) {
        new_map_price = overrides.map_price;
      }

      // Get latest from BigCommerce
      let bc_qty = bc_export_prod.inventory_level;
      let bc_price = bc_export_prod.price;
      let bc_cost_price = bc_export_prod.cost_price;
      let bc_map_price = bc_export_prod.map_price;

      // Compute new sales price based on Sports South data
      let is_gun = false;
      if( opts.is_gun(test_categories) ) {
        is_gun = true;
      } else {
        if( ss_item && (ss_item.ITYPE[0] == '1' || ss_item.ITYPE[0] == '2'  ) ) {
          is_gun = true;
        }
      }
      if( is_gun ) {
        if( new_map_price > 0 ) {
          new_price = new_map_price
        } else {
          new_price = new_cost_price * 1.20;
        }
      } else {
        new_price = new_cost_price * 1.40;
        new_price = Math.max(new_price,new_map_price);
      }
      let is_archery = opts.is_archery(test_categories);
      let hide_me = false;
      if( is_archery && bc_export_prod.is_visible ) {
        hide_me = true;
      }
      //let new_price = is_gun ? new_cost_price * 1.30 : new_cost_price * 1.4; 
      new_price = Math.floor( new_price ) + 0.99;

      if (new_qty != bc_qty || new_price != bc_price || new_cost_price != bc_cost_price || new_map_price != bc_map_price || hide_me ) {

        let updt = {
          "id": bc_export_prod.id
        }

        if( hide_me ) {
          updt.is_visible = false;
        }
        if( new_qty != bc_qty ) {
          updt.inventory_level = new_qty;
          ++imp_inv_changed;
        }
        if( new_price != bc_price ) {
          updt.price = new_price;
          ++imp_price_changed;
        }
        if( new_cost_price != bc_cost_price ) {
          updt.cost_price = new_cost_price;
          ++imp_cost_changed;
        }
        if( new_map_price != bc_map_price ) {
          updt.map_price = new_map_price;
          ++imp_map_changed;
        }
       
        pending_updates.push(updt);
        // console.log('import_sku='+ import_sku + ', bc_inv=' + bc_inv + ', rsr_inv=' + rsr_inv);
        if (pending_updates.length == 10) {
          // console.log("batch of updates", pending_updates);
          let batch_res = null;
          batch_res = await iii.updateProductBatch(hash, auth_token, client_id, pending_updates);
          // console.log('batch res', batch_res);
          pending_updates = [];
        }
        ++imp_updated;
      } else {
        ++imp_unchanged;
      }
      // Need to update
    }
  }
  if (pending_updates.length > 0) {
    // console.log("batch of updates", pending_updates);
    let batch_res = null;
    batch_res = await iii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    // console.log('batch res', batch_res);
    // pending_updates = [];
  }
  
  // Second pass, look for any products we don't already have and add them
  if( imp_count == -1 ) {
    imp_count = import_data.items.length;
  }
  let imp_processed = 0;
  for( let i = imp_start; i < (imp_count + imp_start) && i < import_data.items.length; i++ ) {

    if( sf.abort_sync ) {
      break;
    }

    ++imp_processed;
    let item = import_data.items[i];
    let item_no = item.ITEMNO[0];
    let bc_item_no = item_no + '-' + sportsouth.importOptions.sku_tag;
    let bc_prod = import_data.bc_export.bc_by_sku[bc_item_no];
    if( !bc_prod ) {
      let gg = await add_product(hash, auth_token, client_id, import_data, i, opts );
      if( !gg  ) {
        ++imp_add_failed;
      } else {
        ++imp_added;
      }
    }
  }
 

  console.log( 'Sports South is done, added ' + imp_added + ', add failed ' + imp_add_failed + ', updated ' + imp_updated 
  + ', unchanged ' + imp_unchanged + ', processed ' + imp_processed );
  console.log('Changes: cost ' + imp_cost_changed + ", map " + imp_map_changed + ", inv " + imp_inv_changed + ", calculated price " + imp_price_changed );


  return;
}

async function add_product(hash, auth_token, client_id, d, i, opts ) {
  let item = d.items[i];
  let add_data = {
    "inventory_warning_level": 3
  };
  // console.log('item to be added');
  // console.log(item);

  let bc_catg = await getSSCategory( d, i );
  add_data.categories = [  bc_catg.id, opts.catg_south.id ];
  
  let is_gun = false;
  if( opts.is_gun(add_data.categories) ) {
        is_gun = true;
  } else if( item.ITYPE[0] == '1' || item.ITYPE[0] == '2'  ) {
    is_gun = true;
  }
 
  let is_ammo = false;
  if( opts.is_ammo(add_data.categories) ) {
        is_ammo = true;
  } else if( item.ITYPE[0] == '4' ) {
    is_ammo = true;
  }

  if( is_ammo ) {
    add_data.categories.push(opts.catg_hazmat.id);
  }

  let is_archery = opts.is_archery(add_data.categories);
 
  const item_no = item.ITEMNO[0];

  let item_catg_id = item.CATID[0];
  // if( item_catg_id == '0') {
  //   console.log("can't process - category is zero");
  //   return;
  // }
  add_data.type = "physical";
  add_data.name = getUniqueProductName(item,d,opts);
  add_data.sku = item_no + "-" + sportsouth.importOptions.sku_tag;
  let desc = '<div class="ss_desc1">' + iii.escapeForHTML(item.SHDESC[0]) + '</div>';

  let text = d.texts_by_item_no[item.ITEMNO[0]];
  if( text ) {
    desc += '<div class="ss_desc2">' + iii.escapeForHTML(text.TEXT[0]) + '</div>';
  }
  add_data.description = desc;

  add_data.weight = item.WTPBX[0];
  add_data.width = item.WIDTH[0];
  add_data.depth = item.LENGTH[0];
  add_data.height = item.HEIGHT[0];

  add_data.upc = item.ITUPC[0];

  let mpn = item.MFGINO[0];
  if( typeof mpn === 'string') {
    if( mpn != '' ) {
      add_data.mpn = item.MFGINO[0];
    } 
  }
  

  // Price is based on cost times markup or MAP, if greater. Cost and inventory can come
  // from either OnHand or DailyItem, priority to OnHand. MAP can only come from DailyItem.

  let s_cost_price = item.CPRC[0] * 1;
  let s_inventory_level = item.QTYOH[0] * 1;
  let s_map_price = item.MFPRC[0] * 1;

  let onhand = d.onhand_by_item_no[item_no];
  if( onhand ) {
    s_cost_price = onhand.C[0] * 1;
    s_inventory_level = onhand.Q[0] * 1;
  }

  let s_price = 0;
  if( is_gun ) {
    if( s_map_price > 0 ) {
      s_price = s_map_price
    } else {
      s_price = s_cost_price * 1.20;
    }
  } else {
    s_price = s_cost_price * 1.40;
    s_price = Math.max(s_price,s_map_price)
  }
  //let s_price = is_gun ? s_cost_price * 1.30 : s_cost_price * 1.4; 
  s_price = Math.floor( s_price ) + 0.99;

  add_data.price = s_price;
  add_data.map_price = s_map_price;
  add_data.cost_price = s_cost_price;
  add_data.inventory_level = s_inventory_level;

  add_data.inventory_tracking = "product";
  add_data.condition = "New";

  let brand = d.brands_by_brand_no[item.ITBRDNO[0]];
  if( brand ) {
    add_data.brand_name = brand.BRDNM[0];
  }

    // up to 3 image views - see what is available
  let img_url = null;
  let xxx = false;
  const images = [];
  let is_thumbnail = true;
  
  // Primary view angle
  img_url = sportsouth.importOptions.image_url_large.replace(sportsouth.importOptions.image_url_ix,item_no);
  xxx = await iii.imgURLExists(img_url);  
  if( xxx ) {
    images.push( { "image_url": img_url, "is_thumbnail": is_thumbnail } );
    is_thumbnail = false;
  } else {
    img_url = sportsouth.importOptions.image_url_small.replace(sportsouth.importOptions.image_url_ix,item_no);
    xxx = await( iii.imgURLExists(img_url));
    if( xxx ) {
      images.push( { "image_url": img_url, "is_thumbnail": is_thumbnail } );
      is_thumbnail = false;
    } 
  }
  
  // 2nd view angle
  img_url = sportsouth.importOptions.image_url_large_2.replace(sportsouth.importOptions.image_url_ix,item_no);
  xxx = await iii.imgURLExists(img_url);  
  if( xxx ) {
    images.push( { "image_url": img_url, "is_thumbnail": is_thumbnail } );
    is_thumbnail = false;
  }
  
  // 3rd view angle
  img_url = sportsouth.importOptions.image_url_large_3.replace(sportsouth.importOptions.image_url_ix,item_no);
  xxx = await iii.imgURLExists(img_url);  
  if( xxx ) {
    images.push( { "image_url": img_url, "is_thumbnail": is_thumbnail } );
    is_thumbnail = false;
  }
  
  if( images.length > 0 ) {
    add_data.images = images;
  } else {
    add_data.is_visible = false;
  }
  if( is_archery ) {
    add_data.is_visible = false;
  }
  add_data.is_visible = false; // all added get initially hidden

  const custom_fields = [ { name: "_warehouse_", "value": "sports_south" } ];

  if( is_gun ) {
    custom_fields.push( { "name": "FFL", "value" : "Yes" } );
    custom_fields.push({ "name": "_gun_", "value": "true" });
  }

  if( is_ammo ) {
    custom_fields.push({ "name": "_ammo_", "value": "true" });
  }

  let ss_catg = d.categories_by_id[item_catg_id];
  //console.log(ss_catg,item);
  let used_names = {};
  if( ss_catg ) {
    // Watch out! The properties run from ATTR0 thru ATTR9, then ATTR11 thru ATTR20.
    for( let j = 0; j <= 9; j++ ) {
      let cval = item['ITATR'+j][0];
      if( typeof cval === 'string' ) {
        let cname = ss_catg['ATTR'+j][0];
        if( typeof cname === 'string'  ) {
          cval = cval.trim();
          cname = cname.trim();
          if( cval != '' && cname != '' && !used_names[cname] ) {
            custom_fields.push( { "name": cname, "value": cval } );
            used_names[cname] = 'x';
          }
        }
      }
    }
    for( let j = 11; j <= 20; j++ ) {
      let cval = item['ITATR'+j][0];
      if( typeof cval === 'string' ) {
        let cname = ss_catg['ATTR'+j][0];
        if( typeof cname === 'string'  ) {
          cval = cval.trim();
          cname = cname.trim();
          if( cval != '' && cname != '' && !used_names[cname] ) {
            custom_fields.push( { "name": cname, "value": cval } );
            used_names[cname] = 'x';
          }
        }
      }
    }

    
  }
  if( custom_fields.length > 0 ) {
    add_data.custom_fields = custom_fields;
  }

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
  // ff = 'test';
  let added = false;
  add_data.categories.push(opts.catg_unlisted.id); 

  let outcome = await iii.addABC(add_opts, JSON.stringify(add_data));
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
    console.log( "Sports South add failed - " + outcome);
    console.log(add_data);
  }

  return added;
}

function getUniqueProductName(item,d,opts) {
  let product_name = item.IDESC[0];
  let item_no = item.ITEMNO[0];
  let products_for_name = d.items_by_name[product_name];
  let name_ix = '';
  if (products_for_name && products_for_name.length > 1) {
      for (let i = 0; i < products_for_name.length; i++) {
          let name_prod = products_for_name[i];
          if (name_prod.ITEMNO[0] == item_no) {
              name_ix += (i + 1);
              break;
          }
      }
  }
  product_name += " (" + sportsouth.importOptions.name_tag + name_ix + ")";
  let bc = opts.bc_products.bc_by_name[product_name];
  if( bc ) {
      // nuts - same name in BigCommerce already
      product_name = product_name.slice(0, -1) + "." + bc.dupe_ct++ + ")";
  }
  return product_name;
}

function getSSCategory( d, i ) {
  let item = d.items[i];
  let item_catid = item.CATID[0] * 1;
  let ret_catg = null;

  // Find Sports South category match - this will give category and department level names
  let ss_category = null;
  for( let i = 0; i < d.categories.length; i++ ) {
    if( d.categories[i].CATID[0] == item_catid ) {
      ss_category = d.categories[i];
      break;
    }
  }

  if( !ss_category ) {
    return d.default_category; // better default?
  }

  //let ss_catg_name = ss_category.CATDES[0].trim();
  let ss_dept_id = ss_category.DEPID[0].trim() * 1;

  // locate deparment category under top level
  for( let i = 0; i < d.category_map.length; i++ ) {
    if( d.category_map[i].depid == ss_dept_id
      && d.category_map[i].catid == item_catid ) {
        let path = d.category_map[i].bc_path;
        ret_catg = iii.getBigCommerceCategoryByPath(d.bc_categories,path);
        break;
    }
  }
  if( !ret_catg ) {
    ret_catg = d.default_catg;
  }
  

  return ret_catg;

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

function generateMappings(d) {

  // Brands by brand id
  d.brands_by_brand_no = [];
  for( let i = 0; i < d.brands.length; i++) {
    let brand_no = d.brands[i].BRDNO[0];
    d.brands_by_brand_no[brand_no] = d.brands[i];
  }

  // Text by item number
  d.texts_by_item_no = [];
  for( let i = 0; i < d.texts.length; i++) {
    let item_no = d.texts[i].ITEMNO[0];
    d.texts_by_item_no[item_no] = d.texts[i];
  }

  // Categories by category id
  d.categories_by_id = [];
  for( let i = 0; i < d.categories.length; i++) {
    let cat_id = d.categories[i].CATID[0];
    d.categories_by_id[cat_id] = d.categories[i];
  }

  // Departments by department id
  d.departments_by_id = [];
  for( let i = 0; i < d.departments.length; i++) {
    let dep_id = d.departments[i].DEPID[0];
    d.departments_by_id[dep_id] = d.departments[i];
  }

  // Manufacturers by no
  d.manufacturers_by_no = [];
  for( let i = 0; i < d.manufacturers.length; i++) {
    let mfg_no = d.manufacturers[i].MFGNO[0];
    d.manufacturers_by_no[mfg_no] = d.manufacturers[i];
  }

  // On-Hand by item no
  d.onhand_by_item_no = [];
  for( let i = 0; i < d.onhand.length; i++) {
    let item_no = d.onhand[i].I[0];
    d.onhand_by_item_no[item_no] = d.onhand[i];
  }

  // duplicate name mappings, items by item no
  //let ssByName = [];
  d.items_by_name = [];
  d.items_by_item_no = [];
  for (let i = 0; i < d.items.length; i++) {

    let ss_item_no = d.items[i].ITEMNO[0];
    d.items_by_item_no[ss_item_no] = d.items[i];

    let ss_prod = d.items[i];
    let ss_name = ss_prod.IDESC[0];
    let prods_for_name = d.items_by_name[ss_name];
    if (!prods_for_name) {
        prods_for_name = [];
        d.items_by_name[ss_name] = prods_for_name;
        prods_for_name.push(ss_prod);
    } 
    // if( prods_for_name.length > 1 ) {
    //     console.log(prods_for_name);
    // }

  }
  
}
/***
 * Workhorse function to hit a Sports South API and return parsed XML object
 */
async function getAndParseXML(api_path, api_props) {
  var options = {
    'method': 'POST',
    'url': sportsouth.importOptions.endpoint + api_path,
    'headers': {
      'Accept': 'application/xml',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      'CustomerNumber': sportsouth.importOptions.customer_number,
      'Password': sportsouth.importOptions.password,
      'UserName': sportsouth.importOptions.user_name,
      'Source': sportsouth.importOptions.source,
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

async function mapSSToBC(imp_data) {

  imp_data.bc_export = await iii.getAllBigCommerceProducts( hash, auth_token, client_id );

  const matches = xpath.find(bc_export_xml, "//product");
  const ss_to_bc = [];
  for( let i = 0; i < matches.length; i++ ) {
    let xprod = matches[i];
    let ssItemNumber = xprod.Code[0];
    const ss_tag = '-' + sportsouth.importOptions.sku_tag;
    if( ssItemNumber.endsWith( ss_tag ) ) {
      ss_to_bc[ssItemNumber] = xprod;
    } 
  }    

  imp_data.ss_to_bc;
  
}

exports.sports_south_import = sports_south_import;
