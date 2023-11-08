const { createClient, AuthType } = require("webdav");

/***
 * This module defines columns used for the various RSR FTP files
 */
const invCSVColumns = [
    'RSRStockNumber',
    'UPCCode',
    'ProductDescription',
    'DepartmentNumber',
    'ManufactureID',
    'RetailPrice',
    'RSRPricing',
    'ProductWeight',
    'InventoryQty',
    'Model',
    'FullManufactureName',
    'ManufacturerPartNumber',
    'AllocatedCloseoutDeleted',
    'ExpandedProductDescription',
    'ImageName',
    'RestrictedAK',
    'RestrictedAL',
    'RestrictedAR',
    'RestrictedAZ',
    'RestrictedCA',
    'RestrictedCO',
    'RestrictedCT',
    'RestrictedDC',
    'RestrictedDE',
    'RestrictedFL',
    'RestrictedGA',
    'RestrictedHI',
    'RestrictedIA',
    'RestrictedID',
    'RestrictedIL',
    'RestrictedIN',
    'RestrictedKS',
    'RestrictedKY',
    'RestrictedLA',
    'RestrictedMA',
    'RestrictedMD',
    'RestrictedME',
    'RestrictedMI',
    'RestrictedMN',
    'RestrictedMO',
    'RestrictedMS',
    'RestrictedMT',
    'RestrictedNC',
    'RestrictedND',
    'RestrictedNE',
    'RestrictedNH',
    'RestrictedNJ',
    'RestrictedNM',
    'RestrictedNV',
    'RestrictedNY',
    'RestrictedOH',
    'RestrictedOK',
    'RestrictedOR',
    'RestrictedPA',
    'RestrictedRI',
    'RestrictedSC',
    'RestrictedSD',
    'RestrictedTN',
    'RestrictedTX',
    'RestrictedUT',
    'RestrictedVA',
    'RestrictedVT',
    'RestrictedWA',
    'RestrictedWI',
    'RestrictedWV',
    'RestrictedWY',
    'GroundShipmentsOnly',
    'AdultSignatureRequired',
    'BlockedFromDropShip',
    'DateEntered',
    'RetailMAP',
    'ImageDisclaimer',
    'ShippingLength',
    'ShippingWidth',
    'ShippingHeight',
    'Prop65',
    'VendorApprovalRequired'
];

const catgCSVColumns = [
    "DepartmentID",
    "DepartmentName",
    "CategoryID",
    "CategoryName"
];

const prodMsgCSVColumns = [
    'RSRStockNumber',
    "UPCCode",
    "MfrPartNumber",
    "MessageType",
    "MessageText"
];

const prodShipRestrictionCSVColumns = [
    'RSRStockNumber'
    ,"Municipality" /* City or county or "ALL" */
    ,"State"
    ,"TerritoryRestrictionType" /* C - City, T - County, S - State */
    ,"RestrictionDetail" /* A - avadavit required
                            F - fulfillment or drop ship blocked
                            H - require high-capacity permit
                            L - require license
                            O - require SOTS licensing
                            S - require assault weapon permit
                            R - require short-barrel permit
                            Y - all blocked
                            */
];

const deletedProductsCSVColumns = [
    'RSRStockNumber',
    "Description",
    "Deleted" // constant DELETED
];

const attributeFields = [
/* 1  */ "RSRStockNumber",
/* 2  */ "ManufacturerId",
/* 3  */ "Accessories",
/* 4  */ "Action",
/* 5  */ "Type of Barrel",
/* 6  */ "Barrel Length",
/* 7  */ "Catalog Code",
/* 8  */ "Chamber",
/* 9  */ "Chokes",
/* 10 */ "Condition",
/* 11 */ "Capacity",
/* 12 */ "Description",
/* 13 */ "Dram",
/* 14 */ "Edge",
/* 15 */ "Firing Casing",
/* 16 */ "Finish",               // (combined with Color, field 48, prior to July 2020)",
/* 17 */ "Fit",
/* 18 */ "Fit 2", //   **",
/* 19 */ "Feet per second",
/* 20 */ "Frame",                // (combined with Material, field 49, prior to July 2020)",
/* 21 */ "Caliber",
/* 22 */ "Caliber 2", //   **",
/* 23 */ "Grain Weight",
/* 24 */ "Grips",                // (combined with Stock, field 50, prior to July 2020)",
/* 25 */ "Hand",
/* 26 */ "Manufacturer",
/* 27 */ "Manufacturer Part No",  // (added June 2010)",
/* 28 */ "Manufacturer Weight",
/* 29 */ "MOA",
/* 30 */ "Model",
/* 31 */ "Model 2", //   **",
/* 32 */ "New Stock #",
/* 33 */ "National Stock Number", // (National Stock #)    (added June 2010)",
/* 34 */ "Objective",
/* 35 */ "Ounce of Shot",
/* 36 */ "Packaging",
/* 37 */ "Power",
/* 38 */ "Reticle",
/* 39 */ "Safety",
/* 40 */ "Sights",
/* 41 */ "Size",
/* 42 */ "Type",
/* 43 */ "Units per Box",
/* 44 */ "Units per Case",
/* 45 */ "Wt Characteristics",
/* 46 */ "Sub Category",
/* 47 */ "Diameter",
/* 48 */ "Color", //                 (added July 2020)",
/* 49 */ "Material", //              (added July 2020)",
/* 50 */ "Stock", //                 (added July 2020)",
/* 51 */ "LensColor", //             (added July 2020)",
/* 52 */ "HandleColor" //           (added July 2020)
];

