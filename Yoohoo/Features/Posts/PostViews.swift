import Combine
import PhotosUI
import SwiftUI

enum PostFilter {
    case popular
    case followed
}

struct PostFeedView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var filter: PostFilter = .popular

    private var rows: [PostItem] {
        session.visiblePosts(followedOnly: filter == .followed)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.white.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                filterRow
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
                Text("Post")
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                Spacer(minLength: 0)
                Button { nav.push(.compose) } label: {
                    HStack(spacing: 4) {
                        Image("PostBadge").resizable().scaledToFill().frame(width: 28, height: 28).clipShape(RoundedRectangle(cornerRadius: 8))
                        Text("POST")
                            .font(YoohooFont.title(20))
                            .foregroundStyle(YoohooColor.blue)
                            .shadow(color: Color(red: 196 / 255, green: 219 / 255, blue: 1), radius: 0, y: 2)
                        Image("Pencil").resizable().frame(width: 18, height: 18)
                    }
                    .padding(.leading, 4)
                    .padding(.trailing, 8)
                    .frame(height: 34)
                    .background(RoundedRectangle(cornerRadius: 12).fill(.white).overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.blue, lineWidth: 1)))
                }
                .buttonStyle(PressDownStyle())
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

    private var filterRow: some View {
        HStack(spacing: 14) {
            SnowChoice(title: "Popular", selected: filter == .popular) { filter = .popular }
            SnowChoice(title: "Followed", selected: filter == .followed) { filter = .followed }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .background(alignment: .bottom) { SnowEdge() }
    }

    private var sheet: some View {
        Group {
            if rows.isEmpty {
                EmptyPenguin(message: "", animate: false)
            } else {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(rows) { post in
                            PostCard(post: post)
                        }
                    }
                    .padding(.top, 16)
                    .padding(.bottom, 110)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
        .id(filter)
        .transition(.opacity.combined(with: .move(edge: .trailing)))
        .animation(.easeInOut(duration: 0.25), value: filter == .followed)
    }
}

struct SnowChoice: View {
    var title: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Capsule()
                    .fill(LinearGradient(
                        colors: selected
                            ? [Color(red: 1, green: 114 / 255, blue: 212 / 255), Color(red: 238 / 255, green: 0, blue: 166 / 255)]
                            : [Color(white: 166 / 255), .black],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(height: 42)
                    .shadow(color: .black.opacity(0.08), radius: 0, y: 2)
                HStack {
                    Image("SnowCapLeft").resizable().scaledToFit().frame(width: 16, height: 12)
                    Spacer(minLength: 0)
                    Image("SnowCapRight").resizable().scaledToFit().frame(width: 16, height: 12)
                }
                .offset(y: -16)
                VStack {
                    Spacer(minLength: 0)
                    Image("SnowFluff").resizable().scaledToFit().frame(height: 12)
                }
                HStack {
                    Image("SnowmanBody").resizable().scaledToFit().frame(width: 22, height: 8)
                    Spacer(minLength: 0)
                    Image("SnowmanArm").resizable().scaledToFit().frame(width: 16, height: 22)
                }
                .offset(y: 6)
                Text(title)
                    .font(YoohooFont.heavy(20))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 51)
        }
        .buttonStyle(PressDownStyle())
    }
}

struct EmptyPenguin: View {
    var message: String = "No more data"
    var animate = true
    @State private var dot = 0

    var body: some View {
        VStack(spacing: 8) {
            Image("Penguin")
                .resizable()
                .scaledToFit()
                .frame(width: 93, height: 93)
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color(red: 243 / 255, green: 34 / 255, blue: 42 / 255))
                        .frame(width: 5, height: 5)
                        .opacity(animate && dot != index ? 0.35 : 1)
                }
            }
            if message.isEmpty == false {
                Text(message)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(YoohooColor.gray)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onReceive(Timer.publish(every: 0.35, on: .main, in: .common).autoconnect()) { _ in
            guard animate else { return }
            dot = (dot + 1) % 3
        }
    }
}

struct PostCard: View {
    var post: PostItem
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var page = 0
    @State private var playing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            media
            Text(post.caption)
                .font(YoohooFont.medium(16))
                .foregroundStyle(YoohooColor.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            HStack(alignment: .bottom) {
                HStack(spacing: 8) {
                    ForEach(post.tags, id: \.self) { tag in
                        Text(tag)
                            .font(YoohooFont.medium(12))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .frame(height: 19)
                            .background(RoundedRectangle(cornerRadius: 4).fill(YoohooColor.ice))
                    }
                }
                Spacer(minLength: 8)
                Text(post.time)
                    .font(YoohooFont.medium(12))
                    .foregroundStyle(YoohooColor.gray)
                    .offset(y: 4)
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 16)
    }

