import Foundation

struct HotPaths {
    var rnIndex: URL
    var h5Index: URL
    var version: Int
}

enum HotUpdateService {
    private static let versionKey = "yoohoo.hot.version"
    private static let rootName = "yoohoo-hot"

    static func prepare() async -> HotPaths {
        let bundled = bundledPaths()
        guard YoohooConfig.backendReady else { return bundled }
        do {
            guard let release = try await YoohooBackend.latestHotRelease() else { return bundled }
            if release.version <= storedVersion, let disk = diskPaths(version: release.version) {
                return disk
            }
            let folder = try await download(release)
            UserDefaults.standard.set(release.version, forKey: versionKey)
            return folder
        } catch {
            return diskPaths(version: storedVersion) ?? bundled
        }
    }

    private static var storedVersion: Int {
        UserDefaults.standard.integer(forKey: versionKey)
    }

    private static func bundledPaths() -> HotPaths {
        HotPaths(
            rnIndex: bundledIndex(folder: "BundledRN"),
            h5Index: bundledIndex(folder: "BundledH5"),
            version: 0
        )
    }

    private static func bundledIndex(folder: String) -> URL {
        let names = ["Hybrid/\(folder)", folder]
        for name in names {
            if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: name),
               FileManager.default.fileExists(atPath: url.path) {
                return url
            }
            let loose = Bundle.main.bundleURL.appendingPathComponent("\(name)/index.html")
            if FileManager.default.fileExists(atPath: loose.path) {
                return loose
            }
        }
        return Bundle.main.bundleURL.appendingPathComponent("\(folder)/index.html")
    }

    private static func diskRoot(_ version: Int) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(rootName, isDirectory: true)
            .appendingPathComponent("\(version)", isDirectory: true)
    }

    private static func diskPaths(version: Int) -> HotPaths? {
        guard version > 0 else { return nil }
        let root = diskRoot(version)
        let rn = root.appendingPathComponent("rn/index.html")
        let h5 = root.appendingPathComponent("h5/index.html")
        guard FileManager.default.fileExists(atPath: rn.path), FileManager.default.fileExists(atPath: h5.path) else {
            return nil
        }
        return HotPaths(rnIndex: rn, h5Index: h5, version: version)
    }

    private static func download(_ release: HotReleaseRow) async throws -> HotPaths {
        let root = diskRoot(release.version)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("rn"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appendingPathComponent("h5"), withIntermediateDirectories: true)
        try await pullFolder(release.rnURL, into: root.appendingPathComponent("rn"), fallback: "BundledRN")
        try await pullFolder(release.h5URL, into: root.appendingPathComponent("h5"), fallback: "BundledH5")
        guard let paths = diskPaths(version: release.version) else {
            return bundledPaths()
        }
        return paths
    }

    private static func pullFolder(_ base: String?, into folder: URL, fallback: String) async throws {
        guard let base, let manifestURL = URL(string: base.hasSuffix("/") ? base + "manifest.json" : base + "/manifest.json") else {
            copyBundle(fallback, to: folder)
            return
        }
        let (data, response) = try await URLSession.shared.data(from: manifestURL)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let files = manifest["files"] as? [String]
        else {
            copyBundle(fallback, to: folder)
            return
        }
        let root = base.hasSuffix("/") ? base : base + "/"
        for file in files {
            guard let url = URL(string: root + file) else { continue }
            let (fileData, fileResponse) = try await URLSession.shared.data(from: url)
            guard let fileHTTP = fileResponse as? HTTPURLResponse, fileHTTP.statusCode == 200 else { continue }
            let dest = folder.appendingPathComponent(file)
            try FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fileData.write(to: dest, options: .atomic)
        }
    }

    private static func copyBundle(_ subdirectory: String, to folder: URL) {
        let candidates = [
            Bundle.main.url(forResource: subdirectory, withExtension: nil),
            Bundle.main.resourceURL?.appendingPathComponent("Hybrid/\(subdirectory)"),
            Bundle.main.resourceURL?.appendingPathComponent(subdirectory),
            Bundle.main.bundleURL.appendingPathComponent("Hybrid/\(subdirectory)"),
            Bundle.main.bundleURL.appendingPathComponent(subdirectory)
        ]
        guard let source = candidates.compactMap({ $0 }).first(where: { FileManager.default.fileExists(atPath: $0.path) }) else { return }
        let fm = FileManager.default
        if let items = fm.enumerator(at: source, includingPropertiesForKeys: nil) {
            for case let file as URL in items {
                var isDir: ObjCBool = false
                fm.fileExists(atPath: file.path, isDirectory: &isDir)
                if isDir.boolValue { continue }
                let relative = file.path.replacingOccurrences(of: source.path + "/", with: "")
                let dest = folder.appendingPathComponent(relative)
                try? fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
                try? fm.removeItem(at: dest)
                try? fm.copyItem(at: file, to: dest)
            }
        }
    }
}
