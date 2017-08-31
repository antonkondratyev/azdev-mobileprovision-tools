import os = require('os');
import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');

import MobileProvision from './MobileProvision';
import MobileProvisionReader from './MobileProvisionReader';

tl.setResourcePath(tl.resolve(__dirname, 'task.json'));

async function main(): Promise<void> {
    try {
        let provision: MobileProvision;
        let provisionReader: MobileProvisionReader = new MobileProvisionReader();

        let provisionMethod: string = tl.getInput('provisionMethod', false);
        if (provisionMethod === 'uuid') {
            let provisionUuid: string = tl.getInput('provProfileUuid', false);
            provision = provisionReader.getProvisionByUuid(provisionUuid);
        } else if (provisionMethod === 'file') {
            let provisionPath: string = tl.getPathInput('provProfilePath', false, true);
            provision = provisionReader.getProvisionByFile(provisionPath);
        }

        let printProvisionedDevices: boolean = tl.getBoolInput('printProvisionedDevices', false);
        if (printProvisionedDevices) {
            let provisionedDevicesList: string = provision.ProvisionedDevices.join(os.EOL);
            console.log(`Provisioned Devices:\n${provisionedDevicesList}\n`);

            let provisionedDevicesExportFile: string = tl.resolve(tl.getPathInput('provisionedDevicesExportFile', false, false));
            if (provisionedDevicesExportFile !== null && !tl.exist(provisionedDevicesExportFile)) {
                tl.mkdirP(path.dirname(provisionedDevicesExportFile));
                tl.writeFile(provisionedDevicesExportFile, provisionedDevicesList);
                console.log(`\nProvisioned Devices were saved in the ${provisionedDevicesExportFile}`);
            }
        }
    } catch (err) {
        tl.error(err);
    }
}

process.on('warning', (warn: any) => tl.warning(warn));
process.on('uncaughtException', (err: Error) => tl.error(`Task Uncaught Exception: ${err}`));

main();