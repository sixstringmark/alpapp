/**
 * BigCommerce Express Hello World App
 *
 * A simple Express app to quickly demonstrate
 * single-click app OAuth flow.
 *
 * Note: not intended for production use.
 **/



const express = require("express");
const session = require("express-session");
const exphbs = require('express-handlebars');

const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const ammofeedRouter = require("./routes/ammofeed");
const hooks = require("./routes/hooks");
const productsRouter = require("./routes/products");

require('dotenv').config();

// App Routes ============================================
const auth = require("./routes/auth");
const load = require("./routes/load");
const remove_user = require("./routes/remove_user");
const uninstall = require("./routes/uninstall");
// ========================================================

const app = express();
app.set('trust proxy', 1)
app.use(session(
  {secret: 'ssshhhhh', 
  cookie: {secure: true, sameSite: 'none', httpOnly: true, maxAge: 60 * 60 * 24 * 1000 },
  resave: false,
  saveUninitialized: false,
}));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.set("views", __dirname + "/views");
app.use("/", indexRouter);

// App Routes ============================================+
app.use("/ammofeed", ammofeedRouter);
app.use("/users", usersRouter);
app.use("/remove_user", remove_user);
app.use("/hooks", hooks);
app.use("/products", productsRouter);
app.use("/auth", auth);
app.use("/load", load);
app.use("/uninstall", uninstall);
// ========================================================

app.engine('hbs', exphbs({
    defaultLayout: 'main',
    extname: '.hbs'
}));

app.set('view engine', 'hbs');

app.get('/mc1', (req, res) => {
  res.render('home', {
    post: {
        author: 'Janithy Kasun',
        image: 'https://picsum.photos/500/500',
        comments: []
    }
});
});

const listener = app.listen(8080, function() {
  console.log("Listening on port " + listener.address().port);
});

global.sf = { app_name: "Sportsman's Finest Supplier Feeds", abort_sync: false, sync_active: false, pending: null };

global.sfLog = function sfLog(...args) {
  const st = {"year":"numeric","hour12":false,"month":"2-digit","day":"2-digit",
  "hour":"2-digit","minute":"2-digit","second":"2-digit"};
  let p = new Date().toLocaleString(undefined,st);
  console.log( p, ...args );
}

/**
 * Pull any sync overrides from the BigCommerce product custom fields
 */
global.getOverrides = function(bc_export_prod) {
  let overrides = {};
  if( bc_export_prod && bc_export_prod.custom_fields && bc_export_prod.custom_fields.length > 0 ) {
    for( let c = 0; c < bc_export_prod.custom_fields.length; c++ ) {
      if( bc_export_prod.custom_fields[c].name == "_map_price_override_") {
        overrides.map_price = bc_export_prod.custom_fields[c].value * 1.0;
        break;
      }
    }
  }
  return overrides;
}

global.noUpdates = false;