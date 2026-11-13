import AVKit
import SwiftUI

struct LiveLine: Identifiable, Equatable {
    var id = UUID().uuidString
    var name: String
    var text: String
    var welcome: Bool = false
    var senderID: String = ""
}

struct LiveRoomView: View {
    var hostID: String
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var draft = ""
    @State private var lines: [LiveLine] = [
        LiveLine(name: "", text: "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.", welcome: true)
    ]
    @State private var audience: [AudiencePerson] = []
    @FocusState private var composing: Bool
    @State private var giftSender = ""
    @State private var giftAsset = "Gift10"
    @State private var showGifts = false
    @State private var showAudience = false
    @State private var seenGifts: Set<String> = []
    @State private var giftsPrimed = false
    @State private var pendingGiftLabel: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            GeometryReader { geo in
                stage(geo.size)
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
                        .frame(maxWidth: .infinity, minHeight: 260, alignment: .bottomLeading)
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
                VStack {
                    Spacer(minLength: 0)
                    Image(giftAsset)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 160, height: 160)
                        .shadow(color: .black.opacity(0.2), radius: 12)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
                giftBanner
                    .padding(.trailing, 0)
                    .padding(.bottom, 86)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
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
                LiveAudienceSheet(people: audience, onClose: { showAudience = false })
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if composing { composer }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
        .preferredColorScheme(.dark)
        .task {
            await openRoom()
            await simulateLive()
        }
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
                        ForEach(audienceFaces, id: \.self) { name in
                            Group {
                                if name.hasPrefix("http") {
                                    UserImage(name: name)
                                } else {
                                    Image(name).resizable().scaledToFill()
                                }
                            }
                            .frame(width: 28, height: 28)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(.white, lineWidth: 0.5))
                        }
                    }
                    Text(audienceLabel)
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
            Button { nav.push(.profile(ownerID)) } label: {
                UserImage(name: room?.avatar ?? "")
                    .frame(width: 33, height: 33)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 1))
            }
            .buttonStyle(PressDownStyle())
            VStack(alignment: .leading, spacing: 0) {
                Text(hostName)
                    .font(YoohooFont.heavy(16))
                    .foregroundStyle(.white)
                    .frame(height: 18, alignment: .top)
                Text(room?.handle ?? "")
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(.white)
                    .frame(height: 17, alignment: .top)
            }
            .padding(.leading, 4)
            if hostFollowed == false {
                Button { session.toggleFollow(ownerID) } label: {
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
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(white: 44 / 255).opacity(0.5)))
        .frame(maxWidth: .infinity, alignment: .leading)
        .onLongPressGesture {
            guard line.welcome == false, line.senderID.isEmpty == false, line.senderID != session.meID else { return }
            nav.sheet = .about(.person(line.senderID))
        }
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
                .frame(width: 205, height: 38, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(white: 44 / 255).opacity(0.5))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.pink, lineWidth: 1))
                )
            }
            .buttonStyle(PressDownStyle())
            .layoutPriority(1)
            Spacer(minLength: 8)
            liveIconButton("LiveGift", filled: true) { showGifts = true }
            liveIconButton("MoreCircle", filled: false) { nav.sheet = .about(.person(ownerID)) }
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
        .frame(width: 343, height: 38)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.pink, lineWidth: 1)))
        .frame(maxWidth: .infinity)
        .padding(.bottom, 8)
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

    private var room: FeedCard? {
        session.cards.first { $0.id == hostID }
    }

    private var audienceFaces: [String] {
        let remote = audience.prefix(5).map(\.avatar).filter { !$0.isEmpty }
        if remote.count >= 5 { return Array(remote) }
        let placeholders = ["LiveFace1", "LiveFace2", "LiveFace3", "LiveFace4", "LiveFace5"]
        return Array((remote + placeholders).prefix(5))
    }

    private var ownerID: String {
        let id = room?.userID ?? ""
        return id.isEmpty ? hostID : id
    }

    private var hostFollowed: Bool { session.isFollowed(ownerID) }

    private var hostName: String { room?.name ?? "" }

    private var audienceLabel: String {
        let count = max(audience.count, 1)
        return count >= 40 ? "40+" : "\(count)"
    }

    private var liveVideoURL: URL? {
        if let video = room?.videoURL, video.hasPrefix("http"), let url = URL(string: video) {
            return url
        }
        return Bundle.main.url(forResource: "LiveLoop", withExtension: "mp4")
    }

    private func stage(_ size: CGSize) -> some View {
        ZStack {
            if let photo = room?.photo, photo.hasPrefix("http") {
                UserImage(name: photo)
            } else {
                Image("LiveStage").resizable().scaledToFill()
            }
            if let url = liveVideoURL {
                LoopingVideo(url: url)
            }
        }
        .frame(width: size.width, height: size.height, alignment: .bottom)
        .clipped()
    }

    private func openRoom() async {
        guard let roomID = UUID(uuidString: hostID), let me = UUID(uuidString: session.meID) else {
            fillAudience()
            return
        }
        try? await YoohooBackend.joinRoom(roomID, user: me)
        let members = (try? await YoohooBackend.roomMembers(roomID)) ?? []
        var people = members.map { id in
            let key = id.uuidString.lowercased()
            let known = session.known[key]
            return AudiencePerson(id: key, userID: key, name: known?.name ?? "", handle: known?.handle ?? "", avatar: known?.avatar ?? "")
        }
        if people.count < 5 {
            for person in session.contacts where people.contains(where: { $0.userID == person.id }) == false {
                people.append(AudiencePerson(id: person.id, userID: person.id, name: person.name, handle: person.handle, avatar: person.avatar))
                if people.count >= 8 { break }
            }
        }
        audience = people
        let rows = (try? await YoohooBackend.roomMessages(roomID)) ?? []
        var next = [LiveLine(name: "", text: "Welcome! Respect others and keep chats positive. No hate or offensive comments. Enjoy our friendly live space.", welcome: true)]
        next += rows.map { row in
            let key = row.senderID.uuidString.lowercased()
            return LiveLine(id: row.id.uuidString, name: session.known[key]?.name ?? "", text: row.body, senderID: key)
        }
        if next.count > 1 {
            lines = next
        }
        await loadGifts(roomID)
    }

    private func loadGifts(_ roomID: UUID) async {
        let rows = (try? await YoohooBackend.roomGifts(roomID)) ?? []
        if giftsPrimed == false {
            seenGifts = Set(rows.map { $0.id.uuidString.lowercased() })
            giftsPrimed = true
            return
        }
        for row in rows {
            let id = row.id.uuidString.lowercased()
            if seenGifts.contains(id) { continue }
            seenGifts.insert(id)
            let sender = row.senderID.uuidString.lowercased()
            if pendingGiftLabel == row.label, sender == session.meID {
                pendingGiftLabel = nil
                continue
            }
            giftAsset = row.label
            giftSender = session.known[sender]?.name ?? session.meName
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if giftAsset == row.label { giftSender = "" }
        }
    }

    private func fillAudience() {
        audience = session.contacts.prefix(8).map {
            AudiencePerson(id: $0.id, userID: $0.id, name: $0.name, handle: $0.handle, avatar: $0.avatar)
        }
    }

    private func simulateLive() async {
        let extras = [
            LiveLine(name: "Thalassa", text: "That jump was insane!", senderID: session.contacts.first { $0.name == "Thalassa" }?.id ?? ""),
            LiveLine(name: "Thalassa", text: "Snow looks perfect today", senderID: session.contacts.first { $0.name == "Thalassa" }?.id ?? ""),
            LiveLine(name: "Maren", text: "Powder day vibes ❄️", senderID: session.contacts.first { $0.name == "Maren" }?.id ?? "")
        ]
        for extra in extras {
            try? await Task.sleep(nanoseconds: 2_400_000_000)
            if lines.contains(where: { $0.text == extra.text && $0.name == extra.name }) { continue }
            lines.append(extra)
        }
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            await openRoom()
        }
    }

    private func playGift(_ asset: String, _ price: Int) {
        giftAsset = asset
        giftSender = session.meName
        pendingGiftLabel = asset
        Task {
            guard let roomID = UUID(uuidString: hostID) else { return }
            do {
                let gems = try await YoohooBackend.sendGift(room: roomID, cost: price, label: asset)
                session.coins = gems
                try? await Task.sleep(nanoseconds: 2_200_000_000)
                if giftAsset == asset { giftSender = "" }
            } catch {
                pendingGiftLabel = nil
                if giftAsset == asset { giftSender = "" }
                session.show(error.localizedDescription)
            }
        }
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        composing = false
        lines.append(LiveLine(name: session.meName, text: text, senderID: session.meID))
        Task {
            guard let roomID = UUID(uuidString: hostID), let me = UUID(uuidString: session.meID) else { return }
            do {
                try await YoohooBackend.sendRoomMessage(room: roomID, sender: me, body: text)
                await openRoom()
            } catch {
                session.show(error.localizedDescription)
            }
        }
    }
}

