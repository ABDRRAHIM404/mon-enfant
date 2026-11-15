const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "..")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
// Shared modules are pure domain code. Keep hierarchical lookup for Expo’s nested native dependencies.
config.resolver.disableHierarchicalLookup = false;
module.exports = config;
