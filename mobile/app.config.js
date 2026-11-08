module.exports = ({ config }) => {
  return { ...config, plugins: [...config.plugins, 'expo-location', './plugins/withWindowsObjectPaths.cjs', '@maplibre/maplibre-react-native'] };
};
