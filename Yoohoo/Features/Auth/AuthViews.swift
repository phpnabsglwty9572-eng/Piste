import PhotosUI
import SwiftUI

struct SplashView: View {
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        DesignBoard(height: 667) {
            ZStack(alignment: .topLeading) {
                AuthBackdrop()
                AppMark(side: 65)
                    .offset(x: 155, y: 244)
            }
            .frame(width: 375, height: 667, alignment: .topLeading)
            .clipped()
        }
        .onAppear {
            Task {
                try? await Task.sleep(nanoseconds: 1_100_000_000)
                if nav.stage == .splash { nav.openAuth() }
            }
        }
    }
}

struct AuthLandingView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        DesignBoard(height: 667) {
            ZStack(alignment: .topLeading) {
                AuthBackdrop()
                AppMark(side: 65)
                    .offset(x: 155, y: 120)
                appleButton
                    .offset(x: 35, y: 254)
                outlineButton("Create Account") { gate { nav.push(.register) } }
                    .offset(x: 35, y: 331)
                outlineButton("Sign In") { gate { nav.push(.signIn) } }
                    .offset(x: 35, y: 391)
                legalLine
                    .offset(x: 34, y: 508)
            }
            .frame(width: 375, height: 667, alignment: .topLeading)
            .clipped()
        }
    }

    private var appleButton: some View {
        Button {
            gate { Task { await apple() } }
        } label: {
            ZStack(alignment: .top) {
                Image("ButtonBlue")
                    .resizable()
                    .frame(width: 305, height: 64)
                HStack(spacing: 10) {
                    Image("AppleGlyph")
                        .resizable()
                        .frame(width: 25, height: 25)
                    Text("Sign In With Apple")
                        .font(YoohooFont.heavy(18))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                .offset(y: 24)
            }
            .frame(width: 305, height: 64, alignment: .top)
        }
        .buttonStyle(PressDownStyle())
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
        .buttonStyle(PressDownStyle())
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
        .lineLimit(1)
        .fixedSize()
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
            session.rememberAppleName(credential.fullName, userID: credential.userID)
            session.applyAppleNameIfNeeded(userID: credential.userID, currentName: session.meName, email: nil)
            session.stopLoading()
            if YoohooConfig.backendReady {
                session.show("The Yoohoo test project is not wired to Apple yet.")
            } else {
                session.signedIn = true
                nav.enterApp()
            }
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
        DesignBoard(height: 667) {
            ZStack(alignment: .topLeading) {
                AuthChrome(title: mode == .signIn ? "Sign In" : "Create Account")
                field(title: "Email", text: $email, prompt: "Your Email", secure: false)
                    .offset(x: 16, y: 134)
                field(title: "Password", text: $password, prompt: "Your Password", secure: true)
                    .offset(x: 16, y: 218)
                if mode == .register {
                    field(title: "Name", text: $name, prompt: "Your name", secure: false)
                        .offset(x: 16, y: 302)
                }
                SnowButton(title: mode == .signIn ? "Sign In" : "Next", enabled: true) {
                    submit()
                }
                .offset(x: 35, y: 582)
            }
            .frame(width: 375, height: 667, alignment: .topLeading)
            .clipped()
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
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)
            session.stopLoading()
            if mode == .register {
                session.meName = display
                nav.push(.registerPhotos)
            } else if YoohooConfig.backendReady {
                session.show("Connect this product's test Supabase before signing in.")
            } else {
                session.signedIn = true
                nav.enterApp()
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
        DesignBoard(height: 667) {
            ZStack(alignment: .topLeading) {
                AuthChrome(title: "Create Account")
                photoBlock(title: "Avatar", image: avatar, circle: true, item: $avatarItem)
                    .offset(x: 16, y: 134)
                photoBlock(title: "Background", image: background, circle: false, item: $backgroundItem)
                    .offset(x: 16, y: 293)
                SnowButton(title: "Create", enabled: true) { create() }
                    .offset(x: 35, y: 582)
            }
            .frame(width: 375, height: 667, alignment: .topLeading)
            .clipped()
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
        AnyShape(RoundedRectangle(cornerRadius: circle ? 55.5 : 10, style: .continuous))
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
            try? await Task.sleep(nanoseconds: 500_000_000)
            session.stopLoading()
            if YoohooConfig.backendReady {
                session.show("Connect this product's test Supabase before creating an account.")
            } else {
                session.signedIn = true
                nav.enterApp()
            }
        }
    }
}

struct AuthBackdrop: View {
    var body: some View {
        ZStack(alignment: .topLeading) {
            Image("SnowSky")
                .resizable()
                .frame(width: 375 * 1.0004, height: 668 * 1.2171, alignment: .topLeading)
                .offset(x: 375 * -0.0002, y: 668 * -0.0599)
            GogglePile()
                .offset(y: 487)
        }
        .frame(width: 375, height: 667, alignment: .topLeading)
        .clipped()
    }
}

struct AuthChrome: View {
    var title: String
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        ZStack(alignment: .topLeading) {
            HeaderSky(height: 177)
            Color.white
                .frame(width: 375, height: 549)
                .offset(y: 118)
            SnowEdge()
                .offset(y: 99)
            Image("HeaderSled")
                .resizable()
                .frame(width: 32, height: 32)
                .offset(x: 327, y: 86)
            Button(action: nav.pop) {
                Image("BackButton")
                    .resizable()
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(PressDownStyle())
            .offset(x: 16, y: 36)
            Text(title)
                .font(YoohooFont.title(20))
                .foregroundStyle(YoohooColor.ink)
                .lineLimit(1)
                .offset(x: 58, y: 39)
        }
        .frame(width: 375, height: 667, alignment: .topLeading)
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
