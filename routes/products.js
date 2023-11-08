var express = require("express");
var router = express.Router();
var https = require("follow-redirects").https;
var fs = require("fs");
const csv = require('csv-parser')

const Client = require('ftp');
const ftp = require("basic-ftp");

var ii = require("../util/ick");
//var pp = require("../util/httpPromise");
var querystring = require("querystring");

const rsr = require("../util/rsr_import");
const rsrm = require("../util/RSRMappings");

const hooks = require("./hooks");

const kinseys = require("../util/kinseys_import");
const kinseysm = require("../util/KinseysMappings");

const lipseys = require("../util/lipseys_import");
const lipseysm = require("../util/LipseysMappings");

const sports_south = require("../util/sports_south_import");
const sports_southm = require("../util/SportsouthMappings");

const sku_scrub = require("../util/upc_sku_scrub");
const sku_scrub_rev = require("../util/upc_sku_scrub_rev");
const shipperhq_meta = require("../util/insert_shipperhq_metafields");

const in_house = require("../util/in_house_import")

const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const xml2js = require('xml2js');

const xpath = require("xml2js-xpath");

const stringify = require( 'csv-stringify' );
const { insert_shipperhq_metafields } = require("../util/insert_shipperhq_metafields");
const e = require("express");

const repeat_ms = 20 * 60 * 1000; // normal wait time between repeats - 20 minutes
const min_wait = 3 * 60 * 1000; // least wait time between repeats - 3 minutes

const m = "products";


