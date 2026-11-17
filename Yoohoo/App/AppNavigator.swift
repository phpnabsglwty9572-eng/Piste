import SwiftUI

enum AppStage: Equatable {
    case splash
    case hybrid
    case auth
    case main
}

enum AppTab: Hashable {
    case home
    case post
    case chat
}

enum AppPage: Hashable {
    case register
    case registerPhotos
    case signIn
    case terms
    case privacy
    case postDetail(String)
    case compose
    case chat(String)
    case profile(String)
    case settings
    case people(String)
    case editProfile
    case coinShop
    case live(String)
    case ai
    case videoCall(String)
}

enum AboutTarget: Hashable {
    case post(String)
    case person(String)
    case chat(String)
    case comment(String)
}

enum AppSheet: Identifiable {
    case eula
    case about(AboutTarget)
    case deletePost(String, pop: Bool)
    case deleteChat(String, pop: Bool)
    case block(String, pop: Bool)
    case feedback
    case report
    case logout
    case deleteAccount

    var id: String {
        switch self {
        case .eula: return "eula"
        case .about(let target): return "about-\(target)"
        case .deletePost(let id, let pop): return "delete-\(id)-\(pop)"
        case .deleteChat(let id, let pop): return "delete-chat-\(id)-\(pop)"
        case .block(let id, let pop): return "block-\(id)-\(pop)"
        case .feedback: return "feedback"
        case .report: return "report"
        case .logout: return "logout"
        case .deleteAccount: return "delete-account"
        }
    }

    var usesSystemSheet: Bool {
        if case .eula = self { return true }
        return false
    }
}

final class AppNavigator: ObservableObject {
    @Published var stage: AppStage = .splash
    @Published var tab: AppTab = .home
    @Published var path = NavigationPath()
    @Published var sheet: AppSheet?
    @Published var mediaPreview: String?

    func openAuth() {
        stage = .hybrid
        tab = .home
        path = NavigationPath()
        sheet = nil
    }

    func enterApp() {
        stage = .hybrid
        tab = .home
        path = NavigationPath()
        sheet = nil
    }

    func enterHybrid() {
        stage = .hybrid
        tab = .home
        path = NavigationPath()
        sheet = nil
    }

    func push(_ page: AppPage) {
        path.append(page)
    }

    func pop() {
        guard !path.isEmpty else {
            if stage != .main { openAuth() }
            return
        }
        path.removeLast()
    }
}
