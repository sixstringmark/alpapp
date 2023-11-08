var express = require("express");
var router = express.Router();
var https = require("follow-redirects").https;
var fs = require("fs");
var ii = require("../util/ick");
//var pp = require("../util/httpPromise");
var querystring = require("querystring");


/* GET users listing. */
router.get("/", function (req, res, next) {
  //console.log(req.session);
  var func = req.query["go"];
  console.log("func=" + func);
  if( func == "search") {
    get_products(req.cookies.mc_hash, res, req);

  } else if (func == "addp") {
    add_product(req.cookies.mc_hash, res, req);
    res.render('products', {
//      data: f,
      post: {
        author: 'Add Product',
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });
  } else if (func == "updt") {
    update_product(req.cookies.mc_hash, res, req);
    res.render('products', {
//      data: f,
      post: {
        author: 'Add Product',
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });
  } else if (func == "dltp") {
    delete_product(req.cookies.mc_hash, res, req);
    res.render('products', {
//      data: f,
      post: {
        author: 'Delete Product',
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });
  } else {
    res.render('products', {
//      data: f,
      post: {
        author: 'Default',
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });

  }
  //res.send("respond with a resource");
});

module.exports = router;

function get_products(hash, res1, req) {
  var params1 = {
    host: 'guitar.mcmarkio.com',
    port: 443,
    method: 'GET',
    path: '/'
  };
  var params2 = {
    host: 'vortex.mcmarkio.com',
    port: 443,
    method: 'POST',
    path: '/'
  };


  var https = require('follow-redirects').https;
  var fs = require('fs');
  var ff = null;
  var dd = ii.get_app_data();
  var uu = loadABC(hash, req.query['what'], dd);

  var options = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products?keyword=' + querystring.escape(req.query['what']),
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };

  var params3 = {
    'method': 'GET',
    'hostname': 'api.bigcommerce.com',
    'path': '/stores/' + hash + '/v3/catalog/products?keyword=' + querystring.escape(req.query['what']),
    'headers': {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Auth-Token': dd.store_hash[hash],
      'X-Auth-Client': dd.app_client,
    },
    'maxRedirects': 20
  };

  var fred = "hah";
  ii.httpRequest(params1).then(function (body) {
    console.log(body.length);
    console.log("fred=" + fred);
    fred += '.' + body.length;
    return ii.httpRequest(params2, "hello");
  }).then(function (body) {
    console.log(body.length);
    console.log("fred=" + fred);
    fred += '.' + body.length;
    return ii.httpRequest(params3);
  }).then(function (body) {
    console.log(body.length);
    var jt = null;
    try {
      jt = JSON.parse(body);
      //console.log(jt);
    } catch (ee) {
      console.log(ee);
    }
    console.log("fred=" + fred);
    fred += '.' + body.length;
    return (jt);
  }).then(function (f) {
    console.log("fred=" + fred);
    res1.render('products', {
      data: f,
      post: {
        author: 'Products ' + fred,
        image: 'https://picsum.photos/500/500',
        comments: []
      }
    });
  }).catch(function (e) {
    console.log(e);
  });
  return ff;
}

function add_product(hash, res1, req) {
  var dd = ii.get_app_data();

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
      75
    ],
    "condition": "New"
  };
  ff = addABC(add_opts,JSON.stringify(add_data));
  msg = (ff) ? "Product added" : "Error";
  return ff;
  res1.render('products', {
    data: f,
    message: msg,
    post: {
      author: 'Products ' + fred,
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}

function update_product(hash, res1, req) {
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
  
  ff = updateABC(update_opts,JSON.stringify(update_data));
  return ff;
  res1.render('products', {
    data: ff,
    post: {
      author: 'Products Update ' + fred,
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}

function delete_product(hash, res1, req) {
  var dd = ii.get_app_data();

  var ff = null;
  var update_opts = 
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
  
  ff = deleteABC(update_opts);
  return ff;
  res1.render('products', {
    data: ff,
    post: {
      author: 'Product Delete ' + fred,
      image: 'https://picsum.photos/500/500',
      comments: []
    }
  });
}
async function addABC(opts,data) {
  var kk = ii.httpRequest(opts,data);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data);
    }
  })
  .catch(function(e) {
    ff="nuts";
    console.log("ick");
  });
  ;
  console.log("ff",ff);
  return ff;
}

async function updateABC(opts,data) {
  var kk = ii.httpRequest(opts,data);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data);
    }
  });
  return ff;
}

async function deleteABC(opts) {
  var kk = ii.httpRequest(opts);
  var ff = null;
  await kk.then((data) => {
    try {
      ff = ""; // no return content for delete
    } catch (e) {
      console.log(e);
      console.log(data);
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
  var catg_opts =  {
      'method': 'GET',
      'hostname': 'api.bigcommerce.com',
      'path': '/stores/' + hash + '/v3/catalog/categories',
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

  var cc = null;
  var pp = null;

  var kk = ii.httpRequest(prod_opts);
  await kk.then((data) => {
    try {
      pp = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data);
    }
  });

  kk = ii.httpRequest(catg_opts);
  await kk.then((data) => {
    try {
      cc = JSON.parse(data);
    } catch (e) {
      console.log(e);
      console.log(data);
    }
  });

  console.log(pp);
  console.log(cc);

  return uu;
}

