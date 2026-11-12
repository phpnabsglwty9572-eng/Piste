import PhotosUI
import StoreKit
import SwiftUI

struct EditProfileView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var name = ""
    @State private var avatar: UIImage?
    @State private var cover: UIImage?
    @State private var frame = "AvatarFrame"
    @State private var pickingAvatar = false
    @State private var picker: PhotosPickerItem?

    private let frames = ["AvatarFrame", "FrameSnow", "FrameSki", "FrameSnowman", "FrameCable", "FrameTrophy"]

    private var ready: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && avatar != nil && cover != nil
    }

    var body: some View {
        SnowForm(title: "Edit Profile") {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    label("Avatar")
                    avatarBox
                    label("Background")
                    coverBox
                    label("Frame")
                    frameGrid
                    label("Name")
                    TextField("Your name", text: $name)
                        .font(YoohooFont.medium(14))
                        .onChange(of: name) { value in
                            if value.count > YoohooConfig.nameLimit {
                                name = String(value.prefix(YoohooConfig.nameLimit))
                            }
                        }
                        .padding(.horizontal, 8)
                        .frame(height: 36)
                        .background(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1))
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                SnowButton(title: ready ? "Create" : "Save", enabled: ready, action: save)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
        }
        .onAppear {
            name = session.meName.isEmpty ? "" : session.meName
            avatar = session.localAvatar
            cover = session.localCover
            frame = session.frameAsset
        }
        .onChange(of: picker) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    if pickingAvatar { avatar = image } else { cover = image }
                }
                picker = nil
            }
        }
    }

    private func label(_ title: String) -> some View {
        HStack(spacing: 2) {
            Image("ChatBell").resizable().scaledToFit().frame(width: 24, height: 24)
            Text(title).font(YoohooFont.title(16)).foregroundStyle(YoohooColor.ink)
        }
    }

    private var avatarBox: some View {
        PhotosPicker(selection: $picker, matching: .images) {
            ZStack {
                if let avatar {
                    Image(uiImage: avatar).resizable().scaledToFill()
                } else {
                    Circle().stroke(YoohooColor.blue, lineWidth: 1)
                    Image("EditUpload").resizable().frame(width: 25, height: 25)
                }
            }
            .frame(width: 111, height: 111)
            .clipShape(Circle())
        }
        .onTapGesture { pickingAvatar = true }
        .simultaneousGesture(TapGesture().onEnded { pickingAvatar = true })
    }

    private var coverBox: some View {
        PhotosPicker(selection: $picker, matching: .images) {
            ZStack {
                if let cover {
                    Image(uiImage: cover).resizable().scaledToFill()
                } else {
                    RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 1)
                    VStack(spacing: 4) {
                        Image("EditUpload").resizable().frame(width: 25, height: 25)
                        Text("Upload Photo").font(YoohooFont.medium(10)).foregroundStyle(YoohooColor.gray)
                    }
                }
            }
            .frame(width: 111, height: 130)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .simultaneousGesture(TapGesture().onEnded { pickingAvatar = false })
    }

    private var frameGrid: some View {
        let columns = [GridItem(.fixed(109), spacing: 8), GridItem(.fixed(109), spacing: 8), GridItem(.fixed(109), spacing: 8)]
        return LazyVGrid(columns: columns, spacing: 8) {
            ForEach(frames, id: \.self) { item in
                Button { frame = item } label: {
                    Image(item)
                        .resizable()
                        .scaledToFit()
                        .padding(12)
                        .frame(width: 109, height: 109)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(frame == item ? YoohooColor.pink : YoohooColor.gray, lineWidth: 1)
                        )
                }
                .buttonStyle(PressDownStyle())
            }
        }
    }

    private func save() {
        guard ready, !session.busy else { return }
        let chosen = String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(YoohooConfig.nameLimit))
        session.frameAsset = frame
        session.startLoading()
        Task {
            do {
                try await session.saveProfile(name: chosen, avatar: avatar, cover: cover)
                session.localAvatar = nil
                session.localCover = nil
                session.stopLoading()
                nav.pop()
            } catch {
                session.stopLoading()
                session.show(error.localizedDescription)
            }
        }
    }
}