    private var media: some View {
        ZStack(alignment: .topLeading) {
            TabView(selection: $page) {
                ForEach(0..<max(post.pageCount, post.photos.count), id: \.self) { index in
                    let name = post.photos[index % max(post.photos.count, 1)]
                    Group {
                        if let local = session.localImages[name] {
                            Image(uiImage: local)
                                .resizable()
                                .scaledToFill()
                        } else {
                            Image(name)
                                .resizable()
                                .frame(width: 343 * crop.width, height: 380 * crop.height)
                                .offset(x: 343 * crop.left, y: 380 * crop.top)
                        }
                    }
                    .frame(width: 343, height: 380, alignment: .topLeading)
                    .clipped()
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(width: 343, height: 380)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            if post.pageCount > 1 {
                HStack(spacing: 5) {
                    ForEach(0..<post.pageCount, id: \.self) { index in
                        Circle()
                            .fill(index == page ? YoohooColor.pink : Color(white: 0.8))
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(width: 343)
                .padding(.top, 8)
            }
            if post.isVideo && !playing {
                Button { playing = true } label: {
                    Image("PlayButton").resizable().frame(width: 34, height: 34)
                }
                .frame(width: 343, height: 380)
                .buttonStyle(PressDownStyle())
            }
            VStack {
                Spacer()
                HStack(spacing: 8) {
                    author
                    Button { session.toggleLike(post.id) } label: {
                        Image(post.liked ? "LikeOnGlyph" : "LikeGlyph").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                    Button { nav.push(.postDetail(post.id)) } label: {
                        Image("CommentGlyph").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                    Button { nav.sheet = .about(.post(post.id)) } label: {
                        Image("MoreCircle").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                    Spacer(minLength: 0)
                }
                .padding(8)
            }
            .frame(width: 343, height: 380)
        }
        .frame(width: 343, height: 380)
        .contentShape(RoundedRectangle(cornerRadius: 15))
        .onTapGesture { nav.push(.postDetail(post.id)) }
    }

    private var crop: (width: CGFloat, height: CGFloat, left: CGFloat, top: CGFloat) {
        if post.id == "lodge" {
            return (1, 1.2031, 0, -0.2029)
        }
        return (1.0006, 1.1289, -0.0003, -0.1211)
    }

    private var author: some View {
        HStack(spacing: 4) {
            Image(post.avatar)
                .resizable()
                .scaledToFill()
                .frame(width: 33, height: 33)
                .clipShape(RoundedRectangle(cornerRadius: post.isVideo ? 12 : 10))
                .overlay(RoundedRectangle(cornerRadius: post.isVideo ? 12 : 10).stroke(.white, lineWidth: 1))
            VStack(alignment: .leading, spacing: 0) {
                Text(post.name).font(YoohooFont.heavy(16)).foregroundStyle(.white)
                Text(post.handle).font(YoohooFont.medium(12)).foregroundStyle(.white)
            }
            if !post.followed && !post.mine {
                Button { session.toggleFollow(post.userID) } label: {
                    Image("BadgePlus")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 23, height: 23)
                        .background(RoundedRectangle(cornerRadius: post.isVideo ? 12 : 10).fill(.white))
                }
                .buttonStyle(PressDownStyle())
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.5))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.yellow, lineWidth: 1))
        )
    }
}

struct PostDetailView: View {
    var postID: String
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var draft = ""

    private var post: PostItem? { session.posts.first { $0.id == postID } }

    var body: some View {
        SnowForm(title: "Detail") {
            VStack(spacing: 0) {
                if let post {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            PostCard(post: post)
                            commentBlock(post)
                        }
                        .padding(.bottom, 16)
                    }
                    commentBar
                }
            }
        }
        .overlay(alignment: .topTrailing) {
            HStack(spacing: 8) {
                if let post, !post.mine {
                    Button { session.toggleLike(post.id) } label: {
                        Image(post.liked ? "LikeOnGlyph" : "LikeGlyph").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                }
                Button { nav.sheet = .about(.post(postID)) } label: {
                    Image("MoreCircle").resizable().frame(width: 34, height: 34)
                }
                .buttonStyle(PressDownStyle())
            }
            .padding(.trailing, 16)
            .padding(.top, 36)
        }
    }

    private func commentBlock(_ post: PostItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 2) {
                FieldMark()
                Text("Comment").font(YoohooFont.title(16)).foregroundStyle(YoohooColor.ink)
            }
            .padding(.horizontal, 16)
            let lines = session.comments(for: post.id)
            if lines.isEmpty {
                EmptyPenguin(message: "", animate: false).frame(height: 180)
            } else {
                ForEach(lines) { line in
                    commentRow(line)
                }
            }
        }
    }

