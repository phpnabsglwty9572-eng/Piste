import SwiftUI

struct SplashView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        GeometryReader { geo in
            let board = min(667, geo.size.height)
            let boardTop = (geo.size.height - board) / 2
            ZStack {
                Color(red: 0.847, green: 0.941, blue: 0.988)
                Color.clear
                    .frame(width: geo.size.width, height: geo.size.height)
                    .overlay(AuthSkyFill())
                    .clipped()
                AuthLogoMark()
                    .position(x: geo.size.width / 2, y: boardTop + 244 + 32.5)
            }
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .allowsHitTesting(false)
    }
}

struct AuthSkyFill: View {
    var body: some View {
        Image("AuthSky")
            .resizable()
            .scaledToFill()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
    }
}

struct AuthLogoMark: View {
    var body: some View {
        Image("AuthLogo")
            .resizable()
            .scaledToFill()
            .frame(width: 65, height: 65)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(Color.black, lineWidth: 1)
            )
    }
}

struct EULAView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var bodyText = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("USER AGREEMENT")
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                    .frame(maxWidth: .infinity)
                ScrollView {
                    Text(bodyText)
                        .font(YoohooFont.medium(14))
                        .foregroundStyle(YoohooColor.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                SnowButton(title: "Agree", enabled: true) {
                    session.acceptEULA()
                    nav.sheet = nil
                    let next = EULAGate.shared.next
                    EULAGate.shared.next = nil
                    next?()
                }
                .frame(maxWidth: .infinity)
            }
            .padding(20)
            .background(Color.white)
            .navigationBarHidden(true)
        }
        .onAppear { bodyText = bundledText("EULA") }
    }
}

func bundledText(_ name: String) -> String {
    let url = Bundle.main.url(forResource: name, withExtension: "txt", subdirectory: "Resources")
        ?? Bundle.main.url(forResource: name, withExtension: "txt")
    guard let url, let text = try? String(contentsOf: url, encoding: .utf8) else { return "" }
    return text
}
