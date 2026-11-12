import PhotosUI
import SwiftUI

struct SplashView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        GeometryReader { geo in
            ZStack {
                AuthSkyFill()
                AuthLogoMark()
                    .position(x: geo.size.width / 2, y: 276.5)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .navigationBarHidden(true)
        .onAppear {
            Task {
                await session.restore()
                try? await Task.sleep(nanoseconds: 600_000_000)
                guard nav.stage == .splash else { return }
                if session.signedIn { nav.enterApp() } else { nav.openAuth() }
            }
        }
    }
}

struct AuthLandingView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        GeometryReader { geo in
            let scale = max(geo.size.width / 375, geo.size.height / 667)
            ZStack {
                AuthSkyFill()
                VStack(spacing: 0) {
                    Color.clear.frame(height: 120)
                    AuthLogoMark()
                    Color.clear.frame(height: 69)
                    appleButton
                    Color.clear.frame(height: 13)
                    outlineButton("Create Account") { gate { nav.push(.register) } }
                    Color.clear.frame(height: 16)
                    outlineButton("Sign In") { gate { nav.push(.signIn) } }
                    Color.clear.frame(height: 73)
                    legalLine
                }
                .frame(width: 375, height: 667, alignment: .top)
                .scaleEffect(scale)
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .ignoresSafeArea()
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var appleButton: some View {
        Button {
            gate { Task { await apple() } }
        } label: {
            ZStack {
                Image("ButtonBlue")
                    .resizable()
                    .frame(width: 306, height: 64)
                HStack(spacing: 10) {
                    Image("AppleGlyph")
                        .resizable()
                        .frame(width: 25, height: 25)
                    Text("Sign In With Apple")
                        .font(YoohooFont.heavy(18))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .offset(y: 6)
            }
            .frame(width: 306, height: 64)
        }
        .buttonStyle(.plain)
    }

    private func outlineButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(YoohooFont.heavy(18))
                .foregroundStyle(YoohooColor.pink)
                .frame(width: 305, height: 44)
                .background(Capsule().fill(.white))
                .overlay(Capsule().stroke(YoohooColor.pink, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }

    private var legalLine: some View {
        HStack(spacing: 0) {
            Text("By signing up, you agree to the ")
            Button("User Agreement") { nav.push(.terms) }
            Text(" & ")
            Button("Privacy Policy") { nav.push(.privacy) }
            Text(".")
        }
        .font(YoohooFont.medium(10))
        .foregroundStyle(YoohooColor.ink)
        .buttonStyle(.plain)
        .tint(YoohooColor.ink)
        .lineLimit(1)
        .frame(maxWidth: .infinity)
    }

    private func gate(_ work: @escaping () -> Void) {
        if session.acceptedEULA {
            work()
        } else {
            nav.sheet = .eula
            EULAGate.shared.next = work
        }
    }

    private func apple() async {
        guard !session.busy else { return }
        session.startLoading()
        do {
            let credential = try await AppleSignIn.request()
            try await session.signInWithApple(token: credential.identityToken, nonce: credential.nonce, userID: credential.userID, fullName: credential.fullName)
            session.stopLoading()
            nav.enterApp()
        } catch let error as AppleSignInError where error == .cancelled {
            session.stopLoading()
        } catch {
            session.stopLoading()
            session.show(error.localizedDescription)
        }
    }
}

struct AccountFormView: View {
    var mode: Mode
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var email = ""
    @State private var password = ""
    @State private var name = ""

    enum Mode { case signIn, register }

    private var ready: Bool {
        let mail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let secret = password.trimmingCharacters(in: .whitespacesAndNewlines)
        if mode == .signIn { return mail.contains("@") && secret.count >= 6 }
        let display = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return mail.contains("@") && secret.count >= 6 && !display.isEmpty
    }

    var body: some View {
        AuthFormPage(
            title: mode == .signIn ? "Sign In" : "Create Account",
            buttonTitle: mode == .signIn ? "Sign In" : "Next",
            ready: ready,
            action: submit
        ) {
            VStack(alignment: .leading, spacing: 16) {
                field(title: "Email", text: $email, prompt: "Your Email", secure: false)
                field(title: "Password", text: $password, prompt: "Your Password", secure: true)
                if mode == .register {
                    field(title: "Name", text: $name, prompt: "Your name", secure: false)
                }
            }
        }
    }

    private func field(title: String, text: Binding<String>, prompt: String, secure: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 2) {
                FieldMark()
                Text(title)
                    .font(YoohooFont.title(16))
                    .foregroundStyle(YoohooColor.ink)
            }
            Group {
                if secure {
                    SecureField("", text: text)
                } else {
                    TextField("", text: text)
                        .textInputAutocapitalization(title == "Name" ? .words : .never)
                        .keyboardType(title == "Email" ? .emailAddress : .default)
                }
            }
            .font(YoohooFont.medium(14))
            .foregroundStyle(YoohooColor.ink)
            .padding(.horizontal, 8)
            .frame(width: 343, height: 36)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(YoohooColor.blue, lineWidth: 1)
            )
            .overlay(alignment: .leading) {
                if text.wrappedValue.isEmpty {
                    Text(prompt)
                        .font(YoohooFont.medium(14))
                        .foregroundStyle(YoohooColor.gray)
                        .padding(.leading, 8)
                        .allowsHitTesting(false)
                }
            }
            .onChange(of: text.wrappedValue) { value in
                if title == "Name", value.count > YoohooConfig.nameLimit {
                    text.wrappedValue = String(value.prefix(YoohooConfig.nameLimit))
                }
            }
        }
    }

