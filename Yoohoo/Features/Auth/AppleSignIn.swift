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
    static func request() async throws -> Credential {
        let nonce = randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        return try await withCheckedThrowingContinuation { continuation in
            let coordinator = Coordinator(continuation: continuation, nonce: nonce)
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
    var controller: ASAuthorizationController?
    private var resumed = false

    init(continuation: CheckedContinuation<AppleSignIn.Credential, Error>, nonce: String) {
        self.continuation = continuation
        self.nonce = nonce
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? ASPresentationAnchor()
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
