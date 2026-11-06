const {withAppBuildGradle}=require('expo/config-plugins');
const marker='// VTG: bound Windows Ninja object paths';
function patch(contents) {
  if(contents.includes(marker))return contents;
  const target='defaultConfig {';
  if(contents.split(target).length!==2)throw new Error('Review Android defaultConfig before applying Windows CMake limit');
  return contents.replace(target,target+`
        ${marker}
        externalNativeBuild {
            cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }
        }
  `);
}
module.exports=config=>{
  if(process.platform!=='win32')return config;
  return withAppBuildGradle(config,result=>{
    if(result.modResults.language!=='groovy')throw new Error('Windows object path plugin expects Groovy');
    result.modResults.contents=patch(result.modResults.contents);
    return result;
  });
};
module.exports.patch=patch;
