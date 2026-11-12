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
            if likes {
                return mine ? post.liked : post.userID == userID && post.liked
            }
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
        ZStack(alignment: .bottom) {
            coverImage
                .frame(height: 300)
                .frame(maxWidth: .infinity)
                .clipped()
            SnowEdge()
            VStack {
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
                            Image("MoreDots").resizable().frame(width: 34, height: 34)
                        }
                        .buttonStyle(PressDownStyle())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                Spacer()
            }
            avatar
                .offset(y: 36)
        }
        .frame(height: 300)
    }

    private var coverImage: some View {
        Group {
            if mine, let photo = session.localCover {
                Image(uiImage: photo).resizable().scaledToFill()
            } else {
                Image(mine ? session.coverAsset : (userID == "seren" ? "SerenCover" : "ProfileCover"))
                    .resizable()
                    .scaledToFill()
            }
        }
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var avatar: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if mine, let photo = session.localAvatar {
                    Image(uiImage: photo).resizable().scaledToFill()
                } else {
                    Image(mine ? session.avatarAsset : avatarName).resizable().scaledToFill()
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
            } else if session.isFollowed(userID) == false {
                Button { session.toggleFollow(userID) } label: {
                    Image("BadgePlus").resizable().scaledToFit().frame(width: 22, height: 22)
                        .background(Circle().fill(.white).overlay(Circle().stroke(YoohooColor.pink, lineWidth: 1)))
                }
                .buttonStyle(PressDownStyle())
            }
        }
        .frame(width: 80, height: 80)
    }

    private var avatarName: String {
        session.posts.first { $0.userID == userID }?.avatar
            ?? session.people.first { $0.id == userID }?.avatar
            ?? YoohooSession.profile(userID)?.avatar
            ?? "AvatarSaffira"
    }

    private var identity: some View {
        HStack {
            Spacer()
            VStack(spacing: 2) {
                Text(displayName).font(YoohooFont.heavy(18)).foregroundStyle(YoohooColor.ink)
                Text(displayHandle).font(YoohooFont.medium(14)).foregroundStyle(YoohooColor.gray)
            }
            Spacer()
            if mine {
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
            } else {
                Button {
                    session.ensureChat(userID)
                    nav.push(.chat(userID))
                } label: {
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
        }
        .padding(.top, 28)
        .padding(.trailing, mine ? 0 : 16)
    }

    private var displayName: String {
        if mine { return session.meName.isEmpty ? "Saffira" : session.meName }
        return session.posts.first { $0.userID == userID }?.name
            ?? session.people.first { $0.id == userID }?.name
            ?? YoohooSession.profile(userID)?.name
            ?? "Yoohoo"
    }

    private var displayHandle: String {
        if mine { return session.meName.isEmpty ? "@sa8d52" : "@yoohoo" }
        return session.posts.first { $0.userID == userID }?.handle
            ?? session.people.first { $0.id == userID }?.handle
            ?? YoohooSession.profile(userID)?.handle
            ?? ""
    }

    private var stats: some View {
        HStack(spacing: 0) {
            stat(mine ? "\(session.followedCount)" : "108", "Followed")
            divider
            stat(mine ? "\(session.fanCount)" : "33", "Fans")
            divider
            stat(mine ? "\(session.blocked.count)" : "0", "Blacklist")
        }
        .padding(.horizontal, 16)
    }

    private func stat(_ value: String, _ title: String) -> some View {
        VStack(spacing: 0) {
            Text(value).font(YoohooFont.heavy(18)).foregroundStyle(.black)
            Text(title).font(YoohooFont.medium(12)).foregroundStyle(YoohooColor.ink)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(Color(white: 0.85)).frame(width: 1, height: 22)
    }

    private var filters: some View {
        HStack(spacing: 12) {
            SnowChoice(title: "Post", selected: !likes) { likes = false }
            SnowChoice(title: "Like", selected: likes) { likes = true }
        }
        .padding(.horizontal, 16)
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
    }
}