    private func submit() {
        guard !session.busy, ready else { return }
        session.startLoading()
        let display = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(YoohooConfig.nameLimit))
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let secret = password
        Task {
            do {
                if mode == .register {
                    try await session.register(email: address, password: secret, name: display)
                    session.stopLoading()
                    nav.push(.registerPhotos)
                } else {
                    try await session.signIn(email: address, password: secret)
                    session.stopLoading()
                    nav.enterApp()
                }
            } catch {
                session.stopLoading()
                session.show(error.localizedDescription)
            }
        }
    }
}

struct RegisterPhotosView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var avatar: UIImage?
    @State private var background: UIImage?
    @State private var avatarItem: PhotosPickerItem?
    @State private var backgroundItem: PhotosPickerItem?

    private var ready: Bool { avatar != nil && background != nil }

    var body: some View {
        AuthFormPage(title: "Create Account", buttonTitle: "Create", ready: ready, action: create) {
            VStack(alignment: .leading, spacing: 16) {
                photoBlock(title: "Avatar", image: avatar, circle: true, item: $avatarItem)
                photoBlock(title: "Background", image: background, circle: false, item: $backgroundItem)
            }
        }
        .onChange(of: avatarItem) { item in
            load(item) { avatar = $0 }
        }
        .onChange(of: backgroundItem) { item in
            load(item) { background = $0 }
        }
    }

    private func photoBlock(title: String, image: UIImage?, circle: Bool, item: Binding<PhotosPickerItem?>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 2) {
                FieldMark()
                Text(title)
                    .font(YoohooFont.title(16))
                    .foregroundStyle(YoohooColor.ink)
            }
            PhotosPicker(selection: item, matching: .images) {
                ZStack {
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                    } else {
                        VStack(spacing: 4) {
                            Image("UploadCloud")
                                .resizable()
                                .frame(width: 25, height: 25)
                            if !circle {
                                Text("Upload Photo")
                                    .font(YoohooFont.medium(10))
                                    .foregroundStyle(YoohooColor.gray)
                            }
                        }
                    }
                }
                .frame(width: 111, height: circle ? 111 : 130)
                .background(Color.white)
                .clipShape(photoShape(circle: circle))
                .overlay(photoShape(circle: circle).stroke(image == nil ? YoohooColor.blue : Color.clear, lineWidth: 1))
            }
            .buttonStyle(PressDownStyle())
        }
    }

    private func photoShape(circle: Bool) -> AnyShape {
        if circle {
            return AnyShape(Circle())
        }
        return AnyShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func load(_ item: PhotosPickerItem?, assign: @escaping (UIImage?) -> Void) {
        guard let item else { return }
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else { return }
            assign(image)
        }
    }

    private func create() {
        guard !session.busy, ready else { return }
        session.startLoading()
        Task {
            do {
                try await session.saveProfile(name: session.meName, avatar: avatar, cover: background)
                session.stopLoading()
                nav.enterApp()
            } catch {
                session.stopLoading()
                session.show(error.localizedDescription)
            }
        }
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
            .frame(width: 65, height: 65)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(Color.black, lineWidth: 1)
            )
    }
}

