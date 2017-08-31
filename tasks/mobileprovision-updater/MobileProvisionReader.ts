import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import MobileProvision from './MobileProvision';
const plist = require('plist');

export class MobileProvisionReaderOptions {
    storagePath?: string;
}

export default class MobileProvisionReader {
    private readonly _provisioningFolder: string = `${process.env.HOME}/Library/MobileDevice/Provisioning Profiles/`;

    constructor(options?: MobileProvisionReaderOptions) {
        if (options) {
            if (options.storagePath) this._provisioningFolder = options.storagePath;
        }
    }

    public getProvisionByAppId(appId: string, selector?: string): MobileProvision {
        if (appId === null) throw new Error('The Provisioning Profile "application-identifier" is not defined.');

        let provisioningList: MobileProvision[] = fs.readdirSync(this._provisioningFolder)
            .filter(file => path.extname(file) === '.mobileprovision')
            .map(file => this.getProvisionByFile(path.join(this._provisioningFolder, file)));
        
        let findedProfiles: MobileProvision[] = provisioningList.filter(p => p.Entitlements['application-identifier'].match(RegExp(appId.replace('*', '\\*'))));
        if (findedProfiles.length === 1) {
            return findedProfiles.pop();
        } else if (findedProfiles.length > 1) {
            findedProfiles.sort((first, second) => {
                if (first.CreationDate < second.CreationDate) return -1;
                if (first.CreationDate === second.CreationDate) return 0;
                if (first.CreationDate > second.CreationDate) return 1;
            });

            console.log(`Finded ${findedProfiles.length} mobileprovisioning profiles:`);
            findedProfiles.forEach(p => console.log(`${p.UUID} | ${new Date(p.CreationDate)} -> ${new Date(p.ExpirationDate)}`));

            if (selector) {
                switch (selector) {
                    case 'single':
                        throw new Error('Selected "single" provision but finded more one provisions.');
                    
                    case 'first':
                        return findedProfiles[0];
                    
                    case 'latest':
                        return findedProfiles.pop();
                    
                    default:
                }
            }
            return findedProfiles.pop();
        } else {
            throw new Error('No installed any mobileprovisioning profiles.');
        }
    }
    
    public getProvisionByFile(path: string): MobileProvision {
        if (path === null) throw new Error('The Provisioning Profile path is not defined.');
        
        return this.getProvisionBy(path);
    }

    public getProvisionByUuid(uuid: string): MobileProvision {
        if (uuid === null) throw new Error('The Provisioning Profile UUID is not defined.');
        
        return this.getProvisionBy(uuid);
    }

    private getProvisionBy(uuidOrFile: string): MobileProvision {
        let provisionReader: tr.ToolRunner = tl.tool('security');
        provisionReader.arg(['cms', '-D', '-i', this.isUuid(uuidOrFile)
            ? path.join(this._provisioningFolder, `${uuidOrFile}.mobileprovision`)
            : uuidOrFile
        ]);

        return plist.parse(provisionReader.execSync({ silent: true } as tr.IExecSyncOptions).stdout);
    }

    private isUuid(str: string): boolean {
        return RegExp('^[a-fA-Z0-9]{8}-[a-fA-Z0-9]{4}-[a-fA-Z0-9]{4}-[a-fA-Z0-9]{4}-[a-fA-Z0-9]{12}$').test(str);
    }
}