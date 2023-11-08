/**
 * This module attempts to match old URL to current products and to generate 301 redirects for the matches
 */
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("../util/ick");
const stream = require("stream");

const searchNum = /[^0-9. ]/g;
const replaceNum = '';

const searchCatgSep = / , /g;
const replaceCatgSep = '\t';

const promisifiedPipe = require("promisified-pipe");

//duh();

async function generate_redirects(hash, auth_token, client_id, opts) {

    init_status();

    let start = new Date().getTime();

    let aa = [];

    
    let fda = fs.createReadStream("../urls_to_redirect.csv");
    let csva = csv({ separator: ',', quote: '"' });

    fda.pipe(csva).on('data', (data) => aa.push(data));

    let enda = new Promise(function (resolve, reject) {
        csva.on('end', () => resolve("yes"));
        fda.on('error', reject); // or something like that. might need to close `hash`
    });

    await enda;

    console.log(aa);
  
}





exports.generate_redirects = generate_redirects;