private struct LiveGiftItem {
    var asset: String
    var price: Int
}

struct LiveGiftShop: View {
    var onClose: () -> Void
    var onSend: (String, Int) -> Void
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
        SnowBottomSheet(title: "Gift Shop", close: onClose, leading: { coinPill }) {
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(82), spacing: 5), count: 4), spacing: 16) {
                ForEach(gifts.indices, id: \.self) { index in
                    giftCard(index)
                }
            }
            .padding(.horizontal, 16)
            SnowButton(title: "Send", enabled: true, action: send)
        }
    }

    private var coinPill: some View {
        HStack(spacing: 2) {
            Image("CoinBadge").resizable().scaledToFit().frame(width: 24, height: 24)
            Text("\(session.coins)")
                .font(YoohooFont.heavy(14))
                .foregroundStyle(YoohooColor.ink)
            Button {
                onClose()
                nav.push(.coinShop)
            } label: {
                Image("CoinPlus").resizable().frame(width: 24, height: 24)
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.horizontal, 2)
        .frame(width: 88, height: 28)
        .background(RoundedRectangle(cornerRadius: 8).fill(.white).overlay(RoundedRectangle(cornerRadius: 8).stroke(YoohooColor.blue, lineWidth: 1)))
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
            .frame(width: 82, height: 97)
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
        onClose()
        onSend(gift.asset, gift.price)
    }
}

