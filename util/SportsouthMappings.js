const { createClient, AuthType } = require("webdav");

// fix these
// sync_master got BC products...
// sync_master invoking sports_south_import...
// no Sports South BigCommerce category match for path  {catid: 13, catdes: 'BLACK POWDER FIREARMS ', depid: 8, dep: 'MUZZLELOADING ', bc_path: Array(5)}
// no Sports South BigCommerce category match for path  {catid: 37, catdes: 'STOCKS AND FORENDS ', depid: 4, dep: 'FIREARM ACCESSORIES ', bc_path: Array(4)}
// no Sports South BigCommerce category match for path  {catid: 39, catdes: 'RED DOT SCOPES ', depid: 9, dep: 'OPTICS ', bc_path: Array(5)}
// not sure yet - no Sports South BigCommerce category match for path  {catid: 43, catdes: 'TRAPS AND CLAY THROWERS ', depid: 12, dep: 'SHOOTING ', bc_path: Array(4)}
// no Sports South BigCommerce category match for path  {catid: 68, catdes: 'KNIFE ACCESSORIES ', depid: 1, dep: 'ACCESSORIES ', bc_path: Array(3)}
// no Sports South BigCommerce category match for path  {catid: 79, catdes: 'BORE SIGHTERS AND ARBORS ', depid: 12, dep: 'SHOOTING ', bc_path: Array(4)}
// no Sports South BigCommerce category match for path  {catid: 81, catdes: 'COMPONENTS ', depid: 11, dep: 'RELOADING ', bc_path: Array(4)}
// no Sports South BigCommerce category match for path  {catid: 82, catdes: 'POWDERS ', depid: 11, dep: 'RELOADING ', bc_path: Array(5)}
const categoryMappings = [
    {"catid": 0, "catdes": "UNASSIGNED ", "depid": 0, "dep": "",
    "bc_path": [ "Misc" ] },
   { "catid": 1, "catdes": "ACCESSORIES MISCELLANEOUS ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 2, "catdes": "AIR GUNS ", "depid": 2, "dep": "AIR GUNS AND ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 3, "catdes": "ATV ACCESSORIES ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 4, "catdes": "BLANK ROUNDS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Blanks & Dummys" ] },
   { "catid": 5, "catdes": "CENTERFIRE HANDGUN ROUNDS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Handgun Ammunition" ] },
   { "catid": 6, "catdes": "RIMFIRE ROUNDS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Rimfire Ammunition" ] },
   { "catid": 7, "catdes": "ARCHERY AND ACCESSORIES ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Archery" ] },
   { "catid": 8, "catdes": "EXTRA BARRELS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Barrels" ] },
   { "catid": 9, "catdes": "LASER SIGHTS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Optics" ] },
   { "catid": 10, "catdes": "BINOCULARS ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Binoculars" ] },
   { "catid": 11, "catdes": "BLACK POWDER ACCESSORIES ", "depid": 8, "dep": "MUZZLELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Black Powder", "Black Powder Accessories" ] },
   { "catid": 12, "catdes": "BLACK POWDER BULLETS ", "depid": 8, "dep": "MUZZLELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Reloading Bullets" ] },
   { "catid": 13, "catdes": "BLACK POWDER FIREARMS ", "depid": 8, "dep": "MUZZLELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Black Powder", "Muzzleloader" ] },
   { "catid": 14, "catdes": "APPAREL ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Apparel" ] },
   { "catid": 15, "catdes": "GUNCASES ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Storage & Security", "Gun Cases" ] },
   { "catid": 16, "catdes": "CHOKE TUBES ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Choke Tubes" ] },
   { "catid": 17, "catdes": "CLEANING AND RESTORATION ", "depid": 6, "dep": "GUN CARE ",
    "bc_path": [ "Firearms", "Shooting", "Gun Maintenance", ] },
   { "catid": 18, "catdes": "MAGAZINES AND ACCESSORIES ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Magazines & Accessories" ] },
   { "catid": 19, "catdes": "DECOYS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Decoys" ] },
   { "catid": 20, "catdes": "ELECTRONICS ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 21, "catdes": "FEEDERS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Feeders & Accessories" ] },
   { "catid": 22, "catdes": "GAME CALLS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Game Calls" ] },
   { "catid": 23, "catdes": "GRIPS AND RECOIL PADS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts" ] },
   { "catid": 25, "catdes": "EYE PROTECTION ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [ "Firearms", "Shooting", "Safety & Protection", "Eye Protection" ] },
   { "catid": 26, "catdes": "PISTOLS ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Handguns", "Pistols" ] },
   { "catid": 27, "catdes": "BLINDS AND ACCESSORIES ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Blinds" ] },
   { "catid": 28, "catdes": "HOLSTERS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Holsters" ] },
   { "catid": 29, "catdes": "MEDIA ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 30, "catdes": "KNIVES ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Knives & Tools", "Knives" ] },
   { "catid": 31, "catdes": "LIGHTS ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Camping & Outdoors", "Lighting" ] },
   { "catid": 32, "catdes": "NIGHT VISION ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Camping & Outdoors", "Lighting" ] },
   { "catid": 34, "catdes": "PERSONAL PROTECTION ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Safety & Protection" ] },
   { "catid": 35, "catdes": "RELOADING ACCESSORIES ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Reloading Tools & Accessories" ] },
   { "catid": 36, "catdes": "RELOADING BULLETS ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Reloading Bullets" ] },
   { "catid": 37, "catdes": "STOCKS AND FORENDS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Stocks" ] },
   { "catid": 38, "catdes": "DIES ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Dies"] },
   { "catid": 39, "catdes": "RED DOT SCOPES ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Sights", "Red Dot" ] },
   { "catid": 40, "catdes": "RIFLES CENTERFIRE ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Long Guns", "Rifles" ] },
   { "catid": 41, "catdes": "RINGS AND ADAPTORS ", "depid": 10, "dep": "OPTICS ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Rings, Mounts & Bases" ] },
   { "catid": 42, "catdes": "PRESSES ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Presses" ] },
   { "catid": 43, "catdes": "TRAPS AND CLAY THROWERS ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [  "Firearms", "Shooting", "Shooting Accessories", "Target Throwers" ] },
   { "catid": 44, "catdes": "GUN VAULTS AND SAFES ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [  "Firearms", "Shooting", "Storage & Security", "Gun Cases", ] },
   { "catid": 45, "catdes": "HUNTING SCENTS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Scents & Repellents" ] },
   { "catid": 46, "catdes": "SCOPES ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Scopes" ] },
   { "catid": 47, "catdes": "TARGETS ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Targets" ] },
   { "catid": 48, "catdes": "SHOTGUNS ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Long Guns", "Shotguns" ] },
   { "catid": 49, "catdes": "SHOTSHELL LEAD LOADS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Shotgun Ammunition" ] },
   { "catid": 50, "catdes": "GUN SIGHTS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Sights" ] },
   { "catid": 51, "catdes": "SLINGS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Slings & Swivels" ] },
   { "catid": 52, "catdes": "SPOTTING ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Spotting Scopes" ] },
   { "catid": 53, "catdes": "GUN RESTS - BIPODS - TRIPODS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Rests, Bipods & Tripods" ] },
   { "catid": 55, "catdes": "BASES ", "depid": 10, "dep": "OPTICS ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Rings, Mounts & Bases", "Bases" ] },
   { "catid": 56, "catdes": "CAMPING ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Camping & Outdoors" ] },
   { "catid": 57, "catdes": "COMBO ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms","Firearm Combos" ] },
   { "catid": 58, "catdes": "RIFLES CENTERFIRE TACTICAL ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Long Guns", "Rifles" ] },
   { "catid": 59, "catdes": "SHOTGUNS TACTICAL ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Long Guns", "Shotguns" ] },
   { "catid": 60, "catdes": "BATTERIES ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 62, "catdes": "CAMERAS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Cameras & Accessories" ] },
   { "catid": 63, "catdes": "UPPERS ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Upper Receivers" ] },
   { "catid": 64, "catdes": "REVOLVERS ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Handguns", "Revolvers" ] },
   { "catid": 65, "catdes": "SPECIALTY ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Specialty" ] },
   { "catid": 66, "catdes": "LOWERS ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Lowers" ] },
   { "catid": 67, "catdes": "FRAMES ", "depid": 5, "dep": "FIREARMS ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts", "Frames" ] },
   { "catid": 68, "catdes": "KNIFE ACCESSORIES ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Knives & Tools", "Sharpeners & Accessories" ] },
   { "catid": 69, "catdes": "DUMMY ROUNDS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Blanks & Dummys" ] },
   { "catid": 70, "catdes": "CENTERFIRE RIFLE ROUNDS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition" ] },
   { "catid": 71, "catdes": "SHOTSHELL STEEL LOADS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Shotgun Ammunition" ] },
   { "catid": 72, "catdes": "SHOTSHELL NON-TOX LOADS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Shotgun Ammunition" ] },
   { "catid": 73, "catdes": "AIR GUN ACCESSORIES ", "depid": 2, "dep": "AIR GUNS AND ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 74, "catdes": "FIREARM PARTS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Gun Parts"] },
   { "catid": 75, "catdes": "HOLDERS AND ACCESSORIES ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Holders & Pouches" ] },
   { "catid": 76, "catdes": "SWIVELS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories", "Slings & Swivels" ] },
   { "catid": 77, "catdes": "CONVERSION KITS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Shooting Accessories" ] },
   { "catid": 78, "catdes": "RANGE FINDERS ", "depid": 9, "dep": "OPTICS ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Binoculars", "Range Finders" ] },
   { "catid": 79, "catdes": "BORE SIGHTERS AND ARBORS ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", ] },
   { "catid": 80, "catdes": "SCOPE COVERS AND SHADES ", "depid": 10, "dep": "OPTICS ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "Optics", "Bore Sighting" ] },
   { "catid": 81, "catdes": "COMPONENTS ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading" ] },
   { "catid": 82, "catdes": "POWDERS ", "depid": 11, "dep": "RELOADING ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Primers & Powders" ] },
   { "catid": 83, "catdes": "HEARING PROTECTION ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": ["Firearms", "Shooting", "Safety & Protection", "Hearing Protection" ] },
   { "catid": 84, "catdes": "CARRYING BAGS ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [ "Firearms", "Shooting", "Storage & Security" ] },
   { "catid": 85, "catdes": "REPELLENTS ", "depid": 7, "dep": "HUNTING ",
    "bc_path": [ "Hunting", "Scents & Repellents" ] },
   { "catid": 86, "catdes": "AIR GUN AMMO ", "depid": 2, "dep": "AIR GUNS AND ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 87, "catdes": "CLEANING KITS ", "depid": 6, "dep": "GUN CARE ",
    "bc_path": [ "Firearms", "Shooting", "Gun Maintenance", "Cleaning" ] },
   { "catid": 88, "catdes": "UTILITY BOXES ", "depid": 12, "dep": "SHOOTING ",
    "bc_path": [ "Misc" ] },
   { "catid": 89, "catdes": "DISPLAYS ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 90, "catdes": "SHOTSHELL SLUG LOADS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Shotgun Ammunition" ] },
   { "catid": 91, "catdes": "SHOTSHELL BUCKSHOT LOADS ", "depid": 3, "dep": "AMMO ",
    "bc_path": [ "Firearms", "Shooting", "Ammunition", "Shotgun Ammunition" ] },
   { "catid": 92, "catdes": "REFURBISH DENT OR SCRATCH ", "depid": 1, "dep": "ACCESSORIES ",
    "bc_path": [ "Misc" ] },
   { "catid": 93, "catdes": "SUPPRESSORS ", "depid": 4, "dep": "FIREARM ACCESSORIES ",
    "bc_path": [ "Firearms", "Shooting", "NFA/Class III", "Suppressors" ] }
];

/* misc constants needed for import / update processing */
const importOptions = {
    // user / password 95182 / 78738
    user_name: "***",
    source: "***",
    customer_number: "***",
    password: "***",
    image_url_ix: "{ix}",
    default_category_path: [ "Misc" ],
    image_url_hires: "http://media.server.theshootingwarehouse.com/hires/{ix}.png",
    image_url_large: "http://media.server.theshootingwarehouse.com/large/{ix}.jpg", 
    image_url_large_2: "http://media.server.theshootingwarehouse.com/large/{ix}_A.jpg", 
    image_url_large_3: "http://media.server.theshootingwarehouse.com/large/{ix}_B.jpg", 
    image_url_small: "http://media.server.theshootingwarehouse.com/small/{ix}.jpg", 
    image_url_small_2: "http://media.server.theshootingwarehouse.com/small/{ix}_A.jpg", 
    image_url_small_3: "http://media.server.theshootingwarehouse.com/small/{ix}_B.jpg", 
    image_url_thumbnail: "http://media.server.theshootingwarehouse.com/thumbnail/{ix}.jpg", 
    endpoint: "http://webservices.theshootingwarehouse.com/smart/inventory.asmx/",
    sku_tag: "c3NvdXRo",
    name_tag: "s",
    webdav_host: "https://sportsmans-finest.mybigcommerce.com",
    webdav_options: {
        authType: AuthType.Digest,
        username: "mark.mckenzie@herodigital.com",
        password: "fc7398ae3c7e04dbfe0be2e018292ed53a3df6b3"
    }
}

exports.importOptions = importOptions;
exports.categoryMappings = categoryMappings;
