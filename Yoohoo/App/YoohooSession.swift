import SwiftUI
import UIKit

enum YoohooConfig {
    #if YOOHOO_APPSTORE
    static let supabaseURL = ""
    static let supabaseKey = ""
    #else
    static let supabaseURL = "https://wjbdbuooefqvsovjjwhq.supabase.co"
    static let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqYmRidW9vZWZxdnNvdmpqd2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NDQwMTYsImV4cCI6MjEwOTQyMDAxNn0.9yUcWTyUR9YH36vGGeYVSj327vn1YUVcnkciCcxsDV0"
    #endif
    static let nameLimit = 24

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
        return []
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

struct PostItem: Identifiable, Equatable {
    var id: String
    var userID: String
    var name: String
    var handle: String
    var avatar: String
    var caption: String
    var tags: [String]
    var photos: [String]
    var isVideo: Bool
    var time: String
    var followed: Bool
    var liked: Bool
    var pageCount: Int
    var mine: Bool
}

struct CommentItem: Identifiable, Equatable {
    var id: String
    var postID: String
    var author: String
    var avatar: String
    var text: String
    var time: String
    var mine: Bool
    var userID: String = ""
}

struct ChatPerson: Identifiable, Equatable {
    var id: String
    var name: String
    var handle: String
    var avatar: String
    var followed: Bool
    var preview: String
    var time: String
}

struct ChatLine: Identifiable, Equatable {
    var id: String
    var threadID: String
    var text: String
    var mine: Bool
    var stamp: String
}

struct KnownProfile: Equatable {
    var name: String
    var handle: String
    var avatar: String
    var cover: String
}

struct FeedCard: Identifiable, Equatable {
    var id: String
    var userID: String
    var name: String
    var handle: String
    var caption: String
    var tags: [String]
    var photo: String
    var avatar: String
    var followed: Bool
    var videoURL: String = ""
}

@MainActor
final class YoohooSession: ObservableObject {
    @Published var toast: String?
    @Published var toastSpinning = false
    @Published var busy = false
    @Published var acceptedEULA = false
    @Published var signedIn = false
    @Published var meName = ""
    @Published var meHandle = ""
    @Published var meID = ""
    @Published var known: [String: KnownProfile] = [:]
    var reportTarget = ""
    @Published var coins = 0
    @Published var followedCount = 0
    @Published var fanCount = 0
    @Published var followedIDs: Set<String> = []
    @Published var extraFollowed: [String] = []
    @Published var blocked: [String] = []
    @Published var people: [ChatPerson] = []
    @Published var lines: [ChatLine] = []
    @Published var cards: [FeedCard] = []
    @Published var posts: [PostItem] = []
    @Published var comments: [CommentItem] = []
    @Published var followedPeople: [ChatPerson] = []
    @Published var fanPeople: [ChatPerson] = []
    @Published var blockedPeople: [ChatPerson] = []
    var threadForUser: [String: String] = [:]
    @Published var localImages: [String: UIImage] = [:]
    @Published var frameAsset = "AvatarFrame"
    @Published var coverAsset = ""
    @Published var avatarAsset = ""
    @Published var localAvatar: UIImage?
    @Published var localCover: UIImage?

    private let eulaKey = "yoohoo.eula"
    private let appleNamePrefix = "yoohoo.appleName."

    init() {
        acceptedEULA = UserDefaults.standard.bool(forKey: eulaKey)
    }

    func startLoading() {
        guard !busy else { return }
        busy = true
        toastSpinning = true
        toast = "Please wait"
    }

    func stopLoading() {
        busy = false
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
        let limited = String(trimmed.prefix(YoohooConfig.nameLimit))
        UserDefaults.standard.set(limited, forKey: appleNamePrefix + userID)
    }

    func appleName(for userID: String) -> String? {
        UserDefaults.standard.string(forKey: appleNamePrefix + userID)
    }

    func applyAppleNameIfNeeded(userID: String, currentName: String, email: String?) {
        guard let stored = appleName(for: userID), !stored.isEmpty else { return }
        let prefix = email?.split(separator: "@").first.map(String.init) ?? ""
        let normalized = currentName.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.isEmpty || normalized == prefix || normalized.lowercased() == "apple" {
            meName = String(stored.prefix(YoohooConfig.nameLimit))
        }
    }

