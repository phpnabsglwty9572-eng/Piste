import SwiftUI
import UIKit

enum YoohooConfig {
    // This product's own test project. Leave empty until that URL and publishable key exist.
    static let supabaseURL = ""
    static let supabaseKey = ""
    static let nameLimit = 24

    static var backendReady: Bool {
        supabaseURL.hasPrefix("https://") && supabaseKey.isEmpty == false
    }
}

struct CoinPack: Identifiable {
    var id: String
    var amount: Int

    static var catalog: [CoinPack] {
        #if YOOHOO_APPSTORE
        return []
        #else
        return [
            CoinPack(id: "6zdz3v2alwput2vo2", amount: 400),
            CoinPack(id: "74s0kqa23h3vjb6o9bb", amount: 800),
            CoinPack(id: "u1g6h9wj1i9ykfnmkgv", amount: 2450),
            CoinPack(id: "wq9s6664bp2r0drdv", amount: 5150),
            CoinPack(id: "7nnk6a5itntmqozk1w52", amount: 10800),
            CoinPack(id: "mq8ufjhoq1oflb67xi", amount: 29400),
            CoinPack(id: "95ywicsa7y52jpo33p", amount: 63700)
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
}

@MainActor
final class YoohooSession: ObservableObject {
    @Published var toast: String?
    @Published var toastSpinning = false
    @Published var busy = false
    @Published var acceptedEULA = false
    @Published var signedIn = false
    @Published var meName = ""
    let meID = "me"
    @Published var coins = 200
    @Published var followedCount = 2344
    @Published var fanCount = 71
    @Published var people: [ChatPerson] = YoohooSession.designPeople
    @Published var lines: [ChatLine] = YoohooSession.designLines
    @Published var cards: [FeedCard] = YoohooSession.designCards
    @Published var posts: [PostItem] = YoohooSession.designPosts
    @Published var comments: [CommentItem] = YoohooSession.designComments
    @Published var blocked: Set<String> = []
    @Published var localImages: [String: UIImage] = [:]
    @Published var frameAsset = "AvatarFrame"
    @Published var coverAsset = "ProfileCover"
    @Published var avatarAsset = "AvatarSaffira"
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

    func toggleFollow(_ id: String) {
        if let index = cards.firstIndex(where: { $0.id == id || $0.userID == id }) {
            cards[index].followed.toggle()
        }
        for index in posts.indices where posts[index].userID == id || posts[index].id == id {
            posts[index].followed.toggle()
        }
    }

    func toggleLike(_ id: String) {
        guard let index = posts.firstIndex(where: { $0.id == id }) else { return }
        posts[index].liked.toggle()
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
        comments.append(CommentItem(
            id: UUID().uuidString.lowercased(),
            postID: postID,
            author: meName.isEmpty ? "You" : meName,
            avatar: "SampleAvatar",
            text: trimmed,
            time: "Now",
            mine: true
        ))
    }

    func publish(caption: String, tags: [String], photos: [String], video: Bool, image: UIImage?) {
        let name = meName.isEmpty ? "You" : meName
        let id = UUID().uuidString.lowercased()
        if let image {
            localImages[id] = image
        }
        posts.insert(PostItem(
            id: id,
            userID: meID,
            name: name,
            handle: "@yoohoo",
            avatar: "SampleAvatar",
            caption: caption,
            tags: tags,
            photos: image == nil ? photos : [id],
            isVideo: video,
            time: "Now",
            followed: false,
            liked: false,
            pageCount: 1,
            mine: true
        ), at: 0)
    }

    func deletePost(_ id: String) {
        posts.removeAll { $0.id == id }
        comments.removeAll { $0.postID == id }
    }

    func deleteComment(_ id: String) {
        comments.removeAll { $0.id == id }
    }

    func deleteThread(_ id: String) {
        people.removeAll { $0.id == id }
        lines.removeAll { $0.threadID == id }
    }

    func sendMessage(threadID: String, text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        lines.append(ChatLine(id: UUID().uuidString.lowercased(), threadID: threadID, text: trimmed, mine: true, stamp: ""))
        if let index = people.firstIndex(where: { $0.id == threadID }) {
            people[index].preview = trimmed
            people[index].time = "Now"
        }
    }

    func lines(for threadID: String) -> [ChatLine] {
        lines.filter { $0.threadID == threadID }
    }

    func togglePersonFollow(_ id: String) {
        guard let index = people.firstIndex(where: { $0.id == id }) else { return }
        people[index].followed.toggle()
    }

    func block(_ userID: String) {
        blocked.insert(userID)
        posts.removeAll { $0.userID == userID }
        cards.removeAll { $0.userID == userID }
        people.removeAll { $0.id == userID }
    }

    private func authorID(_ comment: CommentItem) -> String {
        comment.mine ? meID : comment.author.lowercased()
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
