const { createClient, AuthType } = require("webdav");


/* misc constants needed for import / update processing */
const importOptions = {
    webdav_host: "https://sportsmans-finest.mybigcommerce.com",
    webdav_options: {
        authType: AuthType.Digest,
        username: "mark.mckenzie@herodigital.com",
        password: "***"
    }
}

exports.importOptions = importOptions;
