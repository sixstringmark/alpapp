/**
 * 
 * This modules will hide duplicate SKUs for a UPC code, based on warehouse priority,
 * but setting the product is_visible property.
 */
const iii = require("../util/ick");
const m = "upc_sku_scrub_rev";


async function upc_sku_scrub_rev(hash, auth_token, client_id, opts) {

    init_status();

    let products_hidden = 0;
    let products_shown = 0;

    let pp = opts.bc_products;

    let in_house_pp = [];

    // First, index all BC products by UPC code

    let byUPC = [];
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
        }
        if (bc.upc && bc.upc != '' && bc.upc != '0' && bc.xsort_order != 999) {
            let bcs = byUPC["" + bc.upc];
            if (!bcs) {
                bcs = []
                byUPC["" + bc.upc] = bcs;
            }
            bcs.push(bc);
            if( bc.xsort_order == opts.catg_in_house.sort_order ) {
                in_house_pp.push(bcs);
            }
            // if( bcs.length == 2 ) {
            //   ++multi;
            //   console.log("ick " + bcs[0].upc + " 1 /" + bcs[0].sku + "/" + bcs[0].id); // log the first
            //   console.log("ick " + bc.upc + " 2 /" + bc.sku + "/" + bc.id); // and the 2nd
            // }
        }
    }

    sfLog(m, "done with by UPC");

    // Process each UPC grouping
    let updts = [];
    let uc = 0;
    for (let key in byUPC) {
        uc++;
        let xprod = byUPC[key]; // Get array of SKUs for this UPC
        // if( key == "738435619466" || key == "716736063324" || key == "850016201607"
        // || key == "798681640447" || key == "874218000004" ) {
        //     console.log("check me out");
        // }
        let prod = [];
        let have_in_house = false;
        for( let i = 0; i < xprod.length; i++ ) {
            // only deal with item with images so we don't show any
            let p = xprod[i];
            if( p.images.length > 0 ) {
                if( p.is_visible && p.xsort_order == opts.catg_in_house.sort_order ) {
                    have_in_house = true;
                }
                prod.push(p);
            }
        }
        if (prod.length > 1) {

            // Sort the SKUs by Warehouse priority
            prod.sort(function (a, b) { 
                return a.xsort_order - b.xsort_order 
            });

            // Look for first in stock SKU that has images
            let top = null;
            for (let i = 0; i < prod.length; i++) {
                let p = prod[i];
                if (p.inventory_level > 0) {
                    top = p;
                    break;
                }
            }

            if (!top) {
                top = prod[0]; // Use highest priority out-of-stock if none in stock
            }

            // Update as needed to make the first eligible SKU visible and the rest not visible, except for in-house are shown
            for (let i = 0; i < prod.length; i++) {
                let p = prod[i];
                if (top.id == p.id) {
                    // If this is top priority and not currently visible, show it
                    if (!p.is_visible) {
                        updts.push({ "id": p.id, "is_visible": true });
                        if( p.xsort_order == opts.catg_in_house.sort_order ) {
                            have_in_house = true;
                        }
                        ++products_shown;
                        if (updts.length == 10) {
                            //sfLog(m, "batch of upc updates", updts);
                            let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
                            sfLog(m, 'batch res', batch_res);
                            updts = [];
                        }
                    }
                } else {
                    if (p.is_visible) {
                        // Will hide visible if not top priority, unless it's in-house
                        if (p.xsort_order != opts.catg_in_house.sort_order) {
                            updts.push({ "id": p.id, "is_visible": false });
                            ++products_hidden;
                            if (updts.length == 10) {
                                //sfLog(m, "batch of upc updates", updts);
                                let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
                                sfLog(m, 'batch res', batch_res);
                                updts = [];
                            }
                        }
                    }
                }
            }

        }
    }
    if (updts.length > 0) {
        //sfLog(m, "final batch of upc updates", updts);
        let batch_res = await iii.updateProductBatch(hash, auth_token, client_id, updts);
        sfLog(m, 'batch res', batch_res);
        updts = [];
    }


    console.log('UPC SKU Scrub is done, hidden ' + products_hidden + ", shown " + products_shown);

    return;
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




exports.upc_sku_scrub_rev = upc_sku_scrub_rev;
