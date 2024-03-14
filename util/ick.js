// ick.js mostly common code etc. yes
const fs = require("fs");
const https = require('follow-redirects').https;
const xml2js = require('xml2js');
const { createClient, AuthType } = require("webdav");
const promisifiedPipe = require("promisified-pipe");
const common = require("./CommonMappings");
const request = require('request');

const nodemailer = require('nodemailer');

const data_path = "../app_data/output.json";

const upc_metafield_options = {
  "permission_set": "write",
  "key": "saved_catg",
  "namespace": "sf.catalog"
};

const US_STATES = {
  'ALABAMA': 'AL',
  'ALASKA': 'AK',
  'AMERICAN SAMOA': 'AS',
  'ARIZONA': 'AZ',
  'ARKANSAS': 'AR',
  'ARMED FORCES AMERICAS': 'AA',
  'ARMED FORCES EUROPE': 'AE',
  'ARMED FORCES PACIFIC': 'AP',
  'CALIFORNIA': 'CA',
  'COLORADO': 'CO',
  'CONNECTICUT': 'CT',
  'DELAWARE': 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  'FLORIDA': 'FL',
  'GEORGIA': 'GA',
  'GUAM': 'GU',
  'HAWAII': 'HI',
  'IDAHO': 'ID',
  'ILLINOIS': 'IL',
  'INDIANA': 'IN',
  'IOWA': 'IA',
  'KANSAS': 'KS',
  'KENTUCKY': 'KY',
  'LOUISIANA': 'LA',
  'MAINE': 'ME',
  'MARSHALL ISLANDS': 'MH',
  'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA',
  'MICHIGAN': 'MI',
  'MINNESOTA': 'MN',
  'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO',
  'MONTANA': 'MT',
  'NEBRASKA': 'NE',
  'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  'NORTHERN MARIANA ISLANDS': 'NP',
  'OHIO': 'OH',
  'OKLAHOMA': 'OK',
  'OREGON': 'OR',
  'PENNSYLVANIA': 'PA',
  'PUERTO RICO': 'PR',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  'TENNESSEE': 'TN',
  'TEXAS': 'TX',
  'US VIRGIN ISLANDS': 'VI',
  'UTAH': 'UT',
  'VERMONT': 'VT',
  'VIRGINIA': 'VA',
  'WASHINGTON': 'WA',
  'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI',
  'WYOMING': 'WY'
};





