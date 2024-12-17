const http = require('http');
const { exec } = require('child_process');

const mainServer = 'http://localhost:8081';
let backupServerProcess = null;

setInterval(() => {
    http.get(mainServer, (response) => {
        console.log('main server is up');
        
    }).on('error', (err) => {
        console.log('main server is down');
        if (!backupServerProcess) {
            backupServerProcess = exec('node server.js 8082', (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log('Backup server started on port 8082');
                console.log(stdout);
            });
        }
    });
}, 3000);

// curl -I http://localhost:8081