private struct AuthSnowEdge: View {
    var width: CGFloat

    var body: some View {
        let imageWidth = width * 1.1132
        let imageHeight: CGFloat = 19 * 11.1111
        Color.clear
            .frame(width: width, height: 19)
            .overlay(alignment: .topLeading) {
                Image("AuthSnow")
                    .resizable()
                    .frame(width: imageWidth, height: imageHeight, alignment: .topLeading)
                    .offset(x: width * -0.0445, y: 19 * -4.5185)
            }
            .clipped()
    }
}

struct AuthFormPage<Fields: View>: View {
    var title: String
    var buttonTitle: String
    var ready: Bool
    var action: () -> Void
    @ViewBuilder var fields: () -> Fields

    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        GeometryReader { geo in
            let top = geo.safeAreaInsets.top
            let width = geo.size.width
            ZStack(alignment: .topLeading) {
                Color.white.ignoresSafeArea()
                formSky(width: width, height: top + 157)
                    .ignoresSafeArea(edges: .top)
                    .offset(y: -top)
                AuthSnowEdge(width: width)
                    .offset(y: 79)
                Image("AuthSled")
                    .resizable()
                    .frame(width: 32, height: 32)
                    .offset(x: width - 48, y: 66)
                Button(action: nav.pop) {
                    Image("BackButton")
                        .resizable()
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .offset(x: 16, y: 16)
                Text(title)
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                    .lineLimit(1)
                    .offset(x: 58, y: 19)
                fields()
                    .padding(.leading, 16)
                    .offset(y: 114)
            }
            .frame(width: width, height: geo.size.height)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            SnowButton(title: buttonTitle, enabled: ready, action: action)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 21)
                .background(Color.white)
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private func formSky(width: CGFloat, height: CGFloat) -> some View {
        Image("FormSky")
            .resizable()
            .frame(width: width, height: width * 2543 / 658, alignment: .top)
            .frame(width: width, height: height, alignment: .top)
            .clipped()
    }
}

struct SnowForm<Content: View>: View {
    var title: String
    @EnvironmentObject private var nav: AppNavigator
    @ViewBuilder var content: () -> Content

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                content()
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var header: some View {
        ZStack(alignment: .bottom) {
            Color.clear
            HStack {
                Spacer(minLength: 0)
                Image("HeaderSled")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 32, height: 32)
            }
            .padding(.trailing, 16)
            .padding(.bottom, 22)
            SnowEdge()
            HStack(spacing: 8) {
                Button(action: nav.pop) {
                    Image("BackButton")
                        .resizable()
                        .frame(width: 34, height: 34)
                }
                .buttonStyle(PressDownStyle())
                Text(title)
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 0)
            }
            .padding(.leading, 16)
            .padding(.bottom, 22)
        }
        .frame(height: 78)
        .background(alignment: .top) {
            HeaderSky(height: 240)
                .frame(maxWidth: .infinity)
                .frame(height: 180, alignment: .top)
                .ignoresSafeArea(edges: .top)
        }
    }
}

struct LegalPage: View {
    var title: String
    var resource: String

    @State private var bodyText = ""

    var body: some View {
        SnowForm(title: title) {
            ScrollView {
                Text(bodyText)
                    .font(YoohooFont.medium(14))
                    .foregroundStyle(YoohooColor.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }
        .onAppear {
            bodyText = bundledText(resource)
        }
    }
}

struct EULAView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var bodyText = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("EULA")
                    .font(YoohooFont.title(22))
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

struct AnyShape: Shape {
    private let path: (CGRect) -> Path

    init<S: Shape>(_ shape: S) {
        path = { shape.path(in: $0) }
    }

    func path(in rect: CGRect) -> Path { path(rect) }
}
