import CoreText
import SwiftUI
import UIKit

enum YoohooColor {
    static let blue = Color(red: 42 / 255, green: 117 / 255, blue: 238 / 255)
    static let ice = Color(red: 130 / 255, green: 196 / 255, blue: 249 / 255)
    static let ink = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255)
}

enum YoohooFont {
    static func title(_ size: CGFloat) -> Font {
        .custom("Bakbak One", size: size)
    }

    static func medium(_ size: CGFloat) -> Font {
        .custom("PingFangSC-Medium", size: size)
    }

    static func registerBundledFonts() {
        let names = ["ADLaMDisplay-Regular", "BakbakOne-Regular", "SpaceGrotesk-Medium"]
        for name in names {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else { continue }
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}

struct YoohooToast: View {
    var text: String
    var spinning: Bool

    var body: some View {
        HStack(spacing: 8) {
            if spinning {
                ProgressView().controlSize(.small).tint(YoohooColor.blue)
            }
            Text(text)
                .font(YoohooFont.medium(14))
                .foregroundStyle(YoohooColor.ink)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color.white.opacity(0.96)))
        .overlay(Capsule().stroke(YoohooColor.ice, lineWidth: 1))
        .padding(.horizontal, 28)
        .padding(.top, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .allowsHitTesting(false)
    }
}

struct SnowButton: View {
    var title: String
    var enabled: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Image(enabled ? "ButtonBlue" : "ButtonGray")
                    .resizable()
                    .frame(width: 306, height: 64)
                Text(title)
                    .font(YoohooFont.title(22))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .offset(y: 6)
            }
            .frame(width: 306, height: 64)
        }
        .buttonStyle(PressDownStyle())
        .disabled(!enabled)
    }
}

struct PressDownStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
