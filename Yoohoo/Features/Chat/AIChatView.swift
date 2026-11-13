import SwiftUI

private struct AILine: Identifiable {
    var id = UUID()
    var mine: Bool
    var text: String
    var full = ""
    var typing = false
    var stamp: String?
}

struct AIChatView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var draft = ""
    @State private var lines: [AILine] = []
    @State private var thinking = false

    private let prompts = [
        "Did you go skiing this weekend?",
        "Do you usually go skiing alone, or hang out with a group of ski buddies?",
        "Have you ever tried night skiing? I heard the lights on the slope look beautiful."
    ]

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            GeometryReader { geo in
                VStack(spacing: 0) {
                    header(width: geo.size.width)
                    sheet
                }
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
        .task { await loadHistory() }
    }

    private func header(width: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Image("HomeSky")
                .resizable()
                .scaledToFill()
                .frame(width: width, height: 260, alignment: .top)
                .clipped()
            Image("SnowCap")
                .resizable()
                .scaledToFill()
                .frame(width: width, height: 83)
                .clipped()
            ZStack(alignment: .topLeading) {
                Image("FlakeA").resizable().frame(width: 25, height: 25).offset(x: 50, y: 194)
                Image("FlakeB").resizable().frame(width: 25, height: 25).offset(x: 233, y: 167)
                Image("FlakeA")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 19 * 1.5789, height: 30)
                    .offset(x: 19 * -0.5789)
                    .frame(width: 19, height: 30, alignment: .topLeading)
                    .clipped()
                    .scaleEffect(x: -1, y: -1)
                    .offset(x: 356, y: 61)
                ZStack(alignment: .topLeading) {
                    Text("Glide into winter with Pegu")
                        .font(YoohooFont.display(20))
                        .foregroundStyle(.white)
                        .shadow(color: YoohooColor.titleShadow, radius: 0, y: 3)
                        .lineLimit(1)
                        .offset(y: 80)
                    Text("Fresh snow, cool goggles and endless fun. Let this tiny skier bring warmth and joy to your snowy days.")
                        .font(YoohooFont.body(14))
                        .foregroundStyle(.white)
                        .frame(width: 253, alignment: .leading)
                        .offset(y: 118)
                }
                .frame(width: 253, height: 190, alignment: .topLeading)
                .offset(x: 16)
                Image("Penguin")
                    .resizable()
                    .frame(width: 150 * 1.0949, height: 140 * 1.1731)
                    .offset(x: 150 * -0.0511, y: 140 * -0.0983)
                    .frame(width: 150, height: 140, alignment: .topLeading)
                    .clipped()
                    .offset(x: 209, y: 144)
            }
            .frame(width: 375, alignment: .topLeading)
            .frame(width: width, alignment: .top)
            controls
                .padding(.top, 16)
        }
        .overlay(alignment: .bottom) { SnowEdge() }
        .frame(width: width, height: 260, alignment: .topLeading)
    }

    private var controls: some View {
        HStack(spacing: 8) {
            Button(action: nav.pop) {
                Image("BackButton").resizable().frame(width: 34, height: 34)
            }
            .buttonStyle(PressDownStyle())
            peguChip
            Spacer(minLength: 0)
            Button { nav.sheet = .about(.person("pegu")) } label: {
                Image("MoreCircle").resizable().frame(width: 38, height: 38)
            }
            .buttonStyle(PressDownStyle())
        }
        .padding(.horizontal, 16)
    }

    private var peguChip: some View {
        HStack(spacing: 4) {
            Image("Penguin")
                .resizable()
                .scaledToFill()
                .frame(width: 30, height: 28)
                .background(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 0) {
                Text("Pegu")
                    .font(YoohooFont.heavy(14))
                    .foregroundStyle(YoohooColor.ink)
                HStack(spacing: 2) {
                    Text("5")
                    Image("CoinBadge").resizable().scaledToFit().frame(width: 10, height: 10)
                    Text("/Message")
                }
                .font(YoohooFont.medium(12))
                .foregroundStyle(YoohooColor.blue)
            }
        }
        .padding(.leading, 2)
        .padding(.trailing, 8)
        .frame(width: 122, height: 34, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(.white)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
        )
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 2) {
                FieldMark()
                Text("All Chat")
                    .font(YoohooFont.title(16))
                    .foregroundStyle(YoohooColor.ink)
            }
            if lines.isEmpty {
                ForEach(prompts, id: \.self) { prompt in
                    Button { send(prompt) } label: {
                        promptRow(prompt)
                    }
                    .buttonStyle(PressDownStyle())
                }
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        ForEach(lines) { line in
                            lineRow(line)
                        }
                        if thinking {
                            thinkingRow
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            Spacer(minLength: 0)
            composer
        }
        .padding(.top, 40)
        .padding(.bottom, 12)
        .frame(width: 343)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.white)
    }

    private func promptRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image("AIPromptIcon")
                .resizable()
                .frame(width: 18, height: 18)
                .frame(width: 24, height: 24)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(.white)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(YoohooColor.pink, lineWidth: 1))
                )
            Text(text)
                .font(YoohooFont.medium(14))
                .foregroundStyle(YoohooColor.ink)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(8)
        .frame(maxWidth: .infinity, minHeight: text.count > 40 ? 56 : 40, alignment: .topLeading)
        .background(promptShape.fill(.white).overlay(promptShape.stroke(YoohooColor.blue, lineWidth: 1)))
    }

    private var promptShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 0, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
    }

    private var composer: some View {
        HStack(spacing: 8) {
            Image("CommentSend").resizable().frame(width: 22, height: 22)
            ZStack(alignment: .leading) {
                if draft.isEmpty {
                    Text("Please enter...")
                        .font(YoohooFont.medium(12))
                        .foregroundStyle(YoohooColor.gray)
                }
                TextField("", text: $draft)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(YoohooColor.ink)
                    .onSubmit { send(draft) }
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 38)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.white)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.pink, lineWidth: 1))
        )
    }

    private func lineRow(_ line: AILine) -> some View {
        VStack(spacing: 16) {
            if let stamp = line.stamp {
                Text(stamp)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(YoohooColor.gray)
                    .frame(maxWidth: .infinity)
            }
            HStack(alignment: .top, spacing: 4) {
                if line.mine {
                    Spacer(minLength: 12)
                    bubble(line)
                    face.offset(y: -8)
                } else {
                    peguFace.offset(y: -8)
                    bubble(line)
                    Spacer(minLength: 12)
                }
            }
        }
    }

    private func bubble(_ line: AILine) -> some View {
        let shape = UnevenRoundedRectangle(
            cornerRadii: RectangleCornerRadii(
                topLeading: line.mine ? 10 : 0,
                bottomLeading: 10,
                bottomTrailing: 10,
                topTrailing: line.mine ? 0 : 10
            )
        )
        return HStack(alignment: .lastTextBaseline, spacing: 0) {
            Text(line.text)
                .font(YoohooFont.medium(14))
                .foregroundStyle(.black)
                .multilineTextAlignment(.leading)
            if line.typing {
                Rectangle()
                    .fill(.black)
                    .frame(width: 1, height: 14)
            }
        }
        .padding(8)
        .frame(maxWidth: 304, alignment: .leading)
        .background(
            shape
                .fill(line.mine ? Color(red: 222 / 255, green: 240 / 255, blue: 1) : .white)
                .overlay(shape.stroke(line.mine ? Color.clear : YoohooColor.blue, lineWidth: 1))
        )
    }

    private var face: some View {
        Group {
            if session.avatarAsset.hasPrefix("http") {
                UserImage(name: session.avatarAsset)
            } else if let image = session.localAvatar {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Color.white.opacity(0.35)
            }
        }
        .frame(width: 35, height: 35)
        .clipShape(Circle())
    }

    private var peguFace: some View {
        Image("Penguin")
            .resizable()
            .frame(width: 35 * 1.0949, height: 35 * 1.1731)
            .offset(x: 35 * -0.0511, y: 35 * -0.0983)
            .frame(width: 35, height: 35, alignment: .topLeading)
            .clipped()
            .background(Circle().fill(.black))
            .clipShape(Circle())
    }

    private var thinkingRow: some View {
        HStack(alignment: .top, spacing: 4) {
            peguFace
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { _ in
                    Circle().fill(YoohooColor.gray).frame(width: 5, height: 5)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 35)
            .background(
                UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 0, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
                    .fill(.white)
                    .overlay(
                        UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(topLeading: 0, bottomLeading: 10, bottomTrailing: 10, topTrailing: 10))
                            .stroke(YoohooColor.blue, lineWidth: 1)
                    )
            )
            Spacer(minLength: 12)
        }
    }

    private func loadHistory() async {
        let rows = (try? await YoohooBackend.aiLines()) ?? []
        guard lines.isEmpty else { return }
        lines = rows.map { AILine(id: $0.id, mine: $0.mine, text: $0.body) }
    }

    private func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, thinking == false else { return }
        draft = ""
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let user = AILine(mine: true, text: text, stamp: lines.isEmpty ? formatter.string(from: Date()) : nil)
        lines.append(user)
        thinking = true
        let reply = answer(for: text)
        Task {
            let paid = await session.spendAITokens()
            if paid == false {
                lines.removeAll { $0.id == user.id }
                thinking = false
                return
            }
            try? await YoohooBackend.addAI(mine: true, body: text)
            try? await Task.sleep(nanoseconds: 700_000_000)
            thinking = false
            let id = UUID()
            lines.append(AILine(id: id, mine: false, text: "", full: reply, typing: true))
            try? await YoohooBackend.addAI(mine: false, body: reply)
            for count in 1...reply.count {
                try? await Task.sleep(nanoseconds: 16_000_000)
                guard let index = lines.firstIndex(where: { $0.id == id }) else { return }
                let end = reply.index(reply.startIndex, offsetBy: count)
                lines[index].text = String(reply[..<end])
                lines[index].typing = count < reply.count
            }
        }
    }

    private func answer(for question: String) -> String {
        let designed = "No. You can rent large items such as skis, ski boots and ski poles at the resort. Only buy personal and safety items like a helmet, goggles and base layers."
        if question == "Do I need to buy all ski gear for my first ski trip?" {
            return designed
        }
        return designed
    }
}