    func restore() async {
        guard YoohooConfig.backendReady, YoohooBackend.userID != nil else { return }
        signedIn = true
        await reload()
    }

    func signIn(email: String, password: String) async throws {
        try await YoohooBackend.signIn(email: email, password: password)
        signedIn = true
        await reload()
    }

    func register(email: String, password: String, name: String) async throws {
        let trimmed = String(name.prefix(YoohooConfig.nameLimit))
        try await YoohooBackend.signUp(email: email, password: password, name: trimmed)
        meName = trimmed
        if let id = YoohooBackend.userID {
            meID = id.uuidString.lowercased()
        } else {
            try await YoohooBackend.signIn(email: email, password: password)
            meID = YoohooBackend.userID?.uuidString.lowercased() ?? ""
        }
        signedIn = meID.isEmpty == false
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
            await reload()
        }
    }

    func saveProfile(name: String, avatar: UIImage?, cover: UIImage?) async throws {
        guard let me = UUID(uuidString: meID) else { return }
        var avatarURL = avatarAsset.isEmpty ? nil : avatarAsset
        var coverURL = coverAsset.isEmpty ? nil : coverAsset
        if let avatar, let data = avatar.jpegData(compressionQuality: 0.82) {
            avatarURL = try await YoohooBackend.upload(data: data, path: "yoohoo/profiles/\(me.uuidString)-avatar.jpg", type: "image/jpeg")
        }
        if let cover, let data = cover.jpegData(compressionQuality: 0.82) {
            coverURL = try await YoohooBackend.upload(data: data, path: "yoohoo/profiles/\(me.uuidString)-cover.jpg", type: "image/jpeg")
        }
        try await YoohooBackend.saveProfile(id: me, name: String(name.prefix(YoohooConfig.nameLimit)), avatar: avatarURL, cover: coverURL)
        await reload()
    }

    func publishMedia(caption: String, images: [UIImage], video: Data?) async throws {
        guard let me = UUID(uuidString: meID) else { return }
        var urls: [String] = []
        if let video {
            urls.append(try await YoohooBackend.upload(data: video, path: "yoohoo/posts/\(UUID().uuidString).mp4", type: "video/mp4"))
        } else {
            for image in images.prefix(9) {
                guard let data = image.jpegData(compressionQuality: 0.82) else { continue }
                urls.append(try await YoohooBackend.upload(data: data, path: "yoohoo/posts/\(UUID().uuidString).jpg", type: "image/jpeg"))
            }
        }
        try await YoohooBackend.publish(author: me, body: caption, urls: urls, video: video != nil)
        await reload()
    }

    func reload() async {
        guard YoohooConfig.backendReady else { return }
        do {
            apply(try await YoohooBackend.load())
        } catch {
            show(error.localizedDescription)
        }
    }

