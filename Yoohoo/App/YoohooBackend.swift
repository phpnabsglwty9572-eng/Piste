import Foundation
import Supabase
import SwiftUI

enum YoohooBackend {
    static let client = SupabaseClient(
        supabaseURL: URL(string: YoohooConfig.supabaseURL.isEmpty ? "https://example.com" : YoohooConfig.supabaseURL)!,
        supabaseKey: YoohooConfig.supabaseKey.isEmpty ? "public" : YoohooConfig.supabaseKey
    )

    static var userID: UUID? { client.auth.currentUser?.id }

    static func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    static func signUp(email: String, password: String, name: String) async throws {
        try await client.auth.signUp(email: email, password: password, data: ["name": .string(name)])
    }

    static func signInWithApple(token: String, nonce: String) async throws {
        try await client.auth.signInWithIdToken(credentials: OpenIDConnectCredentials(provider: .apple, idToken: token, nonce: nonce))
    }

    static func signOut() async {
        try? await client.auth.signOut()
    }

    static func load() async throws -> RemoteLibrary {
        guard let me = userID else { throw URLError(.userAuthenticationRequired) }
        let profiles: [ProfileRow] = try await client.from("profiles").select()
            .or("created_at.gte.\"2026-11-12T00:00:00Z\",id.eq.\(me.uuidString)")
            .execute().value
        let ids = profiles.map(\.id)
        let posts: [PostRow] = ids.isEmpty ? [] : try await client.from("posts").select().in("author_id", values: ids).order("created_at", ascending: false).execute().value
        let postIDs = posts.map(\.id)
        let comments: [CommentRow] = postIDs.isEmpty ? [] : try await client.from("comments").select().in("post_id", values: postIDs).order("created_at", ascending: true).execute().value
        let rooms: [RoomRow] = ids.isEmpty ? [] : try await client.from("rooms").select().in("owner_id", values: ids).order("created_at", ascending: false).execute().value
        let follows: [FollowRow] = try await client.from("follows").select().or("follower.eq.\(me.uuidString),followee.eq.\(me.uuidString)").execute().value
        let blocks: [BlockRow] = try await client.from("blocks").select().eq("blocker", value: me).execute().value
        let likes: [LikeRow] = try await client.from("post_likes").select().eq("user_id", value: me).execute().value
        let threads: [ThreadRow] = try await client.from("threads").select().or("user_low.eq.\(me.uuidString),user_high.eq.\(me.uuidString)").execute().value
        let hidden: [HideRow] = try await client.from("thread_hides").select().eq("user_id", value: me).execute().value
        let hiddenIDs = Set(hidden.map(\.threadID))
        let visibleThreads = threads.filter { hiddenIDs.contains($0.id) == false }
        let threadIDs = visibleThreads.map(\.id)
        let messages: [MessageRow] = threadIDs.isEmpty ? [] : try await client.from("messages").select().in("thread_id", values: threadIDs).order("created_at", ascending: true).execute().value
        return RemoteLibrary(me: me, profiles: profiles, posts: posts, comments: comments, rooms: rooms, follows: follows, blocks: blocks, likes: likes, threads: visibleThreads, messages: messages)
    }

    static func setFollow(me: UUID, other: UUID, follow: Bool) async throws {
        if follow {
            try await client.from("follows").insert(FollowWrite(follower: me, followee: other)).execute()
        } else {
            try await client.from("follows").delete().eq("follower", value: me).eq("followee", value: other).execute()
        }
    }

    static func block(me: UUID, other: UUID) async throws {
        try await client.from("blocks").insert(BlockWrite(blocker: me, blocked: other)).execute()
    }

    static func unblock(me: UUID, other: UUID) async throws {
        try await client.from("blocks").delete().eq("blocker", value: me).eq("blocked", value: other).execute()
    }

    static func like(me: UUID, post: UUID, on: Bool) async throws {
        if on {
            try await client.from("post_likes").insert(LikeWrite(postID: post, userID: me)).execute()
        } else {
            try await client.from("post_likes").delete().eq("post_id", value: post).eq("user_id", value: me).execute()
        }
    }

    static func addComment(post: UUID, author: UUID, body: String) async throws {
        try await client.from("comments").insert(CommentWrite(postID: post, authorID: author, body: body)).execute()
    }

    static func deletePost(_ id: UUID) async throws {
        try await client.from("posts").delete().eq("id", value: id).execute()
    }

    static func deleteComment(_ id: UUID) async throws {
        try await client.from("comments").delete().eq("id", value: id).execute()
    }

    static func publish(author: UUID, body: String, urls: [String], video: Bool) async throws {
        try await client.from("posts").insert(PostWrite(authorID: author, body: body, isVideo: video, mediaURL: urls.first, mediaURLs: urls)).execute()
    }

