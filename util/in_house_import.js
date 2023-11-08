/**
 * This module handles specific processing for importing ih-house exported products
 * 
 * Two files - a products export and an attributes export
 * 
 * There is also a Categories Excel file that can be processed manually to set up Categories
 */
const Client = require('ftp');
const ftp = require("basic-ftp");
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("../util/ick");
const stream = require("stream");
//const request = require("request");
//const e = require('express');
const xml2js = require('xml2js');
const xpath = require("xml2js-xpath");

const searchNum = /[^0-9. ]/g;
const replaceNum = '';

const searchCatgSep = / , /g;
const replaceCatgSep = '\t';

const combineAll = (array) => {
    const res = [];
    let max = array.length - 1;
    const helper = (arr, i) => {
        for (let j = 0, l = array[i].length; j < l; j++) {
            let copy = arr.slice(0);
            copy.push(array[i][j]);
            if (i == max)
                res.push(copy);
            else
                helper(copy, i + 1);
        };
    };
    helper([], 0);
    return res;
};

const custom_field_map = [
    { "field": "gun", "label": "_uc_gun_", "skip_if": ["No"] },
    { "field": "caliber", "label": "Caliber" },
    { "field": "model", "label": "Model" },
    { "field": "ammo", "label": "_uc_ammo_", "skip_if": ["No"] },
    { "field": "prop_65", "label": "_prop_65_", "skip_if": ["No"] },
    { "field": "created_at", "label": "_created_at_" },
    { "field": "updated_at", "label": "_updated_at_" },
    { "field": "color", "label": "Color" },
    { "field": "finish_color", "label": "Finish / Color" },
    { "field": "size", "label": "Size" },
    { "field": "apparel_size", "label": "Apparel Size" },
    { "field": "footwear_size", "label": "Footwear Size" },
    { "field": "bow_hand", "label": "Bow Hand" },
    { "field": "draw_length", "label": "Draw Length" },
    { "field": "draw_weight", "label": "Draw Weight" },
    { "field": "riser_color", "label": "Riser Color" },
    { "field": "limb_color", "label": "Limb Color" },
    { "field": "rod_length", "label": "Rod Length" },
    { "field": "rod_tube_size", "label": "Rod Tube Size" },
    { "field": "pieces", "label": "Pieces" },
    { "field": "line_weight", "label": "Line Weight" },
    { "field": "handle", "label": "Handle" },
    { "field": "frame_color", "label": "Frame Color" },
    { "field": "lens_color", "label": "Lens Color" },
    { "field": "frame_fit", "label": "Frame Fit" },
    { "field": "lens_material", "label": "Lens Material" },
    { "field": "line_length", "label": "Line Length" },
    { "field": "hook_size", "label": "Hook Size" },
    { "field": "line_diameter", "label": "Line Diameter" },
    { "field": "rod_specs", "label": "Rod Specs" },
    { "field": "sunglasses_specs", "label": "Sunglasses Specs" },
    { "field": "series", "label": "Series" },
    { "field": "blade_edge", "label": "Blade Edge" },
    { "field": "blade_finish", "label": "Blade Finish" },
    { "field": "blade_steel", "label": "Blade Steel" },
    { "field": "blade_style", "label": "Blade_Style" },
    { "field": "clip_type", "label": "Clip Type" },
    { "field": "clip_position", "label": "Clip Position" },
    { "field": "handle_material", "label": "Handle Material" },
    { "field": "sheath_type", "label": "Sheath Type" },
    { "field": "use", "label": "Use" },
    { "field": "receiver_finish", "label": "Receiver Finish" },
    { "field": "reel_size", "label": "Reel Size" },
    { "field": "default_supply_delay", "label": "_default_supply_delay_" },
    { "field": "barrel_length", "label": "Barrel Length" },
    { "field": "frame_material", "label": "Frame Material" },
    { "field": "type", "label": "Type" },
    { "field": "sights", "label": "Sights" },
    { "field": "magnification", "label": "Magnification" },
    { "field": "tube_size", "label": "Tube Size" },
    { "field": "stock", "label": "Stock" },
    { "field": "action", "label": "Action" },
    { "field": "grips_stock", "label": "Grips Stock" },
    { "field": "capacity", "label": "Capacity" },
    { "field": "glass_breaker", "label": "_glass_breaker_", "skip_if": ["No"] },
    { "field": "lanyard_hole", "label": "_lanyard_hole_", "skip_if": ["No"] },
    { "field": "molle_compatible", "label": "Molle Compatible", "skip_if": ["No"] },
    { "field": "price_match_guarantee", "label": "_price_match_guarantee", "skip_if": ["No"] },
    { "field": "gift_card", "label": "_gift_card_", "skip_if": ["No"] },
    { "field": "egift_card_value", "label": "_egift_card_value_" },
    { "field": "egift_card_value1", "label": "_egift_card_value1_" },
    { "field": "Gift Card Amount:drop_down:1:0", "label": "_gift_card_amount_" },
    { "field": "country_of_manufacture", "label": "Country of Manufacture" },
//    { "field": "stock_filter", "label": "Stock Filter" },
    { "field": "old_id", "label": "_old_id_" }
];
    

