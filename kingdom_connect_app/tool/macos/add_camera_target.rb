# Adds the KingdomConnect camera (a CoreMedia IO camera extension, macos/KingdomConnectCamera) to the macOS Xcode project
# and embeds it in the app. Run once (it refuses to run twice):
#   gem install xcodeproj && ruby tool/macos/add_camera_target.rb
require "xcodeproj"

root = File.expand_path("../..", __dir__)
project_path = File.join(root, "macos", "Runner.xcodeproj")
project = Xcodeproj::Project.open(project_path)
abort "The camera target is already in the project." if project.targets.any? { |t| t.name == "KingdomConnectCamera" }
runner = project.targets.find { |t| t.name == "Runner" } or abort "No Runner target"

# files
group = project.main_group.new_group("KingdomConnectCamera", "KingdomConnectCamera")
sources = %w[main.swift CameraProvider.swift].map { |f| group.new_file(f) }
%w[Info.plist KingdomConnectCamera.entitlements LICENSE-cameraextension-MIT.txt].each { |f| group.new_file(f) }
camera_xcconfig = project.main_group.find_subpath("Runner/Configs", false).new_file("Camera.xcconfig")

# the target: a system extension (xcodeproj has no name for this product type, so it is set by hand)
target = project.new_target(:app_extension, "KingdomConnectCamera", :osx, "12.3")
target.product_type = "com.apple.product-type.system-extension"
product = target.product_reference
product.explicit_file_type = "wrapper.system-extension"
product.path = "org.kingdomconnect.kingdomConnect.Camera.systemextension"
product.name = "KingdomConnectCamera.systemextension"
target.add_file_references(sources)
target.build_configurations.each do |config|
  config.base_configuration_reference = camera_xcconfig
  s = config.build_settings
  s["PRODUCT_NAME"] = "org.kingdomconnect.kingdomConnect.Camera"
  s["PRODUCT_BUNDLE_IDENTIFIER"] = "org.kingdomconnect.kingdomConnect.Camera"
  s["INFOPLIST_FILE"] = "KingdomConnectCamera/Info.plist"
  s["CODE_SIGN_ENTITLEMENTS"] = "KingdomConnectCamera/KingdomConnectCamera.entitlements"
  s["MACOSX_DEPLOYMENT_TARGET"] = "12.3"
  s["SWIFT_VERSION"] = "5.0"
  s["SKIP_INSTALL"] = "YES"
  s["ENABLE_HARDENED_RUNTIME"] = "YES"
  s["MARKETING_VERSION"] = "$(FLUTTER_BUILD_NAME)"
  s["CURRENT_PROJECT_VERSION"] = "$(FLUTTER_BUILD_NUMBER)"
  s["LD_RUNPATH_SEARCH_PATHS"] = ["$(inherited)", "@executable_path/../Frameworks", "@executable_path/../../../../Frameworks"]
  s.delete("INFOPLIST_KEY_NSHumanReadableCopyright")
end
%w[CoreMediaIO IOKit].each { |f| target.add_system_framework(f) }

# the app embeds it in Contents/Library/SystemExtensions and is built after it
runner.add_dependency(target)
embed = runner.new_copy_files_build_phase("Embed System Extensions")
embed.dst_subfolder_spec = Xcodeproj::Constants::COPY_FILES_BUILD_PHASE_DESTINATIONS[:products_directory]   # as Xcode does for system extensions
embed.dst_path = "$(SYSTEM_EXTENSIONS_FOLDER_PATH)"
file = embed.add_file_reference(product)
file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }
%w[SystemExtensions CoreMediaIO Accelerate].each { |f| runner.add_system_framework(f) }
runner.add_file_references([project.main_group.find_subpath("Runner", false).new_file("CameraBridge.swift")])

# the app's entitlements come from the xcconfig, so a signing file can switch on the camera's (see Signing.xcconfig.example)
runner.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = "$(KC_ENTITLEMENTS_$(CONFIGURATION))"
end

project.save
puts "Added KingdomConnectCamera to #{project_path}"