const sellFeatures = [
    "type", // FEATURES or SELLCOPY 
    "RSRStockNumber",
    "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10"
];

const deletedInv = [
    "RSRStockNumber", "Description", 'DELETED'
];

/* misc constants needed for import / update processing */
const importOptions = {
    default_category_path: [ "Misc" ],
    sku_tag: "cnNyZmVlZA",
    name_tag: "r",
    webdav_host: "https://sportsmans-finest.mybigcommerce.com",
    webdav_options: {
        authType: AuthType.Digest,
        username: "mark.mckenzie@herodigital.com",
        password: "fc7398ae3c7e04dbfe0be2e018292ed53a3df6b3"
    }
}

const RSRtoBigCommerceCategoryMappings = [
	{"deptId": 1,"dept":"Hand Guns","catgId": 1, "catg": "Handguns", "bcPath": [ "Firearms", "Handguns" ] },
	{"deptId": 2,"dept":"Used Hand Guns","catgId": 1, "catg": "Handguns", "bcPath": [ "Firearms", "Used Guns", "Used Handguns" ] },
	{"deptId": 3,"dept":"Used Long Guns","catgId": 5, "catg": "Long Guns", "bcPath": [ "Firearms", "Used Guns", "Used Long Guns" ] },
	{"deptId": 4,"dept":"Tasers","catgId": 4, "catg": "Tasers", "bcPath": [ "Firearms", "Shooting", "Stun Guns" ] },
	{"deptId": 5,"dept":"Sporting Long Guns","catgId": 5, "catg": "Long Guns", "bcPath": [ "Firearms", "Long Guns" ] },
	{"deptId": 6,"dept":"NFA Products","catgId": 6, "catg": "NFA Products", "bcPath": [ "Firearms", "Shooting", "NFA/Class III" ] },
	{"deptId": 7,"dept":"Black Powder Firearms","catgId": 7, "catg": "Black Powder Firearms", "bcPath": [ "Firearms", "Shooting", "Black Powder", "Black Powder Firearms" ] },
	{"deptId": 8,"dept":"Scopes","catgId": 8, "catg": "Optics", "bcPath": [ "Firearms", "Shooting", "Optics", "Scopes" ] },
	{"deptId": 9,"dept":"Scope Mounts","catgId": 9, "catg": "Optical Accessories", "bcPath": [ "Firearms", "Shooting", "Optics", "Rings, Mounts & Bases", "Mounts" ] },
	{"deptId": 10,"dept":"Magazines","catgId": 10, "catg": "Magazines", "bcPath": [ "Firearms", "Shooting", "Magazines & Accessories", "Magazines" ] },
	{"deptId": 11,"dept":"Grips/Pads/Stocks","catgId": 11, "catg": "Grips, Pads, Stocks, Bipods", "bcPath": [ "Firearms", "Shooting", "Gun Parts" ] },
	{"deptId": 12,"dept":"Soft Gun Cases/Packs","catgId": 12, "catg": "Soft Gun Cases, Packs, Bags", "bcPath": [ "Firearms", "Shooting", "Storage & Security", "Gun Cases", "Soft Cases"] },
	{"deptId": 13,"dept":"Misc. Accessories","catgId": 13, "catg": "Misc. Accessories", "bcPath": [ "Firearms", "Shooting", "Shooting Accessories" ] },
	{"deptId": 14,"dept":"Holsters/Pouches","catgId": 14, "catg": "Holsters & Pouches", "bcPath": [ "Firearms", "Shooting", "Shooting Accessories", "Holders & Pouches" ] },
	{"deptId": 15,"dept":"Reloading Equipment","catgId": 15, "catg": "Reloading Supplies", "bcPath": [ "Firearms", "Shooting", "Ammunition", "Reloading", "Reloading Tools & Accessories" ] },
	{"deptId": 18,"dept":"Ammunition","catgId": 18, "catg": "Ammunition", "bcPath": [ "Firearms", "Shooting", "Ammunition" ] },
	{"deptId": 19,"dept":"Survival Supplies","catgId": 19, "catg": "Survival & Camping Supplies", "bcPath": [ "Camping & Outdoors", "Camp Stoves & Cooking", "Meals" ] },
	{"deptId": 20,"dept":"Flashlights & Batteries","catgId": 20, "catg": "Lights, Lasers, & Batteries", "bcPath": [ "Camping & Outdoors", "Lighting", "Flashlights & Accessories" ] },
	{"deptId": 21,"dept":"Cleaning Equipment","catgId": 21, "catg": "Cleaning Equipment", "bcPath": [ "Firearms", "Shooting", "Gun Maintenance" ] },
	{"deptId": 22,"dept":"Airguns","catgId": 22, "catg": "Airguns", "bcPath": [ "Misc" ] },
	{"deptId": 23,"dept":"Knives","catgId": 23, "catg": "Knives & Tools", "bcPath": [ "Gear & Apparel", "Accessories", "Knives & Tools", "Knives" ] },
	{"deptId": 24,"dept":"High Capacity Magazines","catgId": 10, "catg": "Magazines", "bcPath": [ "Firearms", "Shooting", "Magazines & Accessories", "High Capacity Magazines" ] },
	{"deptId": 25,"dept":"Safes/Security","catgId": 25, "catg": "Safes & Security", "bcPath": [ "Firearms", "Shooting", "Storage & Security" ] },
	{"deptId": 26,"dept":"Safety/Protection","catgId": 26, "catg": "Safety & Protection", "bcPath": [ "Firearms", "Shooting", "Safety & Protection" ] },
	{"deptId": 27,"dept":"Non-Lethal Defense","catgId": 27, "catg": "Non-Lethal Defense", "bcPath": [ "Firearms", "Shooting", "Safety & Protection", "Non Lethal Defense" ] },
	{"deptId": 29,"dept":"Spotting Scopes","catgId": 8, "catg": "Optics", "bcPath": [ "Firearms", "Shooting", "Optics", "Sights" ] },
	{"deptId": 30,"dept":"Sights/Lasers/Lights","catgId": 30, "catg": "Sights", "bcPath": [ "Firearms", "Shooting", "Optics", "Sights" ] },
	{"deptId": 32,"dept":"Barrels/Choke Tubes","catgId": 32, "catg": "Barrels, Choke Tubes, & Muzzle Devices", "bcPath": [ "Firearms", "Shooting", "Gun Parts" ] },
	{"deptId": 33,"dept":"Clothing","catgId": 33, "catg": "Clothing", "bcPath": [ "Gear & Apparel" ] },
	{"deptId": 34,"dept":"Parts","catgId": 34, "catg": "Parts", "bcPath": [ "Firearms", "Shooting", "Gun Parts" ] },
	{"deptId": 35,"dept":"Slings/Swivels","catgId": 35, "catg": "Slings & Swivels", "bcPath": [ "Firearms", "Shooting", "Shooting Accessories", "Slings & Swivels"] },
	{"deptId": 36,"dept":"Electronics","catgId": 36, "catg": "Electronics", "bcPath": ["Misc" ] },
	{"deptId": 38,"dept":"Books/Software","catgId": 38, "catg": "Books, Software, & DVDs", "bcPath": ["Misc"] },
	{"deptId": 39,"dept":"Targets","catgId": 39, "catg": "Targets", "bcPath": [ "Firearms", "Shooting", "Shooting Accessories", "Targets" ] },
	{"deptId": 40,"dept":"Hard Gun Cases","catgId": 40, "catg": "Hard Gun Cases", "bcPath": [ "Firearms", "Shooting", "Storage & Security", "Gun Cases", "Hard Cases" ] },
	{"deptId": 41,"dept":"Upper Receivers/Conv Kits","catgId": 41, "catg": "Upper Receivers & Conversion Kits", "bcPath": [ "Firearms", "Shooting", "Gun Parts", "Upper Receivers" ] },
	{"deptId": 42,"dept":"SBR Uppers","catgId": 42, "catg": "SBR Barrels & Upper Receivers", "bcPath": [ "Firearms", "Shooting", "Gun Parts", "Upper Receivers" ] },
	{"deptId": 43,"dept":"Upper/Conv Kits-High Cap","catgId": 43, "catg": "Upper Receivers & Conversion Kits - High Capacity", "bcPath": [ "Firearms", "Shooting", "Gun Parts", "Upper Receivers" ] }
];

exports.RSRtoBigCommerceCategoryMappings = RSRtoBigCommerceCategoryMappings;
exports.importOptions = importOptions;
exports.invCSVColumns = invCSVColumns;
exports.catgCSVColumns = catgCSVColumns;
exports.prodMsgCSVColumns = prodMsgCSVColumns;
exports.prodShipRestrictionCSVColumns = prodShipRestrictionCSVColumns;
exports.deletedProductsCSVColumns = deletedProductsCSVColumns;
exports.attributeFields = attributeFields;
exports.sellFeatures = sellFeatures;
exports.deletedInv = deletedInv;