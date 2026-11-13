import SwiftUI

struct ProfileView: View {
    var userID: String
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var likes = false

    private var mine: Bool { userID == session.meID }

    private var rows: [PostItem] {
        session.posts.filter { post in
            guard session.blocked.contains(post.userID) == false else { return false }
            if likes { return post.liked && (mine || post.userID == userID) }
            return post.userID == userID
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 12) {
                    cover
                    identity
                    stats
                    filters
                    posts
                }
                .padding(.bottom, 24)
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var cover: some View {
        ZStack(alignment: .top) {
            coverImage
                .frame(maxWidth: .infinity)
                .frame(height: 300)
                .clipped()
                .allowsHitTesting(false)
            VStack {
                Spacer(minLength: 0)
                SnowEdge()
            }
            .frame(height: 300)
            .allowsHitTesting(false)
            Image("HeaderSled")
                .resizable()
                .scaledToFit()
                .frame(width: 32, height: 32)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .padding(.trailing, 16)
                .padding(.bottom, 8)
                .allowsHitTesting(false)
            HStack {
                Button(action: nav.pop) {
                    Image("BackButton").resizable().frame(width: 34, height: 34)
                }
                .buttonStyle(PressDownStyle())
                Spacer()
                if mine {
                    Button { nav.push(.settings) } label: {
                        Image("SettingsIcon").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                } else {
                    Button { nav.sheet = .about(.person(userID)) } label: {
                        Image("MoreCircle").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .frame(maxWidth: .infinity)
            .zIndex(2)
            avatar
                .padding(.top, 214)
                .zIndex(3)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 300, alignment: .top)
    }

    private var coverImage: some View {
        let remote = mine ? session.coverAsset : (session.known[userID]?.cover ?? "")
        return Group {
            if remote.hasPrefix("http") {
                UserImage(name: remote)
            } else if mine, let photo = session.localCover {
                Image(uiImage: photo).resizable().scaledToFill()
            } else {
                Image("ProfileCover").resizable().scaledToFill()
            }
        }
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if avatarURL.hasPrefix("http") {
                    UserImage(name: avatarURL)
                } else if mine, let photo = session.localAvatar {
                    Image(uiImage: photo).resizable().scaledToFill()
                } else if avatarURL.isEmpty == false {
                    Image(avatarURL).resizable().scaledToFill()
                } else {
                    Image("AIUserFace").resizable().scaledToFill()
                }
            }
            .frame(width: 70, height: 70)
            .clipShape(Circle())
            Image(mine ? session.frameAsset : (userID == "seren" ? "FrameTrophy" : "AvatarFrame"))
                .resizable()
                .frame(width: 80, height: 80)
            if mine {
                Button { nav.push(.editProfile) } label: {
                    Image("EditBadge").resizable().frame(width: 24, height: 24)
                }
                .buttonStyle(PressDownStyle())
            } else {
                Button { session.toggleFollow(userID) } label: {
                    Image(session.isFollowed(userID) ? "FollowedGlyph" : "BadgePlus")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 22, height: 22)
                        .background(Circle().fill(.white).overlay(Circle().stroke(YoohooColor.pink, lineWidth: 1)))
                }
                .buttonStyle(PressDownStyle())
            }
        }
        .frame(width: 80, height: 80)
    }

    private var avatarURL: String {
        if mine { return session.avatarAsset }
        return session.known[userID]?.avatar
            ?? session.posts.first { $0.userID == userID }?.avatar
            ?? ""
    }

    private var identity: some View {
        ZStack(alignment: .trailing) {
            VStack(spacing: 2) {
                Text(displayName).font(YoohooFont.heavy(18)).foregroundStyle(YoohooColor.ink)
                Text(displayHandle).font(YoohooFont.medium(14)).foregroundStyle(YoohooColor.gray)
            }
            .frame(maxWidth: .infinity)
            if mine {
                shopChip
            } else {
                chatChip
            }
        }
        .padding(.top, 8)
    }

    private var shopChip: some View {
        Button { nav.push(.coinShop) } label: {
            HStack(spacing: 4) {
                Image("CoinShop").resizable().scaledToFit().frame(width: 44, height: 44)
                Text("Coin Shop")
                    .font(YoohooFont.title(18))
                    .foregroundStyle(.black)
                    .shadow(color: Color(red: 212 / 255, green: 188 / 255, blue: 0), radius: 0, y: 2)
            }
            .padding(.leading, 8)
            .frame(height: 34)
            .background(
                UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                    .fill(Color(red: 1, green: 237 / 255, blue: 101 / 255))
                    .overlay(
                        UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                            .stroke(YoohooColor.blue, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PressDownStyle())
    }

    private var chatChip: some View {
        Button { nav.push(.chat(userID)) } label: {
            HStack(spacing: 4) {
                Image("ChatNow").resizable().scaledToFit().frame(width: 44, height: 44)
                Text("Chat Now")
                    .font(YoohooFont.title(18))
                    .foregroundStyle(.black)
                    .shadow(color: Color(red: 245 / 255, green: 183 / 255, blue: 1), radius: 0, y: 2)
            }
            .padding(.leading, 8)
            .frame(height: 34)
            .background(
                UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                    .fill(Color(red: 251 / 255, green: 226 / 255, blue: 1))
                    .overlay(
                        UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                            .stroke(YoohooColor.blue, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PressDownStyle())
    }

    private var displayName: String {
        if mine { return session.meName }
        return session.known[userID]?.name
            ?? session.posts.first { $0.userID == userID }?.name
            ?? ""
    }

    private var displayHandle: String {
        if mine { return session.meHandle }
        return session.known[userID]?.handle
            ?? session.posts.first { $0.userID == userID }?.handle
            ?? ""
    }

    private var stats: some View {
        HStack(spacing: 0) {
            stat("\(followedValue)", "Followed") { if mine { nav.push(.people("Followed")) } }
            divider
            stat("\(fanValue)", "Fans") { if mine { nav.push(.people("Fans")) } }
            divider
            stat("\(blacklistValue)", "Blacklist") { if mine { nav.push(.people("Blacklist")) } }
        }
        .padding(.horizontal, 16)
    }

    private var followedValue: Int {
        mine ? session.followedCount : (session.followingByUser[userID] ?? 0)
    }

    private var fanValue: Int {
        mine ? session.fanCount : (session.fansByUser[userID] ?? 0)
    }

    private var blacklistValue: Int {
        mine ? session.blocked.count : 0
    }

    private func stat(_ value: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Text(value).font(YoohooFont.heavy(18)).foregroundStyle(.black)
                Text(title).font(YoohooFont.medium(12)).foregroundStyle(YoohooColor.ink)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private var divider: some View {
        Rectangle().fill(Color(white: 0.85)).frame(width: 1, height: 22)
    }

    private var filters: some View {
        HStack(spacing: 13) {
            SnowChoice(title: "Post", selected: !likes, width: 165) {
                withAnimation(.easeInOut(duration: 0.25)) { likes = false }
            }
            SnowChoice(title: "Like", selected: likes, width: 165) {
                withAnimation(.easeInOut(duration: 0.25)) { likes = true }
            }
        }
        .frame(width: 343)
        .frame(maxWidth: .infinity)
    }

    private var posts: some View {
        Group {
            if rows.isEmpty {
                EmptyPenguin(message: "No more data").frame(height: 220)
            } else {
                VStack(spacing: 16) {
                    ForEach(rows) { post in
                        PostCard(post: post)
                    }
                }
            }
        }
        .id(likes)
        .transition(.opacity.combined(with: .move(edge: .trailing)))
    }
}
