import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            GeometryReader { geo in
                let scale = geo.size.width / 375
                ScrollView {
                    feed
                        .frame(width: 375, alignment: .topLeading)
                        .scaleEffect(scale, anchor: .top)
                        .frame(width: geo.size.width, alignment: .top)
                }
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var feed: some View {
        VStack(spacing: 0) {
            header
            VStack(spacing: 16) {
                if session.cards.isEmpty {
                    EmptyPenguin(message: "No more data").frame(height: 280)
                }
                ForEach(session.cards) { card in
                    HomeCard(card: card)
                }
            }
            .padding(.top, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
            .background(Color.white)
        }
    }

    private var header: some View {
        ZStack(alignment: .topLeading) {
            Image("HomeSky")
                .resizable()
                .frame(width: 375, height: 260 * 2.4038)
                .offset(y: -260 * 0.2769)
                .frame(width: 375, height: 260, alignment: .topLeading)
                .clipped()
                .allowsHitTesting(false)
            Image("SnowCap")
                .resizable()
                .scaledToFill()
                .frame(width: 375, height: 83)
                .clipped()
                .allowsHitTesting(false)
            Image("FlakeA").resizable().frame(width: 25, height: 25).offset(x: 50, y: 194).allowsHitTesting(false)
            Image("FlakeB").resizable().frame(width: 25, height: 25).offset(x: 233, y: 167).allowsHitTesting(false)
            Image("FlakeA")
                .resizable()
                .scaledToFill()
                .frame(width: 19 * 1.5789, height: 30)
                .offset(x: 19 * -0.5789)
                .frame(width: 19, height: 30, alignment: .topLeading)
                .clipped()
                .scaleEffect(x: -1, y: -1)
                .offset(x: 356, y: 61)
                .allowsHitTesting(false)
            SnowEdge()
                .padding(.top, 241)
                .allowsHitTesting(false)
            VStack(alignment: .leading, spacing: 12) {
                Button(action: { nav.push(.ai) }) {
                    Text("Glide into winter with Pegu")
                        .font(YoohooFont.display(20))
                        .foregroundStyle(.white)
                        .shadow(color: Color(red: 191 / 255, green: 222 / 255, blue: 240 / 255), radius: 2, y: -3)
                        .shadow(color: YoohooColor.titleShadow, radius: 0, y: 3)
                        .lineLimit(1)
                }
                .buttonStyle(PressDownStyle())
                Button(action: { nav.push(.ai) }) {
                    Text("Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.")
                        .font(YoohooFont.body(14))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                        .frame(width: 253, alignment: .leading)
                }
                .buttonStyle(PressDownStyle())
            }
            .padding(.top, 80)
            .padding(.leading, 16)
            Button(action: { nav.push(.ai) }) {
                Image("Penguin")
                    .resizable()
                    .frame(width: 150 * 1.0949, height: 140 * 1.1731)
                    .offset(x: 150 * -0.0511, y: 140 * -0.0983)
                    .frame(width: 150, height: 140, alignment: .topLeading)
                    .clipped()
            }
            .buttonStyle(PressDownStyle())
            .offset(x: 209, y: 144)
            avatar
                .offset(x: 16, y: 214)
                .zIndex(2)
            Button { nav.push(.settings) } label: {
                Image("SettingsIcon")
                    .resizable()
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(PressDownStyle())
            .offset(x: 325, y: 16)
            .zIndex(2)
        }
        .frame(width: 375, height: 284, alignment: .topLeading)
    }

    private var avatar: some View {
        Button {
            nav.push(.profile(session.meID))
        } label: {
            ZStack(alignment: .topLeading) {
                homeFace
                    .frame(width: 50, height: 50, alignment: .topLeading)
                    .clipped()
                    .clipShape(Circle())
                    .padding(.leading, 10)
                    .padding(.top, 10)
                Image("AvatarFrame")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 70, height: 70)
                    .clipped()
                Image("EditBadge")
                    .resizable()
                    .frame(width: 24, height: 24)
                    .padding(.leading, 46)
                    .padding(.top, 46)
            }
            .frame(width: 70, height: 70, alignment: .topLeading)
        }
        .buttonStyle(PressDownStyle())
    }

    private var homeFace: some View {
        Group {
            if session.avatarAsset.hasPrefix("http") {
                UserImage(name: session.avatarAsset)
            } else if let photo = session.localAvatar {
                Image(uiImage: photo).resizable().scaledToFill()
            } else {
                Image("AIUserFace")
                    .resizable()
                    .frame(width: 50 * 1.0042, height: 50 * 1.7556)
                    .offset(x: 50 * -0.0021, y: 50 * -0.2667)
            }
        }
    }

}

struct MainTabBar: View {
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 5) {
                item(.home, on: "TabHome", off: "TabHomeOff", title: "home")
                item(.post, on: "TabPostOn", off: "TabPost", title: "post")
                item(.chat, on: "TabChatOn", off: "TabChat", title: "chat")
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
        .frame(height: 71, alignment: .top)
        .overlay(alignment: .bottom) {
            Image("TabSnow")
                .resizable()
                .frame(width: 371 * 1.0098, height: 15 * 9.9333)
                .offset(x: 371 * -0.0008, y: 15 * -3.0667)
                .frame(width: 371, height: 15, alignment: .topLeading)
                .clipped()
                .allowsHitTesting(false)
        }
        .background(tabShape.fill(YoohooColor.ice).overlay(tabShape.stroke(YoohooColor.blue, lineWidth: 2)))
        .contentShape(Rectangle())
    }

    private var tabShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 40, bottomLeading: 0, bottomTrailing: 0, topTrailing: 40))
    }

    private func item(_ tab: AppTab, on: String, off: String, title: String) -> some View {
        let selected = nav.tab == tab
        return Button {
            nav.tab = tab
        } label: {
            VStack(spacing: 1) {
                ZStack {
                    Circle().fill(.white).frame(width: 36, height: 36)
                    if tab == .home && selected {
                        Image(on)
                            .resizable()
                            .frame(width: 36 * 1.05, height: 36 * 1.05)
                            .offset(x: 36 * -0.025, y: 36 * -0.025)
                            .frame(width: 36, height: 36, alignment: .topLeading)
                            .clipped()
                    } else {
                        Image(selected ? on : off)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 36, height: 36)
                            .clipped()
                    }
                }
                .modifier(tab == .home && selected ? SoftFloat(amount: 2) : SoftFloat(amount: 0))
                Text(title)
                    .font(YoohooFont.heavy(10))
                    .foregroundStyle(selected ? YoohooColor.ink : YoohooColor.gray)
            }
            .frame(width: 111, height: 51)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressDownStyle())
    }
}

