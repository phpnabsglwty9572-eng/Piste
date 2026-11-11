import SwiftUI

@main
struct YoohooApp: App {
    @StateObject private var navigator = AppNavigator()
    @StateObject private var session = YoohooSession()

    init() {
        YoohooFont.registerBundledFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(navigator)
                .environmentObject(session)
                .preferredColorScheme(.light)
        }
    }
}
