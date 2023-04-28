const https = require('https');
const crypto = require('crypto');
const axios = require('axios');

class Storage_Request {
    constructor() {}
  
    async getDID(token) {
        try {
            console.log("getDID");
            const did_request = await axios.get(
                "https://api.nft.storage/did", {
                headers: {
                    Authorization: token,
                },
            });
    
            return did_request.value;

        } catch (error) {
            console.error(`getDID: ${error.response.data}`);
            throw error;
        }
    }
  
    async fetchStorage(cid, token) {
        try {
            console.log("fetchStorage");
            const response = await axios.get(
                `https://api.nft.storage/${cid}`, {
                headers: {
                    Authorization: token,
                },
            });
        
            return response.data.value;
        } catch (error) {
            console.error(`fetchStorage: ${error.response.data}`);
            throw error;
        }
    }
  
    fetchAllAthletesIDs(directory) {
        var athlete_id_list = [];
        
        // loop through json to get each athlete/file name in directory
        for (let i = 0; i < directory.files.length; i++) {
            // add to array
            athlete_id_list.push(directory.files[i].name);
        }
      
        return athlete_id_list;
    }
  
    async fetchFile(directory, fileName, token) {
        let cid = directory.cid;
        try {
            console.log("fetchFile");
            const athlete_file = await axios.get(
                "https://" + cid + ".ipfs.nftstorage.link/" + fileName, {
                    headers: {
                        Authorization: token,
                    },
                }
            );
            
            return athlete_file;
        } catch (error) {
            console.error(`fetchFile: ${error.response.data}`);
            throw error;
        }
    }
  
    async fetchDesiredAthleteList(directory, token) {
        let cid = directory.cid;
        try {
            console.log("fetchDesiredAthleteList");
            return await await axios.get(
                "https://" + cid + ".ipfs.nftstorage.link/", {
                    headers: {
                        Authorization: token,
                    },
                }
            );
        } catch (error) {
            console.error(`fetchDesiredAthleteList: ${error.response.data}`);
            throw error;
        }
    }
  
    async uploadAndDelete(athleteJsons, old_directory, token, github_access_token, league) {
    
        const did = await this.getDID(token);
    
        // generate a random boundary string
        const boundary = crypto.randomBytes(16).toString('hex');
    
        // create the request payload
        var payload = `--${boundary}\r\n`;
        for (let i = 0; i < athleteJsons.length; i++) {
            // add Content-Disposition before each athlete with correct filename
            payload += `Content-Disposition: form-data; name="file"; filename="${athleteJsons[i].ID}"\r\n\r\n` +
            // attach the athlete
            `${JSON.stringify(athleteJsons[i])}\r\n`;
            // add a line if before the last athlete
            if (i < athleteJsons.length-1) {
                payload += `--${boundary}\r\n`
            } else {
                payload +=`--${boundary}--`;
            }
        }
    
        const options = {
        hostname: 'api.nft.storage',
        path: '/upload',
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Authorization': token,
            'x-agent-did': did,
            'Content-Length': Buffer.byteLength(payload)
        }
        };
    
        const req = https.request(options, res => {
            let responseData = '';
          
            res.on('data', chunk => {
              responseData += chunk;
            });
          
            res.on('end', async () => {
                const response = JSON.parse(responseData);
                
                if (response.ok) {
                    
                    // update sports-cids (if the write happened)
                    const org = 'AthleteX-DAO';
                    const repo = 'sports-cids';
                    const path = `${league}.json`;
                    const url = `https://api.github.com/repos/${org}/${repo}/contents/${path}`;

                    const new_directory_cid = response.value.cid;

                    // Fetch the current content of the file
                    const data = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${github_access_token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }).then(response => response.json());
                    
                    // Parse the content as base64 and decode it
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    // Parse the JSON
                    const json = JSON.parse(content);
                    // Update the directory property
                    json.directory = new_directory_cid;
                    // Encode the JSON as base64
                    const newContent = Buffer.from(JSON.stringify(json), 'utf-8').toString('base64');
                    // Commit the changes to the file
                    const updateResponse = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${github_access_token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        },
                        body: JSON.stringify({
                            message: 'Update directory in nfl.json',
                            content: newContent,
                            sha: data.sha
                        })
                    });

                    if (updateResponse.ok) {
                        if (old_directory != null) {
                            this.deleteFile(old_directory, token);
                        }
                    } else {
                        console.error('Failed to update file:', updateResponse.statusText);
                    }
                } else {
                    console.error('Upload failed:', response);
                }
            });
        });
    
        req.on('error', error => {
            console.error(error);
        });
        
        // write the payload to the request
        req.write(payload);
        req.end();
    }

    deleteFile(file, token) {
        fetch("https://api.nft.storage/" + file.cid, {
          method: 'DELETE',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .catch(error => {
          console.error(error);
        });
    }
}
  
module.exports = Storage_Request;

