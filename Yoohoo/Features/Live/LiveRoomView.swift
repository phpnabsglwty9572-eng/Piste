import SwiftUI

struct LiveLine: Identifiable, Equatable {
    var id = UUID().uuidString
    var name: String
    var text: String
    var welcome: Bool = false
}

struct LiveRoomView: View {
    var hostID: String
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var draft = ""
    @State private var lines: [LiveLine] = [
        LiveLine(name: "", text: "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.", welcome: true),
        LiveLine(name: "Thalassa", text: "That jump was insane!"),
        LiveLine(name: "Thalassa", text: "Snow looks perfect today"),
        LiveLine(name: "Maren", text: "Powder day vibes ❄️")
    ]
    @FocusState private var composing: Bool
    @State private var giftSender = ""
    @State private var giftAsset = "Gift10"
    @State private var showGifts = false
    @State private var showAudience = false

    var body: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geo in
                Image("LiveStage")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
                    .clipped()
            }
            .ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                hostChip
                    .padding(.top, 12)
                Spacer(minLength: 0)
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(lines) { line in
                                lineBubble(line).id(line.id)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 260, alignment: .bottom)
                    }
                    .onChange(of: lines.count) { _ in
                        if let last = lines.last {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
                .frame(maxHeight: 260)
                .padding(.horizontal, 16)
                .padding(.bottom, 48)
                if composing == false {
                    inputBar
                        .padding(.bottom, 12)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            if giftSender.isEmpty == false {
                giftBanner
                    .padding(.trailing, 0)
                    .padding(.bottom, 86)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            if composing {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture { composing = false }
            }
            if showGifts {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture { showGifts = false }
                LiveGiftShop(onClose: { showGifts = false }, onSend: playGift)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            if showAudience {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture { showAudience = false }
                LiveAudienceSheet(onClose: { showAudience = false })
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if composing { composer }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var topBar: some View {
        HStack(alignment: .center, spacing: 0) {
            HStack(spacing: 3) {
                Image("LiveGlyph").resizable().frame(width: 20, height: 20)
                Text("Live").font(YoohooFont.heavy(16)).foregroundStyle(.white)
            }
            .padding(.leading, 10)
            .frame(width: 75, height: 28, alignment: .leading)
            .background(Capsule().fill(Color.black.opacity(0.5)).overlay(Capsule().stroke(YoohooColor.yellow, lineWidth: 1)))
            Spacer(minLength: 0)
            Button { showAudience = true } label: {
                HStack(spacing: 2) {
                    HStack(spacing: -15) {
                        ForEach(["LiveFace1", "LiveFace2", "LiveFace3", "LiveFace4", "LiveFace5"], id: \.self) { name in
                            Image(name)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 28, height: 28)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(.white, lineWidth: 0.5))
                        }
                    }
                    Text("40+")
                        .font(YoohooFont.heavy(12))
                        .foregroundStyle(.black)
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Color.white.opacity(0.6)))
                }
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.leading, 16)
        .padding(.trailing, 16)
        .padding(.top, 16)
    }

    private var hostChip: some View {
        HStack(spacing: 0) {
            Button { nav.push(.profile(hostID)) } label: {
                Image("AvatarKianu")
                    .resizable()
                    .frame(width: 33 * 1.0036, height: 33 * 1.5)
                    .offset(x: 33 * -0.0018, y: 33 * -0.1333)
                    .frame(width: 33, height: 33, alignment: .topLeading)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 1))
            }
            .buttonStyle(PressDownStyle())
            VStack(alignment: .leading, spacing: 0) {
                Text("Kianu")
                    .font(YoohooFont.heavy(16))
                    .foregroundStyle(.white)
                    .frame(height: 18, alignment: .top)
                Text("@ki85d2")
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(.white)
                    .frame(height: 17, alignment: .top)
            }
            .padding(.leading, 4)
            if hostFollowed == false {
                Button { session.toggleFollow(hostID) } label: {
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
        }
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .frame(height: 41, alignment: .leading)
        .background(
            UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 0, bottomLeading: 0, bottomTrailing: 12, topTrailing: 12))
                .fill(Color.black.opacity(0.5))
                .overlay(
                    UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 0, bottomLeading: 0, bottomTrailing: 12, topTrailing: 12))
                        .stroke(YoohooColor.yellow, lineWidth: 1)
                )
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func lineBubble(_ line: LiveLine) -> some View {
        Group {
            if line.welcome {
                Text(line.text)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(.white)
                    .frame(width: 244, alignment: .leading)
                    .padding(8)
                    .frame(width: 260, height: 67, alignment: .topLeading)
            } else {
                (Text(line.name).foregroundColor(YoohooColor.yellow) + Text(" " + line.text).foregroundColor(.white))
                    .font(YoohooFont.medium(12))
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .frame(height: 33, alignment: .leading)
            }
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(white: 44 / 255).opacity(0.5)))
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            Button { composing = true } label: {
                HStack(spacing: 8) {
                    Image("CommentSend").resizable().scaledToFit().frame(width: 22, height: 22)
                    Text(draft.isEmpty ? "Please enter..." : draft)
                        .font(YoohooFont.medium(12))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.leading, 8)
                .frame(maxWidth: 205)
                .frame(height: 38)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(white: 44 / 255).opacity(0.5))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.pink, lineWidth: 1))
                )
            }
            .buttonStyle(PressDownStyle())
            .layoutPriority(1)
            liveIconButton("LiveGift", filled: true) { showGifts = true }
            liveIconButton("MoreCircle", filled: false) { nav.sheet = .about(.person(hostID)) }
            ShareLink(item: "\(hostName) is live") {
                Image("LiveShare")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.horizontal, 16)
    }

    private func liveIconButton(_ asset: String, filled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(asset)
                .resizable()
                .scaledToFit()
                .frame(width: filled ? 26 : 38, height: filled ? 26 : 38)
                .frame(width: 38, height: 38)
                .background {
                    if filled {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(.white)
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.blue, lineWidth: 1))
                    }
                }
        }
        .buttonStyle(PressDownStyle())
    }

    private var composer: some View {
        HStack(spacing: 8) {
            Image("CommentSend").resizable().frame(width: 22, height: 22)
            TextField("", text: $draft, prompt: Text("Please enter...").foregroundColor(YoohooColor.gray))
                .font(YoohooFont.medium(12))
                .foregroundStyle(YoohooColor.ink)
                .focused($composing)
                .submitLabel(.send)
                .onSubmit(send)
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: 343)
        .frame(height: 38)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.pink, lineWidth: 1)))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity)
        .onAppear { composing = true }
    }

    private var giftBanner: some View {
        HStack(spacing: 4) {
            Image(giftAsset).resizable().scaledToFill().frame(width: 60, height: 60)
            Text("Send").font(YoohooFont.title(22)).foregroundStyle(.white)
            Spacer(minLength: 4)
            Text(giftSender).font(YoohooFont.medium(12)).foregroundStyle(.black)
        }
        .padding(.trailing, 8)
        .frame(width: 179, height: 60)
        .background(
            LinearGradient(
                colors: [Color(red: 1, green: 231 / 255, blue: 33 / 255).opacity(0), Color(red: 1, green: 231 / 255, blue: 33 / 255).opacity(0.7), Color(red: 1, green: 231 / 255, blue: 33 / 255)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }

    private var hostFollowed: Bool {
        session.cards.first { $0.userID == hostID }?.followed ?? false
    }

    private var hostName: String {
        session.cards.first { $0.userID == hostID }?.name ?? "Kianu"
    }

    private func playGift(_ asset: String) {
        let sender = session.meName.isEmpty ? "Saffira" : session.meName
        giftAsset = asset
        giftSender = sender
        Task {
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if giftSender == sender && giftAsset == asset { giftSender = "" }
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        lines.append(LiveLine(name: session.meName.isEmpty ? "Saffira" : session.meName, text: text))
        composing = false
    }
}

private struct LiveGiftItem {
    var asset: String
    var price: Int
}

struct LiveGiftShop: View {
    var onClose: () -> Void
    var onSend: (String) -> Void
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var selected = 0

    private let gifts = [
        LiveGiftItem(asset: "Gift01", price: 10),
        LiveGiftItem(asset: "Gift02", price: 10),
        LiveGiftItem(asset: "Gift03", price: 10),
        LiveGiftItem(asset: "Gift04", price: 10),
        LiveGiftItem(asset: "Gift05", price: 20),
        LiveGiftItem(asset: "Gift06", price: 20),
        LiveGiftItem(asset: "Gift07", price: 20),
        LiveGiftItem(asset: "Gift08", price: 20),
        LiveGiftItem(asset: "Gift09", price: 30),
        LiveGiftItem(asset: "Gift10", price: 30),
        LiveGiftItem(asset: "Gift11", price: 30),
        LiveGiftItem(asset: "Gift12", price: 30)
    ]

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 59)
            VStack(spacing: 16) {
                Color.clear.frame(height: 63)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 4), spacing: 16) {
                    ForEach(gifts.indices, id: \.self) { index in
                        giftCard(index)
                    }
                }
                SnowButton(title: "Send", enabled: true, action: send)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
            .background(Color.white)
        }
        .overlay(alignment: .top) {
            Image("SnowSheet")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 82)
                .clipped()
                .allowsHitTesting(false)
        }
        .overlay(alignment: .top) {
            ZStack {
                Text("Gift Shop")
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                HStack {
                    HStack(spacing: 2) {
                        Image("CoinBadge").resizable().scaledToFit().frame(width: 24, height: 24)
                        Text("\(session.coins)")
                            .font(YoohooFont.heavy(14))
                            .foregroundStyle(YoohooColor.ink)
                        Button { nav.push(.coinShop) } label: {
                            Image("CoinPlus").resizable().frame(width: 24, height: 24)
                        }
                        .buttonStyle(PressDownStyle())
                    }
                    .padding(.horizontal, 2)
                    .frame(height: 28)
                    .background(RoundedRectangle(cornerRadius: 8).fill(.white).overlay(RoundedRectangle(cornerRadius: 8).stroke(YoohooColor.blue, lineWidth: 1)))
                    Spacer()
                    Button(action: onClose) {
                        Image("CloseBadge").resizable().frame(width: 28, height: 28)
                    }
                    .buttonStyle(PressDownStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 70)
        }
    }

    private func giftCard(_ index: Int) -> some View {
        let gift = gifts[index]
        let picked = index == selected
        return Button { selected = index } label: {
            VStack(spacing: 4) {
                Image(gift.asset)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 60, height: 60)
                HStack(spacing: 4) {
                    Image("CoinBadge").resizable().scaledToFit().frame(width: 13, height: 13)
                    Text("\(gift.price)")
                        .font(YoohooFont.heavy(12))
                        .foregroundStyle(YoohooColor.ink)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 97)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(red: 1, green: 252 / 255, blue: 226 / 255))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(picked ? YoohooColor.pink : YoohooColor.gray, lineWidth: 1))
            )
        }
        .buttonStyle(PressDownStyle())
    }

    private func send() {
        let gift = gifts[selected]
        guard session.coins >= gift.price else {
            session.show("Not enough coins.")
            return
        }
        session.coins -= gift.price
        onClose()
        onSend(gift.asset)
    }
}

