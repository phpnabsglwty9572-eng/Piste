import SwiftUI

enum AppStage: Equatable {
    case splash
    case hybrid
}

enum AppSheet: Identifiable {
    case eula

    var id: String { "eula" }
}

final class AppNavigator: ObservableObject {
    @Published var stage: AppStage = .splash
    @Published var sheet: AppSheet?

    func enterHybrid() {
        stage = .hybrid
        sheet = nil
    }
}