    private func commentRow(_ line: CommentItem) -> some View {
        HStack(alignment: .top, spacing: 4) {
            Image(line.avatar)
                .resizable()
                .scaledToFill()
                .frame(width: 26, height: 26)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(line.author + ":")
                    .font(YoohooFont.heavy(14))
                Text(line.text)
                    .font(YoohooFont.medium(14))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundStyle(.black)
            Spacer(minLength: 8)
            Text(line.time)
                .font(YoohooFont.medium(10))
                .foregroundStyle(Color(white: 0.44))
        }
        .padding(.horizontal, 16)
        .contextMenu {
            if line.mine {
                Button("Delete") { session.deleteComment(line.id) }
            } else {
                Button("Report") { report(line.id) }
                Button("Add to Blacklist") { nav.sheet = .block(line.author.lowercased(), pop: false) }
            }
        }
    }

    private var commentBar: some View {
        HStack(spacing: 8) {
            Image("CommentSend").resizable().frame(width: 22, height: 22)
            TextField("Please enter...", text: $draft)
                .font(YoohooFont.medium(12))
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill")
                    .foregroundStyle(YoohooColor.pink)
            }
            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0 : 1)
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(RoundedRectangle(cornerRadius: 12).fill(.white).overlay(RoundedRectangle(cornerRadius: 12).stroke(YoohooColor.pink, lineWidth: 1)))
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white)
    }

    private func send() {
        let text = draft
        draft = ""
        session.addComment(postID: postID, text: text)
    }

    private func report(_ id: String) {
        nav.sheet = .report
    }
}

struct ComposePostView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var videoMode = false
    @State private var images: [UIImage] = []
    @State private var videoPicked = false
    @State private var caption = ""
    @State private var tags: [String] = []
    @State private var picker: PhotosPickerItem?
    @State private var showTags = false
    @State private var tagDraft = ""

    private var ready: Bool {
        let hasMedia = videoMode ? videoPicked : !images.isEmpty
        return hasMedia && !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        ZStack {
            SnowForm(title: "Create post") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 14) {
                        SnowChoice(title: "Image", selected: !videoMode) { videoMode = false }
                        SnowChoice(title: "Video", selected: videoMode) { videoMode = true }
                    }
                    fieldTitle(videoMode ? "Video" : "Image")
                    mediaRow
                    fieldTitle("Content")
                    TextField("Please enter...", text: $caption, axis: .vertical)
                        .font(YoohooFont.medium(14))
                        .lineLimit(4, reservesSpace: true)
                        .padding(8)
                        .frame(maxWidth: .infinity, minHeight: 100, alignment: .topLeading)
                        .background(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
                    fieldTitle("Label")
                    tagRow
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                Spacer(minLength: 16)
                SnowButton(title: "Release", enabled: ready, action: release)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 16)
            }
            if showTags { tagSheet }
        }
        .onChange(of: picker) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    if videoMode {
                        videoPicked = true
                        images = [image]
                    } else if images.count < 9 {
                        images.append(image)
                    }
                }
                picker = nil
            }
        }
    }

    private func fieldTitle(_ title: String) -> some View {
        HStack(spacing: 2) {
            FieldMark()
            Text(title).font(YoohooFont.title(16)).foregroundStyle(YoohooColor.ink)
        }
    }

    private var mediaRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(images.enumerated()), id: \.offset) { _, image in
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 111, height: 130)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                if videoMode ? !videoPicked : images.count < 9 {
                    PhotosPicker(selection: $picker, matching: videoMode ? .videos : .images) {
                        VStack(spacing: 4) {
                            Image("UploadCloud").resizable().frame(width: 25, height: 25)
                            Text("Upload Photo")
                                .font(YoohooFont.medium(10))
                                .foregroundStyle(YoohooColor.gray)
                        }
                        .frame(width: 111, height: 130)
                        .background(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
                    }
                }
            }
        }
    }

    private var tagRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button { showTags = true } label: {
                    HStack(spacing: 4) {
                        Image("TagPlus").resizable().frame(width: 15, height: 15)
                        Text("Add tags").font(YoohooFont.medium(12))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .frame(height: 19)
                    .background(RoundedRectangle(cornerRadius: 4).fill(YoohooColor.ice))
                }
                .buttonStyle(PressDownStyle())
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(YoohooFont.medium(12))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .frame(height: 19)
                        .background(RoundedRectangle(cornerRadius: 4).fill(YoohooColor.ice))
                }
            }
        }
    }

    private var tagSheet: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.5).ignoresSafeArea().onTapGesture { showTags = false }
            VStack(spacing: 16) {
                SnowSheetHeader(title: "Add Tag") { showTags = false }
                TextField("Please enter...", text: $tagDraft)
                    .font(YoohooFont.medium(14))
                    .padding(8)
                    .frame(height: 100, alignment: .topLeading)
                    .background(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
                    .padding(.horizontal, 16)
                SnowButton(title: "Confirm", enabled: !tagDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                    let raw = tagDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    let tag = raw.hasPrefix("#") ? raw : "#" + raw
                    if !tags.contains(tag) { tags.append(tag) }
                    tagDraft = ""
                    showTags = false
                }
                .padding(.bottom, 12)
            }
            .frame(maxWidth: .infinity)
            .background(Color.white)
        }
    }

    private func release() {
        guard !session.busy, ready else { return }
        session.startLoading()
        let text = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        let names = images.isEmpty ? [] : ["PostSlopes"]
        let video = videoMode
        let chosen = tags
        Task {
            try? await Task.sleep(nanoseconds: 450_000_000)
            session.publish(caption: text, tags: chosen, photos: names, video: video, image: images.first)
            session.stopLoading()
            session.show("Posted.")
            nav.pop()
        }
    }
}

