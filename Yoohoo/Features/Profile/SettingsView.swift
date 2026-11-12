import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var cache = "17M"

    var body: some View {
        SnowForm(title: "Settings") {
            VStack(spacing: 16) {
                VStack(spacing: 16) {
                    row("SetFollow", "Follow", nil, plain: false) { nav.push(.people("Followed")) }
                    row("SetFans", "Fans", nil, plain: false) { nav.push(.people("Fans")) }
                    row("SetBlack", "Blacklist", nil, plain: true) { nav.push(.people("Blacklist")) }
                    row("SetFeedback", "Feedback", nil, plain: false) { nav.sheet = .feedback }
                    row("SetTerms", "Terms Of Use", nil, plain: false) { nav.push(.terms) }
                }
                VStack(spacing: 16) {
                    row("SetPrivacy", "Privacy Policy", nil, plain: false) { nav.push(.privacy) }
                    row("SetVersion", "Version", "V1.1", plain: false) {}
                    row("SetCache", "Clean Cache", cache, plain: false) { clean() }
                    row("SetTrash", "Delete Account", nil, plain: false) { nav.sheet = .deleteAccount }
                }
                Spacer(minLength: 12)
                SnowButton(title: "Log Out", enabled: true) { nav.sheet = .logout }
                    .padding(.bottom, 16)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
        }
    }

    private func row(_ icon: String, _ title: String, _ trailing: String?, plain: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(icon)
                    .resizable()
                    .scaledToFit()
                    .frame(width: plain ? 28 : 18, height: plain ? 28 : 18)
                    .frame(width: 28, height: 28)
                    .background(plain ? nil : RoundedRectangle(cornerRadius: 10).fill(YoohooColor.blue))
                Text(title)
                    .font(YoohooFont.heavy(16))
                    .foregroundStyle(YoohooColor.ink)
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(YoohooFont.heavy(10))
                        .foregroundStyle(YoohooColor.blue)
                }
            }
            .padding(.horizontal, 8)
            .frame(height: 44)
            .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1)))
        }
        .buttonStyle(PressDownStyle())
        .disabled(title == "Version")
    }

    private func clean() {
        guard !session.busy else { return }
        session.startLoading()
        Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            cache = "0M"
            session.stopLoading()
        }
    }
}

struct PeopleListView: View {
    var kind: String
    @EnvironmentObject private var session: YoohooSession

    private var rows: [(id: String, name: String, handle: String, avatar: String)] {
        switch kind {
        case "Fans":
            return [
                ("kianu", "Kianu", "@ki85d2", "AvatarKianu"),
                ("maren", "Maren", "@dks553", "AIUserFace"),
                ("saffira-list", "Saffira", "@de5s8d", "FanSaffira"),
                ("veyra", "Veyra", "@seje8de", "AvatarIsolde")
            ]
        case "Blacklist":
            return session.blocked.map { id in
                if let known = YoohooSession.profile(id) {
                    return (id, known.name, known.handle, known.avatar)
                }
                return (id, id, "", "AvatarSaffira")
            }
        default:
            let base: [(id: String, name: String, handle: String, avatar: String)] = [
                ("maren", "Maren", "@dks553", "AvatarMaren"),
                ("saffira-list", "Saffira", "@de5s8d", "AvatarSaffiraList"),
                ("veyra", "Veyra", "@seje8de", "AvatarIsolde"),
                ("kaelin", "Kaelin", "@didjd55", "AvatarKaelin")
            ]
            let extras = session.extraFollowed.compactMap { id -> (id: String, name: String, handle: String, avatar: String)? in
                guard let known = YoohooSession.profile(id) else { return nil }
                return (id, known.name, known.handle, known.avatar)
            }
            return base + extras
        }
    }

    var body: some View {
        SnowForm(title: kind == "Followed" ? "Followed" : kind) {
            ScrollView {
                if rows.isEmpty {
                    EmptyPenguin(message: "No more data").frame(height: 280)
                } else {
                    VStack(spacing: 16) {
                        ForEach(rows, id: \.id) { person in
                            personRow(person)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private func personRow(_ person: (id: String, name: String, handle: String, avatar: String)) -> some View {
        HStack(spacing: 8) {
            Image(person.avatar)
                .resizable()
                .scaledToFill()
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(YoohooColor.blue, lineWidth: avatarStroke(person.id))
                )
            VStack(alignment: .leading, spacing: 0) {
                Text(person.name).font(YoohooFont.heavy(16)).foregroundStyle(YoohooColor.ink)
                Text(person.handle).font(YoohooFont.medium(12)).foregroundStyle(YoohooColor.ink)
            }
            Spacer()
            action(person.id)
        }
        .padding(.horizontal, 8)
        .frame(height: 56)
        .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.pink, lineWidth: 1)))
    }

    @ViewBuilder
    private func action(_ id: String) -> some View {
        if kind == "Blacklist" {
            chip("Remove", filled: false) { session.unblock(id) }
        } else if session.isFollowed(id) {
            chip("Followed", filled: false) { session.toggleFollow(id) }
        } else {
            Button { session.toggleFollow(id) } label: {
                HStack(spacing: 2) {
                    Text("Follow")
                        .font(YoohooFont.heavy(16))
                        .foregroundStyle(.white)
                    Image("BadgePlus")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 20, height: 20)
                }
                .frame(width: 96, height: 34)
                .background(RoundedRectangle(cornerRadius: 12).fill(YoohooColor.blue))
            }
            .buttonStyle(PressDownStyle())
        }
    }

    private func avatarStroke(_ id: String) -> CGFloat {
        if kind == "Blacklist" { return 0 }
        if kind == "Fans" && id != "kianu" { return 0 }
        return 1
    }

    private func chip(_ title: String, filled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(YoohooFont.heavy(16))
                .foregroundStyle(.white)
                .frame(width: 96, height: 34)
                .background(RoundedRectangle(cornerRadius: 12).fill(filled ? YoohooColor.pink : YoohooColor.gray))
        }
        .buttonStyle(PressDownStyle())
    }
}

struct FeedbackSheet: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var text = ""

    var body: some View {
        VStack(spacing: 16) {
            SnowSheetHeader(title: "Feed Back") { nav.sheet = nil }
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Please enter...")
                        .font(YoohooFont.medium(14))
                        .foregroundStyle(YoohooColor.gray)
                        .padding(8)
                }
                TextField("", text: $text, axis: .vertical)
                    .font(YoohooFont.medium(14))
                    .foregroundStyle(YoohooColor.ink)
                    .lineLimit(4, reservesSpace: true)
                    .padding(8)
            }
            .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
            .padding(.horizontal, 16)
            SnowButton(title: "Submit", enabled: true) {
                let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !body.isEmpty, !session.busy else { return }
                nav.sheet = nil
                session.startLoading()
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    session.stopLoading()
                    session.show("Sent.")
                }
            }
            .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
    }
}
