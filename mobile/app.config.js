// The key is embedded only for native Android builds. Restrict it to the
// Android package, signing certificate and Maps SDK in Google Cloud.
module.exports = ({ config }) => {
  const key = process.env.VTG_ANDROID_MAPS_KEY;
  return { ...config, plugins: [...config.plugins, 'expo-location', './plugins/withWindowsObjectPaths.cjs', ...(key ? [['react-native-maps',{androidGoogleMapsApiKey:key}]] : [])],
    extra: {...config.extra, androidMapsConfigured: Boolean(key)} };
};