    private func apply(_ library: RemoteLibrary) {
        let me = library.me.uuidString.lowercased()
        meID = me
        var profiles: [String: ProfileRow] = [:]
        for profile in library.profiles { profiles[profile.id.uuidString.lowercased()] = profile }
        if let mine = profiles[me] {
            meName = mine.name
            meHandle = mine.handle
            coins = mine.gems
            avatarAsset = mine.avatarURL ?? ""
            coverAsset = mine.coverURL ?? ""
        }
        known = Dictionary(uniqueKeysWithValues: library.profiles.map { profile in
            (profile.id.uuidString.lowercased(), KnownProfile(name: profile.name, handle: profile.handle, avatar: profile.avatarURL ?? "", cover: profile.coverURL ?? ""))
        })
        let following = Set(library.follows.filter { $0.follower.uuidString.lowercased() == me }.map { $0.followee.uuidString.lowercased() })
        followedIDs = following
        followedCount = following.count
        fanCount = library.follows.filter { $0.followee.uuidString.lowercased() == me }.count
        blocked = library.blocks.map { $0.blocked.uuidString.lowercased() }
        let liked = Set(library.likes.map { $0.postID.uuidString.lowercased() })
        posts = library.posts.compactMap { row in
            let author = row.authorID.uuidString.lowercased()
            guard blocked.contains(author) == false, let profile = profiles[author] else { return nil }
            let photos = row.mediaURLs ?? row.mediaURL.map { [$0] } ?? []
            return PostItem(id: row.id.uuidString.lowercased(), userID: author, name: profile.name, handle: profile.handle, avatar: profile.avatarURL ?? "", caption: row.body, tags: [], photos: photos, isVideo: row.isVideo, time: stamp(row.createdAt), followed: following.contains(author), liked: liked.contains(row.id.uuidString.lowercased()), pageCount: max(photos.count, 1), mine: author == me)
        }
        comments = library.comments.compactMap { row in
            let author = row.authorID.uuidString.lowercased()
            guard blocked.contains(author) == false, let profile = profiles[author] else { return nil }
            return CommentItem(id: row.id.uuidString.lowercased(), postID: row.postID.uuidString.lowercased(), author: profile.name, avatar: profile.avatarURL ?? "", text: row.body, time: stamp(row.createdAt), mine: author == me, userID: author)
        }
        cards = library.rooms.compactMap { room in
            let owner = room.ownerID.uuidString.lowercased()
            guard blocked.contains(owner) == false, let profile = profiles[owner] else { return nil }
            return FeedCard(id: room.id.uuidString.lowercased(), userID: owner, name: profile.name, handle: profile.handle, caption: room.title, tags: [], photo: room.coverURL ?? "", avatar: profile.avatarURL ?? "", followed: following.contains(owner), videoURL: room.videoURL ?? "")
        }
        var threads: [String: String] = [:]
        var chatPeople: [ChatPerson] = []
        var chatLines: [ChatLine] = []
        for thread in library.threads {
            let low = thread.userLow.uuidString.lowercased()
            let high = thread.userHigh.uuidString.lowercased()
            let other = low == me ? high : low
            guard blocked.contains(other) == false, let profile = profiles[other] else { continue }
            threads[other] = thread.id.uuidString.lowercased()
            let rows = library.messages.filter { $0.threadID == thread.id }
            chatPeople.append(ChatPerson(id: other, name: profile.name, handle: profile.handle, avatar: profile.avatarURL ?? "", followed: following.contains(other), preview: rows.last?.body ?? "", time: ""))
            for row in rows {
                chatLines.append(ChatLine(id: row.id.uuidString.lowercased(), threadID: other, text: row.body, mine: row.senderID.uuidString.lowercased() == me, stamp: ""))
            }
        }
        threadForUser = threads
        people = chatPeople
        lines = chatLines
        followedPeople = following.compactMap { person($0, profiles) }
        fanPeople = library.follows.filter { $0.followee.uuidString.lowercased() == me }.map { $0.follower.uuidString.lowercased() }.compactMap { person($0, profiles) }
        blockedPeople = blocked.compactMap { person($0, profiles) }
    }

    private func person(_ id: String, _ profiles: [String: ProfileRow]) -> ChatPerson? {
        guard let profile = profiles[id] else { return nil }
        return ChatPerson(id: id, name: profile.name, handle: profile.handle, avatar: profile.avatarURL ?? "", followed: followedIDs.contains(id), preview: "", time: "")
    }

    private func stamp(_ raw: String) -> String {
        guard let marker = raw.firstIndex(of: "T") else { return "" }
        return String(raw[raw.index(after: marker)...].prefix(5))
    }

    func isFollowed(_ id: String) -> Bool {
        followedIDs.contains(id)
    }

    func toggleFollow(_ id: String) {
        let follow = !followedIDs.contains(id)
        setFollowed(id, follow)
        Task {
            guard let me = UUID(uuidString: meID), let other = UUID(uuidString: id) else { return }
            do {
                try await YoohooBackend.setFollow(me: me, other: other, follow: follow)
            } catch {
                show(error.localizedDescription)
            }
            await reload()
        }
    }

