import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        ZStack(alignment: .bottom) {
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
            tabBar
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var feed: some View {
        VStack(spacing: 0) {
            header
            VStack(spacing: 16) {
                ForEach(session.cards) { card in
                    HomeCard(card: card)
                }
            }
            .padding(.top, 16)
            .padding(.bottom, 96)
            .frame(maxWidth: .infinity)
            .background(Color.white)
        }
    }

    private var header: some View {
        ZStack(alignment: .topLeading) {
            Image("HomeSky")
                .resizable()
                .scaledToFill()
                .frame(width: 375, height: 260 * 2.4, alignment: .top)
                .frame(width: 375, height: 260, alignment: .top)
                .clipped()
            Image("SnowCap")
                .resizable()
                .scaledToFill()
                .frame(width: 375, height: 83)
                .clipped()
            Image("FlakeA").resizable().frame(width: 25, height: 25).offset(x: 50, y: 194)
            Image("FlakeB").resizable().frame(width: 25, height: 25).offset(x: 233, y: 167)
            Image("FlakeA")
                .resizable()
                .frame(width: 19, height: 30)
                .scaleEffect(x: 1, y: -1)
                .offset(x: 340, y: 61)
            Button {
                nav.push(.ai)
            } label: {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Glide into winter with Pegu")
                        .font(YoohooFont.display(20))
                        .foregroundStyle(.white)
                        .shadow(color: YoohooColor.titleShadow, radius: 0, y: 3)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text("Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.")
                        .font(YoohooFont.body(14))
                        .foregroundStyle(.white)
                        .frame(width: 253, alignment: .leading)
                }
            }
            .buttonStyle(PressDownStyle())
            .padding(.leading, 16)
            .padding(.top, 80)
            Button {
                nav.push(.ai)
            } label: {
                Image("Penguin")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 150, height: 140)
            }
            .buttonStyle(PressDownStyle())
            .offset(x: 209, y: 144)
            avatar
                .offset(x: 16, y: 214)
        }
        .frame(width: 375, height: 284, alignment: .topLeading)
        .overlay(alignment: .top) {
            SnowEdge().offset(y: 241)
        }
    }

    private var avatar: some View {
        Button {
            nav.push(.profile(session.meID))
        } label: {
            ZStack(alignment: .topLeading) {
                Image("AvatarSaffira")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 50, height: 50)
                    .clipShape(Circle())
                    .offset(x: 10, y: 10)
                Image("AvatarFrame")
                    .resizable()
                    .frame(width: 70, height: 70)
                Image("EditBadge")
                    .resizable()
                    .frame(width: 24, height: 24)
                    .offset(x: 46, y: 46)
            }
            .frame(width: 70, height: 70, alignment: .topLeading)
        }
        .buttonStyle(PressDownStyle())
    }

    private var tabBar: some View {
        MainTabBar()
    }
}

struct MainTabBar: View {
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                item(.home, on: "TabHome", off: "TabHomeOff", title: "home")
                item(.post, on: "TabPostOn", off: "TabPost", title: "post")
                item(.chat, on: "TabChatOn", off: "TabChat", title: "chat")
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            Image("TabSnow")
                .resizable()
                .scaledToFill()
                .frame(height: 15)
                .clipped()
                .padding(.bottom, 2)
        }
        .background(tabShape.fill(YoohooColor.ice).overlay(tabShape.stroke(YoohooColor.blue, lineWidth: 2)))
        .ignoresSafeArea(edges: .bottom)
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
                    Image(selected ? on : off)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 36, height: 36)
                }
                .modifier(nav.tab == .home && selected ? SoftFloat(amount: 2) : SoftFloat(amount: 0))
                Text(title)
                    .font(YoohooFont.heavy(10))
                    .foregroundStyle(selected ? YoohooColor.ink : YoohooColor.gray)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 51)
        }
        .buttonStyle(PressDownStyle())
    }
}

struct HomeCard: View {
    var card: FeedCard
    @EnvironmentObject private var session: YoohooSession
    @EnvironmentObject private var nav: AppNavigator

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            photo
            Text(card.caption)
                .font(YoohooFont.medium(16))
                .foregroundStyle(YoohooColor.ink)
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
        }
        .padding(.horizontal, 16)
    }

    private var photo: some View {
        ZStack(alignment: .topLeading) {
            Image(card.photo)
                .resizable()
                .scaledToFill()
                .frame(width: 343, height: 343)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            liveBadge
                .padding(8)
            Button { nav.push(.live(card.userID)) } label: {
                Image("PlayButton")
                    .resizable()
                    .frame(width: 34, height: 34)
            }
            .frame(width: 343, height: 343)
            .buttonStyle(PressDownStyle())
            .modifier(SoftFloat(amount: 3))
            VStack {
                Spacer()
                HStack(spacing: 8) {
                    authorChip
                    Image(card.followed ? "FollowedGlyph" : "FollowGlyph")
                        .resizable()
                        .frame(width: 34, height: 34)
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
        .padding(.horizontal, 8)
        .frame(height: 28)
        .background(
            Capsule()
                .fill(Color.black.opacity(0.5))
                .overlay(Capsule().stroke(YoohooColor.yellow, lineWidth: 1))
        )
    }

    private var authorChip: some View {
        HStack(spacing: 4) {
            Image(card.avatar)
                .resizable()
                .scaledToFill()
                .frame(width: 33, height: 33)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 1))
            VStack(alignment: .leading, spacing: 0) {
                Text(card.name)
                    .font(YoohooFont.heavy(16))
                    .foregroundStyle(.white)
                Text(card.handle)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(.white)
            }
            if !card.followed {
                Image("BadgePlus")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 23, height: 23)
                    .background(RoundedRectangle(cornerRadius: 8).fill(.white))
                    .onTapGesture { session.toggleFollow(card.id) }
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.black.opacity(0.5))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.yellow, lineWidth: 1))
        )
    }
}
