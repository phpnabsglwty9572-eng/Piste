import CoreText
import SwiftUI
import UIKit

enum YoohooColor {
    static let blue = Color(red: 42 / 255, green: 117 / 255, blue: 238 / 255)
    static let yellow = Color(red: 255 / 255, green: 228 / 255, blue: 18 / 255)
    static let pink = Color(red: 1, green: 0, blue: 178 / 255)
    static let ice = Color(red: 130 / 255, green: 196 / 255, blue: 249 / 255)
    static let ink = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255)
    static let gray = Color(red: 128 / 255, green: 128 / 255, blue: 128 / 255)
    static let titleShadow = Color(red: 0, green: 70 / 255, blue: 184 / 255)
}

enum YoohooFont {
    static func display(_ size: CGFloat) -> Font {
        .custom("ADLaM Display", size: size)
    }

    static func title(_ size: CGFloat) -> Font {
        .custom("Bakbak One", size: size)
    }

    static func body(_ size: CGFloat) -> Font {
        .custom("Space Grotesk", size: size).weight(.medium)
    }

    static func heavy(_ size: CGFloat) -> Font {
        .custom("PingFangSC-Semibold", size: size)
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

struct DesignBoard<Content: View>: View {
    var height: CGFloat
    var fill: Color = .white
    @ViewBuilder var content: () -> Content

    var body: some View {
        GeometryReader { geo in
            let scale = geo.size.width / 375
            ZStack(alignment: .top) {
                fill
                content()
                    .frame(width: 375, height: height, alignment: .topLeading)
                    .scaleEffect(scale, anchor: .top)
                    .frame(width: geo.size.width, height: height * scale, alignment: .top)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .top)
        }
        .background(fill.ignoresSafeArea())
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }
}

struct BoardItem<Content: View>: View {
    var x: CGFloat
    var y: CGFloat
    var width: CGFloat
    var height: CGFloat
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .frame(width: width, height: height, alignment: .topLeading)
            .offset(x: x, y: y)
    }
}

struct SoftFloat: ViewModifier {
    var amount: CGFloat = 3
    @State private var lifted = false

    func body(content: Content) -> some View {
        content
            .offset(y: lifted ? -amount : amount)
            .animation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true), value: lifted)
            .onAppear { lifted = true }
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

struct SnowEdge: View {
    var body: some View {
        Image("SnowEdge")
            .resizable()
            .frame(width: 375 * 1.1132, height: 19 * 11.1111)
            .offset(x: 375 * -0.0445, y: 19 * -4.5185)
            .frame(width: 375, height: 19, alignment: .topLeading)
            .clipped()
    }
}

struct HeaderSky: View {
    var height: CGFloat = 177

    var body: some View {
        GeometryReader { geo in
            Image("HeaderSky")
                .resizable()
                .scaledToFill()
                .frame(width: geo.size.width, height: height, alignment: .top)
                .clipped()
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
    }
}

struct FieldMark: View {
    var body: some View {
        Image("FieldBell")
            .resizable()
            .scaledToFit()
            .frame(width: 24, height: 24)
    }
}

struct SnowBottomSheet<Leading: View, Content: View>: View {
    var title: String
    var close: () -> Void
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 46)
            VStack(spacing: 16) {
                ZStack {
                    Text(title)
                        .font(YoohooFont.title(20))
                        .foregroundStyle(YoohooColor.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    HStack(spacing: 8) {
                        leading()
                        Spacer(minLength: 0)
                        Button(action: close) {
                            Image("CloseBadge").resizable().frame(width: 28, height: 28)
                        }
                        .buttonStyle(PressDownStyle())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                content()
            }
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
            .background(
                Color.white
                    .overlay(Rectangle().stroke(YoohooColor.yellow, lineWidth: 1))
            )
        }
        .overlay(alignment: .top) {
            Image("SnowSheet")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 82)
                .clipped()
                .allowsHitTesting(false)
        }
    }
}

extension SnowBottomSheet where Leading == EmptyView {
    init(title: String, close: @escaping () -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.init(title: title, close: close, leading: { EmptyView() }, content: content)
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

struct GogglePile: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.clear.frame(width: 375, height: 190)
            faceBlob(blob: "BlobBlue", x: 84.83, y: 50, width: 188.64, height: 195.35, face: 81.32, faceX: 47.79, faceY: 18.44)
            faceBlob(blob: "BlobPink", x: -25, y: 90.24, width: 177.74, height: 185.28, face: 69.59, faceX: 67.07, faceY: 32.7)
            faceBlob(blob: "BlobBlueRight", x: 238.25, y: 96.11, width: 160.13, height: 166, face: 58.69, faceX: 55.34, faceY: 26.83)
            faceBlob(blob: "BlobYellow", x: 170.83, y: 119.32, width: 115.7, height: 112.34, face: 50.3, faceX: 32.7, faceY: 19.64)
        }
        .frame(width: 375, height: 190, alignment: .topLeading)
        .allowsHitTesting(false)
    }

    private func faceBlob(blob: String, x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, face: CGFloat, faceX: CGFloat, faceY: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Image(blob).resizable().frame(width: width, height: height)
            Image("GoggleFace")
                .resizable()
                .scaledToFill()
                .frame(width: face, height: face)
                .clipShape(Circle())
                .offset(x: faceX, y: faceY)
        }
        .frame(width: width, height: height, alignment: .topLeading)
        .offset(x: x, y: y)
    }
}

struct AppMark: View {
    var side: CGFloat

    var body: some View {
        Image("AppMark")
            .resizable()
            .scaledToFill()
            .frame(width: side, height: side)
            .clipShape(RoundedRectangle(cornerRadius: side * 15 / 65, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: side * 15 / 65, style: .continuous)
                    .stroke(Color.black, lineWidth: 1)
            )
    }
}

private final class SwipeBackDelegate: NSObject, UIGestureRecognizerDelegate {
    static let shared = SwipeBackDelegate()

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let navigation = navigationController(for: gestureRecognizer) else { return false }
        guard navigation.viewControllers.count > 1 else { return false }
        return navigation.transitionCoordinator == nil
    }

    private func navigationController(for gesture: UIGestureRecognizer) -> UINavigationController? {
        var responder: UIResponder? = gesture.view
        while let current = responder {
            if let navigation = current as? UINavigationController { return navigation }
            responder = current.next
        }
        return nil
    }
}

struct NavigationGestureRelay: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> Controller { Controller() }
    func updateUIViewController(_ uiViewController: Controller, context: Context) {}

    final class Controller: UIViewController {
        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            guard let navigation = navigationController, let pop = navigation.interactivePopGestureRecognizer else { return }
            pop.isEnabled = navigation.viewControllers.count > 1
            if pop.delegate !== SwipeBackDelegate.shared {
                pop.delegate = SwipeBackDelegate.shared
            }
        }
    }
}
