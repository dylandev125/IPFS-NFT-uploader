require("dotenv").config();
const fs = require("fs");
const path = require('path');
const Uploader = require("./fileuploader.js");
const axios = require("axios");
const formData = require("form-data");
const recursive = require('recursive-fs');
const basePathConverter = require('base-path-converter');

const pinFileToIPFS = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
const hashlist = [];

const uploadAssets = async (path) => {

  try {
    let data = new formData();
    data.append("file", fs.createReadStream(`${path}`));
    const res = await axios.post(pinFileToIPFS, data, {
      maxContentLength: "Infinity",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
      },
    });

    return res.data.IpfsHash;
  } catch(error) {
    console.error(error);
    throw error;
  }
}

const pinDirectoryToIPFS = (src) => {
  let metadataHash;
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  //we gather the files from a local directory in this example, but a valid readStream is all that's needed for each file in the directory.
  recursive.readdirr(src, function (err, dirs, files) {
      let data = new formData();
      files.forEach((file) => {
          //for each file stream, we need to include the correct relative file path
          data.append(`file`, fs.createReadStream(file), {
              filepath: basePathConverter(src, file)
          });
      });

      const metadata = JSON.stringify({
          name: 'metadata',
          keyvalues: {
              exampleKey: 'exampleValue'
          }
      });
      data.append('pinataMetadata', metadata);

      return axios
          .post(url, data, {
              maxBodyLength: 'Infinity', //this is needed to prevent axios from erroring out with large directories
              headers: {
                  'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                  pinata_api_key: process.env.PINATA_API_KEY,
                  pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
              }
          })
          .then(function (response) {
              //handle response here
            console.log("Metadata Hash:", response.data.IpfsHash)
          })
          .catch(function (error) {
              //handle error here
          });
  });
  return metadataHash;
}

class App {

  constructor() {
    this.ipfs = new Uploader();
    this.workDir = "./files/inputGIF/";
    this.metadataDir = "./files/inputMetadata/";
    this.workDirOutputIPFS = this.workDir + "outputIPFS/";
    this.workDirOutputMetadata = "files/outputMetadata/";
  }


  async uploadFiles() {
    try {
      //get files from dir excluding hidden files
      const files = this.getFilesFromDir(this.workDir);
      //Upload files to ipfs and save output to file

      const result = await this.uploadAndSave(this.workDir, files);

    } catch(error) {
      console.error(error);
      process.exit(1);
    }
  }

  async generateMetadata() {

    const files = this.getFilesFromDir(this.workDirOutputIPFS);
    for(let file of files) {
      const data = JSON.parse(fs.readFileSync(this.workDirOutputIPFS + file, "utf8"));
      var obj = {};
      obj.name = "Change Name";
      obj.serie = "#x/y";
      obj.displayName = "Change Name #x/y";
      obj.description ="description";
      obj.image = "https://ipfs.io/ipfs/" + data.IpfsHash;
      obj.ipfsHash = data.IpfsHash;
      obj.external_url = "url to see the image";
      obj.autor = "Autor name / nick";
      obj.autorEOA = "Ethereum EOA address";
      obj.autorHashSignature = "Autor sign ipfsHash";
      obj.chainId = "1";
      obj.ERC721Address = "";
      const filename = "_" + data.filename.replace(/\.[^/.]+$/, "") + ".json";
      fs.writeFileSync(this.workDirOutputMetadata + filename, JSON.stringify(obj));
    }
    console.log("Please add information to each metadata file then run with --mode=1");
  }

  getFilesFromDir(wDir) {
    let filespath = new Array();
    fs.readdirSync(wDir).forEach(file => {
      if (!fs.lstatSync(path.resolve(wDir, file)).isDirectory()) {
        if(! /^\..*/.test(file)) {
          filespath.push(file);
        }
      }
    });

    return filespath;
  }

  async uploadAndSave(workDir, files) {
    let result = new Array();
    for(let file of files) {
      let res = await uploadAssets(workDir + file);
      console.log("Uploaded", file)
      file = file.replace(/\.[^/.]+$/, "") + ".json";
      const data = JSON.parse(fs.readFileSync(this.metadataDir + file, "utf8"));
      data.image = "https://ipfs.io/ipfs/" + res;

      fs.writeFileSync(this.workDirOutputMetadata + file, JSON.stringify(data));
      console.log("Generated new metadata:", file)
      result.push(res);

    }

    return result;
  }
  async uploadMetadata() {
    //Upload files to ipfs and save output to file

    const files = this.getFilesFromDir(this.workDirOutputMetadata);
    for(let file of files) {
      console.log(this.workDirOutputMetadata + file)
      let res = await uploadAssets(this.workDirOutputMetadata + file);
      hashlist.push(res)
    }

    console.log(hashlist)
    //console.log("Uploading final metadata folder");
    //const result = await pinDirectoryToIPFS(this.workDirOutputMetadata)
  }
}

module.exports = App;