struct HomeCard: View {
    var card: FeedCard
    @EnvironmentObject private var session: YoohooSession
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            photo
            Text(card.caption)
                .font(YoohooFont.medium(16))
                .foregroundStyle(YoohooColor.ink)
                .padding(.top, 8)
            HStack(spacing: 8) {
                ForEach(card.tags, id: \.self) { tag in
                    Text(tag)
                        .font(YoohooFont.medium(12))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .frame(height: 19)
                        .background(RoundedRectangle(cornerRadius: 4).fill(YoohooColor.ice))
                }
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 16)
    }

    private var photo: some View {
        ZStack(alignment: .topLeading) {
            if card.photo.hasPrefix("http") {
                UserImage(name: card.photo)
                    .frame(width: 343, height: 343)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            } else {
                Color(red: 0.85, green: 0.93, blue: 1)
                    .frame(width: 343, height: 343)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            }
            liveBadge
                .padding(8)
            Button { nav.push(.live(card.id)) } label: {
                Image("PlayButton")
                    .resizable()
                    .frame(width: 34, height: 34)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(width: 343, height: 343)
            .buttonStyle(PressDownStyle())
            .modifier(SoftFloat(amount: 3))
            VStack {
                Spacer()
                HStack(spacing: 8) {
                    authorChip
                    Button { session.toggleFollow(card.userID) } label: {
                        Image(card.followed ? "FollowedGlyph" : "FollowGlyph")
                            .resizable()
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                    .modifier(SoftFloat(amount: 2))
                    Image("MoreGlyph")
                        .resizable()
                        .frame(width: 34, height: 34)
                        .modifier(SoftFloat(amount: 2))
                        .onTapGesture { nav.sheet = .about(.person(card.userID)) }
                    Spacer(minLength: 0)
                }
                .padding(8)
            }
            .frame(width: 343, height: 343)
        }
        .frame(width: 343, height: 343)
    }

    private var liveBadge: some View {
        HStack(spacing: 3) {
            Image("LiveGlyph")
                .resizable()
                .frame(width: 20, height: 20)
            Text("Live")
                .font(YoohooFont.heavy(16))
                .foregroundStyle(.white)
        }
        .padding(.leading, 10)
        .frame(width: 75, height: 28, alignment: .leading)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.5))
                .overlay(Capsule().stroke(YoohooColor.yellow, lineWidth: 1))
        )
    }

    private var face: some View {
        Button { nav.push(.profile(card.userID)) } label: {
            UserImage(name: card.avatar)
            .frame(width: 33, height: 33)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 1))
        }
        .buttonStyle(PressDownStyle())
    }

    private var authorChip: some View {
        HStack(spacing: 0) {
            face
            VStack(alignment: .leading, spacing: 0) {
                Text(card.name)
                    .font(YoohooFont.heavy(16))
                    .foregroundStyle(.white)
                    .frame(height: 18, alignment: .top)
                Text(card.handle)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(.white)
                    .frame(height: 17, alignment: .top)
            }
            .padding(.leading, 4)
            Button { session.toggleFollow(card.userID) } label: {
                Image("BadgePlus")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 23, height: 23)
                    .frame(width: 25, height: 25)
                    .background(RoundedRectangle(cornerRadius: 10).fill(.white))
            }
            .buttonStyle(PressDownStyle())
            .padding(.leading, 12)
        }
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .frame(height: 41)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.5))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.yellow, lineWidth: 1))
        )
    }
}