private struct AudiencePerson: Identifiable {
    var id: String
    var userID: String
    var name: String
    var handle: String
    var avatar: String
}

struct LiveAudienceSheet: View {
    var onClose: () -> Void
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var people = [
        AudiencePerson(id: "a1", userID: "kianu", name: "Kianu", handle: "@ki85d2", avatar: "AvatarKianu"),
        AudiencePerson(id: "a2", userID: "maren", name: "Maren", handle: "@dks553", avatar: "AvatarMaren"),
        AudiencePerson(id: "a3", userID: "kianu", name: "Kianu", handle: "@ki85d2", avatar: "AvatarKianu")
    ]

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: 59)
            VStack(spacing: 16) {
                Color.clear.frame(height: 63)
                ForEach(people) { person in
                    audienceRow(person)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
            .background(Color.white)
        }
        .overlay(alignment: .top) {
            Image("SnowSheet")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 82)
                .clipped()
                .allowsHitTesting(false)
        }
        .overlay(alignment: .top) {
            ZStack {
                Text("Audience List")
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                HStack {
                    Spacer()
                    Button(action: onClose) {
                        Image("CloseBadge").resizable().frame(width: 28, height: 28)
                    }
                    .buttonStyle(PressDownStyle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 70)
        }
    }

    private func audienceRow(_ person: AudiencePerson) -> some View {
        let followed = session.isFollowed(person.userID)
        return HStack(spacing: 8) {
            Button {
                onClose()
                nav.push(.profile(person.userID))
            } label: {
                Image(person.avatar)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
            }
            .buttonStyle(PressDownStyle())
            VStack(alignment: .leading, spacing: 0) {
                Text(person.name).font(YoohooFont.heavy(16)).foregroundStyle(YoohooColor.ink)
                Text(person.handle).font(YoohooFont.medium(12)).foregroundStyle(YoohooColor.ink)
            }
            Spacer()
            Button {
                session.toggleFollow(person.userID)
            } label: {
                HStack(spacing: 2) {
                    Text(followed ? "Followed" : "Follow")
                        .font(YoohooFont.heavy(16))
                        .foregroundStyle(.white)
                    if followed == false {
                        Image("BadgePlus").resizable().scaledToFit().frame(width: 20, height: 20)
                    }
                }
                .frame(width: 96, height: 34)
                .background(RoundedRectangle(cornerRadius: 12).fill(followed ? YoohooColor.gray : YoohooColor.blue))
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.horizontal, 8)
        .frame(height: 56)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.pink, lineWidth: 1)))
    }
}
