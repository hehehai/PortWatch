import Foundation

struct PortRecord: Identifiable, Hashable, Sendable {
    let pid: Int
    let command: String
    let user: String
    let fd: String
    let type: String
    let device: String
    let sizeOff: String
    let node: String
    let endpoint: String
    let port: Int
    let protocolName: String
    let state: String
    let workingDirectory: String?
    let executablePath: String?
    let source: String?
    let startedAt: Date?
    let uptime: TimeInterval?
    let launchedBy: String?
    let launchChain: [String]

    var id: String {
        "\(pid):\(port):\(endpoint)"
    }

    var displayTitle: String {
        command.isEmpty ? endpoint : command
    }

    var displaySubtitle: String {
        source ?? workingDirectory ?? launchedBy ?? endpoint
    }

    func matches(_ query: String) -> Bool {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else {
            return true
        }

        let candidates: [String?] = [
            String(port),
            String(pid),
            command,
            user,
            endpoint,
            source,
            workingDirectory,
            executablePath,
            launchedBy,
            launchChain.joined(separator: " > "),
        ]

        return candidates
            .compactMap { $0?.lowercased() }
            .contains { $0.contains(normalized) }
    }
}