    static func upload(data: Data, path: String, type: String) async throws -> String {
        try await client.storage.from("media").upload(path, data: data, options: FileOptions(contentType: type, upsert: true))
        return try client.storage.from("media").getPublicURL(path: path).absoluteString
    }

    static func saveProfile(id: UUID, name: String, avatar: String?, cover: String?) async throws {
        try await client.from("profiles").update(ProfileWrite(name: name, avatarURL: avatar, coverURL: cover)).eq("id", value: id).execute()
    }

    static func openThread(other: UUID) async throws -> UUID {
        try await client.rpc("open_thread", params: ["other": other.uuidString]).execute().value
    }

    static func sendMessage(thread: UUID, sender: UUID, body: String) async throws {
        try await client.from("messages").insert(MessageWrite(threadID: thread, senderID: sender, body: body)).execute()
    }

    static func hideThread(thread: UUID, user: UUID) async throws {
        try await client.from("thread_hides").upsert(HideWrite(threadID: thread, userID: user)).execute()
    }

    static func roomMembers(_ room: UUID) async throws -> [UUID] {
        let rows: [MemberRow] = try await client.from("room_members").select().eq("room_id", value: room).execute().value
        return rows.map(\.userID)
    }

    static func joinRoom(_ room: UUID, user: UUID) async throws {
        try await client.from("room_members").upsert(MemberWrite(roomID: room, userID: user)).execute()
    }

    static func roomMessages(_ room: UUID) async throws -> [RoomMessageRow] {
        try await client.from("room_messages").select().eq("room_id", value: room).order("created_at", ascending: true).execute().value
    }

    static func sendRoomMessage(room: UUID, sender: UUID, body: String) async throws {
        try await client.from("room_messages").insert(RoomMessageWrite(roomID: room, senderID: sender, body: body)).execute()
    }

    static func sendGift(room: UUID, cost: Int, label: String) async throws -> Int {
        try await client.rpc("send_gift", params: GiftParams(pRoom: room, pCost: cost, pLabel: label)).execute().value
    }

    static func credit(transaction: String, product: String) async throws -> Int {
        try await client.rpc("credit_gems", params: CreditParams(pTx: transaction, pProduct: product)).execute().value
    }

    static func report(reporter: UUID, target: String, reason: String) async throws {
        try await client.from("reports").insert(ReportWrite(reporter: reporter, target: target, reason: reason)).execute()
    }

    static func feedback(user: UUID, body: String) async throws {
        try await client.from("feedback").insert(FeedbackWrite(userID: user, body: body)).execute()
    }

    static func aiLines() async throws -> [AIRow] {
        guard let me = userID else { return [] }
        return try await client.from("ai_messages").select().eq("user_id", value: me).order("created_at", ascending: true).execute().value
    }

    static func addAI(mine: Bool, body: String) async throws {
        guard let me = userID else { return }
        try await client.from("ai_messages").insert(AIWrite(userID: me, mine: mine, body: body)).execute()
    }

    static func deleteAccount() async throws {
        try await client.rpc("delete_own_account").execute()
        try? await client.auth.signOut()
    }
}

struct RemoteLibrary {
    var me: UUID
    var profiles: [ProfileRow]
    var posts: [PostRow]
    var comments: [CommentRow]
    var rooms: [RoomRow]
    var follows: [FollowRow]
    var blocks: [BlockRow]
    var likes: [LikeRow]
    var threads: [ThreadRow]
    var messages: [MessageRow]
}

struct ProfileRow: Decodable {
    var id: UUID
    var name: String
    var handle: String
    var avatarURL: String?
    var coverURL: String?
    var gems: Int
    enum CodingKeys: String, CodingKey {
        case id, name, handle, gems
        case avatarURL = "avatar_url"
        case coverURL = "cover_url"
    }
}

struct PostRow: Decodable {
    var id: UUID
    var authorID: UUID
    var body: String
    var isVideo: Bool
    var mediaURL: String?
    var mediaURLs: [String]?
    var createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, body
        case authorID = "author_id"
        case isVideo = "is_video"
        case mediaURL = "media_url"
        case mediaURLs = "media_urls"
        case createdAt = "created_at"
    }
}

struct CommentRow: Decodable {
    var id: UUID
    var postID: UUID
    var authorID: UUID
    var body: String
    var createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, body
        case postID = "post_id"
        case authorID = "author_id"
        case createdAt = "created_at"
    }
}

struct RoomRow: Decodable {
    var id: UUID
    var ownerID: UUID
    var title: String
    var coverURL: String?
    var videoURL: String?
    enum CodingKeys: String, CodingKey {
        case id, title
        case ownerID = "owner_id"
        case coverURL = "cover_url"
        case videoURL = "video_url"
    }
}

