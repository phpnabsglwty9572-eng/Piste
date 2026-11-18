import AVFoundation
import PhotosUI
import SafariServices
import StoreKit
import SwiftUI
import UniformTypeIdentifiers
import UIKit
import WebKit

struct HybridHostView: UIViewControllerRepresentable {
    @EnvironmentObject var session: YoohooSession
    @EnvironmentObject var nav: AppNavigator

    func makeUIViewController(context: Context) -> HybridViewController {
        let controller = HybridViewController()
        controller.session = session
        controller.nav = nav
        return controller
    }

    func updateUIViewController(_ controller: HybridViewController, context: Context) {
        controller.session = session
        controller.nav = nav
    }
}

final class HybridViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, PHPickerViewControllerDelegate, UIGestureRecognizerDelegate {
    weak var session: YoohooSession?
    weak var nav: AppNavigator?
    private var rnView: WKWebView!
    private var h5View: WKWebView?
    private var paths: HotPaths?
    private var pendingPick: (max: Int, video: Bool, id: String)?
    private var pickedBlobs: [String: Data] = [:]
    private var pickSerial = 0
    private let ringer = CallRinger()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 130 / 255, green: 196 / 255, blue: 249 / 255, alpha: 1)
        rnView = makeWebView(name: "rn")
        view.addSubview(rnView)
        rnView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            rnView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            rnView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            rnView.topAnchor.constraint(equalTo: view.topAnchor),
            rnView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        let edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(onEdge(_:)))
        edge.edges = .left
        edge.delegate = self
        view.addGestureRecognizer(edge)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardFrame(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardFrame(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        Task { await boot() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { [weak self] in
            Task { @MainActor in
                self?.session?.h5Ready = true
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        rnView?.configuration.userContentController.removeScriptMessageHandler(forName: "yoohoo")
        h5View?.configuration.userContentController.removeScriptMessageHandler(forName: "yoohoo")
    }

    private func boot() async {
        let prepared = await HotUpdateService.prepare()
        paths = prepared
        await MainActor.run {
            let script = WKUserScript(source: bootstrapJS(), injectionTime: .atDocumentStart, forMainFrameOnly: true)
            rnView.configuration.userContentController.addUserScript(script)
            rnView.loadFileURL(prepared.rnIndex, allowingReadAccessTo: prepared.rnIndex.deletingLastPathComponent())
        }
    }

    private func makeWebView(name: String) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "yoohoo")
        config.userContentController.addUserScript(WKUserScript(source: bootstrapJS(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.scrollView.bounces = false
        web.scrollView.keyboardDismissMode = .interactive
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        web.backgroundColor = .clear
        web.accessibilityIdentifier = name
        if #available(iOS 16.4, *) {
            web.isInspectable = true
        }
        return web
    }

    private func bootstrapJS() -> String {
        let packs = CoinPack.catalog.map { pack in
            ["id": pack.id, "amount": NSNumber(value: pack.amount), "price": pack.price] as [String: Any]
        }
        let body: [String: Any] = [
            "supabaseURL": YoohooConfig.supabaseURL,
            "supabaseKey": YoohooConfig.supabaseKey,
            "packs": packs,
            "eulaAccepted": session?.acceptedEULA ?? false,
            "nameLimit": NSNumber(value: YoohooConfig.nameLimit),
            "termsURL": YoohooConfig.termsURL?.absoluteString ?? "",
            "privacyURL": YoohooConfig.privacyURL?.absoluteString ?? "",
            "h5URL": paths?.h5Index.absoluteString ?? "",
            "hotVersion": NSNumber(value: paths?.version ?? 0),
            "startRoute": UserDefaults.standard.string(forKey: "yoohoo.debug.route") ?? ""
        ]
        let data = (try? JSONSerialization.data(withJSONObject: body)) ?? Data("{}".utf8)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        return """
        window.__YOOHOO__ = \(json);
        window.YoohooNative = {
          post: function(msg) {
            window.webkit.messageHandlers.yoohoo.postMessage(msg);
          }
        };
        """
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        let id = body["id"] as? String ?? ""
        Task { await handle(type: type, id: id, payload: body["payload"] as? [String: Any] ?? [:]) }
    }

    @MainActor
    private func handle(type: String, id: String, payload: [String: Any]) async {
        switch type {
        case "ready":
            await pushSession()
            reply(id, ["ok": true])
        case "settled":
            session?.h5Ready = true
            reply(id, ["ok": true])
        case "mountH5":
            mountH5()
        case "ensureEULA":
            ensureEULA { [weak self] in
                self?.reply(id, ["ok": true])
            }
        case "appleSignIn":
            await apple(id)
        case "setSession":
            let access = payload["accessToken"] as? String ?? ""
            let refresh = payload["refreshToken"] as? String ?? ""
            if access.isEmpty == false, refresh.isEmpty == false {
                try? await YoohooBackend.applySession(access: access, refresh: refresh)
                await session?.restore()
            }
            reply(id, ["ok": true])
        case "signOut":
            await session?.signOut()
            await pushSession()
            reply(id, ["ok": true])
        case "buy":
            await buy(id, product: payload["productId"] as? String ?? "")
        case "pickMedia":
            pick(id: id, max: payload["max"] as? Int ?? 1, video: payload["video"] as? Bool ?? false)
        case "uploadMedia":
            await uploadPicked(id: id, pick: payload["pick"] as? String ?? "", path: payload["path"] as? String ?? "")
        case "openLegal":
            openLegal(payload["kind"] as? String ?? "terms")
            reply(id, ["ok": true])
        case "toast":
            session?.show(payload["text"] as? String ?? "")
            reply(id, ["ok": true])
        case "wait":
            if payload["on"] as? Bool == true {
                session?.startLoading(blocksInput: payload["block"] as? Bool ?? true)
            } else {
                session?.stopLoading()
            }
            reply(id, ["ok": true])
        case "eulaText":
            reply(id, ["text": eulaText()])
        case "haptic":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            reply(id, ["ok": true])
        case "ring":
            if payload["on"] as? Bool == true { ringer.start() } else { ringer.stop() }
            reply(id, ["ok": true])
        default:
            reply(id, ["ok": false])
        }
    }

    private func mountH5() {
        guard h5View == nil, let h5 = paths?.h5Index else { return }
        let web = makeWebView(name: "h5")
        h5View = web
        view.addSubview(web)
        web.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        web.loadFileURL(h5, allowingReadAccessTo: h5.deletingLastPathComponent())
    }

    private func apple(_ id: String) async {
        ensureEULA { [weak self] in
            Task { await self?.runApple(id) }
        }
    }

    private func runApple(_ id: String) async {
        do {
            let credential = try await AppleSignIn.request()
            session?.startLoading()
            try await session?.signInWithApple(
                token: credential.identityToken,
                nonce: credential.nonce,
                userID: credential.userID,
                fullName: credential.fullName
            )
            session?.stopLoading()
            await pushSession()
            reply(id, ["ok": true])
        } catch let error as AppleSignInError where error == .cancelled {
            session?.stopLoading()
            reply(id, ["ok": false, "cancelled": true])
        } catch {
            session?.stopLoading()
            session?.show(error.localizedDescription)
            reply(id, ["ok": false, "error": error.localizedDescription])
        }
    }

    private func buy(_ id: String, product: String) async {
        guard product.isEmpty == false else {
            reply(id, ["ok": false])
            return
        }
        session?.startLoading()
        do {
            let products = try await Product.products(for: [product])
            session?.stopLoading()
            guard let item = products.first else {
                session?.show(product)
                reply(id, ["ok": false, "error": product])
                return
            }
            session?.startLoading(blocksInput: false)
            let result = try await item.purchase()
            switch result {
            case .success(let verification):
                let transaction = try verification.payloadValue
                let gems = try await YoohooBackend.credit(transaction: String(transaction.id), product: product)
                await transaction.finish()
                session?.coins = gems
                session?.stopLoading()
                session?.show("Purchased.")
                await pushSession()
                reply(id, ["ok": true, "gems": NSNumber(value: gems)])
            case .userCancelled:
                session?.stopLoading()
                reply(id, ["ok": false, "cancelled": true])
            case .pending:
                session?.stopLoading()
                session?.show("Purchase is pending.")
                reply(id, ["ok": false, "pending": true])
            @unknown default:
                session?.stopLoading()
                reply(id, ["ok": false])
            }
        } catch {
            session?.stopLoading()
            session?.show(error.localizedDescription)
            reply(id, ["ok": false, "error": error.localizedDescription])
        }
    }

    private func pick(id: String, max: Int, video: Bool) {
        pendingPick = (max, video, id)
        var config = PHPickerConfiguration(photoLibrary: .shared())
        config.selectionLimit = max
        config.filter = video ? .videos : .images
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        let request = pendingPick
        pendingPick = nil
        guard let request else { return }
        Task {
            var items: [[String: String]] = []
            for result in results.prefix(request.max) {
                if request.video {
                    if let url = try? await loadFile(result, type: UTType.movie.identifier) {
                        items.append(["uri": url.absoluteString, "mime": "video/mp4"])
                    }
                } else if let data = try? await loadData(result) {
                    pickSerial += 1
                    let pickID = "pick-\(pickSerial)"
                    pickedBlobs[pickID] = data
                    if pickedBlobs.count > 12, let oldest = pickedBlobs.keys.sorted().first {
                        pickedBlobs.removeValue(forKey: oldest)
                    }
                    let preview = UIImage(data: data).flatMap { jpegLimited($0, maxSide: 480, quality: 0.62) } ?? data
                    items.append([
                        "id": pickID,
                        "uri": "data:image/jpeg;base64,\(preview.base64EncodedString())",
                        "mime": "image/jpeg"
                    ])
                }
            }
            if results.isEmpty == false && items.isEmpty {
                reply(request.id, ["items": items, "message": "Could not read that photo."])
            } else {
                reply(request.id, ["items": items])
            }
        }
    }

    private func loadData(_ result: PHPickerResult) async throws -> Data {
        let provider = result.itemProvider
        let type = UTType.image.identifier
        let raw: Data = try await withCheckedThrowingContinuation { continuation in
            if provider.hasItemConformingToTypeIdentifier(type) {
                provider.loadDataRepresentation(forTypeIdentifier: type) { data, error in
                    if let data {
                        continuation.resume(returning: data)
                    } else {
                        continuation.resume(throwing: error ?? URLError(.cannotDecodeContentData))
                    }
                }
            } else {
                provider.loadObject(ofClass: UIImage.self) { object, error in
                    if let image = object as? UIImage, let data = image.jpegData(compressionQuality: 0.82) {
                        continuation.resume(returning: data)
                    } else {
                        continuation.resume(throwing: error ?? URLError(.cannotDecodeContentData))
                    }
                }
            }
        }
        guard let image = UIImage(data: raw) else { throw URLError(.cannotDecodeContentData) }
        return jpegLimited(image, maxSide: 1280, quality: 0.74)
    }

    private func jpegLimited(_ image: UIImage, maxSide: CGFloat, quality: CGFloat) -> Data {
        let size = image.size
        let longest = max(size.width, size.height)
        let scale = longest > maxSide ? maxSide / longest : 1
        let target = CGSize(width: max(1, floor(size.width * scale)), height: max(1, floor(size.height * scale)))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return rendered.jpegData(compressionQuality: quality) ?? Data()
    }

    private func uploadPicked(id: String, pick: String, path: String) async {
        guard let data = pickedBlobs[pick], data.isEmpty == false else {
            reply(id, ["ok": false, "message": "Choose a photo again."])
            return
        }
        guard let token = await YoohooBackend.accessToken(),
              let uid = YoohooBackend.userID?.uuidString.lowercased(),
              path.hasPrefix(uid + "/"),
              let endpoint = URL(string: YoohooConfig.supabaseURL + "/storage/v1/object/media/" + path)
        else {
            reply(id, ["ok": false, "message": "Could not upload the photo."])
            return
        }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue(YoohooConfig.supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        request.setValue("true", forHTTPHeaderField: "x-upsert")
        request.httpBody = data
        do {
            let (body, response) = try await URLSession.shared.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(code) else {
                let text = String(data: body, encoding: .utf8) ?? "Could not upload the photo."
                reply(id, ["ok": false, "message": text])
                return
            }
            reply(id, ["ok": true, "url": YoohooConfig.supabaseURL + "/storage/v1/object/public/media/" + path])
        } catch {
            reply(id, ["ok": false, "message": error.localizedDescription])
        }
    }

    private func loadFile(_ result: PHPickerResult, type: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
                guard let url else {
                    continuation.resume(throwing: error ?? URLError(.cannotOpenFile))
                    return
                }
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
                do {
                    try FileManager.default.copyItem(at: url, to: dest)
                    continuation.resume(returning: dest)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func openLegal(_ kind: String) {
        let url = kind == "privacy" ? YoohooConfig.privacyURL : YoohooConfig.termsURL
        guard let url else { return }
        present(SFSafariViewController(url: url), animated: true)
    }

    private func ensureEULA(_ next: @escaping () -> Void) {
        if session?.acceptedEULA == true {
            next()
            return
        }
        EULAGate.shared.next = next
        nav?.sheet = .eula
    }

    private func eulaText() -> String {
        guard let url = Bundle.main.url(forResource: "EULA", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8)
        else { return "" }
        return text
    }

    private func pushSession() async {
        var payload: [String: Any] = [
            "signedIn": session?.signedIn ?? false,
            "meID": session?.meID ?? "",
            "meName": session?.meName ?? "",
            "meHandle": session?.meHandle ?? "",
            "coins": NSNumber(value: session?.coins ?? 0),
            "eulaAccepted": session?.acceptedEULA ?? false,
            "hotVersion": NSNumber(value: paths?.version ?? 0),
            "h5URL": paths?.h5Index.absoluteString ?? ""
        ]
        if let access = await YoohooBackend.accessToken() { payload["accessToken"] = access }
        if let refresh = await YoohooBackend.refreshToken() { payload["refreshToken"] = refresh }
        emit("session", payload)
    }

    private func reply(_ id: String, _ payload: [String: Any]) {
        guard id.isEmpty == false else { return }
        emit("reply", ["id": id, "payload": payload])
    }

    private func emit(_ type: String, _ payload: [String: Any]) {
        let body: [String: Any] = ["type": type, "payload": payload]
        guard JSONSerialization.isValidJSONObject(body),
              let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8)
        else { return }
        let script = "window.dispatchEvent(new MessageEvent('yoohoo-native',{data:\(json)}));"
        rnView.evaluateJavaScript(script, completionHandler: nil)
        h5View?.evaluateJavaScript(script, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === h5View,
              let route = UserDefaults.standard.string(forKey: "yoohoo.debug.route"),
              route.isEmpty == false
        else { return }
        let escaped = route.replacingOccurrences(of: "'", with: "\\'")
        webView.evaluateJavaScript("window.goTo && window.goTo('\(escaped)')", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme ?? ""), webView == h5View {
            if url.host?.contains("supabase") == true || url.isFileURL {
                decisionHandler(.allow)
                return
            }
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    @objc private func onEdge(_ gesture: UIScreenEdgePanGestureRecognizer) {
        guard gesture.state == .ended else { return }
        let translation = gesture.translation(in: view).x
        let velocity = gesture.velocity(in: view).x
        if translation > 48 || velocity > 480 {
            emit("back", [:])
        }
    }

    @objc private func keyboardFrame(_ note: Notification) {
        let frame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect) ?? .zero
        let local = view.convert(frame, from: nil)
        let height = note.name == UIResponder.keyboardWillHideNotification ? 0 : max(0, view.bounds.maxY - local.minY)
        emit("keyboard", ["height": NSNumber(value: height)])
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        true
    }
}

final class CallRinger {
    private var player: AVAudioPlayer?
    private var timer: Timer?

    func start() {
        stop()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        beep()
        timer = Timer.scheduledTimer(withTimeInterval: 2.6, repeats: true) { [weak self] _ in
            self?.beep()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        player?.stop()
        player = nil
    }

    private func beep() {
        guard let data = Self.tone() else { return }
        player = try? AVAudioPlayer(data: data)
        player?.volume = 1
        player?.play()
    }

    private static func tone() -> Data? {
        let sampleRate = 22050
        let duration = 1.05
        let count = Int(Double(sampleRate) * duration)
        var data = Data()
        var header = Data()
        func append(_ value: UInt32) {
            var v = value.littleEndian
            header.append(Data(bytes: &v, count: 4))
        }
        header.append(contentsOf: Array("RIFF".utf8))
        append(UInt32(36 + count * 2))
        header.append(contentsOf: Array("WAVEfmt ".utf8))
        append(16)
        header.append(contentsOf: [1, 0, 1, 0])
        append(UInt32(sampleRate))
        append(UInt32(sampleRate * 2))
        header.append(contentsOf: [2, 0, 16, 0])
        header.append(contentsOf: Array("data".utf8))
        append(UInt32(count * 2))
        data.append(header)
        for i in 0..<count {
            let t = Double(i) / Double(sampleRate)
            let on = t < 0.42 || (t >= 0.62 && t < 1.04)
            let local = t < 0.42 ? t : t - 0.62
            let remain = t < 0.42 ? 0.42 - t : 1.04 - t
            let env = on ? min(1.0, min(local / 0.02, remain / 0.03)) : 0
            let sample = (sin(2.0 * Double.pi * 440.0 * t) + sin(2.0 * Double.pi * 480.0 * t)) * 0.45 * env
            var pcm = Int16(max(-1.0, min(1.0, sample)) * 32000).littleEndian
            data.append(Data(bytes: &pcm, count: 2))
        }
        return data
    }
}