//const webdavClient = require('webdav-client');
//const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const { add_child_categories } = require('../util/ick');
const img_domain = "webstore.kinseysinc.com";
const img_path = "/product/image/large/";
const img_host = img_domain + img_path;

const DD = " / ";

//duh();

async function in_house_import(hash, auth_token, client_id, opts) {

    init_status();

    let start = new Date().getTime();

    let aa = [];

    const imp_data = {};
    imp_data.bc_categories = opts.bc_categories;

    // One-time indexing by path
    imp_data.bc_catg_by_path = [];
    for( let i = 0; i < imp_data.bc_categories.data.length; i++ ) {
        imp_data.bc_catg_by_path[ imp_data.bc_categories.data[i].path ] = imp_data.bc_categories.data[i];
    }

    // Set up some special categories
    let hazmat_catg = iii.getBigCommerceCategoryByPath(imp_data.bc_categories, ["HazMat"]);
    if( hazmat_catg ) {
        imp_data.hazmat_catg = hazmat_catg;
    } else {
        console.log("In-House import did not find HazMat category");
    }
    let default_catg = iii.getBigCommerceCategoryByPath(imp_data.bc_categories, ["Misc"]);
    if( default_catg ) {
        imp_data.default_catg = default_catg;
    } else {
        console.log("In-House import did not find default Misc category");
    }

    // Get attributes
    
    let fda = fs.createReadStream(opts.attr_exp_file);
    let csva = csv({ separator: ',', quote: '"' });

    fda.pipe(csva).on('data', (data) => aa.push(data));

    let enda = new Promise(function (resolve, reject) {
        csva.on('end', () => resolve("yes"));
        fda.on('error', reject); // or something like that. might need to close `hash`
    });

    await enda;
    console.log("done read attributes", enda, aa[0]);
    imp_data.uc_attributes = aa;

    let ucx = [];
    let fdx = fs.createReadStream(opts.prod_exp_file);
    let csvx = csv({ separator: ',', quote: '"' });

    fdx.pipe(csvx).on('data', (data) => ucx.push(data));

    let endx = new Promise(function (resolve, reject) {
        csvx.on('end', () => resolve("yes"));
        fdx.on('error', reject); // or something like that. might need to close `hash`
    });

    await endx;
    imp_data.uc_products = ucx;
    
    let uc_by_sku = [];
    let uc_by_name = [];
    imp_data.uc_by_name = uc_by_name;
    console.log("done read c", endx, ucx[0]);
    // Build map by sku
    // let cats = [];
    for (let i = 0; i < ucx.length; i++) {
        let item = ucx[i];
        uc_by_sku[item.sku] = item;
        // if( !cats.includes(item.categories) ) {
        //     cats.push(item.categories);
        //     console.log('categories: ' + item.categories);
        // }
        let uc_name = item.name;
        let prods_for_name = uc_by_name[uc_name];
        if (!prods_for_name) {
            prods_for_name = [];
            uc_by_name[uc_name] = prods_for_name;
        }
        prods_for_name.push(item);
    }

    // plug variants into configurables
    for (let i = 0; i < ucx.length; i++) {
        let item = ucx[i];
        if (item.associated != '' && item.config_attributes != '') {
            let attrs = item.config_attributes.split(",");
            let attr_map = [];
            item.attr_map = attr_map;
            for (let j = 0; j < attrs.length; j++) {
                attr_map[j] = { "name": attrs[j], "values": [] }
                for (let k = 0; k < aa.length; k++) {
                    if (aa[k].attribute_set == item.attribute_set && attr_map[j].name == aa[k].attribute_name) {
                        attr_map[j].display_name = aa[k].frontend_label;
                    }
                }
            }
            let skus = item.associated.split(",");
            if (skus.length > 0) {
                item.variants = [];
                for (let j = 0; j < skus.length; j++) {
                    let variant = uc_by_sku[skus[j]];
                    if (variant) {
                        item.variants.push(variant);
                        variant.uc_parent = item;
                        for (let x = 0; x < attr_map.length; x++) {
                            let val = variant[attr_map[x].name];
                            if (!attr_map[x].values.includes(val)) {
                                attr_map[x].values.push(val);
                            }
                        }
                    }
                }
            }
            if (item.attr_map && item.attr_map.length > 0) {
                let m = [];
                for (let z = 0; z < item.attr_map.length; z++) {
                    m[z] = attr_map[z].values;
                }
                item.opt_combos = combineAll(m);
                // if (item.qty * 1 > 0) {
                //     console.log(item.opt_combos);
                // }
            }
            //console.log(item, '\nwith attr_map');
        }
    }
    // for(let i = 0; i < ucx.length; i++) {
    //   let item = ucx[i];
    //   if( item.variants ) {
    //     console.log('configurable',item);
    //   }
    // }
    let hick = uc_by_sku['PARENT-12199-G3_SFWader'];
    if( hick ) {
        console.log(hick);
    }
    imp_data.uc_by_sku = uc_by_sku;

    let imp_start = 0;
    let imp_count = -1;
 
    let imp_added = 0;
    let imp_processed = 0;
    let imp_skipped = 0;
    let imp_add_failed = 0;

    if (opts.start && opts.start.trim() != '') {
        imp_start = (1 * opts.start) - 1;
    }
    if (opts.count && opts.count.trim() != '') {
        imp_count = 1 * opts.count;
    }
    if (imp_count == -1) {
        imp_count = ucx.length;
    }
    for (let i = imp_start; i < imp_start + imp_count && i < ucx.length; i++) {
        ++imp_processed;
        let item = ucx[i];
        // If item has a parent property, then it is a variant that will get added under that parent,
        // so don't send it into add_product
        if( !item.uc_parent ) {
            let added = await add_product(hash, auth_token, client_id, item, imp_data, opts);
            if( added ) {
                ++imp_added;
            } else {
                ++imp_add_failed;
            }
        } else {
            ++imp_skipped;
        }
    }

    console.log( 'In-House import is done - starting index ' + (imp_start + 1) + ", processed " + imp_processed +
    ", added " + imp_added + ", add failed " + imp_add_failed + ", skipped " + imp_skipped );

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

function map_basic_product() {

}

async function add_product(hash, auth_token, client_id, item, imp_data, opts) {

    let added = false;
    if( item.opt_combos ) {
        console.log('hah');
    }

    //console.log("add_product", hash, auth_token, client_id, prod);
    const add_data = {
        // "name": getUniqueKinseysProductName(kinsByName, prod),
        // "sku": prod.ProductCode + "-" + kins.importOptions.sku_tag,
        // "upc": prod.BarCode,
        "inventory_warning_level": 3,
        "type": "physical",
        "custom_fields": [],
        "images": [],
        "categories": [],
        // "description": prod.ExtendedText + ' ' + extra_desc,
        // "weight": prod.ItemWeight * 1.0,
        // "price": 9999.99, // have to get this from the inv xml file prod.RetailPrice,
        // "categories": [
        //     item_catg_id
        // ],
        //"images": prod_images,
        // "inventory_level": 0, // have to get from inv xml file prod.InventoryQty,
        "condition": "New"
    };

    // Basics
    add_data.sku = item.sku;
    add_data.price = item.price * 1;
    let uname = getUniqueProductName(imp_data.uc_by_name, item, opts);
    add_data.name = uname;
    add_data.upc = item.upc_code;

    // Some internal use hidden custom fields
    add_data.custom_fields.push( { name: "_uc_product_id_", "value": item.product_id } );
    add_data.custom_fields.push( { name: "_uc_prodtype_", "value": item.prodtype } );
    add_data.custom_fields.push( { name: "_warehouse_", "value": "in_house" } );

    if( item.description == item.short_description ) {
        add_data.description = item.description;
    } else {
        add_data.description = '<div class="short_desc">' + item.short_description + '</div>\n' +
        '<div class="long_desc">' + item.description + '</div>';
    }
    add_data.meta_description = item.meta_description;
    if( item.meta_keyword != '' ) {
        add_data.meta_keywords = item.meta_keyword;
    }
    if( item.gfflrequired == "True" || item.gun == 'Yes') {
        add_data.custom_fields.push( { name: "FFL", "value": "Yes" } );
    }
    if( item.ammo == "Yes" ) {
        add_data.custom_fields.push({ name: "_ammo_", "value": "true" } );
        add_data.categories.push(imp_data.hazmat_catg.id);
    }
    // special processing for images
    let gallery = item.gallery.split(",");
    let base_image = item.image;
    let small_image = item.small_image;
    let thumbnail = item.thumnail;
    let set_thumbnail = false;
    if (gallery != '') {
        // Cycle through gallery images - if matches one of the base/small/thumbnail, blank it out
        for (let i = 0; i < gallery.length; i++) {
            let io = { "image_url": gallery[i] };
            if (thumbnail == gallery[i]) {
                io.is_thumbnail = true;
                thumbnail = '';
                set_thumbnail = true;
            }
            if (small_image == gallery[i]) {
                small_image = '';
            }
            if (base_image == gallery[i]) {
                base_image = '';
            }
            add_data.images.push(io);
        }

    }

    if( item.opt_combos && item.opt_combos.length > 0 ) {
        add_data.variants = [];
        for( let i = 0; i < item.opt_combos.length; i++ ) {

            let v = { "option_values": [] };
            add_data.variants.push(v);

            for( let j = 0; j < item.opt_combos[i].length; j++ ) {
                let ov = { 
                    "option_display_name": item.attr_map[j].display_name.replace(/^[0-9]+:/gi, ""),
                    "option_name": item.attr_map[j].name, // will remove this later
                    "label": item.opt_combos[i][j]
                }

                v.option_values.push(ov);
            }
            let v_item = find_variant(item,v);
            for( let z = 0; z < v.option_values.length; z++ ) {
                delete v.option_values[z].option_name;
            }
            if( v_item ) {
                v.purchasing_disabled = false;
                v.sku = v_item.sku;
                v.upc = v_item.upc_code;
                v.inventory_level = v_item.qty * 1.0;
                if( v_item.price * 1.0 != 0 && v_item.price != '' && v_item.price != item.price ) {
                    v.price = v_item.price * 1.0;
                }
            } else {
                v.purchase_diabled = true;
                v.sku = item.sku + "-v" + (i+1);
            }

        }
    }
    // Cascade thru specific images, if anything left
    if( thumbnail && thumbnail != '' ) {
        add_data.images.push( { "image_url": thumbnail, "is_thumbnail": true } );
        set_thumbnail = true;
        if( base_image == thumbnail ) {
            base_image = '';
        }
        if( small_image == thumbnail ) {
            small_image = '';
        }
    }
    if( small_image && small_image != '' ) {
        add_data.images.push( { "image_url": small_image } );
        if( base_image == small_image ) {
            base_image = '';
        }
    }
    if( base_image && base_image != '' ) {
        add_data.images.push( { "image_url": base_image } );
    }
    if( add_data.images.length == 0 || item.status == 'Disabled' ) {
        add_data.is_visible = false;
    }
    if( !set_thumbnail && add_data.images.length > 0 ) {
        add_data.images[0].is_thumbnail = true;
    }

    // special processing for categories
    
    if (item.categories == '') {
        add_data.categories.push(imp_data.default_catg.id);
    } else {
        // Break string into array based on space-comma-space delimiter
        let z = item.categories

        let ct = z.replace(searchCatgSep, replaceCatgSep);
        let cparts = ct.split('\t');
        // Find and add each category - this maps UC category path to BC
        for (let i = 0; i < cparts.length; i++ ) {
            // Scrub for now...
            let cp = cparts[i];
            if( cp == "Shooting" || cp.startsWith("Shooting/") ) {
                cp = "Firearms/" + cp;
            }
            if( cp == "Handguns" || cp.startsWith("Handguns/") ) {
                cp = "Firearms/" + cp;
            }
            if( cp == "Default Category" ) {
                cp = "Misc";
            }
            cp = cp.replace("Night Vison & Thermal", "Night Vision & Thermal");
            cp = cp.replace("Rings, Mounts, & Bases", "Rings, Mounts & Bases");
            cp = cp.replace("Fishing/Fly Fishing/Apparel/Women's Clothing/Shirts/Long-Sleeve","Fishing/Fly Fishing/Apparel/Women's Clothing/Shirts/Long-Sleeved");
            cp = cp.replace("Firearms/Shooting/Gun Maintenance/Cleaning ", "Firearms/Shooting/Gun Maintenance/Cleaning");
            cp = cp.replace("Firearms/Shooting/Optics/Rings, Mounts & Bases/Rings, Mounts, & Base Combos","Firearms/Shooting/Optics/Rings, Mounts & Bases/Rings, Mounts & Bases Combos");
            cp = cp.replace("Apparel/Hunting Apparel/Men's Clothing/Face Masks / Gaitors","Apparel/Hunting Apparel/Men's Clothing/Face Masks / Gaitors");
            // See if there's a match
            let catg = imp_data.bc_catg_by_path[cp];
            if( !catg ) {
                console.log("No BC category for path(" + cp + ")" );
            } else {
                add_data.categories.push(catg.id);
            }
        }
    }

    if( !item.variants ) {
        add_data.inventory_tracking = "product";
    } else {
        add_data.inventory_tracking = "variant";
    }
    add_data.inventory_level = item.qty * 1.0;
    if( item.manufacturer != '' ) {
        add_data.brand_name = item.manufacturer;
    }
    add_data.weight = item.weight * 1.0;

    if( item.manufacturer_part_number != '') {
        add_data.mpn = item.manufacturer_part_number;
    }

    if (item.depth != '') {
        add_data.depth = item.depth.replace(searchNum,replaceNum) * 1;
        if (item.length != '' ) {
            add_data.custom_fields.push( { "name": "length", "value": item.length } );
        }
    } else if( item.length != '' ) {
        add_data.depth = item.length.replace(searchNum,replaceNum) * 1;
    }
    if (item.width != '') {
        add_data.width = item.width.replace(searchNum,replaceNum) * 1;
    }
    if (item.height != '') {
        add_data.height = item.height.replace(searchNum,replaceNum) * 1;
    }

    // Pick up the rest of the custom fields
    for( let i = 0; i < custom_field_map.length; i ++ ) {
        let val = item[custom_field_map[i].field].trim();
        if( val && val != '' ) {
            if( !custom_field_map[i].skip_if || !custom_field_map[i].skip_if.includes(val) ) {
                add_data.custom_fields.push( { "name": custom_field_map[i].label, "value": val } );  
            }
        }
    }


    let ff = null;
   
 
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

    //console.log(add_data);
    let ss = JSON.stringify(add_data);
    ff = await iii.addABC(add_opts, JSON.stringify(add_data));
    // if(add_data.variants) {
    //     console.log("\n\n+++++++++++++++ Variants ++++++++++++++++++++++++++++");
    // }    
    // ff = true; console.log(add_data); // test only

    if (ff && ff.data) {
        added = true;
        if( add_data.categories.includes(opts.catg_hazmat.id) ) {
            let oc = await iii.add_hazmat_metafield(hash, auth_token, client_id, ff.data.id);
            if( oc && oc.data ) {
            //
            } else {
                console.log("In-House hazmat metafield add failed for " + ff.data.id + ", error is " + oc);
            }
        } 
    } else {
        console.log('bad add ' + ff);
        console.log(add_data);
    }

    return added;

}









async function findBigCommerceCategory(hash, auth_token, client_id, cats, item, catg_map) {

    const kICC = item.ItemCategoryCode;
    const kPGC = item.ProductGroupCode;
    let kSG1 = item.ProductSubGroup1;
    if (!kSG1) {
        kSG1 = '';
    }
    let kSG2 = item.ProductSubGroup2;
    if (!kSG2) {
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
    if (!topcat) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kinseysTopName, 0);
        topcat = newcat.data;
        cats.data.push(topcat);
    }

    // Find a matching entry
    let kMaster = null;
    for (let i = 0; i < catg_map.length; i++) {
        // _string1.localeCompare(_string2, _locale, { sensitivity: 'base' }) === 0
        if (catg_map[i].ICC.localeCompare(kICC, undefined, { sensitivity: 'base' }) === 0 &&
            catg_map[i].PGC.localeCompare(kPGC, undefined, { sensitivity: 'base' }) === 0 &&
            catg_map[i].Sub1.localeCompare(kSG1, undefined, { sensitivity: 'base' }) === 0 &&
            catg_map[i].Sub2.localeCompare(kSG2, undefined, { sensitivity: 'base' }) === 0
        ) {
            kMaster = catg_map[i];
            break;
        }
    }
    if (!kMaster) {
        return topcat;
    }

    // This cascade will populate up to 5 levels of categories

    const kMainName = kMaster.CatgMain;
    const kICCname = kMaster.ICCDesc;
    const kPGCname = kMaster.PGCDesc;
    const kSub1name = kMaster.Sub1Desc;
    const kSub2name = kMaster.Sub2Desc;

    let catgMain = null;
    for (let i = 0; i < cats.data.length; i++) {
        if (cats.data[i].name == kMainName && cats.data[i].parent_id == topcat.id) {
            catgMain = cats.data[i];
            break;
        }
    }
    if (!catgMain) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kMainName, topcat.id);
        catgMain = newcat.data;
        cats.data.push(catgMain);
    }
    if (kICCname == '') {
        return catgMain;
    }

    let catgICC = null;
    // Little hiccup here - skip level if main category name is same as ICC level
    if (kMainName == kICCname) {
        catgICC = catgMain;
    } else {
        for (let i = 0; i < cats.data.length; i++) {
            if (cats.data[i].name == kICCname && cats.data[i].parent_id == catgMain.id) {
                catgICC = cats.data[i];
                break;
            }
        }
        if (!catgICC) {
            let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kICCname, catgMain.id);
            catgICC = newcat.data;
            cats.data.push(catgICC);
        }
    }

    if (kPGCname == '') {
        return catgICC;
    }

    let catgPGC = null;
    for (let i = 0; i < cats.data.length; i++) {
        if (cats.data[i].name == kPGCname && cats.data[i].parent_id == catgICC.id) {
            catgPGC = cats.data[i];
            break;
        }
    }
    if (!catgPGC) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kPGCname, catgICC.id);
        catgPGC = newcat.data;
        cats.data.push(catgPGC);
    }
    if (kSub1name == '') {
        return catgPGC;
    }

    let catgSub1 = null;
    for (let i = 0; i < cats.data.length; i++) {
        if (cats.data[i].name == kSub1name && cats.data[i].parent_id == catgPGC.id) {
            catgSub1 = cats.data[i];
            break;
        }
    }
    if (!catgSub1) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kSub1name, catgPGC.id);
        catgSub1 = newcat.data;
        cats.data.push(catgSub1);
    }
    if (kSub2name == '') {
        return catgSub1;
    }

    let catgSub2 = null;
    for (let i = 0; i < cats.data.length; i++) {
        if (cats.data[i].name == kSub2name && cats.data[i].parent_id == catgSub1.id) {
            catgSub2 = cats.data[i];
            break;
        }
    }
    if (!catgSub2) {
        let newcat = await iii.createBigCommerceCategory(hash, auth_token, client_id, kSub2name, catgSub1.id);
        catgSub2 = newcat.data;
        cats.data.push(catgSub2);
    }

    return catgSub2;
}

