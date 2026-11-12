import SwiftUI

struct ChatListView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    private var threads: [ChatPerson] {
        session.people.filter { !$0.preview.isEmpty && !session.blocked.contains($0.id) }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.white.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                sheet
            }
            MainTabBar()
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
    }

    private var header: some View {
        ZStack(alignment: .bottom) {
            Color.clear
            HStack(spacing: 8) {
                Button { nav.tab = .home } label: {
                    Image("BackButton").resizable().frame(width: 34, height: 34)
                }
                .buttonStyle(PressDownStyle())
                Text("Chat")
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                Spacer(minLength: 0)
                coinPill
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 18)
        }
        .frame(height: 72)
        .background(alignment: .top) {
            HeaderSky(height: 220)
                .frame(maxWidth: .infinity)
                .frame(height: 160, alignment: .top)
                .ignoresSafeArea(edges: .top)
        }
    }

    private var coinPill: some View {
        Button { nav.push(.coinShop) } label: {
            coinLabel
        }
        .buttonStyle(PressDownStyle())
    }

    private var coinLabel: some View {
        HStack(spacing: 2) {
            Image("CoinBadge").resizable().scaledToFit().frame(width: 24, height: 24)
            Text("\(session.coins)")
                .font(YoohooFont.heavy(14))
                .foregroundStyle(YoohooColor.ink)
            Image("CoinPlus").resizable().frame(width: 24, height: 24)
        }
        .padding(.leading, 2)
        .padding(.trailing, 2)
        .frame(height: 28)
        .background(RoundedRectangle(cornerRadius: 8).fill(.white))
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            peopleRow
            HStack(spacing: 2) {
                Image("ChatBell").resizable().scaledToFit().frame(width: 24, height: 24)
                Text("All Chat").font(YoohooFont.title(16)).foregroundStyle(YoohooColor.ink)
            }
            .padding(.horizontal, 16)
            if threads.isEmpty {
                EmptyPenguin(message: "", animate: false)
            } else {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(threads) { person in
                            threadRow(person)
                        }
                    }
                    .padding(.bottom, 110)
                }
            }
        }
        .padding(.top, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(alignment: .top) { SnowEdge() }
        .background(Color.white)
    }

    private var peopleRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(session.people.filter { !session.blocked.contains($0.id) }) { person in
                    Button { nav.push(.chat(person.id)) } label: {
                        personCard(person)
                    }
                    .buttonStyle(PressDownStyle())
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func personCard(_ person: ChatPerson) -> some View {
        VStack(spacing: 2) {
            ZStack(alignment: .bottomTrailing) {
                Image(person.avatar)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(YoohooColor.pink, lineWidth: 1))
                Image(person.followed ? "VerifyBadge" : "BadgePlus")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 16, height: 16)
                    .background(Circle().fill(.white))
                    .onTapGesture {
                        session.togglePersonFollow(person.id)
                    }
            }
            Text(person.name).font(YoohooFont.heavy(16)).foregroundStyle(YoohooColor.ink).lineLimit(1)
            Text(person.handle).font(YoohooFont.medium(12)).foregroundStyle(YoohooColor.gray).lineLimit(1)
        }
        .frame(width: 90, height: 104)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1)))
    }

    private func threadRow(_ person: ChatPerson) -> some View {
        Button { nav.push(.chat(person.id)) } label: {
            HStack(alignment: .top, spacing: 8) {
                Image(person.avatar)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 45, height: 45)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) {
                    Text(person.name).font(YoohooFont.heavy(16)).foregroundStyle(YoohooColor.ink)
                    Text(person.preview)
                        .font(YoohooFont.medium(14))
                        .foregroundStyle(YoohooColor.ink)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Text(person.time)
                    .font(YoohooFont.medium(10))
                    .foregroundStyle(Color(white: 0.47))
            }
            .padding(.horizontal, 16)
        }
        .buttonStyle(PressDownStyle())
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                nav.sheet = .deleteChat(person.id)
            } label: {
                Image("ChatTrash")
            }
            .tint(YoohooColor.pink)
        }
    }
}

struct ChatThreadView: View {
    var threadID: String
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var draft = ""

