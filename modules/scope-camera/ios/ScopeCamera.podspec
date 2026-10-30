Pod::Spec.new do |s|
  s.name           = 'ScopeCamera'
  s.version        = '1.0.0'
  s.summary        = "SCOPE's camera with on-device product detection"
  s.description    = 'AVFoundation camera that finds salient objects with Apple Vision.'
  s.author         = 'SCOPE'
  s.homepage       = 'https://github.com/cettocdx/scope'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'AVFoundation', 'Vision'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files   = '**/*.{h,m,swift}'
end