// Note this returns category id, or null if none found
function locateBigCommerceCategory(bc_cats, item, catg_map) {

    let ret_catg_id = null;

    let kICC = item.ItemCategoryCode.toUpperCase();
    let kPGC = item.ProductGroupCode.toUpperCase();
    let kSG1 = item.ProductSubGroup1;
    if (!kSG1) {
        kSG1 = '';
    } else {
        kSG1 = kSG1.toUpperCase();
    }
    let kSG2 = item.ProductSubGroup2;
    if (!kSG2) {
        kSG2 = '';
    } else {
        kSG2 = kSG2.toUpperCase();
    }

    // Find map by levels 



    // Find a matching entry
    let kMaster = null;
    for (let i = 0; i < catg_map.length; i++) {
        // _string1.localeCompare(_string2, _locale, { sensitivity: 'base' }) === 0
        let bICC = catg_map[i].itemCatgCode.toUpperCase();
        let bPGC = catg_map[i].groupCode.toUpperCase();
        let bSG1 = catg_map[i].subgroup1Code.toUpperCase();
        let bSG2 = catg_map[i].subgroup2Code.toUpperCase();

        if (bICC == kICC && bPGC == kPGC && bSG1 == kSG1 && bSG2 == kSG2) {
            let bc_catg = iii.getBigCommerceCategoryByPath(bc_cats, catg_map[i].bc_path)
            //console.log("locate for ", catg_map[i].bc_path, " returned ", bc_catg );
            if (bc_catg) {
                ret_catg_id = bc_catg.id;
            }
            break;
        }
    }
    
    
    if (!ret_catg_id) {
        console.log("Kinsey's has no category path for /" + kICC + "/" + kPGC + "/" + kSG1 + "/" + kSG2 + "/");
        console.log("Item " + item.ProductCode);
    } else {
        //console.log("Kinsey's has category path for /" + kICC + "/" + kPGC + "/" + kSG1 + "/" + kSG2 + "/", item);
    }
    return ret_catg_id;

}

