import os = require('os');
import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');
import { ToolRunner } from 'vsts-task-lib/toolrunner';

import MobileProvision from './MobileProvision';
import MobileProvisionReader, { MobileProvisionReaderOptions } from './MobileProvisionReader';

class UserCredentials {
    username: string;
    password: string;
    appSpecificPassword: string;
    fastlaneSession: string;
}

async function main(): Promise<void> {
    const appSpecificPasswordEnvVar: string = 'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD';
    const fastlaneSessionEnvVar: string = 'FASTLANE_SESSION';
    let isTwoFactorAuthEnabled: boolean = false;

    try {
        tl.setResourcePath(tl.resolve(__dirname, 'task.json'));

        // Check if this is running on Mac and fail the task if not
        if (process.platform !== 'darwin') {
            throw new Error('The Apple App Store Release task can only run on a Mac computer.');
        }

        // Get input variables
        let authType: string = tl.getInput('authType', true);
        let credentials: UserCredentials = new UserCredentials();
        
        if (authType === 'ServiceEndpoint') {
            let serviceEndpoint: tl.EndpointAuthorization = tl.getEndpointAuthorization(tl.getInput('serviceEndpoint', true), false);
            credentials.username = serviceEndpoint.parameters['username'];
            credentials.password = serviceEndpoint.parameters['password'];
            
            credentials.appSpecificPassword = serviceEndpoint.parameters['appSpecificPassword'];
            if (credentials.appSpecificPassword) {
                isTwoFactorAuthEnabled = true;
                
                let fastlaneSession: string = serviceEndpoint.parameters['fastlaneSession'];
                if (!fastlaneSession) {
                    throw Error('\'Fastlane Session\' is not set in the service endpoint configured for two-step verification.');
                }
                credentials.fastlaneSession = fastlaneSession;
            }
        } else if (authType === 'UserAndPass') {
            credentials.username = tl.getInput('username', true);
            credentials.password = tl.getInput('password', true);
            
            isTwoFactorAuthEnabled = tl.getBoolInput('isTwoFactorAuth');
            if (isTwoFactorAuthEnabled) {
                credentials.appSpecificPassword = tl.getInput('appSpecificPassword', true);
                credentials.fastlaneSession = tl.getInput('fastlaneSession', true);
            }
        }

        let installFastlane: boolean = tl.getBoolInput('installFastlane', false);
        let fastlaneVersionChoice: string = tl.getInput('fastlaneToolsVersion', false);
        let fastlaneVersionToInstall: string; // defaults to 'LatestVersion'
        if (fastlaneVersionChoice === 'SpecificVersion') {
            fastlaneVersionToInstall = tl.getInput('fastlaneToolsSpecificVersion', true);
        }

        let fastlaneCleanup: boolean = tl.getBoolInput('fastlaneCleanup', false);

        // Set up environment
        process.env['FASTLANE_PASSWORD'] = credentials.password;
        process.env['FASTLANE_DONT_STORE_PASSWORD'] = 'true';
        process.env['FASTLANE_DISABLE_COLORS'] = 'true';
        
        if (isTwoFactorAuthEnabled) {
            // Properties required for two-factor authentication:
            // 1) Account username and password
            // 2) App-specific password (Apple account->Security where two factor authentication is set)
            // 3) FASTLANE_SESSION, which is essentially a cookie granting access to Apple accounts
            // To get a FASTLANE_SESSION, run 'fastlane spaceauth -u [email]' interactively (requires PIN)
            // See: https://github.com/fastlane/fastlane/blob/master/spaceship/README.md
            tl.debug('Using two-factor authentication');
            process.env[fastlaneSessionEnvVar] = credentials.fastlaneSession;
            process.env[appSpecificPasswordEnvVar] = credentials.appSpecificPassword;
        }

        // Install the ruby gem for fastlane
        tl.debug('Checking for ruby install...');
        tl.which('ruby', true);

        // Whenever a specific version of fastlane is requested, we're going to uninstall all installed
        // versions of fastlane beforehand.  Note that this doesn't uninstall dependencies of fastlane.
        if (installFastlane && fastlaneVersionToInstall || fastlaneCleanup) {
            let gemRunner: ToolRunner = tl.tool('gem');
            gemRunner.arg(['uninstall', 'fastlane']);

            tl.debug(`Uninstalling all fastlane versions...`);
            gemRunner.arg(['-a', '-I']);  // uninstall all versions
            
            await gemRunner.exec();
        }
        
        // If desired, install the fastlane tools (if they're already present, should be a no-op)
        if (installFastlane) {
            tl.debug('Installing fastlane...');
            
            let gemRunner: ToolRunner = tl.tool('gem');
            gemRunner.arg(['install', 'fastlane']);
            
            if (fastlaneVersionToInstall) {
                tl.debug(`Installing specific version of fastlane: ${fastlaneVersionToInstall}`);
                gemRunner.arg(['-v', fastlaneVersionToInstall]);
            }

            let noDocument: boolean = tl.getBoolInput('noDocument', false);
            gemRunner.argIf(noDocument, ['-N']);
            
            await gemRunner.exec();
        } else {
            tl.debug('Skipped fastlane installation.');
        }

        let storagePath: string = tl.getInput('storagePath', false);
        if (!storagePath) storagePath = tl.getVariable('System.DefaultWorkingDirectory');
        if (!tl.exist(storagePath)) tl.mkdirP(storagePath);
        
        // Download and install provisioning profile
        let sigh: ToolRunner = tl.tool('fastlane');
        sigh.arg(['sigh', '--readonly', '-o', storagePath]);
        sigh.arg(['-u', credentials.username]);

        let bundleIdentifier: string = tl.getInput('appIdentifier', true);
        sigh.arg(['-a', bundleIdentifier]);

        let profileType: string = tl.getInput('profileType', false);
        sigh.argIf(profileType === 'development', ['--development']);
        sigh.argIf(profileType === 'adHoc', ['--adhoc']);

        let profileName: string = tl.getInput('profileName', false);
        sigh.argIf(profileName, ['-n', profileName, '-q', `${profileName}.mobileprovision`]);
        
        let teamId: string = tl.getInput('teamId', false);
        sigh.argIf(teamId, ['-b', teamId]);

        let teamName: string = tl.getInput('teamName', false);
        sigh.argIf(teamName, ['-l', teamName]);

        let verboseFastlane: boolean = tl.getBoolInput('verboseFastlane', false);
        sigh.argIf(verboseFastlane, ['--verbose']);

        let fastlaneArguments: string[] = tl.getDelimitedInput('fastlaneArguments', os.EOL).join(' ').split(' ');
        sigh.argIf(fastlaneArguments, fastlaneArguments);

        await sigh.exec();

        let uuidVariable: string = tl.getInput('uuidVariable', false);
        if (uuidVariable) {
            let variable: tl.VariableInfo = tl.getVariables().find(taskVar => taskVar.value === uuidVariable);
            if (variable) uuidVariable = variable.name;
            
            let match = uuidVariable.match(RegExp('\\$\\((.+)\\)'));
            if (match) uuidVariable = match[1];
            
            let provisionReaderOptions: MobileProvisionReaderOptions = new MobileProvisionReaderOptions();
            provisionReaderOptions.storagePath = storagePath;
            
            let provisionReader: MobileProvisionReader = new MobileProvisionReader(provisionReaderOptions);
            let provision: MobileProvision = provisionReader.getProvisionByAppId(bundleIdentifier, tl.getInput('provisionSelector', false));
            
            tl.setVariable(uuidVariable, provision.UUID);
            console.log(`Provisioning Profile UUID Variable: $(${uuidVariable}) = ${provision.UUID}`);
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        if (isTwoFactorAuthEnabled) {
            tl.debug('Clearing two-factor authentication environment variables');
            process.env[fastlaneSessionEnvVar] = '';
            process.env[appSpecificPasswordEnvVar] = '';
        }
    }
}

process.on('warning', (warn: any) => tl.warning(warn));
process.on('uncaughtException', (err: Error) => tl.error(`Task Uncaught Exception: ${err}`));

main();