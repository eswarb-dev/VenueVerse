const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native') {
    return context.resolveRequest(context, 'react-native-web', platform);
  }

  if (
    platform === 'web' &&
    moduleName === '../Utilities/Platform' &&
    context.originModulePath?.includes(`${path.sep}react-native${path.sep}Libraries${path.sep}`)
  ) {
    return context.resolveRequest(
      context,
      'react-native-web/dist/exports/Platform',
      platform
    );
  }

  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.resolve(__dirname, 'src', moduleName.slice(2)),
      platform
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