struct CoinShopView: View {
    @EnvironmentObject private var nav: AppNavigator
    @EnvironmentObject private var session: YoohooSession
    @State private var selected = ""

    private var packs: [CoinPack] { CoinPack.catalog }

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    banner
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 13), GridItem(.flexible(), spacing: 13)], spacing: 32) {
                        ForEach(packs) { pack in
                            packCard(pack)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
        .onAppear {
            if selected.isEmpty { selected = packs.first?.id ?? "" }
        }
    }

    private var banner: some View {
        ZStack(alignment: .top) {
            Image("ShopBanner")
                .resizable()
                .scaledToFill()
                .frame(height: 190)
                .frame(maxWidth: .infinity)
                .clipped()
            VStack {
                HStack(spacing: 8) {
                    Button(action: nav.pop) {
                        Image("BackButton").resizable().frame(width: 34, height: 34)
                    }
                    .buttonStyle(PressDownStyle())
                    Text("Coin Shop")
                        .font(YoohooFont.title(20))
                        .foregroundStyle(YoohooColor.ink)
                    Spacer(minLength: 0)
                    HStack(spacing: 2) {
                        Image("CoinBadge").resizable().scaledToFit().frame(width: 24, height: 24)
                        Text("\(session.coins)")
                            .font(YoohooFont.heavy(14))
                            .foregroundStyle(YoohooColor.ink)
                        Image("CoinPlus").resizable().frame(width: 24, height: 24)
                    }
                    .frame(height: 28)
                    .padding(.horizontal, 2)
                    .background(RoundedRectangle(cornerRadius: 8).fill(.white))
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                Spacer()
            }
            VStack { Spacer(); SnowEdge() }
        }
        .frame(height: 190)
    }

    private func packCard(_ pack: CoinPack) -> some View {
        let picked = selected == pack.id
        return VStack(spacing: 0) {
            Image(pack.art)
                .resizable()
                .scaledToFit()
                .frame(width: 105, height: 90)
                .frame(maxWidth: .infinity)
            HStack(spacing: 2) {
                Image("CoinBadge").resizable().scaledToFit().frame(width: 14, height: 14)
                Text("\(pack.amount)").font(YoohooFont.heavy(14)).foregroundStyle(YoohooColor.ink)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .background(Color(red: 252 / 255, green: 219 / 255, blue: 1))
            Button {
                selected = pack.id
                buy(pack)
            } label: {
                Text(pack.price)
                    .font(YoohooFont.title(20))
                    .foregroundStyle(YoohooColor.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: 125, height: 32)
                    .background(RoundedRectangle(cornerRadius: 10).fill(YoohooColor.yellow).overlay(RoundedRectangle(cornerRadius: 10).stroke(YoohooColor.blue, lineWidth: 2)))
            }
            .buttonStyle(PressDownStyle())
            .padding(.bottom, 6)
        }
        .frame(height: 150)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(.white)
                .overlay(Image("ShopCard").resizable().scaledToFill().clipShape(RoundedRectangle(cornerRadius: 10)))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(picked ? YoohooColor.pink : YoohooColor.ice, lineWidth: 2))
                .shadow(color: picked ? Color(red: 205 / 255, green: 0, blue: 143 / 255) : Color(red: 72 / 255, green: 96 / 255, blue: 1), radius: 0, y: 4)
        )
        .onTapGesture { selected = pack.id }
    }

    private func buy(_ pack: CoinPack) {
        guard !session.busy, pack.id.isEmpty == false else { return }
        selected = pack.id
        session.startLoading()
        Task {
            do {
                let products = try await Product.products(for: [pack.id])
                guard let product = products.first else {
                    session.stopLoading()
                    session.show(pack.id)
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try verification.payloadValue
                    let gems = try await YoohooBackend.credit(transaction: String(transaction.id), product: pack.id)
                    await transaction.finish()
                    session.coins = gems
                    session.stopLoading()
                    session.show("Purchased.")
                case .userCancelled:
                    session.stopLoading()
                case .pending:
                    session.stopLoading()
                    session.show("Purchase is pending.")
                @unknown default:
                    session.stopLoading()
                }
            } catch {
                session.stopLoading()
                session.show(error.localizedDescription)
            }
        }
    }
}
