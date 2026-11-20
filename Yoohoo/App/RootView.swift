import SwiftUI

struct RootView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        ZStack {
            HybridHostView()
                .ignoresSafeArea()
            if session.h5Ready == false {
                SplashView()
            }
            if session.busy, session.blocksInput {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture {
                        session.dismissWait()
                    }
            }
            if let toast = session.toast {
                YoohooToast(text: toast, spinning: session.toastSpinning)
                    .transition(session.toastSpinning
                        ? .opacity.combined(with: .scale(scale: 0.92))
                        : .move(edge: .top).combined(with: .opacity))
                    .id((session.toastSpinning ? "wait-" : "tip-") + toast)
            }
        }
        .animation(.easeInOut(duration: 0.28), value: nav.stage)
        .animation(.spring(response: 0.28, dampingFraction: 0.86), value: session.toast)
        .sheet(item: $nav.sheet) { _ in
            EULAView()
        }
    }
}
