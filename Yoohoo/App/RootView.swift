import SwiftUI

struct RootView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        ZStack {
            switch nav.stage {
            case .splash:
                SplashView()
            case .hybrid, .auth, .main:
                HybridHostView()
            }
            if session.busy, session.blocksInput {
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
            }
            if let preview = nav.mediaPreview {
                ZStack {
                    Color.black.ignoresSafeArea()
                    Group {
                        if preview.hasPrefix("http"), let url = URL(string: preview) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().scaledToFit()
                                default:
                                    ImageShimmer()
                                }
                            }
                        } else if let local = session.localImages[preview] {
                            Image(uiImage: local).resizable().scaledToFit()
                        } else if preview.isEmpty == false {
                            Image(preview).resizable().scaledToFit()
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .contentShape(Rectangle())
                .onTapGesture { nav.mediaPreview = nil }
            }
            if let toast = session.toast {
                YoohooToast(text: toast, spinning: session.toastSpinning)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.28), value: nav.stage)
        .animation(.spring(response: 0.28, dampingFraction: 0.86), value: session.toast)
        .sheet(item: systemSheet) { sheet in
            if case .eula = sheet {
                EULAView()
            }
        }
        .overlay {
            ZStack(alignment: .bottom) {
                if let sheet = nav.sheet, !sheet.usesSystemSheet {
                    Color.black.opacity(0.5)
                        .ignoresSafeArea()
                        .transition(.opacity)
                        .onTapGesture { nav.sheet = nil }
                    sheetCard(sheet)
                        .transition(.move(edge: .bottom))
                }
            }
            .animation(.easeOut(duration: 0.22), value: nav.sheet?.id)
        }
    }

    private var stack: some View {
        NavigationStack(path: $nav.path) {
            Group {
                if nav.stage == .main {
                    Group {
                        switch nav.tab {
                        case .home:
                            HomeView()
                        case .post:
                            PostFeedView()
                        case .chat:
                            ChatListView()
                        }
                    }
                    .id(nav.tab)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                    .animation(.easeInOut(duration: 0.25), value: nav.tab)
                } else {
                    AuthLandingView()
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if nav.stage == .main {
                    MainTabBar()
                }
            }
            .navigationDestination(for: AppPage.self) { page($0) }
        }
    }

    @ViewBuilder
    private func page(_ page: AppPage) -> some View {
        switch page {
        case .register:
            AccountFormView(mode: .register)
        case .registerPhotos:
            RegisterPhotosView()
        case .signIn:
            AccountFormView(mode: .signIn)
        case .terms:
            LegalPage(title: "Terms Of Use", resource: "EULA", remote: YoohooConfig.termsURL)
        case .privacy:
            LegalPage(title: "Privacy Policy", resource: "Privacy", remote: YoohooConfig.privacyURL)
        case .postDetail(let id):
            PostDetailView(postID: id)
        case .compose:
            ComposePostView()
        case .chat(let id):
            ChatThreadView(threadID: id)
        case .profile(let id):
            ProfileView(userID: id)
        case .settings:
            SettingsView()
        case .people(let kind):
            PeopleListView(kind: kind)
        case .editProfile:
            EditProfileView()
        case .coinShop:
            CoinShopView()
        case .live(let id):
            LiveRoomView(hostID: id)
        case .ai:
            AIChatView()
        case .videoCall(let name):
            VideoCallView(name: name)
        }
    }

    private var systemSheet: Binding<AppSheet?> {
        Binding(
            get: {
                if let sheet = nav.sheet, sheet.usesSystemSheet { return sheet }
                return nil
            },
            set: { nav.sheet = $0 }
        )
    }

    @ViewBuilder
    private func sheetCard(_ sheet: AppSheet) -> some View {
        switch sheet {
        case .about(let target):
            AboutSheet(target: target)
        case .deletePost(let id, let pop):
            ConfirmSnowSheet(
                title: "Delete Post",
                message: "Once deleted, this post cannot be recovered. Are you sure you want to continue?",
                confirm: {
                    session.deletePost(id)
                    nav.sheet = nil
                    if pop { nav.pop() }
                    session.show("Deleted.")
                },
                close: { nav.sheet = nil }
            )
        case .deleteChat(let id, let pop):
            ConfirmSnowSheet(
                title: "Delete Chat",
                message: "Are you sure you want to delete your chat history? Once deleted, this action cannot be reversed!",
                confirm: {
                    session.deleteThread(id)
                    nav.sheet = nil
                    if pop { nav.pop() }
                },
                close: { nav.sheet = nil }
            )
        case .feedback:
            FeedbackSheet()
        case .report:
            ReportSheet()
        case .logout:
            ConfirmSnowSheet(
                title: "Log Out",
                message: "Are you sure you want to log out? You will need to sign in again to access your account.",
                confirm: {
                    nav.sheet = nil
                    Task {
                        await session.signOut()
                        nav.openAuth()
                    }
                },
                close: { nav.sheet = nil }
            )
        case .deleteAccount:
            ConfirmSnowSheet(
                title: "Delete Account",
                message: "Are you sure you want to delete your account? This action cannot be undone, and all your data will be permanently erased.",
                confirm: {
                    nav.sheet = nil
                    Task {
                        await session.eraseAccount()
                        if session.signedIn == false { nav.openAuth() }
                    }
                },
                close: { nav.sheet = nil }
            )
        case .block(let id, let pop):
            ConfirmSnowSheet(
                title: "Add to Blacklist",
                message: "Are you sure you want to blacklist him/her? After joining, you will not receive any messages from him/her!",
                confirm: {
                    session.block(id)
                    nav.sheet = nil
                    if pop { nav.pop() }
                    session.show("Added to blacklist.")
                },
                close: { nav.sheet = nil }
            )
        case .eula:
            EmptyView()
        }
    }
}
