import SwiftUI

enum YoohooConfig {
    #if YOOHOO_APPSTORE
    static let supabaseURL = "https://unxvkrjhqswcqucustkg.supabase.co"
    static let supabaseKey = "sb_publishable_rkwl5-_ZmfteDnxdz8HLhQ_wTBXPCAN"
    #else
    static let supabaseURL = "https://wjbdbuooefqvsovjjwhq.supabase.co"
    static let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqYmRidW9vZWZxdnNvdmpqd2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NDQwMTYsImV4cCI6MjEwOTQyMDAxNn0.9yUcWTyUR9YH36vGGeYVSj327vn1YUVcnkciCcxsDV0"
    #endif
    static let nameLimit = 24
    static let termsURL = URL(string: "https://docs.google.com/document/d/1sIwxJ-2XpppQrlxrbGsCb5li5Nh36ODlMY6IGp_6nTo/preview")
    static let privacyURL = URL(string: "https://docs.google.com/document/d/10JLwuVTRezN7lY9ZdxQ6uV6cJdrucYLCCIyo5i2TQ3k/preview")

    static var backendReady: Bool {
        supabaseURL.hasPrefix("https://") && supabaseKey.isEmpty == false
    }
}

struct CoinPack: Identifiable {
    var id: String
    var amount: Int
    var price: String
    var art: String

    static var catalog: [CoinPack] {
        #if YOOHOO_APPSTORE
        return [
            CoinPack(id: "ricfnjspieprhkxk", amount: 400, price: "$0.99", art: "Coin5"),
            CoinPack(id: "ubailncxfjfeotky", amount: 800, price: "$1.99", art: "Coin10"),
            CoinPack(id: "pqyqniwbkwhkritp", amount: 2450, price: "$4.99", art: "Coin15"),
            CoinPack(id: "btlhbcomllaxhafj", amount: 5150, price: "$9.99", art: "Coin20"),
            CoinPack(id: "miihbdkruepvdlyo", amount: 10800, price: "$19.99", art: "Coin25"),
            CoinPack(id: "dtxhgdweskutnqmi", amount: 29400, price: "$49.99", art: "Coin30"),
            CoinPack(id: "ewfkthoykyblhsvr", amount: 63700, price: "$99.99", art: "Coin35")
        ]
        #else
        return [
            CoinPack(id: "6zdz3v2alwput2vo2", amount: 400, price: "$0.99", art: "Coin5"),
            CoinPack(id: "74s0kqa23h3vjb6o9bb", amount: 800, price: "$1.99", art: "Coin10"),
            CoinPack(id: "u1g6h9wj1i9ykfnmkgv", amount: 2450, price: "$4.99", art: "Coin15"),
            CoinPack(id: "wq9s6664bp2r0drdv", amount: 5150, price: "$9.99", art: "Coin20"),
            CoinPack(id: "7nnk6a5itntmqozk1w52", amount: 10800, price: "$19.99", art: "Coin25"),
            CoinPack(id: "mq8ufjhoq1oflb67xi", amount: 29400, price: "$49.99", art: "Coin30"),
            CoinPack(id: "95ywicsa7y52jpo33p", amount: 63700, price: "$99.99", art: "Coin35")
        ]
        #endif
    }
}

@MainActor
final class YoohooSession: ObservableObject {
    @Published var toast: String?
    @Published var toastSpinning = false
    @Published var busy = false
    @Published var blocksInput = true
    @Published var acceptedEULA = false
    @Published var signedIn = false
    @Published var meName = ""
    @Published var meHandle = ""
    @Published var meID = ""
    @Published var coins = 0
    @Published var coverAsset = ""
    @Published var avatarAsset = ""
    @Published var h5Ready = false
    @Published var darkStatusBar = false

    private let eulaKey = "yoohoo.eula"
    private let appleNamePrefix = "yoohoo.appleName."

    init() {
        acceptedEULA = UserDefaults.standard.bool(forKey: eulaKey)
    }

    func startLoading(blocksInput: Bool = true) {
        guard !busy else { return }
        busy = true
        self.blocksInput = blocksInput
        toastSpinning = true
        toast = "Please wait"
    }

    func dismissWait() {
        guard busy, toastSpinning, toast == "Please wait" else { return }
        toastSpinning = false
        toast = nil
        blocksInput = false
    }

    func stopLoading() {
        busy = false
        blocksInput = true
        toastSpinning = false
        if toast == "Please wait" { toast = nil }
    }

    func show(_ message: String) {
        toastSpinning = false
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if toast == message { toast = nil }
        }
    }

    func acceptEULA() {
        acceptedEULA = true
        UserDefaults.standard.set(true, forKey: eulaKey)
    }

    func rememberAppleName(_ name: String?, userID: String) {
        let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return }
        UserDefaults.standard.set(String(trimmed.prefix(YoohooConfig.nameLimit)), forKey: appleNamePrefix + userID)
    }

    func appleName(for userID: String) -> String? {
        UserDefaults.standard.string(forKey: appleNamePrefix + userID)
    }

    func restore() async {
        guard YoohooConfig.backendReady, YoohooBackend.userID != nil else { return }
        signedIn = true
        await reload()
    }

    func signInWithApple(token: String, nonce: String, userID: String, fullName: String?) async throws {
        if let fullName, fullName.isEmpty == false { rememberAppleName(fullName, userID: userID) }
        try await YoohooBackend.signInWithApple(token: token, nonce: nonce)
        signedIn = true
        await reload()
        guard let stored = appleName(for: userID), let me = YoohooBackend.userID else { return }
        let prefix = YoohooBackend.client.auth.currentUser?.email?.split(separator: "@").first.map(String.init) ?? ""
        let current = meName.trimmingCharacters(in: .whitespacesAndNewlines)
        if current.isEmpty || current == prefix || current.lowercased() == "apple" {
            let chosen = String(stored.prefix(YoohooConfig.nameLimit))
            try await YoohooBackend.saveProfile(id: me, name: chosen, avatar: avatarAsset.isEmpty ? nil : avatarAsset, cover: coverAsset.isEmpty ? nil : coverAsset)
            meName = chosen
        }
    }

    func signOut() async {
        await YoohooBackend.signOut()
        signedIn = false
        meName = ""
        meHandle = ""
        meID = ""
        coins = 0
        avatarAsset = ""
        coverAsset = ""
    }

    func reload() async {
        guard YoohooConfig.backendReady else { return }
        do {
            guard let profile = try await YoohooBackend.loadMe() else { return }
            meID = profile.id.uuidString.lowercased()
            meName = profile.name
            meHandle = profile.handle
            coins = profile.gems
            avatarAsset = profile.avatarURL ?? ""
            coverAsset = profile.coverURL ?? ""
        } catch {
            show(error.localizedDescription)
        }
    }
}

final class EULAGate {
    static let shared = EULAGate()
    var next: (() -> Void)?
}
