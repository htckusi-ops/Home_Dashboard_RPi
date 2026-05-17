module.exports = {
    uiPort: process.env.PORT || 1880,

    mqttReconnectTime: 15000,
    serialReconnectTime: 15000,

    debugMaxLength: 1000,

    flowFile: 'flows.json',
    flowFilePretty: true,

    credentialSecret: process.env.NR_CREDENTIAL_SECRET || 'change-me-in-production',

    httpAdminRoot: '/red',
    httpNodeRoot: '/api',

    ui: { path: 'ui' },

    adminAuth: process.env.NR_ADMIN_PASSWORD
        ? {
              type: 'credentials',
              users: [
                  {
                      username: 'admin',
                      password: process.env.NR_ADMIN_PASSWORD,
                      permissions: '*',
                  },
              ],
          }
        : null,

    logging: {
        console: {
            level: 'info',
            metrics: false,
            audit: false,
        },
    },

    exportGlobalContextKeys: false,

    editorTheme: {
        tours: false,
        palette: {
            allowInstall: true,
            editable: true,
        },
    },

    functionGlobalContext: {},

    functionExternalModules: true,

    debugUseColors: true,

    contextStorage: {
        default: { module: 'memory' },
        file: { module: 'localfilesystem' },
    },
}
