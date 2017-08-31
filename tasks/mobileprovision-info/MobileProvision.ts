export default class MobileProvision {
    AppIDName: string = null;
    ApplicationIdentifierPrefix: string[] = [];
    CreationDate: Date = null;
    DeveloperCertificates: string[] = [];
    Entitlements: {
        'keychain-access-groups': string[];
        'get-task-allow': boolean;
        'application-identifier': string;
        'com.apple.developer.team-identifier': string;
    } = {
        'keychain-access-groups': [],
        'get-task-allow': null,
        'application-identifier': null,
        'com.apple.developer.team-identifier': null
    };
    ExpirationDate: Date = null;
    IsXcodeManaged: boolean = null;
    Name: string = null;
    Platform: string[] = [];
    ProvisionedDevices: string[] = [];
    TeamIdentifier: string[] = [];
    TeamName: string = null;
    TimeToLive: number = null;
    UUID: string = null;
    Version: number = null;
}