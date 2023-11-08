/**
 * 
 * This modules will hide duplicate SKUs for a UPC code, based on warehouse priority,
 * but setting the product is_visible property.
 */
const iii = require("../util/ick");
const m = "upc_sku_scrub";
const upc_metafield_options = {
    "permission_set": "write",
    "key": "saved_catg",
    "namespace": "sf.catalog"
};

const csv = require('csv-parser')
const fs = require('fs')

const stream = require("stream");const rsr = require("../util/RSRMappings");
const kinseys = require("../util/KinseysMappings");
const lipseys = require("../util/LipseysMappings");
const south = require("../util/SportsouthMappings");



async function upc_sku_scrub(hash, access_token, client_id, opts) {
    let m = "upc_reset";
  
    let products_hidden = 0;
    let products_shown = 0;
  
  
    sfLog(m, 'upc hey');
  
    let pp = opts.bc_products; //await ii.getAllBigCommerceProducts(creds.hash, creds.access_token, creds.client_id, q, addq);
    let cc = opts.bc_categories; //await ii.getBigCommerceCategories(creds.hash, creds.access_token, creds.client_id);
  
    
    
    
    let xbyUPC = [];
    let in_house_pp = [];
    let updts = [];
    let uc = 0;
    let uc_groups = 0;
    let uc_group_products = 0;
    let uc_made_visible = 0;
    let uc_no_vendor_catg = 0;
    let uc_no_oos_or_catg = 0;
    let uc_no_categories = 0;
    let uc_added_categories = 0;
    let missing_ids = [];
  
    let ihp = [];

    const vendor_catg = [
      opts.catg_rsr.id, opts.catg_south.id, opts.catg_lipseys.id, opts.catg_kinseys.id
    ];
    for (let x = 0; x < pp.data.length; x++) {

      // may need corrections - 
      // 1. no supplier catg but has supplier sku tag - need to add supplier tag.
      // 2. not OOS catg but no other catg, or only supplier catg - fetch meta catg and reapply 
      let bc = pp.data[x];

      if( bc.categories.length == 0 ) {
        ++uc_no_categories;
        missing_ids.push(bc.id);
      }
      let missing_catg = null;
      
      if ( bc.sku.endsWith(rsr.importOptions.sku_tag) ) {
        bc.xsort_order = opts.catg_rsr.sort_order;
        if( !bc.categories.includes(opts.catg_rsr.id)) {
          missing_catg = opts.catg_rsr.id;
          ++uc_no_vendor_catg;
        }
      } else if ( bc.sku.endsWith(south.importOptions.sku_tag) ) {
        bc.xsort_order = opts.catg_south.sort_order;
        if( !bc.categories.includes(opts.catg_south.id)) {
          missing_catg = opts.catg_south.id;
          ++uc_no_vendor_catg;
        }
      } else if ( bc.sku.endsWith(lipseys.importOptions.sku_tag) ) {
        bc.xsort_order = opts.catg_lipseys.sort_order;
        if( !bc.categories.includes(opts.catg_lipseys.id)) {
          missing_catg = opts.catg_lipseys.id;
          ++uc_no_vendor_catg;
        }
      } else if ( bc.sku.endsWith(kinseys.importOptions.sku_tag) ) {
        bc.xsort_order = opts.catg_kinseys.sort_order;
        if( !bc.categories.includes(opts.catg_kinseys.id)) {
          missing_catg = opts.catg_kinseys.id;
          ++uc_no_vendor_catg;
        }
      } else {
        bc.xsort_order = opts.catg_in_house.sort_order;
        ihp.push(bc);
      }

      let is_oos = bc.categories.includes(opts.catg_oos.id);
      if( !is_oos && missing_catg ) {
        //console.log( 'need to add catg ', bc, missing_catg);
      }
      if (bc.upc && bc.upc != '' && bc.upc != '0' && /^\d+$/.test(bc.upc)
      && bc.xsort_order != 999 && bc.is_visible
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

    let exp_file = opts.sku_scrub_export;
  if (exp_file && exp_file != '') {
    let aa = [];
    // Category Name: RSR Catalog, Category Path: Warehouse/RSR Catalog|Category Name: Out of Stock, Category Path: Out of Stock
    //const opts = {};
    let fda = fs.createReadStream(exp_file);
    let csva = csv({ separator: ',', quote: '"' });

    fda.pipe(csva).on('data', (data) => aa.push(data));

    let enda = new Promise(function (resolve, reject) {
      csva.on('end', () => resolve("yes"));
      fda.on('error', reject); // or something like that. might need to close `hash`
    });

    await enda;
    console.log("done read attributes", enda, aa[0]);
    const catg_path_tag = "Category Path: ";
    for (let x = 0; x < aa.length; x++) {
      let r = aa[x];
      let xid = r["Product ID"] * 1;
      if (missing_ids.includes(xid)) {
        let updt = { "id": xid, "categories": [] };
        let catg = r["Category Details"];
        let paths = catg.split("|");
        for (let p = 0; p < paths.length; p++) {
          let path = paths[p];
          let q = path.indexOf(catg_path_tag);
          if (q >= 0) {
            path = path.substring(q + catg_path_tag.length);
          }
          let segs = path.split("/");
          let cid = iii.getBigCommerceCategoryByPath(cc, segs);
          if (cid) {
            updt.categories.push(cid.id);
            ++uc_added_categories;
          }
        }
        if (updt.categories.length > 0) {
          updts.push(updt);
          if (updts.length == 10) {
            let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
            //sfLog(m, 'batch res', batch_res);
            updts = [];
          }
        }
      }
    }
    if (updts.length > 0) {
      let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
      //sfLog(m, 'batch res', batch_res);
      updts = [];
    }
    return;
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
          if( prod[i].xsort_order == opts.catg_in_house.sort_order ) {
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
    // for (let key in byUPC) {
    //   let prod = byUPC[key]; // Get array of SKUs for this UPC
    //   for (let i = 0; i < prod.length; i++) {
    //     let p = prod[i];
    //     if (!p.is_visible) {
    //       updts.push({ "id": p.id, "is_visible": true });
    //       p.is_visible = true;
    //       ++uc_made_visible;
    //       if (updts.length == 10) {
    //         let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
    //         //sfLog(m, 'batch res', batch_res);
    //         updts = [];
    //       }
    //     }
    //   }
    // }
    // if (updts.length > 0) {
    //   let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
    //   //sfLog(m, 'batch res', batch_res);
    //   updts = [];
    // }
  
    let process_aborted = false;
  
    for (let key in byUPC) {
      if( sf.abort_sync ) {
        process_aborted = true;
        break;
      }
      uc++;
      let prod = byUPC[key]; // Get array of SKUs for this UPC
      // for (let i = 0; i < prod.length; i++) {
      //   let p = prod[i];
      //   if( p.xsort_order == opts.catg_in_house.sort_order ) {
      //     console.log("hey");
      //   }
      // }
     
      //let have_in_house = false;
      let have_in_stock = false;
      for (let i = 0; i < prod.length; i++) {
        let p = prod[i];
        // if( p.xsort_order == opts.catg_in_house.sort_order ) {
        //   console.log("hey");
        // }
        // if (p.xsort_order == opts.catg_in_house.sort_order) {
        //     have_in_house = true;
        //     p.show_me = true;
        //     // console.log('have in-house',p);
        //     // console.log(prod);
        // } else {
          if( !have_in_stock && p.inventory_level > 0 ) {
            have_in_stock = true;
            p.show_me = true;
          } else {
            p.show_me = false;
          }
        //}
        if( p.inventory_level > 0 ) {
          have_in_stock = true;
        }
      }
      if( !have_in_stock ) {
        prod[0].show_me = true; // nothing in stock, show the first SKU
      }
      for (let i = 0; i < prod.length; i++) {
        let bc_prod = prod[i];
        let is_hidden = bc_prod.categories.includes(opts.catg_oos.id);
        let rc = null;
        if (is_hidden) {
          if (bc_prod.show_me) {
            rc = await showSKUforUPC(hash, access_token, client_id, opts, cc, bc_prod, updts);
            ++products_shown;
          }
        } else {
          if (!bc_prod.show_me ) {
            if( bc_prod.xsort_order != opts.catg_in_house.sort_order) {
              rc = await hideSKUforUPC(hash, access_token, client_id, opts, cc, bc_prod, updts);
              ++products_hidden;
            }
          }
        }
        if (updts.length == 10) {
          let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
          //sfLog(m, 'batch res', batch_res);
          updts = [];
        }
      }
      //console.log( prod );
      // have to add processing to show / hide as needed
    }
  
    if (updts.length > 0) {
      //sfLog(m, "final batch of upc updates", updts);
      let batch_res = await iii.updateProductBatch(hash, access_token, client_id, updts);
      //sfLog(m, 'batch res', batch_res);
      updts = [];
    }
  
    if( process_aborted ) {
        console.log('UPC SKU Scrub exited early due to sync cancellation');
    }
    console.log('UPC SKU Scrub is done, hidden ' + products_hidden + ", shown " + products_shown
      + ", products made visible " + uc_made_visible
      + ", no oos or catg " + uc_no_oos_or_catg + ", no vendor catg " + uc_no_vendor_catg 
      + ", no categories " + uc_no_categories + ", added categories for " + uc_added_categories
      + ", eligible UPC groups " + uc_groups + ", products in eligible groups " + uc_group_products);
  
    console.log('demo');
  
  
  }
  
  
  async function showSKUforUPC(hash, access_token, client_id, opts, bc_catgs, bc_prod, updts) {
    // first see if there's saved metafield
    let product_id = bc_prod.id;

    let saved_catgs = null;
    let xkey = "x" + product_id;
    if( ! opts.saved_catg_meta[xkey] ) {
      saved_catgs = await iii.getSavedCategories(hash, access_token, client_id, bc_prod, bc_catgs);
      opts.saved_catg_meta[xkey] = saved_catgs;
    } else {
      saved_catgs = opts.saved_catg_meta[xkey];
    }
   
    if (saved_catgs && saved_catgs.length > 0 ) {
        let new_catgs = [];
        for (let i = 0; i < saved_catgs.length; i++) {
          let catg = saved_catgs[i];
          if (bc_catgs.cats_by_id[catg]) {
            new_catgs.push(catg);
          }
        }
        updts.push({ "id": product_id, "categories": new_catgs });
    }
    
  }
  
  async function hideSKUforUPC(hash, access_token, client_id, opts, bc_catgs, bc_prod, updts) {
    // first see if it exists
    let product_id = bc_prod.id;
    let xkey = "x" + product_id;
    //console.log("showing " + product_id, bc_prod);
    let save_categories = bc_prod.categories.join(",");
    let params = "namespace=" + upc_metafield_options.namespace + "&key=" + upc_metafield_options.key;
    let mf = null;
    try {
      mf = await iii.getProductMetafields(hash, access_token, client_id, product_id, params);
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
  
          let md = await iii.create_product_metafield(hash, access_token, client_id, product_id, meta_add_data);
  
          //console.log(md);
        } else {
  
          let mu = await iii.updateProductMetafield(hash, access_token, client_id, product_id, mf.data[0].id, save_categories);
  
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
        // Replace or add value in cached saved catgs
        let sc = [];
        for( let i = 0; i < bc_prod.categories.length; i++ ) {
          sc.push( bc_prod.categories[i] );
        }
        opts.saved_catg_meta[xkey] = sc;
    }
  }
  



// async function xupc_sku_scrub(hash, auth_token, client_id, opts) {

//     init_status();

//     let products_hidden = 0;
//     let products_shown = 0;

//     let pp = opts.bc_products;

//     let in_house_pp = [];

//     // First, index all BC products by UPC code

//     let byUPC = [];
//     for (let x = 0; x < pp.data.length; x++) {
//         let bc = pp.data[x];
//         if (bc.categories.includes(opts.catg_rsr.id)) {
//             bc.xsort_order = opts.catg_rsr.sort_order;
//         } else if (bc.categories.includes(opts.catg_south.id)) {
//             bc.xsort_order = opts.catg_south.sort_order;
//         } else if (bc.categories.includes(opts.catg_lipseys.id)) {
//             bc.xsort_order = opts.catg_lipseys.sort_order;
//         } else if (bc.categories.includes(opts.catg_kinseys.id)) {
//             bc.xsort_order = opts.catg_kinseys.sort_order;
//         } else {
//             bc.xsort_order = opts.catg_in_house.sort_order;
//         }
//         if (bc.upc && bc.upc != '' && bc.upc != '0' && bc.xsort_order != 999) {
//             let bcs = byUPC["" + bc.upc];
//             if (!bcs) {
//                 bcs = []
//                 byUPC["" + bc.upc] = bcs;
//             }
//             bcs.push(bc);
//             if( bc.xsort_order == opts.catg_in_house.sort_order ) {
//                 in_house_pp.push(bcs);
//             }
//             // if( bcs.length == 2 ) {
//             //   ++multi;
//             //   console.log("ick " + bcs[0].upc + " 1 /" + bcs[0].sku + "/" + bcs[0].id); // log the first
//             //   console.log("ick " + bc.upc + " 2 /" + bc.sku + "/" + bc.id); // and the 2nd
//             // }
//         }
//     }

//     sfLog(m, "done with by UPC");

//     // Process each UPC grouping
//     let updts = [];
//     let uc = 0;
//     for (let key in byUPC) {
//         uc++;
//         let xprod = byUPC[key]; // Get array of SKUs for this UPC
//         if( key == "738435619466" || key == "716736063324" || key == "850016201607"
//         || key == "798681640447" || key == "874218000004" ) {
//             console.log("check me out");
//         }
//         let prod = [];
//         let have_in_house = false;
//         for( let i = 0; i < xprod.length; i++ ) {
//             // only deal with item with images so we don't show any
//             let p = xprod[i];
//             if( p.images.length > 0 ) {
//                 if( p.is_visible && p.xsort_order == opts.catg_in_house.sort_order ) {
//                     have_in_house = true;
//                 }
//                 prod.push(p);
//             }
//         }
//         if (prod.length > 1) {

//             // Sort the SKUs by Warehouse priority
//             prod.sort(function (a, b) { 
//                 return a.xsort_order - b.xsort_order 
//             });

//             // Look for first in stock SKU that has images
//             let top = null;
//             for (let i = 0; i < prod.length; i++) {
//                 let p = prod[i];
//                 if (p.inventory_level > 0) {
//                     top = p;
//                     break;
//                 }
//             }

//             if (!top) {
//                 top = prod[0]; // Use highest priority out-of-stock if none in stock
//             }

//             // Update as needed to make the first eligible SKU visible and the rest not visible, except for in-house are shown
//             for (let i = 0; i < prod.length; i++) {
//                 let p = prod[i];
//                 if (top.id == p.id) {
//                     // If this is top priority and not currently visible, show it
//                     if (!p.is_visible) {
//                         updts.push({ "id": p.id, "is_visible": true });
//                         if( p.xsort_order == opts.catg_in_house.sort_order ) {
//                             have_in_house = true;
//                         }
//                         ++products_shown;
//                         if (updts.length == 10) {
//                             //sfLog(m, "batch of upc updates", updts);
//                             let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
//                             sfLog(m, 'batch res', batch_res);
//                             updts = [];
//                         }
//                     }
//                 } else {
//                     if (p.is_visible) {
//                         // Will hide visible if not top priority, unless it's in-house
//                         if (p.xsort_order != opts.catg_in_house.sort_order) {
//                             updts.push({ "id": p.id, "is_visible": false });
//                             ++products_hidden;
//                             if (updts.length == 10) {
//                                 //sfLog(m, "batch of upc updates", updts);
//                                 let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
//                                 sfLog(m, 'batch res', batch_res);
//                                 updts = [];
//                             }
//                         }
//                     }
//                 }
//             }

//         }
//     }
//     if (updts.length > 0) {
//         //sfLog(m, "final batch of upc updates", updts);
//         let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
//         sfLog(m, 'batch res', batch_res);
//         updts = [];
//     }


//     console.log('UPC SKU Scrub is done, hidden ' + products_hidden + ", shown " + products_shown);

//     return;
// }



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




exports.upc_sku_scrub = upc_sku_scrub;