/* GET users listing. */
router.get("/", function (req, res, next) {
  sfLog(m, "\nsession\n",req.session);    
  sfLog(m, "\nsession\n",req.session);    
  let hah = { "junk": '40" rod' };
  sfLog(m, JSON.stringify(hah));

  for (var propName in req.query) {
    if (req.query.hasOwnProperty(propName)) {
      sfLog(m, propName, req.query[propName]);
    }
  }
  
  var func = req.query["go"];
  if( func != 'doh' && func != "hookup" && !req.session.mc_hash ) {
    func = "relaunch";
  }
  sfLog(m, "func=" + func);
  if (func == "search") {
    sfLog(m, req.cookies);
    get_products(req.session.mc_hash, res, req);
    //rsr.rsr_import();
    //get_rsr(req.session.mc_hash, res, req);
  } else if (func == "doh") { // This is shorter path to test WEBDAV BigCommerce product export processing
    let ddd = ii.get_app_data();
    let jsonContent = JSON.stringify(ddd,null,4);
    ii.save_app_data(ddd);
    doh(req.session.mc_hash, res, req);
    sfLog(m, 'end doh', ddd);
  } else if (func == "addp") {
    add_product(req.session.mc_hash, res, req);
  } else if (func == "updt") {
    update_product(req.session.mc_hash, res, req);
  } else if (func == "dltp") {
    delete_product(req.session.mc_hash, res, req);
  } else if (func == "south_import") {
    sfLog(m, "import mc_hash=",req.session.mc_hash);
    import_south(req.session.mc_hash, res, req);
  } else if (func == "rsr_import") {
    sfLog(m, "import mc_hash=",req.session.mc_hash);
    import_rsr(req.session.mc_hash, res, req);
  } else if (func == "kinseys_import") {
    sfLog(m, "import mc_hash=",req.session.mc_hash);
    import_kinseys(req.session.mc_hash, res, req);
  } else if (func == "p_sync") {
    sfLog(m, "p_sync mc_hash=",req.session.mc_hash);
    processSync(req.session.mc_hash, res, req);
  } else if (func == "hookup") {
    hookup('ycmjyu2rb7', res, req);
  } else if (func == "p_sync_cancel") {
    sfLog(m, sf);
    if( sf.pending ) {
      try {
        clearTimeout(sf.pending);
      } catch (e) {
        sfLog(m, e);
      }
      sf.pending = null;
    }
    let msg = "";
    if( !sf.sync_active ) {
      msg = "Sync is not active";
    } else if ( sf.abort_sync ) {
      msg = "Sync stop is in progress";
    } else {
      msg = "Sync stop has been requested - this may take a minute or two";
      sf.abort_sync = true;
    }
    res.render('products', {
    post: {
        author: msg,
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
  } else if (func == "relaunch") {
    res.render('relaunch', {
      //      data: f,
      message: 'Instance has been restarted - please relaunch the app from the Dashboard'
    });
  } else {
    res.render('products', {
      //      data: f,
      post: {
        author: '',
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });

  }
  //res.send("respond with a resource");
});

module.exports = router;



async function processSync( hash, res, req ) {

  sfLog(m,  "sf", global.sf );

  let dd = ii.get_app_data();
  sfLog(m, 'processSync dd\n', dd, "\nhash=", hash);
  sfLog(m, hash,dd.store_hash[hash],dd.app_client);
  let ff = null;
  let import_options = {
    "start": req.query["p_ix_start"],
    "count": req.query["p_ix_count"],
    "do_rsr": req.query["p_import_rsr"],
    "do_lipseys": req.query["p_import_lipseys"],
    "do_kinseys": req.query["p_import_kinseys"],
    "do_sportsouth": req.query["p_import_sportsouth"],
    "do_fix1": req.query["p_fix1"],
    "do_fix2": req.query["p_fix2"],
    "do_fix3": req.query["p_fix3"],
    "do_fix4": req.query["p_fix4"],
    "do_fix5": req.query["p_fix5"],
    "do_fix6": req.query["p_fix6"],
    "do_fix7": req.query["p_fix7"],
    "do_purge_deleted": req.query["p_purge_deleted"],
    "do_adjust_sort_order": req.query["p_adjust_sort_order"],
    "do_fix9": req.query["p_fix9"],
    "do_sku_scrub": req.query["p_sku_scrub"],
    "last_date": req.query["p_last_date"],
    "do_in_house": req.query["p_in_house"],
    "attr_exp_file": req.query["p_attr_exp_file"],
    "prod_exp_file": req.query["p_prod_exp_file"],
    "sku_scrub_export": req.query["p_sku_scrub_export"],
    "do_customer_conversion": req.query["p_customer_conversion"],
    "uc_export_file": req.query["p_uc_export_file"],
    "bc_import_file": req.query["p_bc_import_file"],
    "saved_catg_meta": {}, // cache product saved category meta data across iterations and processes

    is_gun: function(catg) {
      let rc = false;
      if( Array.isArray(catg) ) {
        for( let i = 0; i < catg.length; i++ ) {
          if( this.gun_catgs.includes(catg[i])) {
            rc = true;
            break;
          }
        }
      } else {
        rc = this.gun_catgs.includes(catg);
      }
      return rc;
    },
    
    is_archery: function(catg) {
      let rc = false;
      if( Array.isArray(catg) ) {
        for( let i = 0; i < catg.length; i++ ) {
          if( this.archery_catgs.includes(catg[i])) {
            rc = true;
            break;
          }
        }
      } else {
        rc = this.archery_catgs.includes(catg);
      }
      return rc;
    },

    is_ammo: function(catg) {
      let rc = false;
      if( Array.isArray(catg) ) {
        for( let i = 0; i < catg.length; i++ ) {
          if( this.ammo_catgs.includes(catg[i])) {
            rc = true;
            break;
          }
        }
      } else {
        rc = this.ammo_catgs.includes(catg);
      }
      return rc;
    }

  };

  let msg = '';

  if( import_options.do_purge_deleted ) {
    hooks.purge_deleted({"env":"prod"});
    msg = "Purged Deleted processing started";
  }
  if( import_options.do_rsr || import_options.do_kinseys || import_options.do_lipseys || import_options.do_sportsouth 
    || import_options.do_fix1 || import_options.do_fix2 || import_options.do_fix3 || import_options.do_fix4 || import_options.do_fix5
    || import_options.do_fix6 || import_options.do_fix7 || import_options.do_adjust_sort_order || import_options.do_fix9
    || import_options.do_in_house || import_options.do_customer_conversion || import_options.do_sku_scrub ) {
    sfLog(m,  "got work to do");
    sync_master(hash,dd.store_hash[hash],dd.app_client, import_options);
    msg = 'Sync started';
  } else {
    msg = 'Please select at least one supplier';
  }

  res.render('products', {
      //      data: f,
    post: {
        author: msg,
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}

async function sync_master(hash, auth_token, client_id, opts) {

  let mod = "sync_master";
  
  sf.sync_active = true;
  sf.abort_sync = false;

  sfLog(m, 'sync_master entry');

  let start = new Date().getTime();
  sfLog(m, "")

  opts.sync_errors = [];

  let success = false;

  try {

    let dd = ii.get_app_data();

    if( opts.do_customer_conversion && !sf.abort_sync ) {
      sfLog(m, 'sync_master invoking customer conversion');
      convert_customer_export_to_bc( opts );
    }
    
    sfLog(m, 'sync_master getting BC categories...');
    let cc = await ii.getBigCommerceCategories(hash, auth_token, client_id);
    sfLog(m, 'sync_master got BC categories...');
    opts.gun_catgs = ii.get_gun_category_ids(cc);
    opts.ammo_catgs = ii.get_ammunition_category_ids(cc);
    opts.archery_catgs = ii.get_archery_category_ids(cc);
    opts.bc_categories = cc;
    opts.catg_in_house = ii.getBigCommerceCategoryByPath(cc, ["Warehouse","In-House Catalog"]);
    opts.catg_unlisted = ii.getBigCommerceCategoryByPath(cc, ["Unlisted"]);
    opts.catg_lipseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse","Lipsey's Catalog"]);
    opts.catg_kinseys = ii.getBigCommerceCategoryByPath(cc, ["Warehouse","Kinsey's Catalog"]);
    opts.catg_rsr = ii.getBigCommerceCategoryByPath(cc, ["Warehouse","RSR Catalog"]);
    opts.catg_south = ii.getBigCommerceCategoryByPath(cc, ["Warehouse","Sports South Catalog"]);
    opts.catg_default = ii.getBigCommerceCategoryByPath(cc, ["Misc"]);
    opts.catg_hazmat = ii.getBigCommerceCategoryByPath(cc, ["HazMat"]);
    opts.catg_oos = ii.getBigCommerceCategoryByPath(cc, ["Out of Stock"]);
    opts.catg_unlisted = ii.getBigCommerceCategoryByPath(cc, ["Unlisted"]);
    opts.catgs_vendor = [ opts.catg_rsr.id, opts.catg_south.id, opts.catg_kinseys.id, opts.catg_lipseys.id ];
  
  
  
    if (opts.do_in_house && !sf.abort_sync ) {
      sfLog(m, 'sync_master invoking in_house_import...');
      await in_house.in_house_import( hash, dd.store_hash[hash], dd.app_client, opts);
      sfLog(m, 'sync_master in_house_import completed...');
    }
  
    if( opts.do_rsr || opts.do_kinseys || opts.do_lipseys || opts.do_sportsouth 
      || opts.do_fix1 || opts.do_fix2 || opts.do_fix3 || opts.do_fix4 || opts.do_fix5 || 
      opts.do_fix6 || opts.do_fix7 || opts.do_fix9 ) {
  
      let q = null;
      if( opts.do_fix4 ) {
        q = 'limit=250&include=images&include_fields=id,images,categories,is_visible,sku';
      }
  
      if (opts.do_fix7 && !sf.abort_sync ) {
        sfLog(m, 'sync_master processing fix7...');
        await shipperhq_meta.insert_shipperhq_metafields(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master completed fix7...');
        return;
      }

      if (opts.do_fix6 && !sf.abort_sync ) {
        sfLog(m, 'sync_master processing fix6...');
        
        q = 'limit=250&include=custom_fields&include_fields=id,categories,custom_fields';
        sfLog(m, 'sync_master getting fix6 BC products...');
        opts.bc_products = await ii.getAllBigCommerceProducts(hash, auth_token, client_id, q);
        sfLog(m, 'sync_master got fix6 BC products...');
        
        sfLog(m, 'sync_master invoking fix6...');
        await fix6(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix6 completed...');
        //opts.bc_products = pp;
        return;
      }
  
      sfLog(m, 'sync_master getting BC products...');
      let pp = await ii.getAllBigCommerceProducts(hash, auth_token, client_id, q);
      if( !pp.data || pp.data.length == 0 ) {
        // take early exit and restart if failure
        sfLog(m, 'sync_master error getting BC products, will retry in next cycle');
        let delay = repeat_ms - elapsed; // how much time until delay
        if( delay < min_wait ) {
        delay = min_wait;
        }
        sfLog(m,  "sync_master - next cycle in " + (delay/1000) + " seconds" );
        sf.pending = setTimeout( sync_master, delay, hash, auth_token, client_id, opts );
        return;
      }
      sfLog(m, 'sync_master got BC products...');
      opts.bc_products = pp;
      
  
    
  
      if (opts.do_fix4 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix4...');
        await fix4(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix4 completed...');
        // return;
      }
    
      if (opts.do_fix5 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix5...');
        await fix5(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix5 completed...');
        // return;
      }
    
      if (opts.do_rsr && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking rsr_import...');
        await rsr.rsr_import( hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master rsr_import completed...');
      }
    
      if (opts.do_kinseys && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking kinseys_import...');
        await kinseys.kinseys_import(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master kinseys_import completed...');
      }
    
      if (opts.do_lipseys && !sf.abort_sync )  {
        sfLog(m, 'sync_master invoking lipseys_import...');
        await lipseys.lipseys_import(hash,dd.store_hash[hash],dd.app_client, opts);
        sfLog(m, 'sync_master lipseys_import completed...');
      }
    
      if (opts.do_sportsouth && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking sports_south_import...');
        await sports_south.sports_south_import(hash,dd.store_hash[hash],dd.app_client, opts);
        sfLog(m, 'sync_master sports_south_import completed...');
      }
    
      if (opts.do_fix1 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix1...');
        await fix1(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix1 completed...');
      }
      if (opts.do_fix2 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix2...');
        await fix2(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix2 completed...');
      }
      if (opts.do_fix3 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix3...');
        await fix3(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix3 completed...');
      }
      if (opts.do_fix9 && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking fix9...');
        await fix9(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master fix9 completed...');
      }
    
    }
  
    // These two need a refresh of products data
    if( opts.do_adjust_sort_order || opts.do_sku_scrub ) {

      sfLog(m, 'sync_master getting BC products for post-processing...');
      pp = null;
      opts.bc_products = null;
      let q = 'limit=250&include=images&include_fields=id,inventory_level,price,upc,map_price,sku,cost_price,categories,name,is_visible,images,inventory_warning_level,sort_order';
      pp = await ii.getAllBigCommerceProducts(hash, auth_token, client_id, q);
      if( !pp.data || pp.data.length == 0 ) {
        // take early exit and restart if failure
        sfLog(m, 'sync_master error getting BC products, will retry in next cycle');
        let delay = repeat_ms - elapsed; // how much time until delay
        if( delay < min_wait ) {
        delay = min_wait;
        }
        sfLog(m,  "sync_master - next cycle in " + (delay/1000) + " seconds" );
        sf.pending = setTimeout( sync_master, delay, hash, auth_token, client_id, opts );
        return;
      }
      sfLog(m, 'sync_master got BC products for post-processing...');
      opts.bc_products = pp;

      if (opts.do_adjust_sort_order && !sf.abort_sync ) {
        sfLog(m, 'sync_master processing adjust_sort_order...');
        await adjust_sort_order(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master completed adjust_sort_order...');
      }
  
      if (opts.do_sku_scrub && !sf.abort_sync ) {
        sfLog(m, 'sync_master invoking upc_sku_scrub...');
        await sku_scrub.upc_sku_scrub(hash, dd.store_hash[hash], dd.app_client, opts);
        sfLog(m, 'sync_master upc_sku_scrub completed...');
        // return;
      }
  
    }

    
    sfLog(m, 'sync_master finished successfully');
  
    success = true;

  } catch( e ) {
    sfLog(m, 'sync_master terminated with an error');
    opts.sync_errors.push('sync_master terminated with an error: ' + e);
    console.log(e);
  }

  let elapsed = new Date().getTime() - start;
  sfLog(m,  'took ' + elapsed );


  if( !sf.abort_sync ) {
    let delay = repeat_ms; // will wait the full interval if failure occurred 
    if( success ) {
      delay = repeat_ms - elapsed; // how much time until delay
      if( delay < min_wait ) {
        delay = min_wait;
      }
    }
    sfLog(m,  "sync_master - next cycle in " + (delay/1000) + " seconds" );
    sf.pending = setTimeout( sync_master, delay, hash, auth_token, client_id, opts );
  } else {
    sf.abort_sync = false;
    sf.sync_active = false;
  }

}

async function junk(hash, auth_token, client_id, opts) {
  sfLog(m, "junk",hash, auth_token, client_id, opts);
}

async function fix1(hash, auth_token, client_id, opts) {

  let cc = opts.bc_categories;
  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let hazmat_catg = ii.getBigCommerceCategoryByPath(cc, ["HazMat"]);

  let pending_updates = [];

  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {
    let bc_export = pp.data[i];
    let old_categories = bc_export.categories;
    let old_price = bc_export.price;
    let is_gun = false;
    let is_ammo = false;
    let markup = 1.40;
    let custom_fields = [];
    let categories = [];

    let old_sku = bc_export.sku;
    if (old_sku.endsWith(rsrm.importOptions.sku_tag)) {
      custom_fields.push({ "name": "_warehouse_", "value": "rsr" });
    } else if (old_sku.endsWith(kinseysm.importOptions.sku_tag)) {
      custom_fields.push({ "name": "_warehouse_", "value": "kinseys" });
    } else if (old_sku.endsWith(lipseysm.importOptions.sku_tag)) {
      custom_fields.push({ "name": "_warehouse_", "value": "lipseys" });
    } else if (old_sku.endsWith(sports_southm.importOptions.sku_tag)) {
      custom_fields.push({ "name": "_warehouse_", "value": "sports_south" });
    } else {
      continue;
    }
    let updt = { "id": bc_export.id };

    // Check for gun or ammo
    for (let j = 0; j < old_categories.length; j++) {
      if (opts.gun_catgs.includes(bc_export.categories[j])) {
        is_gun = true;
        markup = 1.20;
        custom_fields.push({ "name": "_gun_", "value": "true" });
        break;
      }
    }
    if (!is_gun) {
      for (let j = 0; j < old_categories.length; j++) {
        if (opts.ammo_catgs.includes(bc_export.categories[j])) {
          is_ammo = true;
          custom_fields.push({ "name": "_ammo_", "value": "true" });
          if (hazmat_catg) {
            let hazmat_catg_id = hazmat_catg.id;
            if (!old_categories.includes(hazmat_catg_id)) {
              for (let x = 0; x < old_categories.length; x++) {
                categories.push(old_categories[x]);
              }
              categories.push(hazmat_catg_id);
              updt.categories = categories;
            }
          }
          break;
        }
      }
    }

    updt.price = Math.floor(old_price * markup) + 0.99;
    updt.cost_price = old_price;
    if (custom_fields.length > 0) {
      updt.custom_fields = custom_fields;
    }

    pending_updates.push(updt);
    if (pending_updates.length == 10) {
      sfLog(m, "batch of updates", pending_updates);
      let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
      sfLog(m, 'batch res', batch_res);
      pending_updates = [];
    }
  }
  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "final updates", pending_updates);
    let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    sfLog(m, 'batch res', batch_res);
  }

}

async function fix2(hash, auth_token, client_id, opts) {
  // create "FFL" "Yes" custom field for Automated FFL processing

  let cc = opts.bc_categories;
  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let hazmat_catg = ii.getBigCommerceCategoryByPath(cc, ["HazMat"]);

  let pending_updates = [];

  opts.is_gun(32);

  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {
    let bc_export = pp.data[i];
    // Check for gun
    if (opts.is_gun(bc_export.categories)) {
      let updt = {
        "id": bc_export.id,
        "custom_fields": [{ "name": "FFL", "value": "Yes" }]
      };
      pending_updates.push(updt);
      if (pending_updates.length == 10) {
        sfLog(m, "fix2 batch of updates", pending_updates);
        let batch_res = null;
        batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
        sfLog(m, 'fix2 batch res', batch_res);
        pending_updates = [];
      }
    }
  }
  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "fix2 final updates", pending_updates);
    let batch_res = null;
    batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    sfLog(m, 'fix2 final batch res', batch_res);
  }

}

async function fix3(hash, auth_token, client_id, opts) {

  let cc = opts.bc_categories;
  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let pending_updates = [];

  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {
    let bc_export = pp.data[i];
    let old_categories = bc_export.categories;
    let categories = [];
    let new_category = null;

    if( i % 100 == 0 ) {
      sfLog(m,  "Fix3 - Processing " + i + " of " + Math.min((start_ix + limit_ix), pp.data.length) );
    }

    let old_sku = bc_export.sku;
    if (old_sku.endsWith(rsrm.importOptions.sku_tag)) {
      new_category = opts.catg_rsr;
    } else if (old_sku.endsWith(kinseysm.importOptions.sku_tag)) {
      new_category = opts.catg_kinseys;
    } else if (old_sku.endsWith(lipseysm.importOptions.sku_tag)) {
      new_category = opts.catg_lipseys;
    } else if (old_sku.endsWith(sports_southm.importOptions.sku_tag)) {
      new_category = opts.catg_south;
    } else {
      new_category = opts.catg_in_house;
    }
    if (!old_categories.includes(new_category.id)) {
      for (let x = 0; x < old_categories.length; x++) {
        categories.push(old_categories[x]);
      }
      categories.push(new_category.id);
      let updt = { "id": bc_export.id, "categories": categories };
      pending_updates.push(updt);
      if (pending_updates.length == 10) {
        // sfLog(m, "batch of updates", pending_updates);
        let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
        sfLog(m, 'batch res', batch_res);
        pending_updates = [];
      }
    }      
  }


  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "final updates", pending_updates);
    let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    sfLog(m, 'batch res', batch_res);
  }

}



async function fix4(hash, auth_token, client_id, opts) {

  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let pending_updates = [];

  let updated = 0;

  const byUPC = [];
  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {

    if( sf.abort_sync ) {
      break;
    }

    let bc_export = pp.data[i];
    let bc_categories = bc_export.categories;

    // if (!bc_export.images || bc_export.images.length == 0) {
    //   if( bc_export.sku.endsWith(rsrm.importOptions.sku_tag+"ccc") ) { // RSR processing - might find images for some, otherwise hide
    //     let updt = {
    //       "id": bc_export.id
    //     };
    //     // See if we have any available images
    //     const img_host = "img.rsrgroup.com";
    //     const rsr_sku = bc_export.sku.replace("-"+rsrm.importOptions.sku_tag,'');
    //     let hi1 = "/highres-pimages/" + rsr_sku + "_1_HR.jpg";
    //     let hi2 = "/highres-pimages/" + rsr_sku + "_2_HR.jpg";
    //     let hi3 = "/highres-pimages/" + rsr_sku + "_3_HR.jpg";
    //     let lo1 = "/pimages/" + rsr_sku +"_1.jpg";
    //     let lo2 = "/pimages/" + rsr_sku +"_2.jpg";
    //     let lo3 = "/pimages/" + rsr_sku +"_3.jpg";
    //     let thumbed = false;
    //     let updt_imgs = [];
    //     // view 1
    //     if( await ii.imageExists( img_host, hi1 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + hi1,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imageExists( img_host, lo1 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + lo1,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
    //     // view 2
    //     if( await ii.imageExists( img_host, hi2 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + hi2,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imageExists( img_host, lo2 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + lo2,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
    //     // view 3
    //     if( await ii.imageExists( img_host, hi3 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + hi3,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imageExists( img_host, lo3 ) ) {
    //       let io = { 
    //         "image_url": "https://" + img_host + lo3,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
        
    //     if( updt_imgs.length > 0 ) {
    //       updt.images = updt_imgs;
    //       updt.is_visible = true;
    //       pending_updates.push(updt);
    //     } else if( bc_export.is_visible ) {
    //       updt.is_visible = false;
    //       pending_updates.push(updt);
    //     }
    //   }
    //   if( bc_export.sku.endsWith(sports_southm.importOptions.sku_tag) ) { // RSR processing - might find images for some, otherwise hide
    //     let updt = {
    //       "id": bc_export.id
    //     };
    //     // See if we have any available images
    //     const img_host = "media.server.theshootingwarehouse.com";
    //     const ss_sku = bc_export.sku.replace("-"+sports_southm.importOptions.sku_tag,'');
    //     let hi1 = "http://media.server.theshootingwarehouse.com/large/" + ss_sku + ".jpg";
    //     let hi2 = "http://media.server.theshootingwarehouse.com/large/" + ss_sku + "_A.jpg"; 
    //     let hi3 = "http://media.server.theshootingwarehouse.com/large/" + ss_sku + "_B.jpg"; 
    //     let lo1 = "http://media.server.theshootingwarehouse.com/small/" + ss_sku + ".jpg";
    //     let lo2 = "http://media.server.theshootingwarehouse.com/small/" + ss_sku + "_A.jpg"; 
    //     let lo3 = "http://media.server.theshootingwarehouse.com/small/" + ss_sku + "_B.jpg";
    //     let thumbed = false;
    //     let updt_imgs = [];
    //     // view 1
    //     if( await ii.imgURLExists( hi1 ) ) {
    //       let io = { 
    //         "image_url": hi1,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imgURLExists( lo1 ) ) {
    //       let io = { 
    //         "image_url": lo1,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
    //     // view 2
    //     if( await ii.imgURLExists( hi2 ) ) {
    //       let io = { 
    //         "image_url": hi2,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imgURLExists( lo2 ) ) {
    //       let io = { 
    //         "image_url": lo2,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
    //     // view 3
    //     if( await ii.imgURLExists( hi3 ) ) {
    //       let io = { 
    //         "image_url": hi3,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     } else if( await ii.imgURLExists( lo3 ) ) {
    //       let io = { 
    //         "image_url": lo3,
    //         "is_thumbnail": (updt_imgs.length == 0)
    //       };
    //       updt_imgs.push(io);
    //     }
        
    //     if( updt_imgs.length > 0 ) {
    //       updt.images = updt_imgs;
    //       updt.is_visible = true;
    //       pending_updates.push(updt);
    //     } else if( bc_export.is_visible ) {
    //       updt.is_visible = false;
    //       pending_updates.push(updt);
    //     }
    //   }
    //   if (pending_updates.length == 10) {
    //     sfLog(m, " fix4 batch of updates", pending_updates);
    //     let batch_res = null;
    //     batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    //     sfLog(m, 'fix4 batch res', batch_res);
    //     pending_updates = [];
    //     updated += pending_updates.length;
    //   }
    // }
  

    if (bc_categories.includes(opts.catg_in_house.id)
      || bc_categories.includes(opts.catg_kinseys.id)
      || bc_categories.includes(opts.catg_lipseys.id)
      || bc_categories.includes(opts.catg_rsr.id)
      || bc_categories.includes(opts.catg_south.id)
    ) {
      if (bc_export.is_visible && (!bc_export.images || bc_export.images.length == 0) ) {

        let updt = { "id": bc_export.id, "is_visible": false };
        pending_updates.push(updt);
        ++updated;
        if (pending_updates.length == 10) {
          sfLog(m, " fix4 batch of updates", pending_updates);
          let batch_res = null;
          batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
          sfLog(m, 'fix4 batch res', batch_res);
          pending_updates = [];
        }
      }
    } else {
      let pp = 0;
    }
  }


  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "fix4 final updates", pending_updates);
    let batch_res = null;
    batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    updated += pending_updates.length;
    sfLog(m, 'fix4 final batch res', batch_res);
  }

  sfLog(m, "fix4 updated " + updated);

}






async function fix5(hash, auth_token, client_id, opts) {

  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  } else {
    limit_ix = pp.data.length;
  }

  let pending_updates = [];

  let updated = 0;


  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {

    if (sf.abort_sync) {
      break;
    }

    let bc_export = pp.data[i];
    let bc_categories = bc_export.categories;
    if (bc_categories.includes(opts.catg_in_house.id)
      || bc_categories.includes(opts.catg_kinseys.id)
      || bc_categories.includes(opts.catg_lipseys.id)
      || bc_categories.includes(opts.catg_rsr.id)
      || bc_categories.includes(opts.catg_south.id)
    ) {
      if (bc_export.inventory_warning_level == 0) {

        let updt = { "id": bc_export.id, "inventory_warning_level": 3 };
        pending_updates.push(updt);
        ++updated;
        if (pending_updates.length == 10) {
          // sfLog(m, " fix5 batch of updates", pending_updates);
          let batch_res = null;
          batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
          // sfLog(m, 'fix5 batch res', batch_res);
          pending_updates = [];
        }
      }
    }
  }


  // apply any remaining updates
  if (pending_updates.length > 0) {
    // sfLog(m, "fix4 final updates", pending_updates);
    let batch_res = null;
    batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    // sfLog(m, 'fix4 final batch res', batch_res);
  }

  sfLog(m, "fix5 updated " + updated);

}

async function fix6(hash, auth_token, client_id, opts) {

  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  } 

  let pending_updates = [];

  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {
    let bc_export = pp.data[i];

    let val = null;
    const nm = "_warehouse_";

    if (bc_export.categories.includes(opts.catg_rsr.id)) {
      val = "rsr";
    } else if (bc_export.categories.includes(opts.catg_kinseys.id)) {
      val = "kinseys";
    } else if (bc_export.categories.includes(opts.catg_lipseys.id)) {
      val = "lipseys";
    } else if (bc_export.categories.includes(opts.catg_south.id)) {
      val = "sports_south";
    } else if (bc_export.categories.includes(opts.catg_in_house.id)) {
      val = "in_house";
    }
    if( val ) {
      let need_it = true;
      if( bc_export ) {
        for( let j = 0; j < bc_export.custom_fields.length; j++ ) {
          if( bc_export.custom_fields[j].name == nm ) {
            need_it = false;
            break;
          }
        }
      }
      if( need_it ) {
        pending_updates.push( { "id": bc_export.id, "custom_fields": [ {"name": nm, "value": val } ] } );
        if (pending_updates.length == 10) {
          sfLog(m, "batch of fix6 updates", pending_updates);
          let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
          sfLog(m, 'fix6 batch res', batch_res);
          pending_updates = [];
        }
      }
    }
  }
  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "fix6 final updates", pending_updates);
    let batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    sfLog(m, 'fix6 batch res', batch_res);
  }

}

async function adjust_sort_order(hash, auth_token, client_id, opts) {
  // set sort order to -1 if item is zero and in stock
  sfLog(m, 'adjust_sort_order entry');

  let q = 'limit=250&include_fields=id,inventory_level,sort_order';
  sfLog(m, 'sync_master getting adjust_sort_order BC products...');
  let pp = opts.bc_products;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let pending_updates = [];

  let updated = 0;

  const byUPC = [];
  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {

    if (sf.abort_sync) {
      break;
    }

    let bc_export = pp.data[i];


    if (bc_export.inventory_level == 0 && bc_export.sort_order == 0) {
      // update to sort order 1
    }
    if (bc_export.inventory_level > 0 && bc_export.sort_order == 0) {
      let updt = {
        "id": bc_export.id,
        "sort_order": -1
      };
      pending_updates.push(updt);
    }
    if (bc_export.inventory_level == 0 && bc_export.sort_order == -1) {
      let updt = {
        "id": bc_export.id,
        "sort_order": 0
      };
      pending_updates.push(updt);
    }

    if (pending_updates.length == 10) {
      //sfLog(m, " fix8 batch of updates", pending_updates);
      let batch_res = null;
      batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
      //sfLog(m, 'fix8 batch res', batch_res);
      updated += pending_updates.length;
      pending_updates = [];
    }

    // if(  i % 1000 == 1 ) {
    //   sfLog(m, "fix8 index " + i + ", updated " + updated);
    // }


  }


  // apply any remaining updates
  if (pending_updates.length > 0) {
    //sfLog(m, "fix8 final updates", pending_updates);
    let batch_res = null;
    batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    updated += pending_updates.length;
    //sfLog(m, 'fix8 final batch res', batch_res);
  }

  sfLog(m, "adjust_sort_order updated " + updated);

}

async function fix9(hash, auth_token, client_id, opts) {

  let cc = opts.bc_categories;
  let pp = opts.bc_products;
  let hidden = 0;

  let limit_ix = pp.data.length;
  let start_ix = 0;
  if (opts.start != '') {
    start_ix = 1 * opts.start - 1;
  }
  if (opts.count != '') {
    limit_ix = 1 * opts.count;
  }

  let pending_updates = [];

  for (let i = start_ix; i < (start_ix + limit_ix) && i < pp.data.length; i++) {
    let bc_export = pp.data[i];
    let is_oos = bc_export.categories.includes(opts.catg_oos.id);
    let test_categories = bc_export.categories;
    if (is_oos) {
      let xkey = "x" + bc_export.id;
      if (!opts.saved_catg_meta[xkey]) {
        test_categories = await ii.getSavedCategories(hash, auth_token, client_id, bc_export, cc);
        opts.saved_catg_meta[xkey] = test_categories;
      } else {
        test_categories = opts.saved_catg_meta[xkey];
      }

    }
    if( opts.is_archery(test_categories) && bc_export.is_visible ) {
      
      let old_sku = bc_export.sku;
      if ( old_sku.endsWith(rsrm.importOptions.sku_tag) 
      || old_sku.endsWith(kinseysm.importOptions.sku_tag)  
      || old_sku.endsWith(lipseysm.importOptions.sku_tag)
      || old_sku.endsWith(sports_southm.importOptions.sku_tag)) {
        let updt = { "id": bc_export.id, "is_visible": false };
        pending_updates.push(updt);
        ++hidden;
        if (pending_updates.length == 10) {
          // sfLog(m, "batch of updates", pending_updates);
          let batch_res = null;
          batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
          sfLog(m, 'batch res', batch_res);
          pending_updates = [];
        }
  
      }

    }
  }
  // apply any remaining updates
  if (pending_updates.length > 0) {
    sfLog(m, "final updates", pending_updates);
    let batch_res = null;
    batch_res = await ii.updateProductBatch(hash, auth_token, client_id, pending_updates);
    sfLog(m, 'batch res', batch_res);
  }
  sfLog(m, 'fix9 hid ' + hidden);  

}

async function hookup(hash, res, req) {

  let msg = "Webhooks check<br>";


  let auth_token = 'l31vivmqq42gucla10ba7wwuxt53klg';
  let kk = await ii.getHooks(hash,auth_token);
  console.log(kk);
  const me_hooks = [ 
    { 
      "scope" : 'store/order/statusUpdated',
      "destination" : 'https://mcmarkio-bc.ngrok.io/hooks'
    },
    { 
      "scope" : 'store/order/transaction/created',
      "destination" : 'https://mcmarkio-bc.ngrok.io/hooks'
    }
  ];

  if( kk.data ) {
    for( let h = 0; h < me_hooks.length; h++ ) {

      let search_hook = me_hooks[h];
      for( let i = 0; i < kk.data.length; i++ ) {
        if( kk.data[i].scope == search_hook.scope && kk.data[i].destination == search_hook.destination ) {
          msg += "<br>Webhook already installed - " + search_hook.destination + "/" + search_hook.scope;
          search_hook = null;
          break;
        }
      }
      
      if( search_hook ) {
        kk = await ii.createHook(hash, auth_token, search_hook.scope, search_hook.destination);
        if( kk.data && kk.data.is_active ) {
          msg += "<br>Webhook added - " + search_hook.destination + "/" + search_hook.scope;
        } else {
          msg += "<br>Error installing webhook for " + search_hook.destination + "/" + search_hook.scope + 
          "<br>" + kk;
        }
      }

    }

  }
  // if( !hooks_installed ) {
  //   kk = await ii.createHook(hash, auth_token, scope, destination);
  //   if( kk.data && kk.data.is_active ) {
  //     msg = "Webhooks were installed";
  //   } else {
  //     msg = "Error installing webhooks - " + kk;
  //   }
  // }
  res.render('products', {
    post: {
        author: msg,
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}

async function get_products(hash, res1, req) {




  sfLog(m, 'hash='+hash);

  
  var dd = ii.get_app_data();
  var uu = await loadABC(hash, req.query['what'], dd);

  //sfLog(m, uu);

  res1.render('products', {
    data: uu,
    post: {
      author: 'Products for ' + req.query['what'],
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });

  return uu;
}

async function add_product(hash, res1, req) {
  var dd = ii.get_app_data();
  sfLog(m, 'dd');sfLog(m, dd);
  var ff = null;
  var add_opts =
  {
    'method': 'POST',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };
  var add_data =
  {
    "name": req.query['p_name'],
    "type": "physical",
    "description": req.query['p_desc'],
    "weight": 5,
    "width": 12,
    "price": 25.99,
    "categories": [
      29
    ],
    "condition": "New"
  };
  ff = await addABC(add_opts, JSON.stringify(add_data));
  msg = (ff) ? "Product added" : "Error";

  res1.render('products', {
    data: { "data": [ff.data] },
    message: msg,
    post: {
      author: 'Product Add ',
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}

async function import_rsr(hash, res1, req) {
  var dd = ii.get_app_data();
  sfLog(m, 'import_rsr dd\n', dd, "\nhash=", hash);
  sfLog(m, hash,dd.store_hash[hash],dd.app_client);
  var ff = null;
  var import_options = {
    "start": req.query["p_ix_start"],
    "count": req.query["p_ix_count"],
    "export_file": req.query["p_export_file"]
  };

  rsr.rsr_import(hash,dd.store_hash[hash],dd.app_client, import_options);

  res1.render('products', {
      //      data: f,
    post: {
        author: 'RSR Import Started',
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}

async function import_lipseys(hash, res1, req) {
  let dd = ii.get_app_data();
  sfLog(m, 'import_lipseys dd\n', dd, "\nhash=", hash);
  sfLog(m, hash,dd.store_hash[hash],dd.app_client);
  let ff = null;
  let import_options = {
    "start": req.query["p_ix_start"],
    "count": req.query["p_ix_count"],
    "export_file": req.query["p_export_file"]
  };

  lipseys.lipseys_import(hash,dd.store_hash[hash],dd.app_client, import_options);

  res1.render('products', {
      //      data: f,
    post: {
        author: 'Lipsey\'s Import Started',
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}

async function import_kinseys(hash, res1, req) {
  let dd = ii.get_app_data();
  sfLog(m, 'import_kinseys dd\n', dd, "\nhash=", hash);
  sfLog(m, hash,dd.store_hash[hash],dd.app_client);
  let ff = null;
  let import_options = {
    "start": req.query["p_ix_start"],
    "count": req.query["p_ix_count"],
    "export_file": req.query["p_export_file"]
  };

  kinseys.kinseys_import(hash,dd.store_hash[hash],dd.app_client, import_options);

  res1.render('products', {
      //      data: f,
    post: {
        author: 'Kinsey\'s Import Started',
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}

async function import_south(hash, res1, req) {
  let dd = ii.get_app_data();
  sfLog(m, 'import_south dd\n', dd, "\nhash=", hash);
  sfLog(m, hash,dd.store_hash[hash],dd.app_client);
  let ff = null;
  let import_options = {
    "start": req.query["p_ix_start"],
    "count": req.query["p_ix_count"],
    "last_date": req.query["p_last_date"],
    "export_file": req.query["p_export_file"]
  };

  sports_south.sports_south_import(hash,dd.store_hash[hash],dd.app_client, import_options);

  res1.render('products', {
      //      data: f,
    post: {
        author: 'Sports South import Started',
        image: 'https://picsum.photos/500/500',
        comments: []
    }
  });
}
async function get_rsr(hash, res1, req) {
  var dd = ii.get_app_data();
  sfLog(m, 'rr');sfLog(m, dd);
  var ff = null;
  var rsr_opts =
  {
    'method': 'POST',
    'hostname': 'test.rsrgroup.com',
    'path': '/api/rsrbridge/1.0/pos/get-items',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    'maxRedirects': 20
  };
  var rsr_data =
  {
    "Username": "***",
    "Password": "***",
    "POS": "I",
    "Limit" : 5,
    "Offset": 0,
    "WithAttributes" : false
  };
  ff = await addABC(rsr_opts, JSON.stringify(rsr_data));
  msg = (ff) ? "got rsr" : "Error";

  sfLog(m, ff.Items[0]);
  if(ff && ff.Items && ff.Items.length > 0 ) {
    var mc_item = ff.Items[0];
    sfLog(m, "Title",mc_item.Title);
  }

}
async function update_product(hash, res1, req) {
  var dd = ii.get_app_data();

  var ff = null;
  var update_opts =
  {
    'method': 'PUT',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products/' + req.query["p_id"],
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };
  var update_data =
  {
    "price": req.query["p_price"]
  };


  ff = await updateABC(update_opts, JSON.stringify(update_data));

  sfLog(m, 'gee');

  res1.render('products', {
    data: { "data": [ff.data] },
    post: {
      author: 'Products Update',
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}

async function delete_product(hash, res1, req) {
  var dd = ii.get_app_data();

  var ff = null;
  var delete_opts =
  {
    'method': 'DELETE',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products/' + req.query["p_id"],
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };

  ff = await deleteABC(delete_opts);

  res1.render('products', {
    data: ff,
    post: {
      author: 'Product Delete',
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}
async function addABC(opts, data) {
  var kk = ii.httpRequest(opts, data);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = JSON.parse(data);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  })
    .catch(function (e) {
      sfLog(m, e);
      sfLog(m, "ick");
    });
  ;
  //  sfLog(m, "ff", ff);
  sfLog(m, 'bacon');
  return ff;
}

async function updateABC(opts, data) {
  var kk = ii.httpRequest(opts, data);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = JSON.parse(data);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });
  sfLog(m, 'doggy');
  return ff;
}

async function deleteABC(opts) {
  var kk = ii.httpRequest(opts);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = ""; // no return content for delete
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });
  return ff;
}

/**
 * Uses await to serialize API calls
 * @param {*} hash 
 * @param {*} what 
 * @param {*} dd 
 */
async function loadABC(hash, what, dd) {
  var catg_opts = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/categories?id:in=',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };
  var prod_opts =
  {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products?keyword=' + querystring.escape(what),
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };
  var catg_opts_base_path = catg_opts.path;
  var cc = null;
  var pp = null;

  sfLog(m, 'wuff',  prod_opts);
  var kk = ii.httpRequest(prod_opts);
  await kk.then((data) => {
    try {
      pp = JSON.parse(data);
      sfLog(m, pp.data.length);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });

  for (var ix = 0; ix < pp.data.length; ix++) {
    var uu = ugh(dd, hash, pp.data[ix]);
    await uu.then((zzz) => {
      sfLog(m, 'zzz ' + pp.data[ix]);
      sfLog(m, JSON.stringify(zzz.categories));
      catg_opts.path = catg_opts_base_path + zzz.categories.join();
      //sfLog(m, zzz);
      //sfLog(m, zzz);
    });

  }



  sfLog(m, 'meow '+ catg_opts.path);
  kk = ii.httpRequest(catg_opts);
  await kk.then((data) => {
    try {
      cc = JSON.parse(data);
      sfLog(m, cc);
      //sfLog(m, cc);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });

  sfLog(m, 'golly');
  //sfLog(m, pp.data[0]);
  //sfLog(m, pp.data[0].categories);

  return pp;
}


async function ugh(dd, hash, pdata) {
  sfLog(m, 'ugh ' + pdata.id);
  //sfLog(m, dd);


    //sfLog(m, ccc);
    var vv = getVariants(dd, hash, pdata.id);
    await vv.then((data) => {
      try {
        sfLog(m, data.length);
        pdata.variants = data;
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    var cf = getCustomFields(dd, hash, pdata.id);
    await cf.then((data) => {
      try {
        sfLog(m, data.length);
        pdata.custom_fields = data;
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    var ct = getCategoryInfo(dd, hash, pdata);
    await ct.then((data) => {
      try {
        sfLog(m, data.length);
        pdata.category_details = data;
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    return pdata;
}

async function getCustomFields(dd, hash, pid) {
  sfLog(m, 'getCustomFields ' + pid);
  //sfLog(m, dd);

  var cf_opts = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products/' + pid + '/custom-fields?limit=30',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };

  var kkk = ii.httpRequest(cf_opts);
  var ccc = null;
  var me_data = null;
  await kkk.then((data) => {
    try {
      ccc = JSON.parse(data);
      me_data = ccc.data;
      //sfLog(m, cc);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });
  sfLog(m, "next=" + ccc.meta.pagination.links.next);
  var base_path = cf_opts.path;
  while (ccc.meta.pagination.links.next) {
    cf_opts.path = base_path + ccc.meta.pagination.links.next;
    var varx = ii.httpRequest(cf_opts);
    //var vard = null;
    await varx.then((data) => {
      try {
        ccc = JSON.parse(data);
        sfLog(m, "next=" + ccc.meta.pagination.links.next);
        me_data = me_data.concat(ccc.data);
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    //sfLog(m, ccc);
  }
  sfLog(m, me_data);
  return me_data;
}

async function getVariants(dd, hash, pid) {
  sfLog(m, 'getVariants ' + pid);
  //sfLog(m, dd);

  var vars_opts = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products/' + pid + '/variants?limit=30',
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };

  var kkk = ii.httpRequest(vars_opts);
  var ccc = null;
  var me_data = null;
  await kkk.then((data) => {
    try {
      ccc = JSON.parse(data);
      me_data = ccc.data;
      //sfLog(m, cc);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });
  sfLog(m, "next=" + ccc.meta.pagination.links.next);
  var base_path = vars_opts.path;
  while (ccc.meta.pagination.links.next) {
    vars_opts.path = base_path + ccc.meta.pagination.links.next;
    var varx = ii.httpRequest(vars_opts);
    //var vard = null;
    await varx.then((data) => {
      try {
        ccc = JSON.parse(data);
        sfLog(m, "next=" + ccc.meta.pagination.links.next);
        me_data = me_data.concat(ccc.data);
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    //sfLog(m, ccc);
  }
  return me_data;
}

async function doh(hash, res1, req) {

  try {

    const results = [];

    const client = new ftp.Client()
    await client.access({
      host: "ftp.kinseysinc.com",
      user: "***",
      password: "***"
      //secure: true
    });
    await client.downloadTo("../app_data/Products.csv", "/Products.csv");

    client.close();

    let fd = fs.createReadStream('../app_data/Products.csv');
    let csv1 = csv();

    fd.pipe(csv1).on('data', (data) => results.push(data));

    let end = new Promise(function (resolve, reject) {
      csv1.on('end', () => resolve("yes"));
      fd.on('error', reject); // or something like that. might need to close `hash`
    });

    await end;

    console.log(results[0]);
    for( let i = 0; i < results.length; i++ ) {
      let p = results[i];
      if( p.BulletFeatures != '' ) {
        let features = p.BulletFeatures.split(';');
        console.log(features.length);
      }
    }

  } catch (e) {
    console.log(e);
  }

  try {

    let mailOptions2 = {
      from: 'mark@mckenzieduo.com',
      to: 'mark.mckenzie@herodigital.com',
      subject: 'Sending Email using Node.js',
      html: '<h1> Node JS </h1> <br> <h5> Hello World</h5>'
    };

    let mailOptions = {
      from: 'onlinesales@sportsmansfinest.com',
      to: 'mark.mckenzie@herodigital.com',
      subject: 'Sending Email using Node.js',
      html: '<h1> Node JS </h1> <br> <h5> Hello World</h5>'
    };


    await ii.wrappedSendMail(mailOptions2);
    console.log("sent");
  } catch (e) {
    console.log(e);
  }
  res1.render('products', {
    data: null,
    post: {
      author: 'Doh ' + req.query['what'],
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });

}

async function doh1(hash, res1, req) 

{
  const alpdemoClient = createClient(
  "https://alpinedemo1.com",
  {
      authType: AuthType.Digest,
      username: "mckids@voyager.net",
      password: "***"
  }
  );
  const sportsmansClient = createClient(
    "https://sportsmans-finest.mybigcommerce.com",
    {
        authType: AuthType.Digest,
        username: "mark.mckenzie@herodigital.com",
        password: "***"
    }
    );
  
  try {
    sfLog(m, 'one');
    //const contents = await client.getDirectoryContents("/");
    //sfLog(m, contents);
    // sfLog(m, 'two');
    // var f1 = fs.createWriteStream("../app_data/products-2021-11-08.xml");
    // var aaa = await client
    // .createReadStream("/content/billboard 1950s weekly top hits.txt")
    // .pipe(f1).on('finish', /*resolve*/ function(){
    //   sfLog(m, "Finished");
    // } )
    // .on('error', function(){
    //   sfLog(m, "Nuts!");
    // });
    // await f1;
    // sfLog(m, 'tree');
    //const directoryItems = await alpdemoClient.getDirectoryContents("/");
    const streamToFile = (client, inputSpec, outputSpec) => {
      return new Promise((resolve, reject) => {
        // "/content/billboard 1950s weekly top hits.txt"
        // rsrinventory-keydlr-new.txt
        var is = client.createReadStream( inputSpec );
        var os = fs.createWriteStream( outputSpec );
        is.pipe(os)          
          .on('finish', () => resolve("done"))
          .on('error', error => reject(error))
      })
    }
    //const yyy = streamToFile(alpdemoClient, "/content/billboard 1950s weekly top hits.txt","../app_data/alpinedemo1.txt");
    //const yyy = streamToFile(alpdemoClient, "/dav/exports/products-2021-11-09.xml","../app_data/alpinedemo1.txt");
    //const yyy = streamToFile(client2, "/content/products-2021-11-08.xml","../app_data/sportsmans.txt");
    const yyy = streamToFile(sportsmansClient, "/dav/exports/products-2021-11-08.xml","../app_data/sportsmans.xml");
    //const yyy = streamToFile(alpdemoClient, "/exports/products-2021-11-09.xml","../app_data/alpinedemo1.txt");
    await yyy;
    sfLog(m, 'yyy',yyy);
  } catch( e ) {
     sfLog(m, e);
   }
  sfLog(m, 'fours');


}
async function getCategoryInfo(dd, hash, pdata) {
  sfLog(m, 'getCategoryInfo ' + pdata.id + " " + pdata.categories);
  //sfLog(m, dd);

  var catg_opts = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/categories?id:in='+pdata.categories.join(),
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };
  var catg_opts_base_path = catg_opts.path;

  var kkk = ii.httpRequest(catg_opts);
  var ccc = null;
  var me_data = null;
  await kkk.then((data) => {
    try {
      ccc = JSON.parse(data);
      me_data = ccc.data;
      //sfLog(m, cc);
    } catch (e) {
      sfLog(m, e);
      sfLog(m, data);
    }
  });
  sfLog(m, "next=" + ccc.meta.pagination.links.next);
  var base_path = catg_opts.path;
  while (ccc.meta.pagination.links.next) {
    catg_opts.path = base_path + ccc.meta.pagination.links.next;
    var varx = ii.httpRequest(catg_opts);
    //var vard = null;
    await varx.then((data) => {
      try {
        ccc = JSON.parse(data);
        sfLog(m, "next=" + ccc.meta.pagination.links.next);
        me_data = me_data.concat(ccc.data);
        //sfLog(m, cc);
      } catch (e) {
        sfLog(m, e);
        sfLog(m, data);
      }
    });

    //sfLog(m, ccc);
  }
  return me_data;
}

// Converts UnifiedCommerce format Customers export csv to "bulk edit" format for BigCommerce dashboard import processing
async function convert_customer_export_to_bc(opts) {

  if( sf.abort_sync ) {
    sfLog(m, "returning");
    return;
  }



  const bb = "p_uc_export_file";

  // First bring in the csv from the UnifiedCommerce customers export
  sfLog(m, bb + " - Going to read and parse UC export csv from " + opts.uc_export_file);

  let fda = fs.createReadStream(opts.uc_export_file);

  let csva = csv({ separator: ',', quote: '"' });
  let aa = [];
  fda.pipe(csva).on('data', (data) => aa.push(data));

  let enda = new Promise(function (resolve, reject) {
    csva.on('end', () => resolve("yes"));
    fda.on('error', reject); // or something like that. might need to close `hash`
  });

  await enda;

  sfLog(m, bb + " - Read and parsed UC export csv from " + opts.uc_export_file);

  // Build array of objects mapping the UC data to BC bulk export properties

  const stp = [];

  // The export csv file will have a base row with the customer email first, possibly followed by more
  // rows with an empty email for each additional customer address. BigCommerce can only handle 2 additional addresses.
  sfLog(m, bb + " - Generating BigCommerce import rows");

  for (let i = 0; i < aa.length; i++) {
    let u = aa[i]
    let usr = {};

    // Common from base row
    if (u.email != '') {
      usr["Email Address"] = u.email;
      usr["First Name"] = u.firstname;
      usr["Last Name"] = u.lastname;
      usr["Company"] = "";
      usr["Phone"] = u._address_telephone;
      usr["Notes"] = "";
      usr["Store Credit"] = "";
      usr["Customer Group"] = "";
      usr["Address ID - 1"] = "";
      usr["Address First Name - 1"] = u._address_firstname;
      usr["Address Last Name - 1"] = u._address_lastname;
      usr["Address Company - 1"] = "";
      let ll = u._address_street.split('\n');
      usr["Address Line 1 - 1"] = ll[0];
      if (ll.length > 1) {
        usr["Address Line 2 - 1"] = ll[1];
      } else {
        usr["Address Line 2 - 1"] = "";
      }
      usr["Address City - 1"] = u._address_city;
      usr["Address State - 1"] = u._address_region;
      usr["Address Zip - 1"] = u._address_postcode;
      usr["Address Country - 1"] = u._address_county_id;
      usr["Address Phone - 1"] = u._address_telephone;
      usr["Address ID - 2"] = "";
      usr["Address First Name - 2"] = "";
      usr["Address Last Name - 2"] = "";
      usr["Address Company - 2"] = "";
      usr["Address Line 1 - 2"] = "";
      usr["Address Line 2 - 2"] = "";
      usr["Address City - 2"] = "";
      usr["Address State - 2"] = "";
      usr["Address Zip - 2"] = "";
      usr["Address Country - 2"] = "";
      usr["Address Phone - 2"] = "";
      usr["Address ID - 3"] = "";
      usr["Address First Name - 3"] = "";
      usr["Address Last Name - 3"] = "";
      usr["Address Company - 3"] = "";
      usr["Address Line 1 - 3"] = "";
      usr["Address Line 2 - 3"] = "";
      usr["Address City - 3"] = "";
      usr["Address State - 3"] = "";
      usr["Address Zip - 3"] = "";
      usr["Address Country - 3"] = "";
      usr["Address Phone - 3"] = "";
      usr["Receive Review/Abandoned Cart Emails?"] = "";
      if (i + 1 < aa.length && aa[i + 1].email == '') {
        // Second address if next row has blank email
        let u2 = aa[i + 1];
        usr["Address First Name - 2"] = u2._address_firstname;
        usr["Address Last Name - 2"] = u2._address_lastname;
        usr["Address Company - 2"] = "";
        let ll = u2._address_street.split('\n');
        usr["Address Line 1 - 2"] = ll[0];
        if (ll.length > 1) {
          usr["Address Line 2 - 2"] = ll[1];
        } else {
          usr["Address Line 2 - 2"] = "";
        }
        usr["Address City - 2"] = u2._address_city;
        usr["Address State - 2"] = u2._address_region;
        usr["Address Zip - 2"] = u2._address_postcode;
        usr["Address Country - 2"] = u2._address_county_id;
        usr["Address Phone - 2"] = u2._address_telephone;

        if (i + 2 < aa.length && aa[i + 2].email == '') {
          // third address if 2nd after row also has blank email - any further blank email rows are ignored
          let u3 = aa[i + 2];
          usr["Address First Name - 3"] = u3._address_firstname;
          usr["Address Last Name - 3"] = u3._address_lastname;
          usr["Address Company - 3"] = "";
          let ll = u3._address_street.split('\n');
          usr["Address Line 1 - 3"] = ll[0];
          if (ll.length > 1) {
            usr["Address Line 2 - 3"] = ll[1];
          } else {
            usr["Address Line 2 - 3"] = "";
          }
          usr["Address City - 3"] = u3._address_city;
          usr["Address State - 3"] = u3._address_region;
          usr["Address Zip - 3"] = u3._address_postcode;
          usr["Address Country - 3"] = u3._address_county_id;
          usr["Address Phone - 3"] = u3._address_telephone;
        }

      }

      stp.push(usr);
    }

  }

  // This is bad because we really don't synchronized it, but let it just stringify and write the csv async
  sfLog(m, bb + " - Launching async process to write csv to " + opts.bc_import_file);

  let xx = stringify(stp, {
    header: true, delimiter: ',', quoted: true
  }, function (err, data) {
    sfLog(m, data);
    try {
      fs.writeFileSync(opts.bc_import_file, data)
      sfLog(m, bb + " - Async process wrote csv to " + opts.bc_import_file);
      //file written successfully
    } catch (err) {
      console.error(err)
    }
  });


}

