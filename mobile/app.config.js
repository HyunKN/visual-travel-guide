module.exports = ({ config }) => {
  return { ...config, plugins: [...config.plugins, 'expo-location', 'expo-web-browser', './plugins/withWindowsObjectPaths.cjs', '@maplibre/maplibre-react-native'] };
};