struct AudiencePerson: Identifiable {
    var id: String
    var userID: String
    var name: String
    var handle: String
    var avatar: String
}

struct LiveAudienceSheet: View {
    var people: [AudiencePerson]
    var onClose: () -> Void
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    var body: some View {
        SnowBottomSheet(title: "Audience List", close: onClose) {
            Group {
                if people.isEmpty {
                    EmptyPenguin(message: "No more data").frame(height: 180)
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 16) {
                            ForEach(people) { person in
                                audienceRow(person)
                            }
                        }
                    }
                    .frame(maxHeight: 360)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func audienceRow(_ person: AudiencePerson) -> some View {
        let followed = session.isFollowed(person.userID)
        return HStack(spacing: 8) {
            Button {
                onClose()
                nav.push(.profile(person.userID))
            } label: {
                UserImage(name: person.avatar)
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

struct LoopingVideo: UIViewRepresentable {
    var url: URL

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.play(url)
        return view
    }

    func updateUIView(_ view: PlayerView, context: Context) {
        view.play(url)
    }

    final class PlayerView: UIView {
        private var player: AVQueuePlayer?
        private var looper: AVPlayerLooper?
        private var current: URL?

        override class var layerClass: AnyClass { AVPlayerLayer.self }

        func play(_ url: URL) {
            guard current != url else {
                player?.play()
                return
            }
            current = url
            let item = AVPlayerItem(url: url)
            let queue = AVQueuePlayer()
            queue.isMuted = true
            looper = AVPlayerLooper(player: queue, templateItem: item)
            player = queue
            if let layer = layer as? AVPlayerLayer {
                layer.player = queue
                layer.videoGravity = .resizeAspectFill
            }
            queue.play()
        }
    }
}
