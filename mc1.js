var Client = require('ftp');
const ftp = require("basic-ftp");
const csv = require('csv-parser')
const fs = require('fs')
const iii = require("./util/ick");
const rsr = require("./util/rsr_import");

const DD = " / ";

get_rsr();

async function get_rsr() {
  try {
    rsr.rsr_import();
    console.log('ick ick');
  }
  catch (err) {
    console.log(err)
  }
}
async function xduh() {
  await example();

  const results = [];
  const catgRes = [];
  fs.createReadStream('../app_data/categories.txt')
    .pipe(csv({ separator: ';', headers: rsr.catgCSVColumns, quote: '\b' }))
    .on('data', (data) => catgRes.push(data))
    .on('end', () => {
      //console.log(catgRes);
      for (var i = 0; i < 10; i++) {
        console.log(i, DD, catgRes[i].DepartmentID, DD, catgRes[i].DepartmentName);
      }
      //console.log(results);
      // [
      //   { NAME: 'Daffy Duck', AGE: '24' },
      //   { NAME: 'Bugs Bunny', AGE: '22' }
      // ]
    });

  fs.createReadStream('../app_data/rsrinventory-keydlr-new.txt')
    .pipe(csv({ separator: ';', headers: rsr.invCSVColumns, quote: '\b' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
      for (var i = 0; i < 10; i++) {
        console.log(i, DD, results[i].RSRStockNumber, DD, results[i].ProductDescription);
      }
      //console.log(results);
      // [
      //   { NAME: 'Daffy Duck', AGE: '24' },
      //   { NAME: 'Bugs Bunny', AGE: '22' }
      // ]
    });
}
async function example() {
  const client = new ftp.Client()
  client.ftp.verbose = false
  try {
    await client.access({
      host: "rsrgroup.com",
      user: "***",
      password: "***"
      //secure: true
    });
    //console.log(await client.list());
    //await client.uploadFrom("README.md", "README_FTP.md")
    await client.downloadTo("../app_data/categories.txt", "/keydealer/categories.txt");
    await client.downloadTo("../app_data/rsrinventory-keydlr-new.txt", "/keydealer/rsrinventory-keydlr-new.txt");

  }
  catch (err) {
    console.log(err)
  }
  client.close()
}