struct SnowSheetHeader: View {
    var title: String
    var close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Image("SnowSheet")
                .resizable()
                .scaledToFill()
                .frame(height: 82)
                .clipped()
            HStack {
                Spacer()
                Text(title)
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                Spacer()
            }
            .overlay(alignment: .trailing) {
                Button(action: close) {
                    Image("CloseBadge").resizable().frame(width: 28, height: 28)
                }
                .padding(.trailing, 16)
                .buttonStyle(PressDownStyle())
            }
            .offset(y: -8)
        }
    }
}

struct AboutSheet: View {
    var target: AboutTarget
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession

    private var mine: Bool {
        if case .post(let id) = target, let post = session.posts.first(where: { $0.id == id }) {
            return post.mine
        }
        return false
    }

    private var isChat: Bool {
        if case .chat = target { return true }
        return false
    }

    var body: some View {
        VStack(spacing: 16) {
            SnowSheetHeader(title: "About") { nav.sheet = nil }
            VStack(spacing: 16) {
                if isChat {
                    row("MenuReport", "Report") { nav.sheet = .report }
                    row("MenuTrash", "Delete Chat") {
                        if case .chat(let id) = target {
                            nav.sheet = .deleteChat(id)
                        }
                    }
                } else if mine {
                    row("MenuTrash", "Delete Post") {
                        if case .post(let id) = target {
                            nav.sheet = .deletePost(id, pop: true)
                        }
                    }
                } else {
                    row("MenuReport", "Report") { nav.sheet = .report }
                    row("MenuSad", "Add to Blacklist") {
                        nav.sheet = .block(personID, pop: true)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .background(
            Color.white
                .overlay(Rectangle().stroke(YoohooColor.yellow, lineWidth: 1).padding(.top, 70))
        )
    }

    private var personID: String {
        switch target {
        case .post(let id):
            return session.posts.first { $0.id == id }?.userID ?? id
        case .person(let id):
            return id
        case .chat(let id):
            return id
        }
    }

    private func row(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(icon).resizable().frame(width: 26, height: 26)
                Text(title).font(YoohooFont.heavy(16)).foregroundStyle(YoohooColor.ink)
                Spacer()
            }
            .padding(.horizontal, 8)
            .frame(height: 42)
            .background(RoundedRectangle(cornerRadius: 10).fill(.white).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1)))
        }
        .buttonStyle(PressDownStyle())
    }

}

struct ReportSheet: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var text = ""

    var body: some View {
        VStack(spacing: 16) {
            SnowSheetHeader(title: "Report") { nav.sheet = nil }
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
                    session.show("Reported.")
                }
            }
            .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        .background(
            Color.white
                .overlay(Rectangle().stroke(YoohooColor.yellow, lineWidth: 1).padding(.top, 70))
        )
    }
}

struct ConfirmSnowSheet: View {
    var title: String
    var message: String
    var confirm: () -> Void
    var close: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            SnowSheetHeader(title: title, close: close)
            Text(message)
                .font(YoohooFont.medium(14))
                .foregroundStyle(YoohooColor.ink)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
            SnowButton(title: "Confirm", enabled: true, action: confirm)
                .padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
        .background(Color.white)
    }
}