    private var person: ChatPerson? { session.people.first { $0.id == threadID } }

    var body: some View {
        SnowForm(title: person?.name ?? "Chat") {
            VStack(spacing: 0) {
                messageList
                inputBar
            }
        }
        .overlay(alignment: .topTrailing) {
            if let person {
                authorChip(person)
                    .padding(.trailing, 0)
                    .padding(.top, 28)
            }
        }
    }

    private var messageList: some View {
        let rows = session.lines(for: threadID)
        return Group {
            if rows.isEmpty {
                EmptyPenguin(message: "", animate: false)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(rows) { line in
                            bubble(line)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
            }
        }
    }

    private func bubble(_ line: ChatLine) -> some View {
        VStack(spacing: 8) {
            if !line.stamp.isEmpty {
                Text(line.stamp)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(YoohooColor.gray)
                    .frame(maxWidth: .infinity)
            }
            HStack(alignment: .top, spacing: 4) {
                if line.mine { Spacer(minLength: 16) }
                if !line.mine, let person {
                    Image(person.avatar)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 35, height: 35)
                        .clipShape(Circle())
                }
                Text(line.text)
                    .font(YoohooFont.medium(14))
                    .foregroundStyle(.black)
                    .padding(8)
                    .background(
                        UnevenRoundedRectangle(cornerRadii: line.mine
                            ? RectangleCornerRadii(topLeading: 10, bottomLeading: 10, bottomTrailing: 10, topTrailing: 0)
                            : RectangleCornerRadii(topLeading: 0, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
                            .fill(line.mine ? Color(red: 222 / 255, green: 240 / 255, blue: 1) : .white)
                            .overlay(
                                UnevenRoundedRectangle(cornerRadii: line.mine
                                    ? RectangleCornerRadii(topLeading: 10, bottomLeading: 10, bottomTrailing: 10, topTrailing: 0)
                                    : RectangleCornerRadii(topLeading: 0, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
                                    .stroke(line.mine ? Color.clear : YoohooColor.blue, lineWidth: 1)
                            )
                    )
                if !line.mine { Spacer(minLength: 16) }
                if line.mine {
                    Image("AvatarSaffira")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 35, height: 35)
                        .clipShape(Circle())
                }
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image("CommentSend").resizable().frame(width: 22, height: 22)
                TextField("Please enter...", text: $draft)
                    .font(YoohooFont.medium(12))
                    .onSubmit(send)
            }
            .padding(.horizontal, 8)
            .frame(height: 38)
            .background(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.pink, lineWidth: 1))
            Button {
                let person = session.people.first { $0.id == threadID }
                nav.push(.videoCall(person?.name ?? "Chat"))
            } label: {
                Image("VideoCall").resizable().scaledToFit().frame(width: 26, height: 26)
            }
            .frame(width: 38, height: 38)
            .background(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.blue, lineWidth: 1))
            .buttonStyle(PressDownStyle())
            Button { nav.sheet = .about(.chat(threadID)) } label: {
                Image("MoreCircle").resizable().frame(width: 38, height: 38)
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white)
    }

    private func authorChip(_ person: ChatPerson) -> some View {
        HStack(spacing: 4) {
            Image(person.avatar)
                .resizable()
                .scaledToFill()
                .frame(width: 33, height: 33)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: 1))
            VStack(alignment: .leading, spacing: 0) {
                Text(person.name).font(YoohooFont.heavy(16)).foregroundStyle(.white)
                Text(person.handle).font(YoohooFont.medium(12)).foregroundStyle(.white)
            }
            if !person.followed {
                Button { session.togglePersonFollow(person.id) } label: {
                    Image("BadgePlus").resizable().scaledToFit().frame(width: 23, height: 23)
                }
                .buttonStyle(PressDownStyle())
            }
        }
        .padding(4)
        .background(
            UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                .fill(Color.black.opacity(0.5))
                .overlay(
                    UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 12, bottomLeading: 12, bottomTrailing: 0, topTrailing: 0))
                        .stroke(YoohooColor.yellow, lineWidth: 1)
                )
        )
    }

    private func send() {
        let text = draft
        draft = ""
        session.sendMessage(threadID: threadID, text: text)
    }
}