module.exports = {

    /**
     * Global access to local file system to get credentials for the app and for each installed storee
    **/
     get_xml_data: function (p) {
      const fs = require("fs");
      let obj = null;
      let rawdata = fs.readFileSync(p);
      let parser = new xml2js.Parser();
      parser.parseString(rawdata, function (err, result) {
        //console.dir(result);
        obj = result;
        console.log('get_xml_data - Done');
    });
      //let app_db = JSON.parse(rawdata);

      return obj;
  },
  /**
     * Global access to local file system to get credentials for the app and for each installed storee
    **/
    get_app_data: function () {
      require('dotenv').config();
      console.log("bully bully"+process.env.PORT);
        const fs = require("fs");

        let rawdata = fs.readFileSync(data_path);
        //console.log("raw");console.timeLog(rawdata);
        let app_db = {"aaa":"bbb"}; //JSON.parse(rawdata);
        //console.log("returning app data",app_db);
        return app_db;
    },
    /**
     * Rewrite credentials to local file system
     * @param {*} dd - the JSON object "database" of app and store credentials
     */
    save_app_data: function (dd) {
        let jsonContent = JSON.stringify(dd,null,4);

        fs.writeFile(data_path, jsonContent, 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing JSON Object to File.");
                return console.log(err);
            }

            console.log("JSON file has been saved.");
        });
    },


    /** *
     * Wraps an https.request in a promise, for easier chaining or sequencing
    */
    httpRequest: function (params, postData) {
        return new Promise(function (resolve, reject) {
          const req = https.request(params, function (res) {
            // reject on bad status
            if ( res.statusCode != 5422 && (res.statusCode < 200 || res.statusCode >= 300) ) {
              console.log('\n\n\nhttpRequest statusCode=' + res.statusCode);
              // console.log(res);
              return reject(new Error('statusCode=' + res.statusCode));
            }
            // cumulate data
            let body = [];
            res.on('data', function (chunk) {
              body.push(chunk);
            });
            // resolve on end
            res.on('end', function () {
              try {
                //console.log(Buffer.concat(body).toString());
                //body = JSON.parse(Buffer.concat(body).toString());
                body = Buffer.concat(body).toString();
              } catch (e) {
                reject(e);
              }
              resolve(body);
            });
          });
          // reject on request error
          req.on('error', function (err) {
            // This is not a "Second reject", just a different sort of failure
            reject(err);
          });
          if (postData) {
            req.write(postData);
          }
          // IMPORTANT
          req.end();
        });
      },
      
      
    /** *
     * this will only return the request status
    */
     headRequest: function (params) {
      return new Promise(function (resolve, reject) {
        const req = https.request(params, function (res) {
          // reject on bad status
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.log('\n\n\nhttpRequest statusCode=' + res.statusCode);
            // console.log(res);
            resolve(res.statusCode);
          }
          // cumulate data
          let body = [];
          res.on('data', function (chunk) {
            body.push(chunk);
          });
          // resolve on end
          res.on('end', function () {
            try {
              //console.log(Buffer.concat(body).toString());
              //body = JSON.parse(Buffer.concat(body).toString());
              body = Buffer.concat(body).toString();
            } catch (e) {
              reject(e);
            }
            resolve(res.statusCode);
          });
        });
        // reject on request error
        req.on('error', function (err) {
          // This is not a "Second reject", just a different sort of failure
          reject(err);
        });
        // IMPORTANT
        req.end();
      });
    },
    
    /*
      path is an array of the names of the categories in the hierarchy
    */
    getBigCommerceCategoryByPath( bc_cats, path ) {
      //let pid = 0; // start with no parent
      let return_catg = null;
      let catgs = bc_cats.data;
      //let j = 0;
      for( let i = 0; i < path.length; i++ ) {
        let match_catg = null;
        for( let j = 0; j < catgs.length; j++ ) {
          if( catgs[j].name == path[i] && (i > 0 || catgs[j].parent_id == 0 )) {
            // match at this level, search its subs
            match_catg = catgs[j];
            break;
          }
        }
        if( !match_catg ) {
          break; // no match at some level
        }
        if( i == path.length - 1 ) {
          return_catg = match_catg;
        } else {
          catgs = match_catg.subs; // go deeper
        }
      }
      return return_catg;
    },

    getBigCommerceCategories: async function (hash, auth_token, client_id) {
      const catg_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + hash + '/v3/catalog/categories',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      //const catg_opts_base_path = catg_opts.path;
      let cc = null;
      let all_cats = {};
      all_cats.data = [];
    
      let more_cats = true;
      while( more_cats  && !sf.abort_sync ) {
        let kk = this.httpRequest(catg_opts);
        await kk.then((data) => {
          try {
            cc = JSON.parse(data);
            for( let x = 0; x < cc.data.length; x++ ) {
               cc.data[x].subs = [];
               //console.log(cc.data[x]);
               all_cats.data.push(cc.data[x]);
             }
            
             
            //console.log(cc);
            if( cc.meta.pagination.current_page < cc.meta.pagination.total_pages ) {
              catg_opts.path = '/stores/' + hash + '/v3/catalog/categories?page=' + (cc.meta.pagination.current_page+1);
            } else {
              more_cats = false;
            }
            //console.log(cc);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
      }

      let cats_by_id = [];
      // develop tree - put each in subs array of parent
      for( let i = 0; i < all_cats.data.length; i++ ) {
        let child_catg = all_cats.data[i];
        cats_by_id[child_catg.id] = child_catg;
        for( let j = 0; j < all_cats.data.length; j++ ) {
          let parent_catg = all_cats.data[j];
          if( child_catg.parent_id == parent_catg.id ) {
            parent_catg.subs.push(child_catg);
          }
        }
      }
      all_cats.cats_by_id = cats_by_id;

      // Build path string
      for( let i = 0; i < all_cats.data.length; i++ ) {
        let child_catg = all_cats.data[i];
        child_catg.path = child_catg.name;
        let c = child_catg;
        while( c.parent_id != 0 ) {
          c = cats_by_id[c.parent_id];
          child_catg.path = c.name + "/" + child_catg.path;
        }
      }
    
      // console.log('golly');
      //console.log(pp.data[0]);
      //console.log(pp.data[0].categories);
    
      return all_cats;
    },

    getHooks: async function (hash, auth_token, client_id) {
      const catg_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + hash + '/v3/hooks',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token
          //'X-Auth-Client': '6la8wkcifd2t40m0798pmioupeg6jx5',
        },
        'maxRedirects': 20
      };
      let hooks = null;
      //const catg_opts_base_path = catg_opts.path;
      
        let kk = this.httpRequest(catg_opts);
        await kk.then((data) => {
          try {
            hooks = JSON.parse(data);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
    
      return hooks;
    },

    getOrder: async function (opts, orderId ) {
      const order_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + opts.hash + '/v2/orders/' + orderId,
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': opts.auth_token,
          'X-Auth-Client': opts.auth_client
        },
        'maxRedirects': 20
      };
      let order = null;
      //const catg_opts_base_path = catg_opts.path;
      
        let kk = this.httpRequest(order_opts);
        await kk.then((data) => {
          try {
            order = JSON.parse(data);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
    
      return order;
    },

    getOrderAddresses: async function (opts, orderId ) {
      const order_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + opts.hash + '/v2/orders/' + orderId + "/shipping_addresses",
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': opts.auth_token,
          'X-Auth-Client': opts.auth_client
        },
        'maxRedirects': 20
      };
      let addr = null;
      //const catg_opts_base_path = catg_opts.path;
      
        let kk = this.httpRequest(order_opts);
        await kk.then((data) => {
          try {
            addr = JSON.parse(data);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
    
      return addr;
    },

    getOrderProducts: async function (opts, orderId ) {
      const order_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + opts.hash + '/v2/orders/' + orderId + '/products',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': opts.auth_token,
          'X-Auth-Client': opts.auth_client
        },
        'maxRedirects': 20
      };
      let prod = null;
      //const catg_opts_base_path = catg_opts.path;
      
        let kk = this.httpRequest(order_opts);
        await kk.then((data) => {
          try {
            prod = JSON.parse(data);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
    
      return prod;
    },

    getOrderTransactions: async function (opts, orderId ) {
      const order_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + opts.hash + '/v3/orders/' + orderId + '/transactions',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': opts.auth_token,
          'X-Auth-Client': opts.auth_client
        },
        'maxRedirects': 20
      };
      let trans = null;
      //const catg_opts_base_path = catg_opts.path;
      
        let kk = this.httpRequest(order_opts);
        await kk.then((data) => {
          try {
            trans = JSON.parse(data);
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
    
      return trans;
    },
    
    updateOrder: async function (opts, update_data, orderId) {
      const batch_opts = {
          'method': 'PUT',
          'hostname': 'api.bigcommerce.com',
          'path': '/stores/' + opts.hash + '/v2/orders/' + orderId,
          'headers': {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Auth-Token': opts.auth_token,
              'X-Auth-Client': opts.auth_client,
          },
          'maxRedirects': 20
      };
      
      let b = await this.addABC(batch_opts, JSON.stringify(update_data));
  
      return b;
  },

  rsrCheckCatalog: async function (opts, check_data) {
    const check_opts = {
      'method': 'POST',
      'hostname': opts.hostname,
      'path': '/api/rsrbridge/1.0/pos/check-catalog',
      'headers': {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      'maxRedirects': 20
    };
    let cd = null;
    let jd = JSON.stringify(check_data);
    let kk = this.httpRequest(check_opts, jd);
    await kk.then((data) => {
      try {
        cd = JSON.parse(data);
      } catch (e) {
        console.log(e);
        console.log(data);
      }
    });

    return cd;
  },


  rsrPlaceOrder: async function (opts, place_data) {
    const place_opts = {
      'method': 'POST',
      'hostname': opts.hostname,
      'path': '/api/rsrbridge/1.0/pos/place-order',
      'headers': {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      'maxRedirects': 20
    };
    let cd = null;
    let jd = JSON.stringify(place_data);
    let kk = this.httpRequest(place_opts, jd);
    await kk.then((data) => {
      try {
        cd = JSON.parse(data);
      } catch (e) {
        console.log(e);
        console.log(data);
      }
    });

    return cd;
  },

    createHook: async function (hash, auth_token, scope, destination) {
      const brand_opts = {
        'method': 'POST',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + hash + '/v3/hooks',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token
          //'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      
      const add_data =
      {
        "scope": scope,
        "destination": destination,
        "is_active": true,
        "headers": {}
      }
      
      let bb = null;
    
    
      //console.log('grrr '+ brand_opts.path);
      kk = this.httpRequest(brand_opts,JSON.stringify(add_data));
      await kk.then((data) => {
        try {
          bb = JSON.parse(data);
          //console.log(bb);
        } catch (e) {
          console.log(e);
          console.log(data);
        }
      });
    
      console.log('zounds');
      //console.log(pp.data[0]);
      //console.log(pp.data[0].categories);
    
      return bb;
    },

    getBigCommerceBrands: async function (hash, auth_token, client_id) {
      const brand_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': '/stores/' + hash + '/v3/catalog/brands',
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      //let brand_opts_base_path = brand_opts.path;
      let bb = null;
    
    
      let all_brands = null;
      //console.log('moo '+ brand_opts.path);
      let more_brands = true;
      while(more_brands) {
    
        let kk = this.httpRequest(brand_opts);
        await kk.then((data) => {
          try {
            bb = JSON.parse(data);
            if( !all_brands ) {
              all_brands = bb;
            } else {
              for( let x = 0; x < bb.data.length; x++ ) {
                all_brands.data.push(bb.data[x]);
              }
            }
            //console.log(bb);
            if( bb.meta.pagination.current_page < bb.meta.pagination.total_pages ) {
              brand_opts.path = '/stores/' + hash + '/v3/catalog/brands?page=' + (bb.meta.pagination.current_page+1);
            } else {
              more_brands = false;
            }
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
      
    
      }
    
      //console.log('wowie');
    
      return all_brands;
    },
    
    getProductMetafields: async function (hash, auth_token, client_id, id, params) {
      const basepath = '/stores/' + hash + '/v3/catalog/products/' + id + "/metafields?" + params;
      const meta_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': basepath,
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      
      let mm = null;
    
    
      let all_meta = null;
      // console.log('mm '+ meta_opts.path);
      let more_meta = true;
      while(more_meta) {
    
        let kk = this.httpRequest(meta_opts);
        await kk.then((data) => {
          try {
            mm = JSON.parse(data);
            if( !all_meta ) {
              all_meta = mm;
            } else {
              for( let x = 0; x < mm.data.length; x++ ) {
                all_meta.data.push(mm.data[x]);
              }
            }
            //console.log(bb);
            if( mm.meta.pagination.current_page < mm.meta.pagination.total_pages ) {
              meta_opts.path = basepath + '?page=' + (mm.meta.pagination.current_page+1);
            } else {
              more_meta = false;
            }
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
      
    
      }
    
      // console.log('wowie');
    
      return all_meta;
    },

    getProductModifiers: async function (hash, auth_token, client_id, id, params) {
      const basepath = '/stores/' + hash + '/v3/catalog/products/' + id + "/modifiers";
      const mods_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': basepath,
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      
      let mm = null;
    
    
      let all_mods = null;
      // console.log('mm '+ meta_opts.path);
      let more_mods = true;
      while(more_mods) {
    
        let kk = this.httpRequest(mods_opts);
        await kk.then((data) => {
          try {
            mm = JSON.parse(data);
            if( !all_mods ) {
              all_mods = mm;
            } else {
              for( let x = 0; x < mm.data.length; x++ ) {
                all_mods.data.push(mm.data[x]);
              }
            }
            //console.log(bb);
            if( mm.meta.pagination.current_page < mm.meta.pagination.total_pages ) {
              mods_opts.path = basepath + '?page=' + (mm.meta.pagination.current_page+1);
            } else {
              more_mods = false;
            }
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
      
    
      }
    
      // console.log('wowie');
    
      return all_mods;
    },


    updateProductMetafield: async function (store_hash, auth_token, auth_client, productId, metafieldId, value) {
      const update_opts = {
          'method': 'PUT',
          'hostname': 'api.bigcommerce.com',
          'path': '/stores/' + store_hash + '/v3/catalog/products/' + productId + "/metafields/" + metafieldId,
          'headers': {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Auth-Token': auth_token,
              'X-Auth-Client': auth_client,
          },
          'maxRedirects': 20
      };

      let update_data = { value };
      
      let b = await this.addABC(update_opts, JSON.stringify(update_data));
  
      return b;
  },

    
    
    /**
     * 
     * @param {*} hash 
     * @param {*} auth_token 
     * @param {*} client_id 
     * @returns object with flat array of all products data (data), and associative array (bc_by_sku), containing an index
     * by sku to all products
     */
    getAllBigCommerceProducts: async function (hash, auth_token, client_id, q, addq) {
      const bc_export = { data: [], bc_by_sku: [], bc_by_name: [] };
      const default_query_string = 'limit=250&include=images,custom_fields&include_fields=custom_fields,id,inventory_level,price,upc,map_price,sku,cost_price,categories,name,is_visible,images,inventory_warning_level';
      let query_string = q ? q : default_query_string;
      if( addq ) {
        query_string += addq;
      }
      const base_path = '/stores/' + hash + '/v3/catalog/products?';
      const product_opts = {
        'method': 'GET',
        'hostname': 'api.bigcommerce.com',
        'path': base_path + query_string,
        'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
        },
        'maxRedirects': 20
      };
      
      let bb = null;

      let more_products = true;
      let pages = "?";
      while(more_products && !sf.abort_sync) {
        //console.log('getAllBigCommerceProducts: API call with ' + product_opts.path + " of " + pages );
        let kk = this.httpRequest(product_opts);
        await kk.then((data) => {
          try {
            bb = JSON.parse(data);
            for( let x = 0; x < bb.data.length; x++ ) {
                bc_export.data.push(bb.data[x]);
                // the following can be used to check for any supplier items not in the proper category
                // if( bb.data[x].sku && bb.data[x].sku.endsWith("a2luc2V5cw") ) {
                //   if( !bb.data[x].categories.includes(2404) ) {
                //     console.log("not in warehouse catg",bb.data[x]);
                //   }
                // }
                bb.data[x].dupe_ct = 0;
                if(bb.data[x].sku) {
                  bc_export.bc_by_sku[bb.data[x].sku] = bb.data[x];
                }
                if(bb.data[x].name) {
                  bc_export.bc_by_name[bb.data[x].name] = bb.data[x];
                }
            }
            //console.log(bb);
            if( bb.meta.pagination.current_page < bb.meta.pagination.total_pages ) {
              pages = bb.meta.pagination.total_pages;
              product_opts.path = base_path + query_string + '&page=' + (bb.meta.pagination.current_page+1);
            } else {
              more_products = false;
            }
          } catch (e) {
            console.log(e);
            console.log(data);
          }
        });
      
    
      }
    
      console.log('wowie');
    
      return bc_export;
    },

    imageExists: async function (host, path) {
      const head_opts =
      {
        'method': 'HEAD',
        'hostname': host,
        'path': path,
        'maxRedirects': 20
      };
    
      let rc = await this.headCheck(head_opts);
    
      return rc >= 200 && rc <= 300;
    
    },
    
    
    /**
     * This will only return the status code.
     * @param {*} opts 
     * @returns 
     */
    headCheck: async function (head_opts) {
    
      const kk = this.headRequest(head_opts);
      let ff = 0;
      await kk.then((rc) => {
          //console.log('swan=',rc);
          ff = rc;
      })
        .catch(function (e) {
          console.log(e);
          console.log("tricky");
        });
      ;
      //  console.log("ff", ff);
      //console.log('big gig', ff);
      return ff;
    },

    updateProductBatch: async function (hash, auth_token, client_id, pending_updates) {
      if( noUpdates ) {
        return;
      }
      const batch_opts = {
          'method': 'PUT',
          'hostname': 'api.bigcommerce.com',
          'path': '/stores/' + hash + '/v3/catalog/products?include_fields=id,sku,name',
          'headers': {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Auth-Token': auth_token,
              'X-Auth-Client': client_id,
          },
          'maxRedirects': 20
      };
      
      let b = await this.addABC(batch_opts, JSON.stringify(pending_updates));
        
      // console.log('batch golly');
  
      return b;
  },

  createBigCommerceBrand: async function (hash, auth_token, client_id, brand_name) {
    const brand_opts = {
      'method': 'POST',
      'hostname': 'api.bigcommerce.com',
      'path': '/stores/' + hash + '/v3/catalog/brands',
      'headers': {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': auth_token,
        'X-Auth-Client': client_id,
      },
      'maxRedirects': 20
    };
    const add_data =
    {
      "name": brand_name
    }
    //let brand_opts_base_path = brand_opts.path;
    let bb = null;
  
  
    //console.log('grrr '+ brand_opts.path);
    kk = this.httpRequest(brand_opts,JSON.stringify(add_data));
    await kk.then((data) => {
      try {
        bb = JSON.parse(data);
        //console.log(bb);
      } catch (e) {
        console.log(e);
        console.log(data);
      }
    });
  
    console.log('zounds');
    //console.log(pp.data[0]);
    //console.log(pp.data[0].categories);
  
    return bb;
  },
  
  createBigCommerceCategory: async function (hash, auth_token, client_id, catg_name, parent_id) {
    const catg_opts = {
      'method': 'POST',
      'hostname': 'api.bigcommerce.com',
      'path': '/stores/' + hash + '/v3/catalog/categories',
      'headers': {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': auth_token,
        'X-Auth-Client': client_id,
      },
      'maxRedirects': 20
    };
    const add_data =
    {
      "name": catg_name,
      "is_visible": true,
      "parent_id": parent_id ? parent_id : 0,
    }
    //var catg_opts_base_path = catg_opts.path;
    let cc = null;
  
  
    // console.log('meow '+ catg_opts.path);
    kk = this.httpRequest(catg_opts,JSON.stringify(add_data));
    await kk.then((data) => {
      try {
        cc = JSON.parse(data);
        //console.log(cc);
        //console.log(cc);
      } catch (e) {
        console.log(e);
        console.log(data);
      }
    });
  
    // console.log('golly');
    //console.log(pp.data[0]);
    //console.log(pp.data[0].categories);
  
    return cc;
  },

  downloadBCExport: async function (export_file) {
    const alpdemoClient = createClient(
    "https://alpinedemo1.com",
    {
        authType: AuthType.Digest,
        username: "mckids@voyager.net",
        password: "9f2152188a63c29e2967fd6e6692f5523d0f1523"
    }
    );
    const sportsmansClient = createClient(
      common.importOptions.webdav_host,
      common.importOptions.webdav_options
    );
    
    try {
      //console.log('one');
  
      const streamToFile = (client, inputSpec, outputSpec) => {
        return new Promise((resolve, reject) => {
          let is = client.createReadStream( inputSpec );
          let os = fs.createWriteStream( outputSpec );
          is.pipe(os)          
            .on('finish', () => resolve("done"))
            .on('error', error => reject(error))
        })
      }
      const yyy = streamToFile(sportsmansClient, "/dav/exports/" + export_file,"../app_data/sportsmans.xml");
      await yyy;
      //console.log('yyy',yyy);
    } catch( e ) {
       console.log(e);
     }
    //console.log('fours');
  
  
  },

  addABC: async function (opts, data) {
    if( noUpdates ) {
      return null;
    }
    const kk = this.httpRequest(opts, data);
    let ff = null;
    await kk.then((data) => {
      try {
        ff = JSON.parse(data);
      } catch (e) {
        console.log(e);
        console.log(data);
      }
    })
      .catch(function (e) {
        console.log(e);
        console.log("ick");
        ff = "error " + e;
      });
    ;
    //  console.log("ff", ff);
    //console.log('big bacon');
    return ff;
  },

  escapeForHTML( g ) {
    if( typeof g === 'string' ) { 
      return g.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    } else {
      return g;
    }
  },

  // this was added to support http non-secure access for Sport South
  imgURLExists: async function (url) {
    var options = {
      'method': 'HEAD',
      'url': url
    };
    return new Promise(function (resolve, reject) {
      request(options, function (error, response) {
        if (error) {
          reject(error);
        }
        let rc = response.statusCode;
        resolve(rc >= 200 && rc <= 300);
      });
  
    });
  },

  
get_gun_category_ids: function( bcCat ) {
  // find main Fireams
  let firearms_categories = []
  let firearms_top = this.getBigCommerceCategoryByPath(bcCat,["Firearms"]);
  firearms_categories.push(firearms_top.id);
  for( let i = 0; i < firearms_top.subs.length; i++ ) {
    if( firearms_top.subs[i].name != "Shooting" ) {
      firearms_categories.push(firearms_top.subs[i].id);
      this.add_child_categories( firearms_top.subs[i].subs, firearms_categories );
    }
  }
  return firearms_categories;
},

get_ammunition_category_ids: function( bcCat ) {
  let ammo_categories = [];
  let ammo_top = this.getBigCommerceCategoryByPath(bcCat,["Firearms","Shooting","Ammunition"]);
  ammo_categories.push(ammo_top.id)
  this.add_child_categories( ammo_top.subs, ammo_categories );
  return ammo_categories;
},

get_archery_category_ids: function( bcCat ) {
  let archery_categories = [];
  let archery_top = this.getBigCommerceCategoryByPath(bcCat,["Archery"]);
  archery_categories.push(archery_top.id)
  this.add_child_categories( archery_top.subs, archery_categories );
  return archery_categories;
},

// Recursive dive into subcategories to compile all ids
add_child_categories: function( subs, cats ) {
  if( subs && subs.length > 0 ) {
    for( let i = 0; i < subs.length; i++ ) {
      cats.push(subs[i].id);
      this.add_child_categories( subs[i].subs, cats );
    }
  }
},

// add required shipping group metafield for hazmat
add_hazmat_metafield: async function(hash, auth_token, client_id, id) {

  const hazmat_meta_key = "shipping-groups";
  const shipperhq_meta_namespace = "shipping.shipperhq";
  const hazmat_meta_value = [ "ammunition" ];
  
  const meta_add_data = {
      "permission_set": "write",
      "key": hazmat_meta_key,
      "value": JSON.stringify(hazmat_meta_value),
      "namespace": shipperhq_meta_namespace
  };
  
  let add_opts = {
      'method': 'POST',
      'hostname': 'api.bigcommerce.com',
      'path': '/stores/' + hash + '/v3/catalog/products/' + id + "/metafields",
      'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
      },
      'maxRedirects': 20
  };
  let dat = JSON.stringify(meta_add_data);
  let add_outcome = await this.addABC(add_opts, dat);
  return add_outcome;
},

// create a product metafield
create_product_metafield: async function(hash, auth_token, client_id, product_id, meta_add_data) {

  /* data like this...

  const meta_add_data = {
      "permission_set": "write",
      "key": hazmat_meta_key,
      "value": JSON.stringify(hazmat_meta_value),
      "namespace": shipperhq_meta_namespace
  };
  
  */

  let add_opts = {
      'method': 'POST',
      'hostname': 'api.bigcommerce.com',
      'path': '/stores/' + hash + '/v3/catalog/products/' + product_id + "/metafields",
      'headers': {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Auth-Token': auth_token,
          'X-Auth-Client': client_id,
      },
      'maxRedirects': 20
  };
  let dat = JSON.stringify(meta_add_data);
  let add_outcome = await this.addABC(add_opts, dat);
  return add_outcome;
},

state_name_to_code: function(state_name) {
  if(state_name && typeof state_name === 'string' ) {
    return US_STATES[state_name.toUpperCase()];
  } else {
    return null;
  }
  
},

wrappedSendMail: async function (mailOptions){
  return new Promise((resolve,reject)=>{
  //let transporter = nodemailer.createTransport({//settings});
    let transporter = nodemailer.createTransport(
    {
      // host: 'smtp-relay.gmail.com', //'mail.mckenzieduo.com',
      // secure: true,
      // auth: {
      //   user: 'onlinesales@sportsmansfinest.com', //'mcmarkio',
      //   pass: eikucjgltdmfbysr 'Onlinesales123', //'Give2God!'
      // }
      host: 'mail.mckenzieduo.com',
      secure: true,
      auth: {
        user: 'mcmarkio',
        pass: 'Give2God!'
      }

    }
    );

transporter.sendMail(mailOptions, function(error, info){
  if (error) {
      console.log("error is "+error);
     resolve(false); // or use rejcet(false) but then you will have to handle errors
  } 
 else {
     console.log('Email sent: ' + info.response);
     resolve(true);
  }
 });
 })
},


getSavedCategories: async function ( hash, access_token, client_id, bc_prod, bc_catgs ) {
  // first see if there's saved metafield
  let saved_catgs = [];
  let product_id = bc_prod.id;
  //console.log("showing " + product_id, bc_prod);
  let params = "namespace=" + upc_metafield_options.namespace + "&key=" + upc_metafield_options.key;
  let mf = null;
  try {
    mf = await this.getProductMetafields( hash, access_token, client_id, product_id, params);
  } catch (ick) {
    console.log(ick);
  }
  if (mf) {
    if (mf.data.length == 1) {

      const restore_catgs = mf.data[0].value.split(",").map(element => {
        return Number(element)
      });
      
      for (let i = 0; i < restore_catgs.length; i++) {
        let catg = restore_catgs[i];
        if (bc_catgs.cats_by_id[catg]) {
          saved_catgs.push(catg);
        }
      }
    }
  }
  return saved_catgs;
},

kinseysInventory: async function (opts, check_data) {
  const check_opts = {
    'method': 'POST',
    'hostname': opts.hostname,
    'path': opts.path,
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    'maxRedirects': 20
  };
  let cd = null;
  let jd = JSON.stringify(check_data);
  let kk = this.httpRequest(check_opts, jd);
  await kk.then((data) => {
    try {
      cd = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data);
    }
  });

  return cd;
},  


}