    func setFollowed(_ id: String, _ value: Bool) {
        guard followedIDs.contains(id) != value else {
            applyFollowFlags(id, value)
            return
        }
        if value {
            followedIDs.insert(id)
            followedCount += 1
            if Self.followedPageIDs.contains(id) == false && extraFollowed.contains(id) == false {
                extraFollowed.append(id)
            }
        } else {
            followedIDs.remove(id)
            followedCount = max(0, followedCount - 1)
            extraFollowed.removeAll { $0 == id }
        }
        applyFollowFlags(id, value)
    }

    private func applyFollowFlags(_ id: String, _ value: Bool) {
        for index in cards.indices where cards[index].id == id || cards[index].userID == id {
            cards[index].followed = value
        }
        for index in posts.indices where posts[index].id == id || posts[index].userID == id {
            posts[index].followed = value
        }
        for index in people.indices where people[index].id == id {
            people[index].followed = value
        }
    }

    func toggleLike(_ id: String) {
        guard let index = posts.firstIndex(where: { $0.id == id }) else { return }
        let on = !posts[index].liked
        posts[index].liked = on
        Task {
            guard let me = UUID(uuidString: meID), let post = UUID(uuidString: id) else { return }
            do { try await YoohooBackend.like(me: me, post: post, on: on) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func comments(for postID: String) -> [CommentItem] {
        comments.filter { $0.postID == postID && !blocked.contains(authorID($0)) }
    }

    func visiblePosts(followedOnly: Bool) -> [PostItem] {
        posts.filter { post in
            !blocked.contains(post.userID) && (!followedOnly || post.followed)
        }
    }

    func addComment(postID: String, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        Task {
            guard let me = UUID(uuidString: meID), let post = UUID(uuidString: postID) else { return }
            do { try await YoohooBackend.addComment(post: post, author: me, body: trimmed) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func publish(caption: String, tags: [String], photos: [String], video: Bool, image: UIImage?) {
        Task {
            do { try await publishMedia(caption: caption, images: image.map { [$0] } ?? [], video: nil) }
            catch { show(error.localizedDescription) }
        }
    }

    func deletePost(_ id: String) {
        posts.removeAll { $0.id == id }
        Task {
            guard let post = UUID(uuidString: id) else { return }
            do { try await YoohooBackend.deletePost(post) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func deleteComment(_ id: String) {
        comments.removeAll { $0.id == id }
        Task {
            guard let comment = UUID(uuidString: id) else { return }
            do { try await YoohooBackend.deleteComment(comment) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func deleteThread(_ id: String) {
        people.removeAll { $0.id == id }
        lines.removeAll { $0.threadID == id }
        Task {
            guard let me = UUID(uuidString: meID), let thread = UUID(uuidString: threadForUser[id] ?? "") else { return }
            try? await YoohooBackend.hideThread(thread: thread, user: me)
            await reload()
        }
    }

    func sendMessage(threadID: String, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        lines.append(ChatLine(id: UUID().uuidString.lowercased(), threadID: threadID, text: trimmed, mine: true, stamp: ""))
        if let index = people.firstIndex(where: { $0.id == threadID }) {
            people[index].preview = trimmed
            people[index].time = "Now"
        }
        Task {
            guard let me = UUID(uuidString: meID) else { return }
            do {
                let thread = try await resolvedThread(threadID)
                try await YoohooBackend.sendMessage(thread: thread, sender: me, body: trimmed)
            } catch {
                show(error.localizedDescription)
            }
            await reload()
        }
    }

    func lines(for threadID: String) -> [ChatLine] {
        lines.filter { $0.threadID == threadID }
    }

    func togglePersonFollow(_ id: String) {
        toggleFollow(id)
    }

    func ensureChat(_ id: String) async {
        guard UUID(uuidString: id) != nil else { return }
        do { _ = try await resolvedThread(id) }
        catch { show(error.localizedDescription) }
        await reload()
    }

    private func resolvedThread(_ userID: String) async throws -> UUID {
        if let known = threadForUser[userID], let id = UUID(uuidString: known) { return id }
        guard let other = UUID(uuidString: userID) else { throw URLError(.badURL) }
        let id = try await YoohooBackend.openThread(other: other)
        threadForUser[userID] = id.uuidString.lowercased()
        return id
    }

    func block(_ userID: String) {
        guard blocked.contains(userID) == false else { return }
        if followedIDs.contains(userID) {
            followedIDs.remove(userID)
            followedCount = max(0, followedCount - 1)
            extraFollowed.removeAll { $0 == userID }
        }
        applyFollowFlags(userID, false)
        blocked.append(userID)
        posts.removeAll { $0.userID == userID }
        cards.removeAll { $0.userID == userID }
        people.removeAll { $0.id == userID }
        comments.removeAll { authorID($0) == userID }
        Task {
            guard let me = UUID(uuidString: meID), let other = UUID(uuidString: userID) else { return }
            do { try await YoohooBackend.block(me: me, other: other) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func unblock(_ userID: String) {
        blocked.removeAll { $0 == userID }
        blockedPeople.removeAll { $0.id == userID }
        Task {
            guard let me = UUID(uuidString: meID), let other = UUID(uuidString: userID) else { return }
            do { try await YoohooBackend.unblock(me: me, other: other) }
            catch { show(error.localizedDescription) }
            await reload()
        }
    }

    func signOut() async {
        await YoohooBackend.signOut()
        clearLocal()
    }

    func fileReport(_ reason: String) async {
        guard let me = UUID(uuidString: meID) else { return }
        do {
            try await YoohooBackend.report(reporter: me, target: reportTarget, reason: reason)
            show("Reported.")
        } catch {
            show(error.localizedDescription)
        }
    }

    func fileFeedback(_ text: String) async {
        guard let me = UUID(uuidString: meID) else { return }
        do {
            try await YoohooBackend.feedback(user: me, body: text)
            show("Sent.")
        } catch {
            show(error.localizedDescription)
        }
    }

    func eraseAccount() async {
        do {
            try await YoohooBackend.deleteAccount()
            clearLocal()
        } catch {
            show(error.localizedDescription)
        }
    }

    private func clearLocal() {
        signedIn = false
        meName = ""
        meHandle = ""
        meID = ""
        known = [:]
        localAvatar = nil
        localCover = nil
        localImages = [:]
        coins = 0
        avatarAsset = ""
        coverAsset = ""
        posts = []
        comments = []
        cards = []
        people = []
        lines = []
        followedIDs = []
        extraFollowed = []
        blocked = []
        followedPeople = []
        fanPeople = []
        blockedPeople = []
        followedCount = 0
        fanCount = 0
        threadForUser = [:]
    }

    private func authorID(_ comment: CommentItem) -> String {
        comment.mine ? meID : comment.author.lowercased()
    }

    static let seedFollowed: Set<String> = ["elowen", "sorrel", "caspian", "eirik", "isolde", "maren", "saffira-list", "veyra", "kaelin"]
    static let followedPageIDs: Set<String> = ["maren", "saffira-list", "veyra", "kaelin"]

    static func profile(_ id: String) -> (name: String, handle: String, avatar: String)? {
        switch id {
        case "kaelin": return ("Kaelin", "@didjd55", "AvatarKaelin")
        case "kianu": return ("Kianu", "@ki85d2", "AvatarKianu")
        case "elowen": return ("Elowen", "@wen992", "AvatarElowen")
        case "seren": return ("Seren", "@dkd821", "AvatarSeren")
        case "maren": return ("Maren", "@dks553", "AvatarMaren")
        case "saffira-list": return ("Saffira", "@de5s8d", "FanSaffira")
        case "veyra": return ("Veyra", "@seje8de", "AvatarIsolde")
        case "rowan": return ("Rowan", "", "AvatarRowan")
        case "thalassa": return ("Thalassa", "", "AvatarThalassa")
        case "torin": return ("Torin", "", "AvatarTorin")
        case "sorrel": return ("Sorrel", "@dk85ds", "AvatarSorrel")
        case "liora": return ("Liora", "@dej8d3", "AvatarLiora")
        case "caspian": return ("Caspian", "@de5d82", "AvatarCaspian")
        case "eirik": return ("Eirik", "@8dej66", "AvatarEirik")
        case "isolde": return ("Isolde", "@isolde", "AvatarIsolde")
        default: return nil
        }
    }

    static let designCards: [FeedCard] = [
        FeedCard(
            id: "kianu",
            userID: "kianu",
            name: "Kianu",
            handle: "@ki85d2",
            caption: "Best ski day ever.",
            tags: ["#Skiing", "#Exercise"],
            photo: "PostKianu",
            avatar: "AvatarKianu",
            followed: false
        ),
        FeedCard(
            id: "elowen",
            userID: "elowen",
            name: "Elowen",
            handle: "@wen992",
            caption: "The snow looks perfect today!",
            tags: ["#Skiing", "#Exercise"],
            photo: "PostElowen",
            avatar: "AvatarElowen",
            followed: true
        )
    ]

    static let designPosts: [PostItem] = [
        PostItem(
            id: "slopes",
            userID: "kianu",
            name: "Kianu",
            handle: "@ki85d2",
            avatar: "AvatarKianu",
            caption: "My happy place is the slopes.",
            tags: ["#Skiing", "#Exercise"],
            photos: ["PostSlopes"],
            isVideo: false,
            time: "15:31",
            followed: false,
            liked: false,
            pageCount: 5,
            mine: false
        ),
        PostItem(
            id: "lodge",
            userID: "seren",
            name: "Seren",
            handle: "@dkd821",
            avatar: "AvatarSeren",
            caption: "Leave the worries at the lodge, find freedom on the snow.",
            tags: ["#Skiing", "#Exercise"],
            photos: ["PostSeren"],
            isVideo: true,
            time: "14:58",
            followed: false,
            liked: true,
            pageCount: 1,
            mine: false
        ),
        PostItem(
            id: "saffira",
            userID: "me",
            name: "Saffira",
            handle: "@sa8d52",
            avatar: "AvatarSaffira",
            caption: "Leave the worries behind, glide down the snow.",
            tags: ["#Skiing", "#Exercise"],
            photos: ["PostSaffira"],
            isVideo: false,
            time: "15:31",
            followed: false,
            liked: false,
            pageCount: 5,
            mine: true
        )
    ]

    static let designComments: [CommentItem] = [
        CommentItem(id: "rowan", postID: "slopes", author: "Rowan", avatar: "AvatarRowan", text: "Love your goggles!", time: "20:44", mine: false),
        CommentItem(id: "thalassa", postID: "slopes", author: "Thalassa", avatar: "AvatarThalassa", text: "Take me with you!", time: "17:02", mine: false),
        CommentItem(id: "torin", postID: "slopes", author: "Torin", avatar: "AvatarTorin", text: "Some of the best memories are made on a snowy mountain.", time: "17:02", mine: false)
    ]

    static let designPeople: [ChatPerson] = [
        ChatPerson(id: "sorrel", name: "Sorrel", handle: "@dk85ds", avatar: "AvatarSorrel", followed: true, preview: "Do you have any skiing trips planned...", time: "20:02"),
        ChatPerson(id: "liora", name: "Liora", handle: "@dej8d3", avatar: "AvatarLiora", followed: false, preview: "Watch out for reckless beginners on...", time: "11/26"),
        ChatPerson(id: "caspian", name: "Caspian", handle: "@de5d82", avatar: "AvatarCaspian", followed: true, preview: "Are you a skier or a snowboarder?", time: "11/27"),
        ChatPerson(id: "eirik", name: "Eirik", handle: "@8dej66", avatar: "AvatarEirik", followed: true, preview: "", time: ""),
        ChatPerson(id: "isolde", name: "Isolde", handle: "@isolde", avatar: "AvatarIsolde", followed: true, preview: "Watch out for reckless beginners on...", time: "11/26")
    ]

    static let designLines: [ChatLine] = [
        ChatLine(id: "s1", threadID: "sorrel", text: "I got up really early to catch the first lift this morning. There were barely any people on the hill, and the snow was soft and quiet.", mine: false, stamp: "12:37"),
        ChatLine(id: "s2", threadID: "sorrel", text: "I’ve been practicing my turns lately. It’s still tricky, but I can feel I’m getting better little by little.", mine: true, stamp: ""),
        ChatLine(id: "s3", threadID: "sorrel", text: "Great!", mine: false, stamp: "17:55")
    ]
}

final class EULAGate {
    static let shared = EULAGate()
    var next: (() -> Void)?
}
