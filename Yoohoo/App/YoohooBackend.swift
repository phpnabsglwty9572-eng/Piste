import Foundation
import Supabase

enum YoohooBackend {
    static let client = SupabaseClient(
        supabaseURL: URL(string: YoohooConfig.supabaseURL.isEmpty ? "https://example.com" : YoohooConfig.supabaseURL)!,
        supabaseKey: YoohooConfig.supabaseKey.isEmpty ? "public" : YoohooConfig.supabaseKey
    )

    static var userID: UUID? { client.auth.currentUser?.id }

    static func signInWithApple(token: String, nonce: String) async throws {
        try await client.auth.signInWithIdToken(credentials: OpenIDConnectCredentials(provider: .apple, idToken: token, nonce: nonce))
    }

    static func signOut() async {
        try? await client.auth.signOut()
    }

    static func loadMe() async throws -> ProfileRow? {
        guard let me = userID else { throw URLError(.userAuthenticationRequired) }
        let rows: [ProfileRow] = try await client.from("profiles").select().eq("id", value: me).limit(1).execute().value
        return rows.first
    }

    static func saveProfile(id: UUID, name: String, avatar: String?, cover: String?) async throws {
        try await client.from("profiles").update(ProfileWrite(name: name, avatarURL: avatar, coverURL: cover)).eq("id", value: id).execute()
    }

    static func credit(transaction: String, product: String) async throws -> Int {
        try await client.rpc("credit_gems", params: CreditParams(pTx: transaction, pProduct: product)).execute().value
    }

    static func accessToken() async -> String? {
        (try? await client.auth.session)?.accessToken
    }

    static func refreshToken() async -> String? {
        (try? await client.auth.session)?.refreshToken
    }

    static func sessionTokens() async -> (access: String?, refresh: String?) {
        let session = try? await client.auth.session
        return (session?.accessToken, session?.refreshToken)
    }

    static func applySession(access: String, refresh: String) async throws {
        try await client.auth.setSession(accessToken: access, refreshToken: refresh)
    }

    static func latestHotRelease() async throws -> HotReleaseRow? {
        let rows: [HotReleaseRow] = try await client.from("hot_releases")
            .select()
            .eq("published", value: true)
            .eq("platform", value: "ios")
            .order("version", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows.first
    }
}

struct HotReleaseRow: Decodable {
    var version: Int
    var minNative: String?
    var rnURL: String?
    var h5URL: String
    var channel: String?
    enum CodingKeys: String, CodingKey {
        case version, channel
        case minNative = "min_native"
        case rnURL = "rn_url"
        case h5URL = "h5_url"
    }
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

struct ProfileWrite: Encodable {
    var name: String
    var avatarURL: String?
    var coverURL: String?
    enum CodingKeys: String, CodingKey {
        case name
        case avatarURL = "avatar_url"
        case coverURL = "cover_url"
    }
}

struct CreditParams: Encodable {
    var pTx: String
    var pProduct: String
    enum CodingKeys: String, CodingKey {
        case pTx = "p_tx"
        case pProduct = "p_product"
    }
}