struct HideRow: Decodable {
    var threadID: UUID
    enum CodingKeys: String, CodingKey { case threadID = "thread_id" }
}
struct HideWrite: Encodable {
    var threadID: UUID
    var userID: UUID
    enum CodingKeys: String, CodingKey { case threadID = "thread_id"; case userID = "user_id" }
}
struct MemberRow: Decodable {
    var userID: UUID
    enum CodingKeys: String, CodingKey { case userID = "user_id" }
}
struct BlockRow: Decodable { var blocker: UUID; var blocked: UUID }
struct LikeRow: Decodable {
    var postID: UUID
    var userID: UUID
    enum CodingKeys: String, CodingKey { case postID = "post_id"; case userID = "user_id" }
}
struct ThreadRow: Decodable {
    var id: UUID
    var userLow: UUID
    var userHigh: UUID
    enum CodingKeys: String, CodingKey { case id; case userLow = "user_low"; case userHigh = "user_high" }
}
struct MessageRow: Decodable {
    var id: UUID
    var threadID: UUID
    var senderID: UUID
    var body: String
    enum CodingKeys: String, CodingKey {
        case id, body
        case threadID = "thread_id"
        case senderID = "sender_id"
    }
}
struct RoomMessageRow: Decodable, Identifiable {
    var id: UUID
    var senderID: UUID
    var body: String
    enum CodingKeys: String, CodingKey { case id, body; case senderID = "sender_id" }
}

struct FollowWrite: Encodable { var follower: UUID; var followee: UUID }
struct BlockWrite: Encodable { var blocker: UUID; var blocked: UUID }
struct LikeWrite: Encodable {
    var postID: UUID
    var userID: UUID
    enum CodingKeys: String, CodingKey { case postID = "post_id"; case userID = "user_id" }
}
struct CommentWrite: Encodable {
    var postID: UUID
    var authorID: UUID
    var body: String
    enum CodingKeys: String, CodingKey { case body; case postID = "post_id"; case authorID = "author_id" }
}
struct PostWrite: Encodable {
    var authorID: UUID
    var body: String
    var isVideo: Bool
    var mediaURL: String?
    var mediaURLs: [String]
    enum CodingKeys: String, CodingKey {
        case body
        case authorID = "author_id"
        case isVideo = "is_video"
        case mediaURL = "media_url"
        case mediaURLs = "media_urls"
    }
}
struct ProfileWrite: Encodable {
    var name: String
    var avatarURL: String?
    var coverURL: String?
    enum CodingKeys: String, CodingKey { case name; case avatarURL = "avatar_url"; case coverURL = "cover_url" }
}
struct MessageWrite: Encodable {
    var threadID: UUID
    var senderID: UUID
    var body: String
    enum CodingKeys: String, CodingKey { case body; case threadID = "thread_id"; case senderID = "sender_id" }
}
struct MemberWrite: Encodable {
    var roomID: UUID
    var userID: UUID
    enum CodingKeys: String, CodingKey { case roomID = "room_id"; case userID = "user_id" }
}
struct RoomMessageWrite: Encodable {
    var roomID: UUID
    var senderID: UUID
    var body: String
    enum CodingKeys: String, CodingKey { case body; case roomID = "room_id"; case senderID = "sender_id" }
}
struct ReportWrite: Encodable { var reporter: UUID; var target: String; var reason: String }
struct FeedbackWrite: Encodable {
    var userID: UUID
    var body: String
    enum CodingKeys: String, CodingKey { case body; case userID = "user_id" }
}
struct GiftParams: Encodable {
    var pRoom: UUID
    var pCost: Int
    var pLabel: String
    enum CodingKeys: String, CodingKey { case pRoom = "p_room"; case pCost = "p_cost"; case pLabel = "p_label" }
}
struct UserImage: View {
    var name: String

    var body: some View {
        if let url = URL(string: name), name.hasPrefix("http") {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Color.white.opacity(0.35)
                }
            }
        } else if name.isEmpty {
            Color.white.opacity(0.35)
        } else {
            Image(name).resizable().scaledToFill()
        }
    }
}

struct AIRow: Decodable, Identifiable {
    var id: UUID
    var mine: Bool
    var body: String
}
struct AIWrite: Encodable {
    var userID: UUID
    var mine: Bool
    var body: String
    enum CodingKeys: String, CodingKey { case mine, body; case userID = "user_id" }
}

struct CreditParams: Encodable {
    var pTx: String
    var pProduct: String
    enum CodingKeys: String, CodingKey { case pTx = "p_tx"; case pProduct = "p_product" }
}
