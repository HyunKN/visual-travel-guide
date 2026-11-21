Pod::Spec.new do |s|
  s.name = 'NubiIOSRecognition'
  s.version = '1.0.0'
  s.summary = 'Nubi on-device photo recognition'
  s.homepage = 'https://github.com/HyunKN/visual-travel-guide'
  s.license = { :type => 'MIT' }
  s.author = 'Visual Travel Guide'
  s.source = { :git => 'https://github.com/HyunKN/visual-travel-guide.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.source_files = '*.{h,m,swift}'
  s.dependency 'ExpoModulesCore'
  if ENV['NUBI_IOS_COREML_BENCHMARK'] == '1'
    s.source_files = '*.swift'
    s.frameworks = 'CoreML'
    s.pod_target_xcconfig = {
      'DEFINES_MODULE' => 'YES',
      'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => '$(inherited) NUBI_COREML_BENCHMARK'
    }
  else
    s.public_header_files = 'NubiORTSession.h'
    s.dependency 'onnxruntime-objc', '1.24.3'
    s.pod_target_xcconfig = {
      'DEFINES_MODULE' => 'YES',
      'HEADER_SEARCH_PATHS' => '$(inherited) "${PODS_ROOT}/onnxruntime-objc/objectivec/include"'
    }
  end
end
