import SwiftUI

struct RootView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        ZStack {
            switch nav.stage {
            case .splash:
                SplashView()
            case .hybrid:
                HybridHostView()
                    .ignoresSafeArea()
            }
            if session.busy, session.blocksInput {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
            }
            if let toast = session.toast {
                YoohooToast(text: toast, spinning: session.toastSpinning)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.28), value: nav.stage)
        .animation(.spring(response: 0.28, dampingFraction: 0.86), value: session.toast)
        .sheet(item: $nav.sheet) { _ in
            EULAView()
        }
    }
}
