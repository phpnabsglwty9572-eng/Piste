import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

enum AppleSignInError: LocalizedError, Equatable {
    case cancelled
    case missingToken

    var errorDescription: String? {
        switch self {
        case .cancelled: return nil
        case .missingToken: return "Apple did not return a sign-in token."
        }
    }
}

enum AppleSignIn {
    struct Credential {
        var userID: String
        var fullName: String?
        var identityToken: String
        var nonce: String
    }

    @MainActor
    static func request(anchor: ASPresentationAnchor? = nil) async throws -> Credential {
        let nonce = randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        return try await withCheckedThrowingContinuation { continuation in
            let coordinator = Coordinator(continuation: continuation, nonce: nonce, anchor: anchor)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            coordinator.controller = controller
            controller.delegate = coordinator
            controller.presentationContextProvider = coordinator
            active[coordinator.id] = coordinator
            controller.performRequests()
        }
    }

    fileprivate static var active: [UUID: Coordinator] = [:]

    private static func randomNonce(length: Int = 32) -> String {
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { return UUID().uuidString }
        return String(bytes.map { characters[Int($0) % characters.count] })
    }

    fileprivate static func personName(_ components: PersonNameComponents?) -> String? {
        guard let components else { return nil }
        let formatted = PersonNameComponentsFormatter().string(from: components)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !formatted.isEmpty { return formatted }
        let joined = [components.givenName, components.middleName, components.familyName, components.nickname]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        return joined.isEmpty ? nil : joined
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private final class Coordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    let id = UUID()
    let continuation: CheckedContinuation<AppleSignIn.Credential, Error>
    let nonce: String
    weak var anchor: ASPresentationAnchor?
    var controller: ASAuthorizationController?
    private var resumed = false

    init(continuation: CheckedContinuation<AppleSignIn.Credential, Error>, nonce: String, anchor: ASPresentationAnchor?) {
        self.continuation = continuation
        self.nonce = nonce
        self.anchor = anchor
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let anchor, !anchor.isHidden, anchor.bounds.width > 1, anchor.bounds.height > 1 {
            return anchor
        }
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .sorted { lhs, rhs in
                let rank: (UIScene.ActivationState) -> Int = {
                    switch $0 {
                    case .foregroundActive: return 0
                    case .foregroundInactive: return 1
                    default: return 2
                    }
                }
                return rank(lhs.activationState) < rank(rhs.activationState)
            }
            .flatMap(\.windows)
            .filter { !$0.isHidden && $0.alpha > 0 && $0.bounds.width > 1 && $0.bounds.height > 1 }
        return windows.first(where: \.isKeyWindow) ?? windows.first ?? UIWindow()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard !resumed else { return }
        resumed = true
        AppleSignIn.active[id] = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            continuation.resume(throwing: AppleSignInError.missingToken)
            return
        }
        continuation.resume(returning: AppleSignIn.Credential(
            userID: credential.user,
            fullName: AppleSignIn.personName(credential.fullName),
            identityToken: token,
            nonce: nonce
        ))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard !resumed else { return }
        resumed = true
        AppleSignIn.active[id] = nil
        if let auth = error as? ASAuthorizationError, auth.code == .canceled {
            continuation.resume(throwing: AppleSignInError.cancelled)
        } else {
            continuation.resume(throwing: error)
        }
    }
}