function getUniqueProductName(namesToProd, prod, opts) {
    let product_name = prod.name;
    let products_for_name = namesToProd[product_name];
    if (products_for_name && products_for_name.length > 1) {
        for (let i = 0; i < products_for_name.length; i++) {
            let name_prod = products_for_name[i];
            if (name_prod.sku == prod.sku) {
                product_name += " (" + (i + 1) + ")";
                break;
            }
        }
    }
    let bc = opts.bc_products.bc_by_name[product_name];
    if( bc ) {
        // nuts - same name in BigCommerce already
        product_name = product_name.slice(0, -1) + "." + bc.dupe_ct++ + ")";
    }
    return product_name;
}

function find_variant( uc_v, bc_v ) {
    // see if each option value in the bc variant matches each in the uc variant
    // uc_v is array of associated items for the configurable item
    // bc_v is the pending variant object for BigCommerce, with an array option_values with
    //    an entry for attribute
    let match = null;
    for( let i = 0; i < uc_v.variants.length; i++ ) {
        let matched = true;
        for( let j = 0; j < bc_v.option_values.length; j++ ) {
            let k = bc_v.option_values[j].option_name; // attr name is used for propety of the item
            let val = uc_v.variants[i][k];
            if( !val || val == '' || val != bc_v.option_values[j].label ) {
                matched = false; // first no match we move on to the next UC variant
                break;
            }
        }
        if( matched ) {
            match = uc_v.variants[i];
            break;
        }
    }
    return match;
}

exports.in_house_import = in_house_import;
