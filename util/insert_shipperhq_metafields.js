/**
 * 
 * Insert product metafields for ShipperHQ needs
 */
const iii = require("../util/ick");
const m = "insert_shipperhq_metafields";

async function insert_shipperhq_metafields(hash, auth_token, client_id, opts) {

    init_status();

    let products_updated = 0;
    let already_set = 0;
    let products_processed = 0;
    let add_failed = 0;

    let q = 'limit=250&include_fields=id,categories&categories:in=' + opts.catg_hazmat.id;
    sfLog(m, 'getting fix7 BC products...');
    let pp = await iii.getAllBigCommerceProducts(hash, auth_token, client_id, q);
    sfLog(m, 'got fix7 BC products...');
    
    let imp_start = 0;
    let imp_count = pp.data.length;

    if (opts.start && opts.start.trim() != '') {
        imp_start = (1 * opts.start) - 1;
    }
    if (opts.count && opts.count.trim() != '') {
        imp_count = 1 * opts.count;
    }
    for (let x = imp_start; x < pp.data.length && x < (imp_start + imp_count); x++) {
        if( x % 100 == 0 ) {
            sfLog( m, 'processing ' + x + " of " + imp_count );
        }
        let bc = pp.data[x];
        if (bc.categories.includes(opts.catg_hazmat.id)) {
            ++products_processed;
            let mm = await iii.getProductMetafields(hash,auth_token,client_id,bc.id,"&namespace="+shipperhq_meta_namespace);
            let has_meta = false;
            if( mm ) {
                for( let i = 0; i < mm.data.length; i++ ) {
                    let val = mm.data[i].value;
                    let key = mm.data[i].key;
                    if( key == hazmat_meta_key ) {
                        has_meta = true;
                        break;
                    }
                }
            }
            if( !has_meta ) {
                let oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, bc.id);
                if( oc && oc.data ) {
                    ++products_updated;
                } else {
                    sfLog(m, "metafield add failed " + oc);
                    ++add_failed;
                }
            } else {
                ++already_set;
            }
        
        }
        
    }

    sfLog(m, 'Done - processed ' + products_processed + ", meta already set " +  already_set + ", meta added " + products_updated + ", add failed " + add_failed );

    return;
}

// async function add_meta(hash, auth_token, client_id, id) {

//     const meta_add_data = {
//         "permission_set": "write",
//         "key": hazmat_meta_key,
//         "value": JSON.stringify(hazmat_meta_value),
//         "namespace": shipperhq_meta_namespace
//     };
    
//     let add_opts = {
//         'method': 'POST',
//         'hostname': 'api.bigcommerce.com',
//         'path': '/stores/' + hash + '/v3/catalog/products/' + id + "/metafields",
//         'headers': {
//             'Accept': 'application/json',
//             'Content-Type': 'application/json',
//             'X-Auth-Token': auth_token,
//             'X-Auth-Client': client_id,
//         },
//         'maxRedirects': 20
//     };
//     let dat = JSON.stringify(meta_add_data);
//     // sfLog(m, 'going to add', dat);
//     let added = false;
//     let add_outcome = await iii.addABC(add_opts, dat);
//     if ( add_outcome && add_outcome.data) {
//         added = true;
//     } else {
//         sfLog(m,  "product metafield add failed - " + add_outcome);
//         sfLog(m, dat)
//     }
//     return added;
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




exports.insert_shipperhq_metafields = insert_shipperhq_metafields;
